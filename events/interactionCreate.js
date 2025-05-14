// events/interactionCreate.js
const { Events } = require('discord.js');
const characterHandler = require('../handlers/characterHandler');
const createCharacterFlow = require('../handlers/CreateCharacterFlow'); // Make sure this import is here!

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            if (!interaction.isChatInputCommand()) return;
            
            // Get command
            const command = client.commands.get(interaction.commandName);
            
            // Handle missing commands
            if (!command) {
                return interaction.reply({ 
                    content: '❌ This command is no longer available.', 
                    ephemeral: true 
                });
            }
            
            // Special handling for create command
            if (interaction.commandName === 'create') {
                return await createCharacterFlow(interaction, characterHandler, false);
            }
            
            // For all other commands, execute normally
            await command.execute(interaction, client);
        } catch (error) {
            console.error('Error in interactionCreate:', error);
            
            // Handle response based on interaction state
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '❌ An error occurred while executing that command.', 
                        ephemeral: true 
                    });
                } else if (interaction.deferred) {
                    await interaction.editReply({ 
                        content: '❌ An error occurred while executing that command.' 
                    });
                }
            } catch (followUpError) {
                console.error('Error handling command error response:', followUpError);
            }
        }
    }
};