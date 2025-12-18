const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const http = require("http");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// load commands from ./commands (robust)
let commandFiles = [];
try {
  const commandsPath = path.resolve(__dirname, "commands");
  commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
} catch (err) {
  console.log("⚠ Commands folder not found. Skipping command loading.");
}

for (const file of commandFiles) {
  try {
    const command = require(`./commands/${file}`);
    if (command && command.data && command.data.name) {
      client.commands.set(command.data.name, command);
    } else {
      console.warn(`Skipping invalid command file: ${file}`);
    }
  } catch (err) {
    console.error(`Failed to load command file ${file}:`, err);
  }
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// --- Railway / PaaS helpers ---
// Ensure TOKEN is set via environment (Railway provides project variables)
if (!process.env.TOKEN) {
  console.error('❌ Missing TOKEN in environment. Set TOKEN in Railway secrets or in your .env (do NOT commit it).');
  process.exit(1);
}

// Lightweight HTTP health check server so Railway can keep the service alive
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
}).listen(PORT, () => console.log(`🔌 Health server listening on port ${PORT}`));

// Graceful shutdown to let Railway restart cleanly
const shutdown = async (signal) => {
  console.log(`Received ${signal}, shutting down...`);
  try {
    await client.destroy();
  } catch (err) {
    console.error('Error while destroying client:', err);
  }
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    // If the interaction has already been replied to or deferred, use followUp.
    // Otherwise, send a normal reply. This avoids calling followUp when it's not allowed
    // and prevents crashes when the interaction token is unknown/expired.
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: "❌ Error executing command!", ephemeral: true });
      } else {
        await interaction.reply({ content: "❌ Error executing command!", ephemeral: true });
      }
    } catch (err) {
      // If the interaction is unknown (timeout) or already acknowledged, log and skip
      if (err.code === 10062 || err.code === 40060 || err.name === 'InteractionNotReplied') {
        console.warn('Could not send error response to interaction:', err.code || err.name);
      } else {
        console.error('Failed to notify user about the error:', err);
      }
    }
  }
});

client.login(process.env.TOKEN);