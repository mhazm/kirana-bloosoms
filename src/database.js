import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

const databaseFile = resolve(config.databasePath);
mkdirSync(dirname(databaseFile), { recursive: true });

export const db = new DatabaseSync(databaseFile);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id          TEXT PRIMARY KEY,
    status_channel_id TEXT,
    notify_channel_id TEXT,
    notify_role_id    TEXT,
    updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS servers (
    guild_id          TEXT    NOT NULL,
    gm_id             INTEGER NOT NULL,
    label             TEXT,
    name              TEXT,
    game              TEXT,
    status_message_id TEXT,
    last_status       INTEGER,
    last_players      INTEGER,
    last_max_players  INTEGER,
    last_checked_at   INTEGER,
    added_by          TEXT,
    added_at          INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (guild_id, gm_id)
  );
`);

// ---------------------------------------------------------------------------
// Guild settings
// ---------------------------------------------------------------------------

const SETTING_COLUMNS = new Set(['status_channel_id', 'notify_channel_id', 'notify_role_id']);

const selectSettings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?');

export function getSettings(guildId) {
  return (
    selectSettings.get(guildId) ?? {
      guild_id: guildId,
      status_channel_id: null,
      notify_channel_id: null,
      notify_role_id: null,
    }
  );
}

export function updateSetting(guildId, column, value) {
  if (!SETTING_COLUMNS.has(column)) {
    throw new Error(`Kolom setting tidak dikenal: ${column}`);
  }
  // Column name is whitelisted above, so interpolation is safe here.
  db.prepare(
    `INSERT INTO guild_settings (guild_id, ${column}) VALUES (?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET ${column} = excluded.${column}, updated_at = unixepoch()`,
  ).run(guildId, value ?? null);
}

// ---------------------------------------------------------------------------
// Monitored servers
// ---------------------------------------------------------------------------

const insertServer = db.prepare(`
  INSERT OR IGNORE INTO servers (guild_id, gm_id, label, name, game, added_by)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const selectServer = db.prepare('SELECT * FROM servers WHERE guild_id = ? AND gm_id = ?');
const selectServers = db.prepare('SELECT * FROM servers WHERE guild_id = ? ORDER BY added_at, gm_id');
const deleteServer = db.prepare('DELETE FROM servers WHERE guild_id = ? AND gm_id = ?');
const updateState = db.prepare(`
  UPDATE servers
  SET last_status = ?, last_players = ?, last_max_players = ?, name = ?, game = ?, last_checked_at = unixepoch()
  WHERE guild_id = ? AND gm_id = ?
`);
const updateMessage = db.prepare('UPDATE servers SET status_message_id = ? WHERE guild_id = ? AND gm_id = ?');
const clearMessages = db.prepare('UPDATE servers SET status_message_id = NULL WHERE guild_id = ?');

/** @returns {boolean} true jika server baru ditambahkan, false jika sudah terdaftar. */
export function addServer(guildId, { gmId, label, name, game, addedBy }) {
  const result = insertServer.run(guildId, gmId, label ?? null, name ?? null, game ?? null, addedBy ?? null);
  return result.changes > 0;
}

export function getServer(guildId, gmId) {
  return selectServer.get(guildId, gmId) ?? null;
}

export function listServers(guildId) {
  return selectServers.all(guildId);
}

/** @returns {object|null} data server yang dihapus, atau null jika tidak ada. */
export function removeServer(guildId, gmId) {
  const existing = getServer(guildId, gmId);
  if (!existing) return null;
  deleteServer.run(guildId, gmId);
  return existing;
}

export function saveServerState(guildId, gmId, { online, players, maxPlayers, name, game }) {
  updateState.run(online ? 1 : 0, players ?? 0, maxPlayers ?? 0, name ?? null, game ?? null, guildId, gmId);
}

export function setStatusMessage(guildId, gmId, messageId) {
  updateMessage.run(messageId ?? null, guildId, gmId);
}

export function clearStatusMessages(guildId) {
  clearMessages.run(guildId);
}

export function closeDatabase() {
  if (db.isOpen) db.close();
}
