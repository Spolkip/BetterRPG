// events/messageCreate.js
const { Events, Collection } = require('discord.js');
const path = require('path');
const fs = require('fs');
const characterHandler = require('../handlers/characterHandler');

// Prefix commands cache
const prefixCommands = new Collection();

// Try to load prefix commands with error handling
function loadPrefixCommands() {
    try {
        const commandsPath = path.join(__dirname, '../commands');
        
        // Check if directory exists
        if (fs.existsSync(commandsPath)) {
            const folders = fs.readdirSync(commandsPath);
            
            for (const folder of folders) {
                const folderPath = path.join(commandsPath, folder);
                
                // Skip if not a directory
                if (!fs.statSync(folderPath).isDirectory()) continue;
                
                const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
                
                for (const file of commandFiles) {
                    try {
                        const command = require(path.join(folderPath, file));
                        // Check if it has prefix command properties
                        if (command.name && command.executeMessage) {
                            prefixCommands.set(command.name, command);
                            
                            // Also register aliases if available
                            if (command.aliases && Array.isArray(command.aliases)) {
                                command.aliases.forEach(alias => {
                                    prefixCommands.set(alias, command);
                                });
                            }
                        }
                    } catch (error) {
                        console.error(`Error loading prefix command ${file}:`, error);
                    }
                }
            }
            
            console.log(`Loaded ${prefixCommands.size} prefix commands/aliases`);
        } else {
            console.warn('Commands directory not found - prefix commands will be disabled');
        }
    } catch (error) {
        console.error('Error initializing prefix commands:', error);
    }
}

// Load commands when this module is required
loadPrefixCommands();

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        try {
            if (message.author.bot) return;

            const prefix = 'rpg ';
            if (!message.content.startsWith(prefix)) return;

            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            // Handle create command specially
            if (commandName === 'create') {
                return await createCharacterFlow(message, characterHandler, true);
            }

            // Skip if no commands loaded
            if (prefixCommands.size === 0) {
                return message.reply('⚠️ Prefix commands are currently unavailable.');
            }

            // Find the command
            const command = prefixCommands.get(commandName);

            if (!command) {
                return message.reply(`❌ Unknown command. Use \`${prefix}help\` for available commands.`);
            }

            // Pass handler to command
            await command.executeMessage(message, args, characterHandler);
        } catch (error) {
            console.error('Error in messageCreate:', error);
            await message.channel.send('❌ An error occurred while executing that command.');
        }
    }
};