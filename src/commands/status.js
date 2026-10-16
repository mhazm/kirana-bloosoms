import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getServer, listServers } from '../database.js';
import { fetchPlayers, fetchServer, getGameInfo } from '../services/gamemonitoring.js';
import { buildServerEmbed, buildSummaryEmbed, errorEmbed } from '../utils/embeds.js';
import { autocompleteServerId } from './_autocomplete.js';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Cek status server ETS2/ATS secara langsung')
  .setContexts(InteractionContextType.Guild)
  .addIntegerOption((opt) =>
    opt
      .setName('id')
      .setDescription('ID server GameMonitoring (kosongkan untuk melihat semua server)')
      .setMinValue(1)
      .setAutocomplete(true),
  );

export const autocomplete = autocompleteServerId;

export async function execute(interaction) {
  const gmId = interaction.options.getInteger('id');
  await interaction.deferReply();
  return gmId ? showDetail(interaction, gmId) : showSummary(interaction);
}

async function showDetail(interaction, gmId) {
  const [serverResult, playersResult] = await Promise.allSettled([fetchServer(gmId), fetchPlayers(gmId)]);

  if (serverResult.status === 'rejected') {
    return interaction.editReply({ embeds: [errorEmbed(serverResult.reason.message)] });
  }

  const server = serverResult.value;
  const registered = getServer(interaction.guildId, gmId);
  const players = playersResult.status === 'fulfilled' && server.status ? playersResult.value : null;

  return interaction.editReply({
    embeds: [buildServerEmbed(server, { label: registered?.label ?? null, players })],
  });
}

async function showSummary(interaction) {
  const servers = listServers(interaction.guildId);
  if (servers.length === 0) {
    return interaction.editReply({ embeds: [buildSummaryEmbed([])] });
  }

  const results = await Promise.allSettled(servers.map((server) => fetchServer(server.gm_id)));

  const entries = servers.map((entry, index) => {
    const result = results[index];
    const base = {
      gmId: entry.gm_id,
      name: entry.label || entry.name || `Server #${entry.gm_id}`,
      game: entry.game,
    };
    if (result.status === 'rejected') {
      return { ...base, status: null, players: null, maxPlayers: null };
    }
    const server = result.value;
    return {
      ...base,
      name: entry.label || server.name || base.name,
      game: getGameInfo(server)?.short ?? base.game,
      status: Boolean(server.status),
      players: server.numplayers ?? 0,
      maxPlayers: server.maxplayers ?? 0,
    };
  });

  return interaction.editReply({ embeds: [buildSummaryEmbed(entries)] });
}
