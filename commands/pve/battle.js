const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChatInputCommandInteraction } = require('discord.js');
const enemyHandler = require('../../handlers/EnemyHandler');
const characterHandler = require('../../handlers/characterHandler');
const skillHandler = require('../../handlers/abilities');

module.exports = {
    // Slash command configuration
    data: new SlashCommandBuilder()
        .setName('battle')
        .setDescription('Start a manual battle against an enemy'),
    
    // Prefix command configuration
    name: 'battle',
    description: 'Start a manual battle against an enemy',
    aliases: ['fight', 'combat'],
    usage: '',
    
    async execute(interaction) {
        await interaction.deferReply();
        await this.handleBattle(interaction, interaction.user.id);
    },
    
    async executeMessage(message, args) {
        await this.handleBattle(message, message.author.id);
    },
    
    async handleBattle(context, userId) {
        const isSlashCommand = context instanceof ChatInputCommandInteraction;
        const replyMethod = isSlashCommand ? 
            (content) => context.editReply(content) : 
            (content) => context.channel.send(content);
        
        const character = await characterHandler.getCharacter(userId);
        if (!character) {
            return replyMethod('❌ You need to create a character first! Use `/create`');
        }

        if (enemyHandler.isOnCooldown(userId)) {
            const cooldown = enemyHandler.getCooldown(userId);
            return replyMethod(`⏳ You're on cooldown! Please wait ${cooldown} more seconds before battling again.`);
        }

        // Get scaled enemy
        const enemy = enemyHandler.getRandomEnemy(
            Math.max(1, character.level - 2),
            character.level + 2
        );

        // Start manual battle
        await this.manualBattle(context, character, enemy, isSlashCommand);
        
        enemyHandler.setCooldown(userId, 300); // 5 min cooldown
    },
    
    async manualBattle(context, character, enemy, isSlashCommand) {
        let battleLog = [`⚔️ Battle against ${enemy.name} (Level ${enemy.level}) begins!`];
        let playerHP = character.health;
        let enemyHP = enemy.health;
        let currentRound = 1;
        
        const skills = await skillHandler.getCharacterSkills(character.id);
        const activeSkills = skills.filter(skill => !skill.is_passive);
        
        while (playerHP > 0 && enemyHP > 0 && currentRound <= 10) {
            battleLog.push(`\n**Round ${currentRound}**`);
            
            // Player turn with skill selection
            const playerTurn = await this.playerTurn(
                context, 
                character, 
                enemy, 
                playerHP, 
                enemyHP, 
                activeSkills, 
                battleLog,
                isSlashCommand
            );
            
            if (playerTurn.aborted) return; // Player fled
            playerHP = playerTurn.playerHP;
            enemyHP = playerTurn.enemyHP;
            if (enemyHP <= 0) break;
            
            // Enemy turn
            const enemyAttack = enemyHandler.calculateDamage(enemy, character, false);
            if (!enemyAttack.wasDodged) {
                playerHP = Math.max(0, playerHP - enemyAttack.damage);
                const attackMethod = enemy.attackPhrases[Math.floor(Math.random() * enemy.attackPhrases.length)];
                const attackMsg = enemyAttack.isCritical
                    ? `💥 **DEVASTATING BLOW!** ${enemy.name} ${attackMethod} for ${enemyAttack.damage} damage!`
                    : `💥 ${enemy.name} ${attackMethod} for ${enemyAttack.damage} damage.`;
                battleLog.push(attackMsg);
            } else {
                battleLog.push(`🍃 You dodge ${enemy.name}'s attack!`);
            }
            
            currentRound++;
        }
        
        const victory = playerHP > 0;
        await this.sendBattleResult(context, character, enemy, {
            victory,
            battleLog,
            playerHP,
            enemyHP,
            xpEarned: victory ? enemy.xp : Math.floor(enemy.xp * 0.3),
            goldEarned: victory ? enemy.gold : 0,
            roundsFought: currentRound - 1
        }, isSlashCommand);
    },
    
async playerTurn(context, character, enemy, playerHP, enemyHP, skills, battleLog, isSlashCommand) {
    try {
        // Debug: Log the skills we received
        console.log('Received skills:', skills);
        
        // Get fresh skills data from database
        const dbSkills = await skillHandler.getCharacterSkills(character.id);
        console.log('Database skills:', dbSkills);
        
        // Filter for active, unlocked skills
        const activeSkills = dbSkills.filter(skill => 
            !skill.is_passive && 
            skill.unlocked
        );
        console.log('Active skills:', activeSkills);

        // Create action row
        const actionRow = new ActionRowBuilder();
        
        // Add basic attack button
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId('basic_attack')
                .setLabel('⚔️ Basic Attack')
                .setStyle(ButtonStyle.Primary)
        );

        // Add skill buttons
        if (activeSkills.length > 0) {
            actionRow.addComponents(
                ...activeSkills.map(skill => {
                    const canUse = character.mana >= (skill.mana_cost || 0);
                    return new ButtonBuilder()
                        .setCustomId(`skill_${skill.id}`)
                        .setLabel(`${skill.name} (${skill.mana_cost} MP)`)
                        .setStyle(canUse ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setDisabled(!canUse);
                })
            );
        }

        // Add flee button
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId('flee')
                .setLabel('🏃 Flee')
                .setStyle(ButtonStyle.Danger)
        );

        // Create embed
        const embed = new EmbedBuilder()
            .setTitle(`Your Turn - Round ${battleLog.filter(l => l.includes('Round')).length + 1}`)
            .setDescription(battleLog.join('\n'))
            .addFields(
                { name: 'Your Stats', value: `❤️ HP: ${playerHP}/${character.max_health}\n✨ MP: ${character.mana}/${character.max_mana}`, inline: true },
                { name: `${enemy.name}`, value: `❤️ HP: ${enemyHP}/${enemy.health}`, inline: true }
            )
            .setColor('#FFA500');

        // Send message with components
        const message = isSlashCommand
            ? await context.editReply({ embeds: [embed], components: [actionRow] })
            : await context.channel.send({ embeds: [embed], components: [actionRow] });

        // Create collector
        const collector = message.createMessageComponentCollector({ 
            componentType: ComponentType.Button,
            time: 60000,
            max: 1
        });

        return new Promise((resolve) => {
            collector.on('collect', async (interaction) => {
                try {
                    const userId = isSlashCommand ? context.user.id : context.author.id;
                    if (interaction.user.id !== userId) {
                        await interaction.reply({ content: '❌ This is not your battle!', ephemeral: true });
                        return;
                    }

                    await interaction.deferUpdate();

                    let result = { playerHP, enemyHP };

                    switch (interaction.customId) {
                        case 'basic_attack':
                            result = this.handleBasicAttack(character, enemy, playerHP, enemyHP, battleLog);
                            break;
                        case 'flee':
                            battleLog.push('🏃 You fled from battle!');
                            return resolve({ aborted: true });
                        default:
                            if (interaction.customId.startsWith('skill_')) {
                                const skillId = parseInt(interaction.customId.split('_')[1]);
                                result = await this.handleSkillAttack(
                                    skillId,
                                    character,
                                    enemy,
                                    playerHP,
                                    enemyHP,
                                    activeSkills,
                                    battleLog
                                );
                            }
                    }

                    resolve({ ...result, aborted: false });
                } catch (error) {
                    console.error('Interaction error:', error);
                    resolve({ aborted: false, playerHP, enemyHP });
                }
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    battleLog.push('⏰ You took too long to act!');
                    await message.edit({ 
                        embeds: [embed.setDescription(battleLog.join('\n'))], 
                        components: [] 
                    });
                    resolve({ aborted: false, playerHP, enemyHP });
                }
            });
        });
    } catch (error) {
        console.error('Player turn error:', error);
        return { aborted: false, playerHP, enemyHP };
    }
},
    
    handleBasicAttack(character, enemy, playerHP, enemyHP, battleLog) {
        const attack = enemyHandler.calculateDamage(character, enemy, true);
        if (!attack.wasDodged) {
            enemyHP = Math.max(0, enemyHP - attack.damage);
            const msg = attack.isCritical
                ? `🎯 **CRITICAL HIT!** You strike for ${attack.damage} damage!`
                : `🗡️ You attack for ${attack.damage} damage.`;
            battleLog.push(msg);
        } else {
            battleLog.push(`🌀 ${enemy.name} dodges your attack!`);
        }
        return { playerHP, enemyHP };
    },
    
    async handleSkillAttack(skillId, character, enemy, playerHP, enemyHP, skills, battleLog) {
        const skill = skills.find(s => s.id === parseInt(skillId));
        if (!skill) {
            battleLog.push('❌ Invalid skill selected! Using basic attack instead.');
            return this.handleBasicAttack(character, enemy, playerHP, enemyHP, battleLog);
        }
        
        const result = await skillHandler.useSkill(character.id, skill.id, enemy);
        if (result.success) {
            battleLog.push(`✨ You use ${skill.name}: ${result.message}`);
            if (result.damage) enemyHP = Math.max(0, enemyHP - result.damage);
            if (result.healing) playerHP = Math.min(character.max_health, playerHP + result.healing);
        } else {
            battleLog.push(`❌ Failed to use ${skill.name}: ${result.message}`);
        }
        
        return { playerHP, enemyHP };
    },
    
    async sendBattleResult(context, character, enemy, result, isSlashCommand) {
        const embed = new EmbedBuilder()
            .setTitle(`Battle against ${enemy.name}`)
            .setColor(result.victory ? 0x00FF00 : 0xFF0000)
            .setDescription(result.battleLog.join('\n'))
            .addFields(
                { name: 'Result', value: result.victory ? '🏆 Victory!' : '☠️ Defeat!', inline: true },
                { name: 'Rounds', value: result.roundsFought.toString(), inline: true },
                { name: 'Your HP', value: `${result.playerHP}/${character.max_health}`, inline: true }
            );
        
        if (result.victory) {
            const xpResult = await characterHandler.addXP(context.user.id, result.xpEarned);
            embed.addFields(
                { name: 'XP Earned', value: result.xpEarned.toString(), inline: true },
                { name: 'Gold Earned', value: result.goldEarned.toString(), inline: true }
            );
            
            if (xpResult.leveledUp) {
                embed.addFields(
                    { name: 'Level Up!', value: `New level: ${xpResult.newLevel}`, inline: true },
                    { name: 'Stat Points', value: `+${xpResult.pointsGained} points`, inline: true }
                );
            }
        }
        
        const reply = { embeds: [embed] };
        isSlashCommand
            ? await context.editReply(reply)
            : await context.channel.send(reply);
    }
};