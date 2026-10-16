import { EmbedBuilder } from 'discord.js';
import { getGameInfo, getSessionId, serverPageUrl } from '../services/gamemonitoring.js';

export const COLORS = Object.freeze({
  online: 0x3ddc84,
  offline: 0xe5484d,
  unknown: 0x8b949e,
  brand: 0xf5a524,
});

const MAX_PLAYER_LINES = 20;

export function truncate(text, max) {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function unix(seconds) {
  return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : null;
}

function gameLabel(server) {
  const game = getGameInfo(server);
  if (game) return `${game.emoji} ${game.short}`;
  return server.app?.name ?? 'Tidak diketahui';
}

function formatPlayers(players) {
  const names = players
    .map((player) => player?.name ?? player?.nickname)
    .filter((name) => typeof name === 'string' && name.trim().length > 0);
  if (names.length === 0) return null;

  const shown = names.slice(0, MAX_PLAYER_LINES).map((name) => `• ${truncate(name, 40)}`);
  if (names.length > MAX_PLAYER_LINES) shown.push(`…dan ${names.length - MAX_PLAYER_LINES} lainnya`);
  return truncate(shown.join('\n'), 1024);
}

/**
 * Embed detail sebuah server.
 * @param {object} server Data dari GameMonitoring /servers/{id}
 * @param {{ label?: string|null, players?: object[]|null }} [options]
 */
export function buildServerEmbed(server, { label = null, players = null } = {}) {
  const online = Boolean(server.status);
  const title = label || server.name || `Server #${server.id}`;

  const descriptionLines = [online ? '🟢 **Online**' : '🔴 **Offline**'];
  if (label && server.name) descriptionLines.push(`-# ${truncate(server.name, 200)}`);

  const embed = new EmbedBuilder()
    .setColor(online ? COLORS.online : COLORS.offline)
    .setTitle(truncate(title, 256))
    .setURL(serverPageUrl(server))
    .setDescription(descriptionLines.join('\n'))
    .addFields(
      { name: 'Game', value: gameLabel(server), inline: true },
      { name: 'Pemain', value: `**${server.numplayers ?? 0}** / ${server.maxplayers ?? 0}`, inline: true },
      { name: 'Map', value: truncate(server.map || '-', 1024), inline: true },
    )
    .setFooter({ text: `GameMonitoring #${server.id} • Kirana` })
    .setTimestamp(new Date());

  // ETS2/ATS tidak bisa connect via IP; pemain mencari server dengan Session ID di convoy.
  const sessionId = getSessionId(server);
  if (sessionId) {
    embed.addFields({ name: 'Session ID', value: `\`${sessionId}\``, inline: true });
  } else if (!server.hide_address && server.connect) {
    embed.addFields({ name: 'Alamat', value: `\`${server.connect}\``, inline: true });
  }
  if (server.version) {
    embed.addFields({ name: 'Versi', value: truncate(server.version, 1024), inline: true });
  }

  const lastSeen = unix(online ? server.last_offline : server.last_online);
  if (lastSeen) {
    embed.addFields({
      name: online ? 'Terakhir offline' : 'Terakhir online',
      value: `<t:${lastSeen}:R>`,
      inline: true,
    });
  }

  if (players) {
    embed.addFields({
      name: `Daftar pemain (${players.length})`,
      value: formatPlayers(players) ?? '-# Daftar pemain tidak tersedia.',
    });
  }

  const lastUpdate = unix(server.last_update);
  if (lastUpdate) {
    embed.addFields({ name: '\u200b', value: `-# Data GameMonitoring diperbarui <t:${lastUpdate}:R>` });
  }

  return embed;
}

/** Embed notifikasi saat status server berubah. */
export function buildStatusChangeEmbed(server, { label = null } = {}) {
  const online = Boolean(server.status);
  const name = label || server.name || `Server #${server.id}`;

  const embed = new EmbedBuilder()
    .setColor(online ? COLORS.online : COLORS.offline)
    .setAuthor({ name: online ? '🟢 Server kembali online' : '🔴 Server offline' })
    .setTitle(truncate(name, 256))
    .setURL(serverPageUrl(server))
    .setFooter({ text: `${gameLabel(server)} • GameMonitoring #${server.id}` })
    .setTimestamp(new Date());

  if (online) {
    const sessionId = getSessionId(server);
    const lines = [`Pemain saat ini: **${server.numplayers ?? 0}** / ${server.maxplayers ?? 0}`];
    if (sessionId) lines.push(`Session ID: \`${sessionId}\``);
    embed.setDescription(lines.join('\n'));
  } else {
    embed.setDescription('Server tidak merespons di GameMonitoring.');
  }
  return embed;
}

/** Ringkasan semua server terdaftar (dipakai /status tanpa ID dan /server list). */
export function buildSummaryEmbed(entries, { title = 'Status Server Nismara Transport' } = {}) {
  const embed = new EmbedBuilder().setColor(COLORS.brand).setTitle(title).setTimestamp(new Date());

  if (entries.length === 0) {
    return embed.setDescription('Belum ada server yang didaftarkan. Gunakan `/server add` untuk menambahkan.');
  }

  const online = entries.filter((entry) => entry.status === true).length;
  embed.setDescription(`**${online}** dari **${entries.length}** server online`);

  for (const entry of entries.slice(0, 25)) {
    const icon = entry.status === true ? '🟢' : entry.status === false ? '🔴' : '⚪';
    const players =
      entry.players === null || entry.players === undefined ? '-' : `${entry.players}/${entry.maxPlayers ?? 0}`;
    const game = entry.game ? `${entry.game} • ` : '';
    embed.addFields({
      name: truncate(`${icon} ${entry.name}`, 256),
      value: `${game}Pemain: **${players}**\n-# ID \`${entry.gmId}\``,
      inline: true,
    });
  }
  if (entries.length > 25) {
    embed.setFooter({ text: `Menampilkan 25 dari ${entries.length} server` });
  }
  return embed;
}

export function errorEmbed(message) {
  return new EmbedBuilder().setColor(COLORS.offline).setDescription(`❌ ${message}`);
}

export function successEmbed(message) {
  return new EmbedBuilder().setColor(COLORS.online).setDescription(`✅ ${message}`);
}
