// events/interactionCreate.js
const { Events } = require('discord.js');
const characterHandler = require('../handlers/characterHandler');
const createCharacterFlow = require('../handlers/CreateCharacterFlow');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            if (!interaction.isChatInputCommand()) return;

            if (interaction.commandName === 'create') {
                return await createCharacterFlow(interaction, characterHandler, true);
            }

            const command = client.commands.get(interaction.commandName);

            if (!command) {
                return interaction.reply({ 
                    content: '❌ This command is no longer available.', 
                    ephemeral: true 
                });
            }

            await command.execute(interaction, true);
        } catch (error) {
            console.error('Error in interactionCreate:', error);
            await interaction.reply({ 
                content: '❌ An error occurred while executing that command.', 
                ephemeral: true 
            });
        }
    }
};