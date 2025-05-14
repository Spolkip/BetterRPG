// utils/createCharacterFlow.js
const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
    AttachmentBuilder
} = require('discord.js');
const { createCanvas } = require('canvas');

async function createCharacterFlow(ctx, handler, isTextCommand = false) {
    const user = ctx.user || ctx.author;
    const channel = ctx.channel;
    const reply = isTextCommand ? 
        (content) => channel.send(content) : 
        (content) => ctx.reply({ ...content, ephemeral: true });

    try {
        // 1. Verify database connection
        if (!await handler.checkDatabaseConnection()) {
            console.error('Database connection failed');
            return reply('⚠️ Database connection failed. Please contact admin.');
        }

        // 2. Check for existing character
        const existingChar = await handler.getCharacter(user.id);
        if (existingChar) {
            return reply('❌ You already have a character!');
        }

        // 3. Load creation options with validation
        let classes, races;
        try {
            [classes, races] = await Promise.all([
                handler.getClasses(),
                handler.getRaces()
            ]);

            if (!classes?.length || !races?.length) {
                console.error('Missing options:', {
                    classes: classes?.length,
                    races: races?.length
                });
                throw new Error('Character creation options not available');
            }
        } catch (error) {
            console.error('Failed to load creation options:', error);
            return reply('⚠️ Failed to load character creation options. Please try again later.');
        }

        // Create initial canvas background for the embed
        const createBackground = (progress = 0, selectedClass = null, selectedRace = null, name = null, gender = null) => {
            const canvas = createCanvas(800, 300);
            const ctx = canvas.getContext('2d');
            
            // Draw gradient background based on progress
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            
            // Gradient colors change based on progress
            if (progress < 1) {
                gradient.addColorStop(0, '#1a1a2e');
                gradient.addColorStop(1, '#16213e');
            } else if (progress < 2) {
                gradient.addColorStop(0, '#1a2e3e');
                gradient.addColorStop(1, '#163e2e');
            } else if (progress < 3) {
                gradient.addColorStop(0, '#2e1a3e');
                gradient.addColorStop(1, '#3e162e');
            } else {
                gradient.addColorStop(0, '#3e2e1a');
                gradient.addColorStop(1, '#2e3e16');
            }
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Add decorative elements
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 20; i++) {
                ctx.beginPath();
                ctx.arc(
                    Math.random() * canvas.width,
                    Math.random() * canvas.height,
                    Math.random() * 5 + 1,
                    0,
                    Math.PI * 2
                );
                ctx.stroke();
            }
            
            // Add title text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 48px "Arial"';
            ctx.textAlign = 'center';
            ctx.fillText('Character Creation', canvas.width / 2, 80);
            
            // Add progress indicator
            ctx.font = '20px "Arial"';
            ctx.fillText(`Step ${progress + 1} of 4`, canvas.width / 2, 120);
            
            // Add selected options if available
            ctx.font = '24px "Arial"';
            ctx.textAlign = 'left';
            
            if (selectedClass) {
                const classData = classes.find(c => c.id === selectedClass);
                ctx.fillText(`Class: ${classData.name} ${classData.emoji || ''}`, 50, 180);
            }
            
            if (selectedRace) {
                const raceData = races.find(r => r.id === selectedRace);
                ctx.fillText(`Race: ${raceData.name} ${raceData.emoji || ''}`, 50, 220);
            }
            
            if (name) {
                ctx.fillText(`Name: ${name}`, 50, 260);
            }
            
            if (gender) {
                ctx.fillText(`Gender: ${gender}`, 400, 260);
            }
            
            return canvas;
        };

        // Initial background (step 0)
        let backgroundCanvas = createBackground(0);
        let background = new AttachmentBuilder(backgroundCanvas.toBuffer(), { name: 'creation-bg.png' });

        // 4. Create selection menus
        const formatOption = (item) => ({
            label: item.name.slice(0, 25),
            value: item.id,
            description: item.description?.slice(0, 50) || 'No description',
            emoji: item.emoji || undefined
        });

        const embed = new EmbedBuilder()
            .setTitle('Character Creation')
            .setDescription('Let\'s create your character!')
            .setColor('#0099ff')
            .setImage('attachment://creation-bg.png');

        const classRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_class')
                .setPlaceholder('Select a class')
                .addOptions(classes.map(formatOption))
        );

        const raceRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_race')
                .setPlaceholder('Select a race')
                .addOptions(races.map(formatOption))
        );

        // 5. Handle character creation flow
        const creationData = {
            userId: user.id,
            classId: null,
            raceId: null,
            name: null,
            gender: null
        };

        const message = await reply({ 
            embeds: [embed], 
            components: [classRow, raceRow],
            files: [background]
        });

        const updateBackground = async () => {
            const progress = 
                (creationData.classId ? 1 : 0) + 
                (creationData.raceId ? 1 : 0) + 
                (creationData.name ? 1 : 0) + 
                (creationData.gender ? 1 : 0);
                
            backgroundCanvas = createBackground(
                progress,
                creationData.classId,
                creationData.raceId,
                creationData.name,
                creationData.gender
            );
            background = new AttachmentBuilder(backgroundCanvas.toBuffer(), { name: 'creation-bg.png' });
            
            await message.edit({ 
                embeds: [embed.setImage('attachment://creation-bg.png')], 
                files: [background] 
            });
        };

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 5 * 60 * 1000
        });

        collector.on('collect', async i => {
            try {
                if (i.user.id !== user.id) {
                    return i.reply({ content: 'This is not your character creation!', ephemeral: true });
                }

                await i.deferUpdate();

                if (i.customId === 'select_class') {
                    creationData.classId = i.values[0];
                    const selected = classes.find(c => c.id === i.values[0]);
                    await i.followUp({ content: `Class selected: ${selected.name} ${selected.emoji || ''}`, ephemeral: true });
                    await updateBackground();
                }

                if (i.customId === 'select_race') {
                    creationData.raceId = i.values[0];
                    const selected = races.find(r => r.id === i.values[0]);
                    await i.followUp({ content: `Race selected: ${selected.name} ${selected.emoji || ''}`, ephemeral: true });
                    await updateBackground();
                }

                if (creationData.classId && creationData.raceId && !creationData.name) {
                    // Disable the select menus
                    classRow.components[0].setDisabled(true);
                    raceRow.components[0].setDisabled(true);
                    await message.edit({ components: [classRow, raceRow] });
                    
                    // Ask for name
                    await channel.send({ 
                        content: `${user}, what is your character's name? (Max 25 characters)` 
                    });
                    
                    const nameMsg = await channel.awaitMessages({
                        filter: m => m.author.id === user.id,
                        max: 1,
                        time: 60000
                    });

                    if (!nameMsg.size) {
                        return channel.send('Character creation timed out. Start again.');
                    }
                    creationData.name = nameMsg.first().content.slice(0, 25);
                    await updateBackground();
                    
                    // Ask for gender (as text input)
                    await channel.send('What is your character\'s gender? (Type your answer, e.g. Male, Female, Non-binary, etc.)');
                    
                    const genderMsg = await channel.awaitMessages({
                        filter: m => m.author.id === user.id,
                        max: 1,
                        time: 60000
                    });

                    if (!genderMsg.size) {
                        return channel.send('Character creation timed out. Start again.');
                    }
                    creationData.gender = genderMsg.first().content;
                    await updateBackground();

                    // Finalize creation with character card
                    const character = await handler.createCharacter(creationData);
                    const classData = await handler.getClassById(creationData.classId);
                    const raceData = await handler.getRaceById(creationData.raceId);

                    // Create character card
                    const cardCanvas = createCanvas(800, 400);
                    const cardCtx = cardCanvas.getContext('2d');
                    
                    // Draw card background using colors from the creation process
                    const cardGradient = cardCtx.createLinearGradient(0, 0, cardCanvas.width, cardCanvas.height);
                    cardGradient.addColorStop(0, '#1e3c72');
                    cardGradient.addColorStop(1, '#2a5298');
                    cardCtx.fillStyle = cardGradient;
                    cardCtx.fillRect(0, 0, cardCanvas.width, cardCanvas.height);
                    
                    // Add decorative border
                    cardCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    cardCtx.lineWidth = 10;
                    cardCtx.strokeRect(10, 10, cardCanvas.width-20, cardCanvas.height-20);
                    
                    // Add character avatar placeholder
                    cardCtx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    cardCtx.beginPath();
                    cardCtx.arc(150, 250, 80, 0, Math.PI * 2);
                    cardCtx.fill();
                    cardCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    cardCtx.lineWidth = 3;
                    cardCtx.stroke();
                    
                    // Add character info
                    cardCtx.fillStyle = '#ffffff';
                    cardCtx.font = 'bold 40px "Arial"';
                    cardCtx.fillText(character.name, 50, 60);
                    
                    cardCtx.font = '24px "Arial"';
                    cardCtx.fillText(`${raceData.name} ${classData.name}`, 50, 100);
                    
                    // Add stats
                    cardCtx.font = '20px "Arial"';
                    cardCtx.fillText(`Level: 1`, 50, 140);
                    cardCtx.fillText(`Gender: ${character.gender}`, 50, 170);
                    
                    // Add stats table
                    const stats = [
                        `STR: ${character.strength}`,
                        `INT: ${character.intelligence}`,
                        `DEX: ${character.dexterity}`,
                        `CON: ${character.constitution}`,
                        `HP: ${character.health}/${character.max_health}`,
                        `MP: ${character.mana}/${character.max_mana}`
                    ];
                    
                    stats.forEach((stat, i) => {
                        cardCtx.fillText(stat, 50 + (i % 2) * 200, 220 + Math.floor(i/2) * 30);
                    });
                    
                    // Add class/race emoji if available
                    if (classData.emoji || raceData.emoji) {
                        cardCtx.font = '30px "Arial"';
                        cardCtx.fillText(`${raceData.emoji || ''} ${classData.emoji || ''}`, cardCanvas.width - 100, 80);
                    }
                    
                    const characterCard = new AttachmentBuilder(cardCanvas.toBuffer(), { name: 'character-card.png' });

                    const confirmEmbed = new EmbedBuilder()
                        .setTitle('🌟 Character Created! 🌟')
                        .setDescription(`**${character.name}**, the ${raceData.name} ${classData.name}`)
                        .setColor('#5865F2')
                        .setImage('attachment://character-card.png')
                        .setFooter({ text: 'Your adventure begins now!' });

                    await channel.send({ 
                        embeds: [confirmEmbed], 
                        files: [characterCard] 
                    });
                    collector.stop();
                }
            } catch (error) {
                console.error('Error during character creation step:', error);
                await channel.send('⚠️ An error occurred during character creation. Please try again.');
            }
        });

        collector.on('end', () => {
            if (!creationData.name) {
                channel.send('Character creation timed out. Please try again.');
            }
        });

    } catch (error) {
        console.error('Error in character creation flow:', error);
        channel.send('⚠️ An unexpected error occurred. Please try again later.');
    }
}

module.exports = createCharacterFlow;