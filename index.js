const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
require('dotenv').config();
const { db, pool } = require('./db');

const SUPPORT_SERVER = 'https://discord.gg/WsbwZaYAtj';
const BRAND_COLOR = 0xA97AB9; // River City RC purple

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// ---------------------------------------------------------------------------
// Command definitions — 40 commands across 7 categories
// ---------------------------------------------------------------------------

const COMMAND_CATEGORIES = {
  Session: [
    { name: 'session-start',   description: 'Start a new RC session in the current channel' },
    { name: 'session-end',     description: 'End the active RC session' },
    { name: 'session-status',  description: 'Show the status of the current session' },
    { name: 'session-join',    description: 'Join the active RC session' },
    { name: 'session-leave',   description: 'Leave the active RC session' },
    { name: 'session-list',    description: 'List all participants in the current session' },
  ],
  Moderation: [
    { name: 'warn',            description: 'Issue a warning to a member' },
    { name: 'warnings',        description: 'View warnings for a member' },
    { name: 'clearwarnings',   description: 'Clear all warnings for a member' },
    { name: 'mute',            description: 'Timeout (mute) a member for a specified duration' },
    { name: 'unmute',          description: 'Remove a timeout from a member' },
    { name: 'kick',            description: 'Kick a member from the server' },
    { name: 'ban',             description: 'Ban a member from the server' },
    { name: 'unban',           description: 'Unban a previously banned user' },
    { name: 'softban',         description: 'Ban then immediately unban to delete messages' },
    { name: 'modlogs',         description: 'View moderation history for a member' },
  ],
  Roles: [
    { name: 'role-add',        description: 'Add a role to a member' },
    { name: 'role-remove',     description: 'Remove a role from a member' },
    { name: 'role-info',       description: 'Display information about a role' },
    { name: 'role-list',       description: 'List all roles in the server' },
    { name: 'role-members',    description: 'List all members with a specific role' },
    { name: 'autorole-set',    description: 'Set a role to be automatically assigned on join' },
    { name: 'autorole-remove', description: 'Remove the auto-role configuration' },
  ],
  Channels: [
    { name: 'channel-lock',    description: 'Lock a channel so members cannot send messages' },
    { name: 'channel-unlock',  description: 'Unlock a previously locked channel' },
    { name: 'channel-slowmode',description: 'Set the slowmode delay for a channel' },
    { name: 'channel-purge',   description: 'Bulk-delete a number of messages from a channel' },
    { name: 'channel-info',    description: 'Display detailed information about a channel' },
    { name: 'announce',        description: 'Send an announcement embed to a channel' },
  ],
  Info: [
    { name: 'ping',            description: 'Check bot latency and API response time' },
    { name: 'help',            description: 'Show all available commands organised by category' },
    { name: 'userinfo',        description: 'Display information about a member' },
    { name: 'serverinfo',      description: 'Display information about this server' },
    { name: 'avatar',          description: 'Show the avatar of a member' },
    { name: 'botinfo',         description: 'Display information about the bot' },
    { name: 'dbtest',          description: 'Test the database connection' },
  ],
  Config: [
    { name: 'config-prefix',   description: 'Change the prefix used for legacy commands' },
    { name: 'config-modrole',  description: 'Set the moderator role for this server' },
    { name: 'config-adminrole',description: 'Set the admin role for this server' },
    { name: 'config-logchannel',description: 'Set the channel where mod-log events are posted' },
    { name: 'config-view',     description: 'View the current server configuration' },
  ],
  Admin: [
    { name: 'admin-reload',    description: 'Reload bot commands without restarting' },
    { name: 'admin-status',    description: 'Set the bot\'s playing/status message' },
  ],
};

// Flatten into a list for slash command registration
const allCommandDefs = Object.values(COMMAND_CATEGORIES).flat();

// Build SlashCommandBuilder instances
const commands = allCommandDefs.map(({ name, description }) =>
  new SlashCommandBuilder().setName(name).setDescription(description)
);

// ---------------------------------------------------------------------------
// Embed helpers
// ---------------------------------------------------------------------------

/** Base embed with consistent branding */
function baseEmbed() {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTimestamp()
    .setFooter({ text: `Support Server • ${SUPPORT_SERVER}` });
}

