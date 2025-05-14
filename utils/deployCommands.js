// utils/deployCommands.js
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

/**
 * Loads all command files and registers slash commands with Discord
 * @param {Client} client - The bot client
 */
async function registerCommands(client) {
  const commands = [];
  const commandMap = new Map();

  const commandsPath = path.join(__dirname, '../commands');
  const folders = fs.readdirSync(commandsPath);

  for (const folder of folders) {
    const folderPath = path.join(commandsPath, folder);
    
    // Skip non-directories
    if (!fs.statSync(folderPath).isDirectory()) continue;
    
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, folder, file);
      try {
        const command = require(filePath);

        if (command.data && command.execute) {
          // Slash command registration
          commands.push(command.data.toJSON());

          // Also store for client use
          commandMap.set(command.data.name, command);
          console.log(`Registered command: ${command.data.name}`);
        }
      } catch (error) {
        console.error(`Error loading command from ${filePath}:`, error);
      }
    }
  }

  // Update client.commands with our commands
  client.commands = commandMap;

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  try {
    console.log(`Registering ${commands.length} slash commands...`);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('Slash commands registered successfully!');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
}

module.exports = { registerCommands };