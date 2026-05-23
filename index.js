const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const { db, pool } = require('./db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check if bot is alive'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands'),
  new SlashCommandBuilder()
    .setName('dbtest')
    .setDescription('Test database connection'),
];

// Register slash commands
client.once('ready', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  console.log('✅ Database connected');

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands.map(cmd => cmd.toJSON()) }
    );
    
    console.log('✅ Slash commands registered');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
});

// Handle slash command interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    if (commandName === 'ping') {
      await interaction.reply('Pong! 🏓');
    } else if (commandName === 'help') {
      await interaction.reply('Available commands:\n/ping - Check if bot is alive\n/help - Show this message\n/dbtest - Test database connection');
    } else if (commandName === 'dbtest') {
      try {
        const result = await pool.query('SELECT NOW()');
        await interaction.reply(`✅ Database connected! Current time: ${result.rows[0].now}`);
      } catch (error) {
        console.error('Database error:', error);
        await interaction.reply('❌ Database connection failed');
      }
    }
  } catch (error) {
    console.error('Command error:', error);
    await interaction.reply({ content: '❌ An error occurred', ephemeral: true });
  }
});

// Legacy prefix command support (optional)
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!ping') {
    message.reply('Pong! 🏓');
  } else if (message.content === '!help') {
    message.reply('Available commands:\n!ping - Check if bot is alive\n!help - Show this message\n!dbtest - Test database connection');
  } else if (message.content === '!dbtest') {
    try {
      const result = await pool.query('SELECT NOW()');
      message.reply(`✅ Database connected! Current time: ${result.rows[0].now}`);
    } catch (error) {
      console.error('Database error:', error);
      message.reply('❌ Database connection failed');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await pool.end();
  process.exit(0);
});