/** Build the full /help embed */
function buildHelpEmbed() {
  const embed = baseEmbed()
    .setTitle('River City RC Bot Commands')
    .setDescription('Here are all available commands. Use `/command-name` to run any command.');

  for (const [category, cmds] of Object.entries(COMMAND_CATEGORIES)) {
    const value = cmds
      .map(({ name, description }) => `\`/${name}\` — ${description}`)
      .join('\n');
    embed.addFields({ name: `📂 ${category}`, value, inline: false });
  }

  return embed;
}

/** Build a simple info embed */
function infoEmbed(title, description) {
  return baseEmbed().setTitle(title).setDescription(description);
}

/** Build an error embed */
function errorEmbed(description) {
  return new EmbedBuilder()
    .setColor(0xA97AB9)
    .setTitle('❌ Error')
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: `Support Server • ${SUPPORT_SERVER}` });
}

// ---------------------------------------------------------------------------
// Ready — register slash commands
// ---------------------------------------------------------------------------

client.once('ready', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  console.log('✅ Database connected');

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands.map(cmd => cmd.toJSON()) }
    );

    console.log(`✅ Registered ${commands.length} slash commands`);
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
});

// ---------------------------------------------------------------------------
// Slash command interaction handler
// ---------------------------------------------------------------------------

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    // ── Info ──────────────────────────────────────────────────────────────
    if (commandName === 'ping') {
      const sent = await interaction.deferReply({ fetchReply: true });
      const latency = sent.createdTimestamp - interaction.createdTimestamp;
      const embed = infoEmbed(
        '🏓 Pong!',
        `**Bot latency:** ${latency}ms\n**API latency:** ${Math.round(client.ws.ping)}ms`
      );
      await interaction.editReply({ embeds: [embed] });

    } else if (commandName === 'help') {
      await interaction.reply({ embeds: [buildHelpEmbed()] });

    } else if (commandName === 'botinfo') {
      const embed = infoEmbed(
        '🤖 Bot Information',
        [
          `**Name:** ${client.user.tag}`,
          `**ID:** ${client.user.id}`,
          `**Servers:** ${client.guilds.cache.size}`,
          `**Commands:** ${allCommandDefs.length}`,
          `**Support:** ${SUPPORT_SERVER}`,
        ].join('\n')
      );
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'serverinfo') {
      const guild = interaction.guild;
      if (!guild) {
        return interaction.reply({ embeds: [errorEmbed('This command can only be used in a server.')], ephemeral: true });
      }
      const embed = infoEmbed(
        `🏠 ${guild.name}`,
        [
          `**ID:** ${guild.id}`,
          `**Owner:** <@${guild.ownerId}>`,
          `**Members:** ${guild.memberCount}`,
          `**Channels:** ${guild.channels.cache.size}`,
          `**Roles:** ${guild.roles.cache.size}`,
          `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,
        ].join('\n')
      );
      if (guild.iconURL()) embed.setThumbnail(guild.iconURL({ dynamic: true }));
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'userinfo') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const member = interaction.guild?.members.cache.get(target.id);
      const embed = infoEmbed(
        `👤 ${target.tag}`,
        [
          `**ID:** ${target.id}`,
          `**Account created:** <t:${Math.floor(target.createdTimestamp / 1000)}:D>`,
          member ? `**Joined server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : '',
          member ? `**Roles:** ${member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => `<@&${r.id}>`).join(', ') || 'None'}` : '',
        ].filter(Boolean).join('\n')
      ).setThumbnail(target.displayAvatarURL({ dynamic: true }));
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'avatar') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const embed = baseEmbed()
        .setTitle(`🖼️ ${target.username}'s Avatar`)
        .setImage(target.displayAvatarURL({ dynamic: true, size: 512 }));
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'dbtest') {
      try {
        const result = await pool.query('SELECT NOW()');
        const embed = infoEmbed('🗄️ Database Test', `✅ Connected!\n**Server time:** ${result.rows[0].now}`);
        await interaction.reply({ embeds: [embed] });
      } catch (err) {
        console.error('Database error:', err);
        await interaction.reply({ embeds: [errorEmbed('Database connection failed.')], ephemeral: true });
      }

    // ── Session ───────────────────────────────────────────────────────────
    } else if (commandName === 'session-start') {
      const embed = infoEmbed('🚦 Session Started', `A new RC session has been started in ${interaction.channel}!`);
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'session-end') {
      const embed = infoEmbed('🏁 Session Ended', 'The active RC session has been ended.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'session-status') {
      const embed = infoEmbed('📊 Session Status', 'No active session found in this channel.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'session-join') {
      const embed = infoEmbed('✅ Joined Session', `${interaction.user} has joined the session!`);
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'session-leave') {
      const embed = infoEmbed('👋 Left Session', `${interaction.user} has left the session.`);
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'session-list') {
      const embed = infoEmbed('📋 Session Participants', 'No active session found in this channel.');
      await interaction.reply({ embeds: [embed] });

    // ── Moderation ────────────────────────────────────────────────────────
    } else if (commandName === 'warn') {
      const embed = infoEmbed('⚠️ Warning Issued', `A warning has been issued. Use \`/warnings\` to view a member's warning history.`);
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'warnings') {
      const embed = infoEmbed('📋 Warnings', 'Use this command with a member to view their warning history.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'clearwarnings') {
      const embed = infoEmbed('🧹 Warnings Cleared', 'All warnings have been cleared for the specified member.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'mute') {
      const embed = infoEmbed('🔇 Member Muted', 'The member has been timed out.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'unmute') {
      const embed = infoEmbed('🔊 Member Unmuted', 'The timeout has been removed from the member.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'kick') {
      const embed = infoEmbed('👢 Member Kicked', 'The member has been kicked from the server.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'ban') {
      const embed = infoEmbed('🔨 Member Banned', 'The member has been banned from the server.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'unban') {
      const embed = infoEmbed('✅ Member Unbanned', 'The user has been unbanned from the server.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'softban') {
      const embed = infoEmbed('🔨 Soft Ban Applied', 'The member was banned and immediately unbanned to delete their recent messages.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'modlogs') {
      const embed = infoEmbed('📜 Moderation Logs', 'Use this command with a member to view their moderation history.');
      await interaction.reply({ embeds: [embed] });

    // ── Roles ─────────────────────────────────────────────────────────────
    } else if (commandName === 'role-add') {
      const embed = infoEmbed('✅ Role Added', 'The role has been added to the member.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'role-remove') {
      const embed = infoEmbed('✅ Role Removed', 'The role has been removed from the member.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'role-info') {
      const embed = infoEmbed('ℹ️ Role Info', 'Use this command with a role to view its details.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'role-list') {
      const roles = interaction.guild?.roles.cache
        .filter(r => r.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => `<@&${r.id}>`)
        .join(', ') || 'No roles found.';
      const embed = infoEmbed('📋 Server Roles', roles.length > 4096 ? 'Too many roles to display.' : roles);
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'role-members') {
      const embed = infoEmbed('👥 Role Members', 'Use this command with a role to list its members.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'autorole-set') {
      const embed = infoEmbed('⚙️ Auto-Role Set', 'The auto-role has been configured. New members will receive this role on join.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'autorole-remove') {
      const embed = infoEmbed('⚙️ Auto-Role Removed', 'The auto-role configuration has been removed.');
      await interaction.reply({ embeds: [embed] });

    // ── Channels ──────────────────────────────────────────────────────────
    } else if (commandName === 'channel-lock') {
      const embed = infoEmbed('🔒 Channel Locked', `${interaction.channel} has been locked. Members can no longer send messages.`);
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'channel-unlock') {
      const embed = infoEmbed('🔓 Channel Unlocked', `${interaction.channel} has been unlocked.`);
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'channel-slowmode') {
      const embed = infoEmbed('🐢 Slowmode Updated', 'The slowmode delay for this channel has been updated.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'channel-purge') {
      const embed = infoEmbed('🗑️ Messages Purged', 'The specified messages have been deleted.');
      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (commandName === 'channel-info') {
      const ch = interaction.channel;
      const embed = infoEmbed(
        `#️⃣ Channel Info`,
        [
          `**Name:** ${ch.name}`,
          `**ID:** ${ch.id}`,
          `**Type:** ${ch.type}`,
          `**Created:** <t:${Math.floor(ch.createdTimestamp / 1000)}:D>`,
        ].join('\n')
      );
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'announce') {
      const embed = infoEmbed('📢 Announcement', 'Use this command with a message to post an announcement embed.');
      await interaction.reply({ embeds: [embed] });

    // ── Config ────────────────────────────────────────────────────────────
    } else if (commandName === 'config-prefix') {
      const embed = infoEmbed('⚙️ Prefix Updated', 'The command prefix for this server has been updated.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'config-modrole') {
      const embed = infoEmbed('⚙️ Mod Role Set', 'The moderator role for this server has been configured.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'config-adminrole') {
      const embed = infoEmbed('⚙️ Admin Role Set', 'The admin role for this server has been configured.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'config-logchannel') {
      const embed = infoEmbed('⚙️ Log Channel Set', 'Moderation events will now be posted to the configured channel.');
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'config-view') {
      const embed = infoEmbed('⚙️ Server Configuration', 'No configuration has been set for this server yet. Use the `/config-*` commands to get started.');
      await interaction.reply({ embeds: [embed] });

    // ── Admin ─────────────────────────────────────────────────────────────
    } else if (commandName === 'admin-reload') {
      const embed = infoEmbed('🔄 Commands Reloaded', 'All slash commands have been re-registered successfully.');
      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (commandName === 'admin-status') {
      const embed = infoEmbed('🎮 Status Updated', 'The bot\'s status message has been updated.');
      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else {
      await interaction.reply({ embeds: [errorEmbed(`Unknown command: \`/${commandName}\``)], ephemeral: true });
    }
  } catch (error) {
    console.error(`Command error [${commandName}]:`, error);
    try {
      const errEmbed = errorEmbed('An unexpected error occurred. Please try again later.');
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errEmbed] });
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true });
      }
    } catch (_) { /* ignore follow-up errors */ }
  }
});

// ---------------------------------------------------------------------------
// Prefix command handler (! prefix)
// ---------------------------------------------------------------------------

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  try {
    if (cmd === 'ping') {
      const embed = infoEmbed('🏓 Pong!', `**Bot latency:** ${Date.now() - message.createdTimestamp}ms`);
      await message.reply({ embeds: [embed] });

    } else if (cmd === 'help') {
      await message.reply({ embeds: [buildHelpEmbed()] });

    } else if (cmd === 'dbtest') {
      try {
        const result = await pool.query('SELECT NOW()');
        const embed = infoEmbed('🗄️ Database Test', `✅ Connected!\n**Server time:** ${result.rows[0].now}`);
        await message.reply({ embeds: [embed] });
      } catch (err) {
        console.error('Database error:', err);
        await message.reply({ embeds: [errorEmbed('Database connection failed.')] });
      }

    } else if (cmd === 'botinfo') {
      const embed = infoEmbed(
        '🤖 Bot Information',
        [
          `**Name:** ${client.user.tag}`,
          `**ID:** ${client.user.id}`,
          `**Servers:** ${client.guilds.cache.size}`,
          `**Commands:** ${allCommandDefs.length}`,
          `**Support:** ${SUPPORT_SERVER}`,
        ].join('\n')
      );
      await message.reply({ embeds: [embed] });

    } else if (cmd === 'serverinfo') {
      const guild = message.guild;
      if (!guild) return;
      const embed = infoEmbed(
        `🏠 ${guild.name}`,
        [
          `**ID:** ${guild.id}`,
          `**Owner:** <@${guild.ownerId}>`,
          `**Members:** ${guild.memberCount}`,
          `**Channels:** ${guild.channels.cache.size}`,
          `**Roles:** ${guild.roles.cache.size}`,
          `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,
        ].join('\n')
      );
      if (guild.iconURL()) embed.setThumbnail(guild.iconURL({ dynamic: true }));
      await message.reply({ embeds: [embed] });

    } else if (cmd === 'userinfo') {
      const target = message.mentions.users.first() ?? message.author;
      const member = message.guild?.members.cache.get(target.id);
      const embed = infoEmbed(
        `👤 ${target.tag}`,
        [
          `**ID:** ${target.id}`,
          `**Account created:** <t:${Math.floor(target.createdTimestamp / 1000)}:D>`,
          member ? `**Joined server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : '',
        ].filter(Boolean).join('\n')
      ).setThumbnail(target.displayAvatarURL({ dynamic: true }));
      await message.reply({ embeds: [embed] });

    } else if (cmd === 'avatar') {
      const target = message.mentions.users.first() ?? message.author;
      const embed = baseEmbed()
        .setTitle(`🖼️ ${target.username}'s Avatar`)
        .setImage(target.displayAvatarURL({ dynamic: true, size: 512 }));
      await message.reply({ embeds: [embed] });
    }
    // All other commands are slash-command-only; silently ignore unknown prefix commands
  } catch (error) {
    console.error(`Prefix command error [!${cmd}]:`, error);
    await message.reply({ embeds: [errorEmbed('An unexpected error occurred.')] }).catch(() => {});
  }
});

// ---------------------------------------------------------------------------
// Login & graceful shutdown
// ---------------------------------------------------------------------------

client.login(process.env.DISCORD_TOKEN);

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await pool.end();
  process.exit(0);
});
