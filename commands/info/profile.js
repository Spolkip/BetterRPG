const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('canvas');

module.exports = {
    // Slash command data
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Display your character profile')
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
            
            const profileCard = await createProfileCard(character);
            await interaction.editReply({ embeds: [profileCard.embed], files: [profileCard.attachment] });
            
        } catch (error) {
            console.error('Error in profile command:', error);
            return interaction.editReply('❌ An error occurred while fetching your profile.');
        }
    },
    
    // Prefix command properties
    name: 'profile',
    description: 'Display your character profile',
    aliases: ['char', 'character'],
    usage: '',
    
    // Prefix command handler
    async executeMessage(message, args, handler) {
        try {
            const userId = message.author.id;
            
            const character = await handler.getCharacter(userId);
            
            if (!character) {
                return message.reply('❌ You don\'t have a character yet! Use `rpg create` to create one.');
            }
            
            const profileCard = await createProfileCard(character);
            await message.reply({ embeds: [profileCard.embed], files: [profileCard.attachment] });
            
        } catch (error) {
            console.error('Error in profile command:', error);
            return message.reply('❌ An error occurred while fetching your profile.');
        }
    }
};

async function createProfileCard(character) {
    // Create canvas
    const canvas = createCanvas(600, 400);
    const ctx = canvas.getContext('2d');
    
    // Background gradient
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
    
    // Character details
    ctx.font = '24px Arial';
    ctx.fillText(`Level ${character.level} ${character.race_name} ${character.class_name}`, 30, 95);
    
    // Add race/class emoji if available
    if (character.class_emoji || character.race_emoji) {
        ctx.font = '40px Arial';
        ctx.fillText(`${character.race_emoji || ''} ${character.class_emoji || ''}`, 500, 60);
    }
    
    // Draw character information boxes
    const infoSections = [
        {
            title: 'CHARACTER DETAILS',
            x: 30,
            y: 130,
            items: [
                { label: 'Gender', value: character.gender },
                { label: 'Age', value: character.age || 'Unknown' },
                { label: 'Alignment', value: character.alignment || 'Neutral' },
                { label: 'Title', value: character.title || 'Adventurer' }
            ]
        },
        {
            title: 'PROGRESS',
            x: 300,
            y: 130,
            items: [
                { label: 'Level', value: character.level },
                { 
                    label: 'Experience', 
                    value: `${character.xp}/${100 + (character.level * 50)}` 
                },
                { label: 'Gold', value: character.gold || 0 },
                { label: 'Reputation', value: character.reputation || 'Neutral' }
            ]
        }
    ];
    
    // Draw information sections
    infoSections.forEach(section => {
        // Section title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.fillText(section.title, section.x, section.y);
        
        // Draw horizontal line under title
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(section.x, section.y + 10);
        ctx.lineTo(section.x + 250, section.y + 10);
        ctx.stroke();
        
        // Draw items
        ctx.font = '18px Arial';
        section.items.forEach((item, index) => {
            const yPos = section.y + 40 + (index * 30);
            
            // Item label
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText(item.label, section.x, yPos);
            
            // Item value with background
            const valueText = String(item.value);
            const valueWidth = ctx.measureText(valueText).width + 20;
            
            // Draw background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            roundRect(ctx, section.x + 120, yPos - 18, valueWidth, 24, 12, true);
            
            // Draw value
            ctx.fillStyle = '#ffffff';
            ctx.fillText(valueText, section.x + 130, yPos);
        });
    });
    
    // Draw health and mana bars at the bottom
    drawResourceBar(ctx, 30, 300, 540, 25, character.health, character.max_health, '#ff5757', 'HEALTH');
    drawResourceBar(ctx, 30, 340, 540, 25, character.mana, character.max_mana, '#5799ff', 'MANA');
    
    // Create the embed and attachment
    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'profile-card.png' });
    
    const embed = new EmbedBuilder()
        .setTitle(`${character.name}'s Character Profile`)
        .setDescription(`Level ${character.level} ${character.race_name} ${character.class_name}`)
        .setColor('#2a5298')
        .setImage('attachment://profile-card.png')
        .setFooter({ text: `Created on ${new Date(character.created_at).toLocaleDateString()}` });
    
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