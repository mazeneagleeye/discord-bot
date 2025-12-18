const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// load commands from ./commands
const commandFiles = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

client.once("clientReady", () => {
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