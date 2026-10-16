import process from 'node:process';
import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { config } from './config.js';
import { commandMap } from './commands/index.js';
import { closeDatabase } from './database.js';
import { ServerMonitor } from './services/monitor.js';
import { errorEmbed } from './utils/embeds.js';
import { logger } from './utils/logger.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.monitor = new ServerMonitor(client, {
  guildId: config.guildId,
  intervalMs: config.updateIntervalSeconds * 1000,
});

client.once(Events.ClientReady, (readyClient) => {
  logger.info(`Kirana online sebagai ${readyClient.user.tag}.`);
  if (!readyClient.guilds.cache.has(config.guildId)) {
    logger.warn(`Kirana belum masuk ke guild ${config.guildId}. Undang bot terlebih dahulu.`);
  }
  client.monitor.start();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.guildId !== config.guildId) return;
  if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) return;

  const command = commandMap.get(interaction.commandName);
  if (!command) return;

  if (interaction.isAutocomplete()) {
    try {
      await command.autocomplete?.(interaction);
    } catch (error) {
      logger.warn(`Autocomplete /${interaction.commandName} gagal: ${error.message}`);
    }
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Command /${interaction.commandName} gagal:`, error);
    const payload = { embeds: [errorEmbed('Terjadi kesalahan saat menjalankan perintah ini.')] };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
      }
    } catch {
      // Interaksi sudah kedaluwarsa; tidak ada yang bisa dilakukan.
    }
  }
});

client.on(Events.Error, (error) => logger.error('Discord client error:', error));
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection:', reason));

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Menerima ${signal}, mematikan Kirana...`);
  client.monitor.stop();
  await client.destroy();
  closeDatabase();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await client.login(config.token);
