// commands/upgrade/upgrade.js
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('canvas');

module.exports = {
    // Slash command data
    data: new SlashCommandBuilder()
        .setName('upgrade')
        .setDescription('Upgrade your character stats using skill points')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('stat')
                .setDescription('The stat you want to upgrade')
                .setRequired(true)
                .addChoices(
                    { name: 'Strength', value: 'strength' },
                    { name: 'Intelligence', value: 'intelligence' },
                    { name: 'Dexterity', value: 'dexterity' },
                    { name: 'Constitution', value: 'constitution' },
                    { name: 'Vitality', value: 'vitality' },
                    { name: 'Wisdom', value: 'wisdom' },
                    { name: 'Agility', value: 'agility' },
                    { name: 'Durability', value: 'durability' },
                    { name: 'Charisma', value: 'charisma' }
                )
        )
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('How many points to add (default: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(100)
        ),
    
    // Slash command handler
    async execute(interaction) {
        try {
            // Get inputs
            const selectedStat = interaction.options.getString('stat');
            const amountToAdd = interaction.options.getInteger('amount') || 1;
            
            const handler = interaction.client.handler;
            const userId = interaction.user.id;
            
            // Get character data
            const character = await handler.getCharacter(userId);
            
            if (!character) {
                return interaction.reply({ 
                    content: '❌ You don\'t have a character yet! Use `/createc` to create one.',
                    ephemeral: true
                });
            }
            
            // Check if character has sufficient stat points
            if (character.stat_points < amountToAdd) {
                return interaction.reply({ 
                    content: `❌ You don't have enough stat points! You have ${character.stat_points} points, but tried to spend ${amountToAdd}.`,
                    ephemeral: true
                });
            }

            // Process the upgrade
            const result = await handler.upgradeCharacterStat(userId, selectedStat, amountToAdd);
            
            if (result.success) {
                // Get updated character data
                const updatedCharacter = await handler.getCharacter(userId);
                
                // Create visualization of stat upgrade
                const canvas = createCanvas(400, 200);
                const ctx = canvas.getContext('2d');
                
                // Draw background
                const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                gradient.addColorStop(0, '#2ecc71');
                gradient.addColorStop(1, '#27ae60');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw stat increase visualization
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${getStatName(selectedStat).toUpperCase()} INCREASED!`, canvas.width / 2, 40);
                
                // Draw progress bar
                const barWidth = 300;
                const barHeight = 30;
                const startX = (canvas.width - barWidth) / 2;
                const startY = 80;
                
                // Old value background
                ctx.fillStyle = '#1a5834';
                ctx.fillRect(startX, startY, barWidth, barHeight);
                
                // Calculate relative positions based on stat values
                const maxPossibleStat = 100; // Arbitrary maximum for visualization
                const oldPos = Math.min((result.oldValue / maxPossibleStat) * barWidth, barWidth);
                const newPos = Math.min((updatedCharacter[selectedStat] / maxPossibleStat) * barWidth, barWidth);
                
                // New value overlay
                ctx.fillStyle = '#3ae374';
                ctx.fillRect(startX, startY, newPos, barHeight);
                
                // Draw value labels
                ctx.fillStyle = '#ffffff';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${result.oldValue} → ${updatedCharacter[selectedStat]}`, canvas.width / 2, startY + barHeight + 20);
                
                // Add stat description
                ctx.font = '14px Arial';
                ctx.fillText(getStatDescription(selectedStat), canvas.width / 2, startY + barHeight + 50);
                
                // Convert canvas to attachment
                const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'stat-upgrade.png' });
                
                // Create success embed
                const successEmbed = new EmbedBuilder()
                    .setTitle('Stat Points Allocated!')
                    .setDescription(`You've successfully upgraded your **${getStatName(selectedStat)}** by **${amountToAdd}** points!`)
                    .setColor('#2ecc71')
                    .addFields(
                        { name: 'New Value', value: `${updatedCharacter[selectedStat]}`, inline: true },
                        { name: 'Remaining Points', value: `${updatedCharacter.stat_points}`, inline: true }
                    )
                    .setImage('attachment://stat-upgrade.png');
                
                // Send success message
                return interaction.reply({ embeds: [successEmbed], files: [attachment] });
            } else {
                // Handle error
                return interaction.reply({ 
                    content: `❌ Failed to upgrade stat: ${result.error}`, 
                    ephemeral: true 
                });
            }
        } catch (error) {
            console.error('Error in upgrade command:', error);
            return interaction.reply({ 
                content: '❌ An error occurred while upgrading your stat.',
                ephemeral: true
            });
        }
    },
    
    // Prefix command properties
    name: 'upgrade',
    description: 'Upgrade your character stats using skill points',
    aliases: ['up', 'skillpoint', 'sp'],
    usage: '<stat> [amount]',
    
    // Prefix command handler
    async executeMessage(message, args, handler) {
        try {
            const userId = message.author.id;
            
            // Check for arguments
            if (!args.length) {
                return message.reply(`❌ Please specify which stat to upgrade. Usage: \`rpg upgrade <stat> [amount]\`
Available stats: strength, intelligence, dexterity, constitution, vitality, wisdom, agility, durability, charisma`);
            }
            
            // Parse input
            const statInput = args[0].toLowerCase();
            const amountToAdd = args[1] ? parseInt(args[1]) : 1;
            
            // Validate amount
            if (isNaN(amountToAdd) || amountToAdd < 1) {
                return message.reply('❌ Please provide a valid positive number for the amount.');
            }
            
            // Map stat abbreviations to full names
            const statMap = {
                'str': 'strength',
                'int': 'intelligence',
                'dex': 'dexterity',
                'con': 'constitution',
                'vit': 'vitality',
                'wis': 'wisdom',
                'agi': 'agility',
                'dur': 'durability',
                'cha': 'charisma'
            };
            
            // Resolve the stat name
            const selectedStat = statMap[statInput] || statInput;
            
            // Check if valid stat
            const validStats = ['strength', 'intelligence', 'dexterity', 'constitution', 
                              'vitality', 'wisdom', 'agility', 'durability', 'charisma'];
            
            if (!validStats.includes(selectedStat)) {
                return message.reply(`❌ Invalid stat. Available stats: ${validStats.join(', ')}`);
            }
            
            // Get character data
            const character = await handler.getCharacter(userId);
            
            if (!character) {
                return message.reply('❌ You don\'t have a character yet! Use `rpg create` to create one.');
            }
            
            // Check if character has sufficient stat points
            if (character.stat_points < amountToAdd) {
                return message.reply(`❌ You don't have enough stat points! You have ${character.stat_points} points, but tried to spend ${amountToAdd}.`);
            }
            
            // Process the upgrade - same logic as slash command
            const result = await handler.upgradeCharacterStat(userId, selectedStat, amountToAdd);
            
            if (result.success) {
                // Get updated character data
                const updatedCharacter = await handler.getCharacter(userId);
                
                // Create the same visualization as in the slash command
                const canvas = createCanvas(400, 200);
                const ctx = canvas.getContext('2d');
                
                // Draw background
                const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                gradient.addColorStop(0, '#2ecc71');
                gradient.addColorStop(1, '#27ae60');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw stat increase visualization
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${getStatName(selectedStat).toUpperCase()} INCREASED!`, canvas.width / 2, 40);
                
                // Draw progress bar
                const barWidth = 300;
                const barHeight = 30;
                const startX = (canvas.width - barWidth) / 2;
                const startY = 80;
                
                // Old value background
                ctx.fillStyle = '#1a5834';
                ctx.fillRect(startX, startY, barWidth, barHeight);
                
                // Calculate relative positions based on stat values
                const maxPossibleStat = 100; // Arbitrary maximum for visualization
                const oldPos = Math.min((result.oldValue / maxPossibleStat) * barWidth, barWidth);
                const newPos = Math.min((updatedCharacter[selectedStat] / maxPossibleStat) * barWidth, barWidth);
                
                // New value overlay
                ctx.fillStyle = '#3ae374';
                ctx.fillRect(startX, startY, newPos, barHeight);
                
                // Draw value labels
                ctx.fillStyle = '#ffffff';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${result.oldValue} → ${updatedCharacter[selectedStat]}`, canvas.width / 2, startY + barHeight + 20);
                
                // Add stat description
                ctx.font = '14px Arial';
                ctx.fillText(getStatDescription(selectedStat), canvas.width / 2, startY + barHeight + 50);
                
                // Convert canvas to attachment
                const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'stat-upgrade.png' });
                
                // Create success embed
                const successEmbed = new EmbedBuilder()
                    .setTitle('Stat Points Allocated!')
                    .setDescription(`You've successfully upgraded your **${getStatName(selectedStat)}** by **${amountToAdd}** points!`)
                    .setColor('#2ecc71')
                    .addFields(
                        { name: 'New Value', value: `${updatedCharacter[selectedStat]}`, inline: true },
                        { name: 'Remaining Points', value: `${updatedCharacter.stat_points}`, inline: true }
                    )
                    .setImage('attachment://stat-upgrade.png');
                
                // Send success message
                return message.reply({ embeds: [successEmbed], files: [attachment] });
            } else {
                // Handle error
                return message.reply(`❌ Failed to upgrade stat: ${result.error}`);
            }
        } catch (error) {
            console.error('Error in upgrade command (prefix):', error);
            return message.reply('❌ An error occurred while upgrading your stat.');
        }
    }
};

// Helper function to get a friendly stat name
function getStatName(stat) {
    const statNames = {
        'strength': 'Strength',
        'intelligence': 'Intelligence',
        'dexterity': 'Dexterity',
        'constitution': 'Constitution',
        'vitality': 'Vitality',
        'wisdom': 'Wisdom',
        'agility': 'Agility',
        'durability': 'Durability',
        'charisma': 'Charisma'
    };
    
    return statNames[stat] || stat;
}

// Helper function to get stat descriptions
function getStatDescription(stat) {
    const descriptions = {
        'strength': 'Increases physical damage and carrying capacity',
        'intelligence': 'Increases magical power and maximum mana',
        'dexterity': 'Improves accuracy and critical hit chance',
        'constitution': 'Improves physical defense and stamina',
        'vitality': 'Increases maximum health points',
        'wisdom': 'Improves magical defense and mana regeneration',
        'agility': 'Increases dodge chance and movement speed',
        'durability': 'Reduces damage taken and improves armor effectiveness',
        'charisma': 'Improves NPC interactions and shop prices'
    };
    
    return descriptions[stat] || 'Improves character abilities';
}