import { ActivityType, RESTJSONErrorCodes } from 'discord.js';
import { getServer, getSettings, listServers, saveServerState, setStatusMessage } from '../database.js';
import { buildServerEmbed, buildStatusChangeEmbed } from '../utils/embeds.js';
import { resolveTextChannel } from '../utils/channels.js';
import { logger } from '../utils/logger.js';
import { fetchServer, getGameInfo } from './gamemonitoring.js';

const DELAY_BETWEEN_REQUESTS_MS = 1_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Loop berkala yang mengecek semua server terdaftar di GameMonitoring,
 * memperbarui embed status, dan mengirim notifikasi saat status berubah.
 */
export class ServerMonitor {
  /**
   * @param {import('discord.js').Client} client
   * @param {{ guildId: string, intervalMs: number }} options
   */
  constructor(client, { guildId, intervalMs }) {
    this.client = client;
    this.guildId = guildId;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.running = false;
    this.pending = false;
  }

  start() {
    if (this.timer) return;
    logger.info(`Monitor dimulai, interval ${this.intervalMs / 1000} detik.`);
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  /** Jalankan pengecekan segera (misalnya setelah /server add atau /config diubah). */
  refreshNow() {
    void this.tick();
  }

  async tick() {
    // Jika siklus sedang berjalan, tandai agar langsung diulang setelah selesai.
    if (this.running) {
      this.pending = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.pending = false;
        await this.runCycle();
      } while (this.pending);
    } catch (error) {
      logger.error('Siklus monitor gagal:', error);
    } finally {
      this.running = false;
    }
  }

  async runCycle() {
    const servers = listServers(this.guildId);
    const settings = getSettings(this.guildId);
    const [statusChannel, notifyChannel] = await Promise.all([
      resolveTextChannel(this.client, settings.status_channel_id),
      resolveTextChannel(this.client, settings.notify_channel_id),
    ]);

    let online = 0;
    for (const [index, entry] of servers.entries()) {
      if (index > 0) await sleep(DELAY_BETWEEN_REQUESTS_MS);
      const isOnline = await this.checkServer(entry, { statusChannel, notifyChannel, settings });
      if (isOnline) online += 1;
    }

    this.updatePresence(online, servers.length);
  }

  /** @returns {Promise<boolean>} true jika server online. */
  async checkServer(entry, { statusChannel, notifyChannel, settings }) {
    let server;
    try {
      server = await fetchServer(entry.gm_id);
    } catch (error) {
      // Gangguan API/jaringan tidak dianggap sebagai server offline.
      logger.warn(`Gagal cek server #${entry.gm_id}: ${error.message}`);
      return entry.last_status === 1;
    }

    const online = Boolean(server.status);
    const previous = entry.last_status;

    saveServerState(this.guildId, entry.gm_id, {
      online,
      players: server.numplayers,
      maxPlayers: server.maxplayers,
      name: server.name,
      game: getGameInfo(server)?.short ?? server.app?.name ?? null,
    });

    if (statusChannel) {
      await this.upsertStatusMessage(entry, server, statusChannel);
    }

    const changed = previous !== null && previous !== undefined && Boolean(previous) !== online;
    if (changed) {
      logger.info(`Server #${entry.gm_id} sekarang ${online ? 'ONLINE' : 'OFFLINE'}.`);
      if (notifyChannel) await this.sendNotification(entry, server, notifyChannel, settings);
    }

    return online;
  }

  async upsertStatusMessage(entry, server, channel) {
    const payload = { embeds: [buildServerEmbed(server, { label: entry.label })] };

    if (entry.status_message_id) {
      try {
        await channel.messages.edit(entry.status_message_id, payload);
        return;
      } catch (error) {
        if (error.code !== RESTJSONErrorCodes.UnknownMessage) {
          logger.warn(`Gagal edit embed server #${entry.gm_id}: ${error.message}`);
          return;
        }
        // Pesan lama sudah dihapus: kirim yang baru di bawah.
      }
    }

    // Server bisa saja dihapus lewat /server remove saat siklus ini berjalan.
    if (!getServer(this.guildId, entry.gm_id)) return;

    try {
      const message = await channel.send(payload);
      setStatusMessage(this.guildId, entry.gm_id, message.id);
    } catch (error) {
      logger.warn(`Gagal kirim embed server #${entry.gm_id}: ${error.message}`);
    }
  }

  async sendNotification(entry, server, channel, settings) {
    const roleId = settings.notify_role_id;
    try {
      await channel.send({
        content: roleId ? `<@&${roleId}>` : undefined,
        embeds: [buildStatusChangeEmbed(server, { label: entry.label })],
        allowedMentions: { roles: roleId ? [roleId] : [] },
      });
    } catch (error) {
      logger.warn(`Gagal kirim notifikasi server #${entry.gm_id}: ${error.message}`);
    }
  }

  updatePresence(online, total) {
    const name = total === 0 ? 'server ETS2 & ATS' : `${online}/${total} server online`;
    this.client.user?.setActivity({ name, type: ActivityType.Watching });
  }
}
