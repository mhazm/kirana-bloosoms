import {
  ChannelType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { clearStatusMessages, getSettings, listServers, updateSetting } from '../database.js';
import { missingBotPermissions, resolveTextChannel } from '../utils/channels.js';
import { COLORS, errorEmbed, successEmbed } from '../utils/embeds.js';
import { config } from '../config.js';

const TEXT_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Atur channel dan role yang dipakai Kirana')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    sub
      .setName('status-channel')
      .setDescription('Channel untuk embed status server yang update otomatis')
      .addChannelOption((opt) =>
        opt.setName('channel').setDescription('Channel tujuan').addChannelTypes(...TEXT_CHANNEL_TYPES).setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('notification-channel')
      .setDescription('Channel untuk notifikasi saat server online/offline')
      .addChannelOption((opt) =>
        opt.setName('channel').setDescription('Channel tujuan').addChannelTypes(...TEXT_CHANNEL_TYPES).setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('notification-role')
      .setDescription('Role yang di-mention saat notifikasi (kosongkan untuk menghapus)')
      .addRoleOption((opt) => opt.setName('role').setDescription('Role yang di-mention')),
  )
  .addSubcommand((sub) => sub.setName('view').setDescription('Lihat konfigurasi saat ini'));

export async function execute(interaction) {
  switch (interaction.options.getSubcommand()) {
    case 'status-channel':
      return setStatusChannel(interaction);
    case 'notification-channel':
      return setNotificationChannel(interaction);
    case 'notification-role':
      return setNotificationRole(interaction);
    default:
      return viewConfig(interaction);
  }
}

function ephemeral(embed) {
  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

function permissionError(channel) {
  const missing = missingBotPermissions(channel);
  return missing.length > 0
    ? errorEmbed(`Kirana belum punya izin di ${channel}: **${missing.join(', ')}**.`)
    : null;
}

async function setStatusChannel(interaction) {
  const channel = interaction.options.getChannel('channel', true, TEXT_CHANNEL_TYPES);
  const error = permissionError(channel);
  if (error) return interaction.reply(ephemeral(error));

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const previous = getSettings(interaction.guildId);
  if (previous.status_channel_id && previous.status_channel_id !== channel.id) {
    // Bersihkan embed lama di channel sebelumnya (best effort).
    const oldChannel = await resolveTextChannel(interaction.client, previous.status_channel_id);
    if (oldChannel) {
      for (const server of listServers(interaction.guildId)) {
        if (server.status_message_id) {
          await oldChannel.messages.delete(server.status_message_id).catch(() => null);
        }
      }
    }
    clearStatusMessages(interaction.guildId);
  }

  updateSetting(interaction.guildId, 'status_channel_id', channel.id);
  interaction.client.monitor?.refreshNow();

  return interaction.editReply({
    embeds: [successEmbed(`Channel status diatur ke ${channel}. Embed akan muncul dalam beberapa detik.`)],
  });
}

async function setNotificationChannel(interaction) {
  const channel = interaction.options.getChannel('channel', true, TEXT_CHANNEL_TYPES);
  const error = permissionError(channel);
  if (error) return interaction.reply(ephemeral(error));

  updateSetting(interaction.guildId, 'notify_channel_id', channel.id);
  return interaction.reply(ephemeral(successEmbed(`Notifikasi online/offline akan dikirim ke ${channel}.`)));
}

async function setNotificationRole(interaction) {
  const role = interaction.options.getRole('role');
  updateSetting(interaction.guildId, 'notify_role_id', role?.id ?? null);

  if (!role) {
    return interaction.reply(ephemeral(successEmbed('Role notifikasi dihapus. Notifikasi dikirim tanpa mention.')));
  }

  const canMention =
    role.mentionable || interaction.guild.members.me?.permissions.has(PermissionFlagsBits.MentionEveryone);
  const note = canMention
    ? ''
    : '\n⚠️ Role ini tidak bisa di-mention. Aktifkan **Allow anyone to @mention this role** atau beri Kirana izin **Mention Everyone**.';

  return interaction.reply(ephemeral(successEmbed(`${role} akan di-mention saat status server berubah.${note}`)));
}

async function viewConfig(interaction) {
  const settings = getSettings(interaction.guildId);
  const servers = listServers(interaction.guildId);
  const show = (value, format) => (value ? format(value) : '*Belum diatur*');

  const embed = new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle('Konfigurasi Kirana')
    .addFields(
      { name: 'Channel status', value: show(settings.status_channel_id, (id) => `<#${id}>`), inline: true },
      { name: 'Channel notifikasi', value: show(settings.notify_channel_id, (id) => `<#${id}>`), inline: true },
      { name: 'Role notifikasi', value: show(settings.notify_role_id, (id) => `<@&${id}>`), inline: true },
      { name: 'Server dipantau', value: `${servers.length}`, inline: true },
      { name: 'Interval cek', value: `${config.updateIntervalSeconds} detik`, inline: true },
    )
    .setTimestamp(new Date());

  return interaction.reply(ephemeral(embed));
}
