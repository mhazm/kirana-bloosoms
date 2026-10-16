import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { commands } from './commands/index.js';
import { logger } from './utils/logger.js';

const body = commands.map((command) => command.data.toJSON());
const rest = new REST().setToken(config.token);

try {
  logger.info(`Mendaftarkan ${body.length} slash command ke guild ${config.guildId}...`);
  const result = await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body });
  logger.info(`Berhasil: ${result.map((command) => `/${command.name}`).join(', ')}`);
} catch (error) {
  logger.error('Gagal mendaftarkan command:', error);
  process.exitCode = 1;
}
