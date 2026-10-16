import { listServers } from '../database.js';

/** Autocomplete opsi `id` berdasarkan server yang sudah terdaftar. */
export async function autocompleteServerId(interaction) {
  const query = String(interaction.options.getFocused() ?? '').toLowerCase().trim();
  const choices = listServers(interaction.guildId)
    .filter((server) => {
      if (!query) return true;
      const haystack = `${server.gm_id} ${server.label ?? ''} ${server.name ?? ''}`.toLowerCase();
      return haystack.includes(query);
    })
    .slice(0, 25)
    .map((server) => {
      const title = server.label || server.name || 'Tanpa nama';
      return { name: `${title} (#${server.gm_id})`.slice(0, 100), value: server.gm_id };
    });
  await interaction.respond(choices);
}
