const { REST, Routes } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const commands = [];
let commandFiles = [];
try {
  if (fs.existsSync('./commands')) {
    commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
  } else {
    // fallback: look for possible command files at repo root
    const rootFiles = fs.readdirSync('.').filter(f => f.endsWith('.js'));
    const exclude = new Set(['deploy-commands.js', 'index.js', 'missionData.js', 'package.json']);
    commandFiles = rootFiles.filter(f => !exclude.has(f));
    if (commandFiles.length) console.log('Using command files found at repo root:', commandFiles);
  }
} catch (err) {
  console.error('Error reading command files:', err);
}

for (const file of commandFiles) {
  try {
    const pathToRequire = fs.existsSync('./commands') ? `./commands/${file}` : `./${file}`;
    const command = require(pathToRequire);
    if (command.data) {
      commands.push(command.data.toJSON());
    }
  } catch (e) {
    // ignore files that are not valid commands
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    if (!process.env.TOKEN || !process.env.CLIENT_ID) {
      throw new Error('Missing TOKEN or CLIENT_ID in environment');
    }

    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log('Successfully reloaded guild (/) commands for GUILD_ID:', process.env.GUILD_ID);
      console.log('Registered commands:', commands.map(c => c.name));
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log('Successfully reloaded global (/) commands. Note: propagation can take up to an hour.');
      console.log('Registered commands:', commands.map(c => c.name));
    }
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exit(1);
  }
})();
