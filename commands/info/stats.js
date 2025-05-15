const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('canvas');

module.exports = {
    // Slash command data
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Display your character stats')
        .setDMPermission(false),
    
    // Slash command handler
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: false });
            
            const handler = interaction.client.handler;
            const userId = interaction.user.id;
            
            const character = await handler.getCharacter(userId);
            
            if (!character) {
                return interaction.editReply('❌ You don\'t have a character yet! Use `/createc` to create one.');
            }
            
            const statsCard = await createStatsCard(character);
            await interaction.editReply({ embeds: [statsCard.embed], files: [statsCard.attachment] });
            
        } catch (error) {
            console.error('Error in stats command:', error);
            return interaction.editReply('❌ An error occurred while fetching your stats.');
        }
    },
    
    // Prefix command properties
    name: 'stats',
    description: 'Display your character stats',
    aliases: ['stat'],
    usage: '',
    
    // Prefix command handler
    async executeMessage(message, args, handler) {
        try {
            const userId = message.author.id;
            
            const character = await handler.getCharacter(userId);
            
            if (!character) {
                return message.reply('❌ You don\'t have a character yet! Use `rpg create` to create one.');
            }
            
            const statsCard = await createStatsCard(character);
            await message.reply({ embeds: [statsCard.embed], files: [statsCard.attachment] });
            
        } catch (error) {
            console.error('Error in stats command:', error);
            return message.reply('❌ An error occurred while fetching your stats.');
        }
    }
};

async function createStatsCard(character) {
    // Calculate derived stats
    const critChance = Math.min(5 + (character.dexterity * 0.2), 25).toFixed(1);
    const dodgeChance = Math.min(3 + (character.agility * 0.15), 20).toFixed(1);
    const physicalDefense = Math.floor(5 + (character.constitution * 0.5) + (character.durability * 0.8));
    const magicalDefense = Math.floor(5 + (character.wisdom * 0.5) + (character.intelligence * 0.3));
    const attackPower = Math.floor(10 + (character.strength * 1.2) + (character.dexterity * 0.3));
    const spellPower = Math.floor(10 + (character.intelligence * 1.2) + (character.wisdom * 0.5));
    
    // Create canvas
    const canvas = createCanvas(600, 400);
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, canvas.width-20, canvas.height-20);
    
    // Create stat sections
    const statSections = [
        {
            title: 'PRIMARY STATS',
            x: 30,
            y: 40,
            stats: [
                { name: 'Strength', value: character.strength },
                { name: 'Intelligence', value: character.intelligence },
                { name: 'Dexterity', value: character.dexterity },
                { name: 'Constitution', value: character.constitution },
                { name: 'Vitality', value: character.vitality },
                { name: 'Wisdom', value: character.wisdom },
                { name: 'Agility', value: character.agility },
                { name: 'Durability', value: character.durability },
                { name: 'Charisma', value: character.charisma }
            ]
        },
        {
            title: 'COMBAT STATS',
            x: 300,
            y: 40,
            stats: [
                { name: 'Attack Power', value: attackPower },
                { name: 'Spell Power', value: spellPower },
                { name: 'Physical Def', value: physicalDefense },
                { name: 'Magical Def', value: magicalDefense },
                { name: 'Crit Chance', value: `${critChance}%` },
                { name: 'Dodge Chance', value: `${dodgeChance}%` }
            ]
        }
    ];
    
    // Draw stat sections
    statSections.forEach(section => {
        // Section title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(section.title, section.x, section.y);
        
        // Draw horizontal line under title
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(section.x, section.y + 8);
        ctx.lineTo(section.x + 250, section.y + 8);
        ctx.stroke();
        
        // Draw stats
        ctx.font = '16px Arial';
        section.stats.forEach((stat, index) => {
            const yPos = section.y + 35 + (index * 25);
            
            // Stat name
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText(stat.name, section.x, yPos);
            
            // Stat value with background
            const valueText = String(stat.value);
            const valueWidth = ctx.measureText(valueText).width + 15;
            
            // Draw background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            roundRect(ctx, section.x + 120, yPos - 15, valueWidth, 20, 5, true);
            
            // Draw stat value
            ctx.fillStyle = '#ffffff';
            ctx.fillText(valueText, section.x + 125, yPos);
        });
    });
    
    // Add available points at the bottom
    if (character.stat_points > 0) {
        ctx.fillStyle = 'rgba(100, 255, 100, 0.2)';
        roundRect(ctx, 20, 350, 560, 30, 5, true);
        
        ctx.fillStyle = '#66ff66';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Available Stat Points: ${character.stat_points}`, canvas.width/2, 372);
        ctx.textAlign = 'left';
    }
    
    // Create the embed and attachment
    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'stats.png' });
    
    const embed = new EmbedBuilder()
        .setColor('#2a5298')
        .setImage('attachment://stats.png')
        .addFields(
            { name: 'Available Points', value: `${character.stat_points || 0}`, inline: true }
        );
    
    return { embed, attachment };
}

// Helper function to draw rounded rectangles
function roundRect(ctx, x, y, width, height, radius, fill) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) {
        ctx.fill();
    } else {
        ctx.stroke();
    }
}