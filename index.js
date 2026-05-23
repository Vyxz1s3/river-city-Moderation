const { Client, GatewayIntentBits } = require('discord.js');
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

client.once('ready', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  console.log('✅ Database connected');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Simple ping command
  if (message.content === '!ping') {
    message.reply('Pong! 🏓');
  }

  // Help command
  if (message.content === '!help') {
    message.reply('Available commands:\n!ping - Check if bot is alive\n!help - Show this message');
  }

  // Example: Database test command
  if (message.content === '!dbtest') {
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
