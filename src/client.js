// src/client.js
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

class RPGClient extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ]
    });

    this.commands = new Collection();
    this.handler = require('../handlers/characterHandler'); 
    this.loadCommands();
    this.loadEvents();
  }

// src/client.js
loadCommands() {
    const commandsPath = path.join(__dirname, '../commands');
    const commandFolders = fs.readdirSync(commandsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                this.commands.set(command.data.name, command);
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing required "data" or "execute" property.`);
            }
        }
    }
}

  loadEvents() {
    const eventsPath = path.join(__dirname, '../events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
      const event = require(path.join(eventsPath, file));
      if (event.once) {
        this.once(event.name, (...args) => event.execute(...args, this));
      } else {
        this.on(event.name, (...args) => event.execute(...args, this));
      }
    }
  }
}

module.exports = RPGClient;