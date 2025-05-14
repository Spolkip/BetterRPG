// events/messageCreate.js
const { Events, Collection } = require('discord.js');
const path = require('path');
const fs = require('fs');
const characterHandler = require('../handlers/characterHandler');
const createCharacterFlow = require('../handlers/createCharacterFlow');

// Prefix commands cache
const prefixCommands = new Collection();

// Try to load prefix commands with error handling
try {
    const prefixCommandsPath = path.join(__dirname, '../commands');
    
    // Check if directory exists
    if (fs.existsSync(prefixCommandsPath)) {
        const prefixCommandFiles = fs.readdirSync(prefixCommandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of prefixCommandFiles) {
            try {
                const command = require(path.join(prefixCommandsPath, file));
                if (command.info && command.info.name) {
                    prefixCommands.set(command.info.name, command);
                }
            } catch (error) {
                console.error(`Error loading prefix command ${file}:`, error);
            }
        }
    } else {
        console.warn('prefixCommands directory not found - prefix commands will be disabled');
    }
} catch (error) {
    console.error('Error initializing prefix commands:', error);
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        try {
            if (message.author.bot) return;

            const prefix = 'rpg ';
            if (!message.content.startsWith(prefix)) return;

            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            // Handle create command specifically
            if (commandName === 'create') {
                try {
                    // Check for existing character first
                    const existingChar = await characterHandler.getCharacter(message.author.id);
                    if (existingChar) {
                        return message.channel.send('❌ You already have a character!');
                    }
                    
                    // If no character, proceed with character creation
                    return await createCharacterFlow(message, characterHandler, true);
                } catch (error) {
                    console.error('Error checking for existing character:', error);
                    return message.channel.send('❌ An error occurred while checking your character status.');
                }
            }

            // Skip if no commands loaded
            if (prefixCommands.size === 0) {
                return message.reply('⚠️ Prefix commands are currently unavailable.');
            }

            const command = prefixCommands.get(commandName) || 
                prefixCommands.find(cmd => cmd.info.aliases?.includes(commandName));

            if (!command) {
                return message.reply(`❌ Unknown command. Use \`${prefix}help\` for available commands.`);
            }

            await command.execute(message, false, args);
        } catch (error) {
            console.error('Error in messageCreate:', error);
            await message.channel.send('❌ An error occurred while executing that command.');
        }
    }
};