import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addServer, getSettings, listServers, removeServer } from '../database.js';
import { fetchServer, getGameInfo, isSupportedGame, SUPPORTED_GAMES } from '../services/gamemonitoring.js';
import { resolveTextChannel } from '../utils/channels.js';
import { buildServerEmbed, buildSummaryEmbed, errorEmbed, successEmbed } from '../utils/embeds.js';
import { autocompleteServerId } from './_autocomplete.js';

const MAX_SERVERS = 25;

export const data = new SlashCommandBuilder()
  .setName('server')
  .setDescription('Kelola server ETS2/ATS yang dipantau Kirana')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Tambahkan server dari GameMonitoring')
      .addIntegerOption((opt) =>
        opt.setName('id').setDescription('ID server di GameMonitoring').setMinValue(1).setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('label').setDescription('Nama tampilan (opsional)').setMaxLength(100),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Hapus server dari pemantauan')
      .addIntegerOption((opt) =>
        opt.setName('id').setDescription('ID server di GameMonitoring').setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Lihat semua server yang dipantau'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return handleAdd(interaction);
  if (sub === 'remove') return handleRemove(interaction);
  return handleList(interaction);
}

export const autocomplete = autocompleteServerId;

async function handleAdd(interaction) {
  const gmId = interaction.options.getInteger('id', true);
  const label = interaction.options.getString('label')?.trim() || null;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (listServers(interaction.guildId).length >= MAX_SERVERS) {
    return interaction.editReply({ embeds: [errorEmbed(`Maksimal ${MAX_SERVERS} server yang bisa dipantau.`)] });
  }

  let server;
  try {
    server = await fetchServer(gmId);
  } catch (error) {
    return interaction.editReply({ embeds: [errorEmbed(error.message)] });
  }

  if (!isSupportedGame(server)) {
    const supported = Object.values(SUPPORTED_GAMES)
      .map((game) => game.name)
      .join(' dan ');
    return interaction.editReply({
      embeds: [
        errorEmbed(`Server #${gmId} adalah server **${server.app?.name ?? 'game lain'}**. Kirana hanya mendukung ${supported}.`),
      ],
    });
  }

  const added = addServer(interaction.guildId, {
    gmId,
    label,
    name: server.name,
    game: getGameInfo(server).short,
    addedBy: interaction.user.id,
  });

  if (!added) {
    return interaction.editReply({ embeds: [errorEmbed(`Server #${gmId} sudah terdaftar.`)] });
  }

  interaction.client.monitor?.refreshNow();

  const settings = getSettings(interaction.guildId);
  const hint = settings.status_channel_id
    ? `Embed status akan muncul di <#${settings.status_channel_id}>.`
    : 'Atur channel status dengan `/config status-channel` agar embed otomatis muncul.';

  return interaction.editReply({
    embeds: [successEmbed(`Server **${label || server.name}** ditambahkan. ${hint}`), buildServerEmbed(server, { label })],
  });
}

async function handleRemove(interaction) {
  const gmId = interaction.options.getInteger('id', true);
  const removed = removeServer(interaction.guildId, gmId);

  if (!removed) {
    return interaction.reply({
      embeds: [errorEmbed(`Server #${gmId} tidak ada di daftar pemantauan.`)],
      flags: MessageFlags.Ephemeral,
    });
  }

  // Hapus embed status lama (best effort).
  if (removed.status_message_id) {
    const settings = getSettings(interaction.guildId);
    const channel = await resolveTextChannel(interaction.client, settings.status_channel_id);
    await channel?.messages.delete(removed.status_message_id).catch(() => null);
  }

  interaction.client.monitor?.refreshNow();

  return interaction.reply({
    embeds: [successEmbed(`Server **${removed.label || removed.name || `#${gmId}`}** dihapus dari pemantauan.`)],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleList(interaction) {
  const entries = listServers(interaction.guildId).map((server) => ({
    gmId: server.gm_id,
    name: server.label || server.name || `Server #${server.gm_id}`,
    game: server.game,
    status: server.last_status === null ? null : Boolean(server.last_status),
    players: server.last_players,
    maxPlayers: server.last_max_players,
  }));

  const embed = buildSummaryEmbed(entries, { title: 'Server yang dipantau' });
  if (entries.length > 0) embed.setFooter({ text: 'Data dari pengecekan terakhir Kirana' });

  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
