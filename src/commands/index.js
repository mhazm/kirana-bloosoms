import * as config from './config.js';
import * as server from './server.js';
import * as status from './status.js';

/** Semua slash command Kirana. Tambahkan command baru di sini. */
export const commands = [config, server, status];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
