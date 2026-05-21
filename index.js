const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
require('dotenv').config();

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
});

client.login(process.env.DISCORD_TOKEN);
