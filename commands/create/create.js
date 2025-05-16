// commands/createcharacter.js
const { SlashCommandBuilder } = require('discord.js');
const createCharacterFlow = require('../../handlers/CreateCharacterFlow');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create')
        .setDescription('Create your RPG character')
        .setDMPermission(false),
    
    async execute(interaction) {
        try {
            await createCharacterFlow(interaction, interaction.client.handler, false);
        } catch (error) {
            console.error('Error in createcharacter command:', error);
            if (!interaction.replied) {
                await interaction.reply({
                    content: '❌ An error occurred while creating your character.',
                    ephemeral: true
                });
            }
        }
    },
    
    name: 'createcharacter',
    description: 'Create a new RPG character',
    aliases: ['cc', 'createchar', 'create'],
    usage: '',
    async validateCharacterCreation(userId) {
    // Check if already has character
    const existing = await CharacterHandler.getCharacter(userId);
    if (existing) {
        return { valid: false, message: 'You already have a character!' };
    }
    
    // Check database connection
    const isConnected = await db.testConnection();
    if (!isConnected) {
        return { valid: false, message: 'Database connection failed' };
    }
    
    return { valid: true };
},
    async executeMessage(message, args, handler) {
        try {
            await createCharacterFlow(message, handler, true);
        } catch (error) {
            console.error('Error in prefix create command:', error);
            await message.reply('❌ An error occurred while creating your character.');
        }
    }
    
    
};