const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
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