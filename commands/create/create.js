// commands/createcharacter.js
const { SlashCommandBuilder } = require('discord.js');
const createCharacterFlow = require('../utils/createCharacterFlow');

module.exports = {
    // Slash command data
    data: new SlashCommandBuilder()
        .setName('createc')
        .setDescription('Create your RPG character')
        .setDMPermission(false),
    
    // Slash command handler
    async execute(interaction) {
        await createCharacterFlow(interaction, interaction.client.handler, false);
    },
    
    // Prefix command properties
    name: 'createcharacter',
    description: 'Create a new RPG character',
    aliases: ['cc', 'createchar,create'],
    usage: '',
    
    // Prefix command handler
    async executeMessage(message, args, handler) {
        await createCharacterFlow(message, handler, true);
    }
};