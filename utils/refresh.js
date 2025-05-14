// commands/admin/refresh.js
const { SlashCommandBuilder } = require('discord.js');
const { registerCommands } = require('../../utils/deployCommands');

module.exports = {
  // Slash command data
  data: new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('Refresh all slash commands')
    .setDefaultMemberPermissions('0'), // Admin only
  
  // Slash command handler
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      await registerCommands(interaction.client);
      await interaction.editReply('Commands refreshed successfully!');
    } catch (error) {
      console.error(error);
      await interaction.editReply('Failed to refresh commands.');
    }
  },
  
  // Prefix command properties
  name: 'refresh',
  description: 'Refresh all slash commands (admin only)',
  aliases: ['reload'],
  usage: '',
  
  // Prefix command handler
  async executeMessage(message, args, handler) {
    // Only allow server owners to use this command
    if (message.guild && message.author.id !== message.guild.ownerId) {
      return message.reply('Only the server owner can use this command.');
    }
    
    try {
      const response = await message.reply('Refreshing commands...');
      await registerCommands(message.client);
      await response.edit('Commands refreshed successfully!');
    } catch (error) {
      console.error(error);
      await message.reply('Failed to refresh commands.');
    }
  }
};