import { PermissionFlagsBits } from 'discord.js';

export const REQUIRED_CHANNEL_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.ReadMessageHistory,
];

const PERMISSION_NAMES = {
  [PermissionFlagsBits.ViewChannel]: 'View Channel',
  [PermissionFlagsBits.SendMessages]: 'Send Messages',
  [PermissionFlagsBits.EmbedLinks]: 'Embed Links',
  [PermissionFlagsBits.ReadMessageHistory]: 'Read Message History',
};

/** @returns {string[]} nama permission yang belum dimiliki bot di channel tersebut. */
export function missingBotPermissions(channel) {
  const me = channel.guild?.members.me;
  if (!me) return REQUIRED_CHANNEL_PERMISSIONS.map((flag) => PERMISSION_NAMES[flag]);
  const permissions = channel.permissionsFor(me);
  return REQUIRED_CHANNEL_PERMISSIONS.filter((flag) => !permissions?.has(flag)).map(
    (flag) => PERMISSION_NAMES[flag],
  );
}

/** Ambil channel teks berdasarkan ID; null jika tidak ada atau bukan channel teks. */
export async function resolveTextChannel(client, channelId) {
  if (!channelId) return null;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  return channel?.isTextBased() && 'send' in channel ? channel : null;
}
