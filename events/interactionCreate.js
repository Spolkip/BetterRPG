// events/interactionCreate.js
const { Events } = require('discord.js');
const createCharacterFlow = require('../handlers/CreateCharacterFlow');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;

        try {
            const command = client.commands.get(interaction.commandName);
            
            if (!command) {
                return interaction.reply({ 
                    content: '❌ This command is no longer available.', 
                    ephemeral: true 
                });
            }

            // Special handling for create command
            if (interaction.commandName === 'createc') {
                return await createCharacterFlow(interaction, client.handler, false);
            }

            await command.execute(interaction);
            
        } catch (error) {
            console.error(`Error executing ${interaction.commandName}:`, error);
            
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ 
                    content: '❌ An error occurred while executing that command.' 
                });
            } else {
                await interaction.reply({ 
                    content: '❌ An error occurred while executing that command.',
                    ephemeral: true 
                });
            }
        }
    }
};