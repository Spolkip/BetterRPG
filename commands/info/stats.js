// commands/stats/stats.js
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
            // Defer reply to prevent timeout
            await interaction.deferReply({ ephemeral: false });
            
            const handler = interaction.client.handler;
            const userId = interaction.user.id;
            
            // Get character data
            const character = await handler.getCharacter(userId);
            
            if (!character) {
                return interaction.editReply('❌ You don\'t have a character yet! Use `/createc` to create one.');
            }
            
            const statsCard = await createStatsCard(character);
            await interaction.editReply({ embeds: [statsCard.embed], files: [statsCard.attachment] });
            
        } catch (error) {
            console.error('Error in stats command:', error);
            // Already deferred, so use editReply
            return interaction.editReply('❌ An error occurred while fetching your stats.');
        }
    },
    
    // Prefix command properties
    name: 'stats',
    description: 'Display your character stats',
    aliases: ['stat', 'profile', 'char'],
    usage: '',
    
    // Prefix command handler
    async executeMessage(message, args, handler) {
        try {
            const userId = message.author.id;
            
            // Get character data
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

// Helper function to create visual stats card
async function createStatsCard(character) {
    // Calculate some additional derived stats
    const critChance = Math.min(5 + (character.dexterity * 0.2), 25).toFixed(1);
    const dodgeChance = Math.min(3 + (character.agility * 0.15), 20).toFixed(1);
    const physicalDefense = Math.floor(5 + (character.constitution * 0.5) + (character.durability * 0.8));
    const magicalDefense = Math.floor(5 + (character.wisdom * 0.5) + (character.intelligence * 0.3));
    const attackPower = Math.floor(10 + (character.strength * 1.2) + (character.dexterity * 0.3));
    const spellPower = Math.floor(10 + (character.intelligence * 1.2) + (character.wisdom * 0.5));
    
    // Calculate leveling progress
    const nextLevelXP = 100 + (character.level * 50); // Same formula as in characterHandler
    const progressPercent = (character.xp / nextLevelXP * 100).toFixed(1);
    
    // Create canvas
    const canvas = createCanvas(800, 500);
    const ctx = canvas.getContext('2d');
    
    // Background gradient based on class theme
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#1e3c72');
    gradient.addColorStop(1, '#2a5298');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add decorative border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, canvas.width-20, canvas.height-20);
    
    // Add character header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Arial';
    ctx.fillText(`${character.name}`, 30, 60);
    
    ctx.font = '24px Arial';
    ctx.fillText(`Level ${character.level} ${character.race_name} ${character.class_name}`, 30, 95);
    
    // Draw XP bar
    const xpBarWidth = 300;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(350, 65, xpBarWidth, 20);
    
    ctx.fillStyle = '#00ff9d';
    const fillWidth = Math.min((character.xp / nextLevelXP) * xpBarWidth, xpBarWidth);
    ctx.fillRect(350, 65, fillWidth, 20);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.fillText(`XP: ${character.xp}/${nextLevelXP} (${progressPercent}%)`, 350, 100);
    
    // Draw health and mana bars
    drawResourceBar(ctx, 30, 120, 350, 25, character.health, character.max_health, '#ff5757', 'HP');
    drawResourceBar(ctx, 30, 160, 350, 25, character.mana, character.max_mana, '#5799ff', 'MP');
    
    // Add race/class emoji if available
    if (character.class_emoji || character.race_emoji) {
        ctx.font = '40px Arial';
        ctx.fillText(`${character.race_emoji || ''} ${character.class_emoji || ''}`, 700, 60);
    }
    
    // Create stat sections
    const statSections = [
        {
            title: 'PRIMARY STATS',
            x: 30,
            y: 220,
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
            x: 400,
            y: 220,
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
        ctx.font = 'bold 20px Arial';
        ctx.fillText(section.title, section.x, section.y);
        
        // Draw horizontal line under title
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(section.x, section.y + 10);
        ctx.lineTo(section.x + 300, section.y + 10);
        ctx.stroke();
        
        // Draw stats
        ctx.font = '18px Arial';
        section.stats.forEach((stat, index) => {
            const yPos = section.y + 40 + (index * 30);
            
            // Stat name
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText(stat.name, section.x, yPos);
            
            // Stat value with pill background
            const valueText = String(stat.value);
            const valueWidth = ctx.measureText(valueText).width + 20;
            
            // Draw pill background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            roundRect(ctx, section.x + 130, yPos - 18, valueWidth, 24, 12, true);
            
            // Draw stat value
            ctx.fillStyle = '#ffffff';
            ctx.fillText(valueText, section.x + 140, yPos);
        });
    });
    
    // Add stat points notification if any
    if (character.stat_points > 0) {
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(`🎯 You have ${character.stat_points} stat points to spend!`, 30, 480);
    }
    
    // Create the embed and attachment
    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'stats-card.png' });
    
    const embed = new EmbedBuilder()
        .setTitle(`${character.name}'s Character Stats`)
        .setDescription(`Level ${character.level} ${character.race_name} ${character.class_emoji || ''} ${character.class_name} ${character.race_emoji || ''}`)
        .setColor('#2a5298')
        .setImage('attachment://stats-card.png')
        .setFooter({ text: `Gender: ${character.gender} • XP: ${character.xp}/${nextLevelXP}` });
    
    return { embed, attachment };
}

// Helper function to draw resource bars (HP/MP)
function drawResourceBar(ctx, x, y, width, height, current, max, color, label) {
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    roundRect(ctx, x, y, width, height, 5, true);
    
    // Fill based on current/max ratio
    ctx.fillStyle = color;
    const fillWidth = Math.min((current / max) * width, width);
    roundRect(ctx, x, y, fillWidth, height, 5, true);
    
    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`${label}: ${current}/${max}`, x + 10, y + height - 7);
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