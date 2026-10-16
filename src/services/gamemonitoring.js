const API_BASE = 'https://api.gamemonitoring.net';
const SITE_BASE = 'https://gamemonitoring.net';
const REQUEST_TIMEOUT_MS = 10_000;

/** Steam App ID game yang didukung Kirana. */
export const SUPPORTED_GAMES = Object.freeze({
  227300: { short: 'ETS2', name: 'Euro Truck Simulator 2', emoji: '🚛' },
  270880: { short: 'ATS', name: 'American Truck Simulator', emoji: '🛻' },
});

export class GameMonitoringError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'GameMonitoringError';
    this.status = status;
  }
}

async function request(path) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'KiranaBot/0.1 (Nismara Transport Discord bot)',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error.name === 'TimeoutError' ? 'timeout' : error.message;
    throw new GameMonitoringError(`Gagal menghubungi GameMonitoring (${reason}).`);
  }

  if (response.status === 404) {
    throw new GameMonitoringError('Server tidak ditemukan di GameMonitoring.', 404);
  }
  if (!response.ok) {
    throw new GameMonitoringError(`GameMonitoring merespons HTTP ${response.status}.`, response.status);
  }

  const body = await response.json().catch(() => null);
  if (!body?.response) {
    throw new GameMonitoringError('Respons GameMonitoring tidak valid.', response.status);
  }
  return body.response;
}

export function fetchServer(gmId) {
  return request(`/servers/${encodeURIComponent(gmId)}`);
}

export async function fetchPlayers(gmId) {
  const data = await request(`/servers/${encodeURIComponent(gmId)}/players`);
  return Array.isArray(data.items) ? data.items : [];
}

export function getSteamAppId(server) {
  return Number(server.app?.steam_id ?? server.game) || null;
}

/** @returns {{short: string, name: string, emoji: string} | null} */
export function getGameInfo(server) {
  return SUPPORTED_GAMES[getSteamAppId(server)] ?? null;
}

export function isSupportedGame(server) {
  return getGameInfo(server) !== null;
}

/**
 * Session ID convoy ETS2/ATS (field `steam_id` dari API).
 * Server convoy tidak bisa di-join lewat IP, pemain mencarinya dengan Session ID ini.
 * Tetap berupa string karena angkanya melebihi Number.MAX_SAFE_INTEGER.
 * @returns {string|null}
 */
export function getSessionId(server) {
  if (!isSupportedGame(server)) return null;
  const sessionId = String(server.steam_id ?? '').trim();
  return /^\d+$/.test(sessionId) ? sessionId : null;
}

export function serverPageUrl(server) {
  return server.app?.url
    ? `${SITE_BASE}/${server.app.url}/servers/${server.id}`
    : `${SITE_BASE}/servers/${server.id}`;
}
