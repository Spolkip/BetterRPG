// events/interactionCreate.js
const { Events } = require('discord.js');
const characterHandler = require('../handlers/characterHandler');
const createCharacterFlow = require('../handlers/createCharacterFlow');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            if (!interaction.isChatInputCommand()) return;

            // Properly defer the reply for all slash commands to prevent timeout
            await interaction.deferReply({ ephemeral: true });

            // Use the correct path for createCharacterFlow
            if (interaction.commandName === 'create') {
                return await createCharacterFlow(interaction, characterHandler, false);
            }

            const command = client.commands.get(interaction.commandName);

            if (!command) {
                return interaction.editReply({ 
                    content: '❌ This command is no longer available.'
                });
            }

            await command.execute(interaction, client);
        } catch (error) {
            console.error('Error in interactionCreate:', error);
            // Use editReply instead of reply since we've already deferred
            const replyMethod = interaction.deferred ? interaction.editReply : interaction.reply;
            await replyMethod.call(interaction, { 
                content: '❌ An error occurred while executing that command.'
            });
        }
    }
};