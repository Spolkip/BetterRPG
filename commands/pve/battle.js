const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const enemyHandler = require('../../handlers/EnemyHandler');
const characterHandler = require('../../handlers/characterHandler');
const skillHandler = require('../../handlers/abilities');

class BattleCommand {
    constructor() {
        this.data = new SlashCommandBuilder()
            .setName('battle')
            .setDescription('Start a battle against an enemy')
            .addStringOption(option =>
                option.setName('mode')
                    .setDescription('Battle mode')
                    .addChoices(
                        { name: 'Manual', value: 'manual' },
                        { name: 'Quick', value: 'quick' },
                        { name: 'Hybrid', value: 'hybrid' }
                    )
            );
        
        this.name = 'battle';
        this.description = 'Start a battle against an enemy';
        this.aliases = ['fight', 'combat'];
        this.usage = '[manual|quick|hybrid]';
    }

    async execute(interaction) {
        await interaction.deferReply();
        const mode = interaction.options?.getString('mode') || 'manual';
        await this.handleBattle(interaction, interaction.user.id, mode, true);
    }

    async executeMessage(message, args) {
        const mode = args[0] === 'quick' ? 'quick' : 
                     args[0] === 'hybrid' ? 'hybrid' : 'manual';
        await this.handleBattle(message, message.author.id, mode, false);
    }

    async handleBattle(context, userId, mode = 'manual', isSlashCommand = false) {
        const replyMethod = isSlashCommand ? 
            (content) => context.editReply(content) : 
            (content) => context.channel.send(content);
        
        try {
            const character = await characterHandler.getCharacter(userId);
            if (!character) {
                return replyMethod('❌ You need to create a character first! Use `/create`');
            }

            if (await enemyHandler.isOnCooldown(userId)) {
                const cooldown = await enemyHandler.getCooldown(userId);
                return replyMethod(`⏳ You're on cooldown! Please wait ${cooldown} more seconds.`);
            }

            const enemy = enemyHandler.getRandomEnemy(
                Math.max(1, character.level - 2),
                character.level + 2
            );

            let result;
            switch (mode) {
                case 'quick':
                    result = await enemyHandler.quickBattle(character, enemy);
                    break;
                case 'hybrid':
                    result = await this.hybridBattle(context, character, enemy, isSlashCommand);
                    break;
                default:
                    result = await this.manualBattle(context, character, enemy, isSlashCommand);
            }

            await this.sendBattleResult(context, character, enemy, result, isSlashCommand);
            await enemyHandler.setCooldown(userId, 300);
        } catch (error) {
            console.error('Battle error:', error);
            replyMethod('❌ An error occurred during battle. Please try again.');
        }
    }

    async manualBattle(context, character, enemy, isSlashCommand) {
        let battleLog = [`⚔️ Manual battle against ${enemy.name} (Level ${enemy.level}) begins!`];
        let playerHP = character.health;
        let enemyHP = enemy.health;
        let currentRound = 1;
        
        const skills = await skillHandler.getCharacterSkills(character.id);
        const activeSkills = skills.filter(skill => !skill.is_passive && skill.unlocked);
        
        while (playerHP > 0 && enemyHP > 0 && currentRound <= 15) {
            battleLog.push(`\n**Round ${currentRound}**`);
            
            const playerTurn = await this.playerTurn(
                context, character, enemy, playerHP, enemyHP, 
                activeSkills, battleLog, isSlashCommand
            );
            
            if (playerTurn.aborted) return playerTurn;
            ({ playerHP, enemyHP } = playerTurn);
            if (enemyHP <= 0) break;
            
            const enemyTurn = await this.enemyTurn(character, enemy, playerHP, battleLog);
            ({ playerHP } = enemyTurn);
            
            currentRound++;
        }
        
        return {
            victory: playerHP > 0,
            battleLog,
            playerHP,
            enemyHP,
            xpEarned: playerHP > 0 ? enemy.xp : Math.floor(enemy.xp * 0.3),
            goldEarned: playerHP > 0 ? enemy.gold : 0,
            roundsFought: currentRound - 1
        };
    }

    async hybridBattle(context, character, enemy, isSlashCommand) {
        let battleLog = [`⚡ Hybrid battle against ${enemy.name} (Level ${enemy.level}) begins!`];
        let playerHP = character.health;
        let enemyHP = enemy.health;
        let currentRound = 1;
        
        const skills = await skillHandler.getCharacterSkills(character.id);
        const activeSkills = skills.filter(skill => !skill.is_passive && skill.unlocked);
        
        while (playerHP > 0 && enemyHP > 0 && currentRound <= 10) {
            battleLog.push(`\n**Round ${currentRound}**`);
            
            // Hybrid mode - auto-decide to use skill or basic attack
            if (activeSkills.length > 0 && Math.random() < 0.4) {
                const skill = activeSkills[Math.floor(Math.random() * activeSkills.length)];
                const result = await skillHandler.useSkill(character.id, skill.id, enemy);
                
                if (result.success) {
                    battleLog.push(`✨ Used ${skill.name}: ${result.message}`);
                    if (result.damage) enemyHP = Math.max(0, enemyHP - result.damage);
                    if (result.healing) playerHP = Math.min(character.max_health, playerHP + result.healing);
                }
            } else {
                const attack = enemyHandler.calculateDamage(character, enemy, true);
                if (!attack.wasDodged) {
                    enemyHP = Math.max(0, enemyHP - attack.damage);
                    battleLog.push(attack.isCritical
                        ? `🎯 Critical hit for ${attack.damage} damage!`
                        : `🗡️ Attacked for ${attack.damage} damage.`
                    );
                } else {
                    battleLog.push(`🌀 ${enemy.name} dodged your attack!`);
                }
            }

            if (enemyHP <= 0) break;
            
            const enemyTurn = await this.enemyTurn(character, enemy, playerHP, battleLog);
            ({ playerHP } = enemyTurn);
            
            currentRound++;
        }
        
        return {
            victory: playerHP > 0,
            battleLog,
            playerHP,
            enemyHP,
            xpEarned: playerHP > 0 ? enemy.xp : Math.floor(enemy.xp * 0.3),
            goldEarned: playerHP > 0 ? enemy.gold : 0,
            roundsFought: currentRound - 1
        };
    }

    async playerTurn(context, character, enemy, playerHP, enemyHP, skills, battleLog, isSlashCommand) {
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('basic_attack')
                .setLabel('⚔️ Basic Attack')
                .setStyle(ButtonStyle.Primary),
            ...skills
                .filter(skill => character.mana >= (skill.mana_cost || 0))
                .map(skill => new ButtonBuilder()
                    .setCustomId(`skill_${skill.id}`)
                    .setLabel(`${skill.name} (${skill.mana_cost} MP)`)
                    .setStyle(ButtonStyle.Success)
                ),
            new ButtonBuilder()
                .setCustomId('flee')
                .setLabel('🏃 Flee')
                .setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
            .setTitle(`Your Turn - Round ${battleLog.filter(l => l.includes('Round')).length + 1}`)
            .setDescription(battleLog.join('\n'))
            .addFields(
                { name: 'Your Stats', value: `❤️ HP: ${playerHP}/${character.max_health}\n✨ MP: ${character.mana}/${character.max_mana}`, inline: true },
                { name: enemy.name, value: `❤️ HP: ${enemyHP}/${enemy.health}`, inline: true }
            )
            .setColor('#FFA500');

        const message = await (isSlashCommand
            ? context.editReply({ embeds: [embed], components: [actionRow] })
            : context.channel.send({ embeds: [embed], components: [actionRow] }));

        return new Promise(resolve => {
            const collector = message.createMessageComponentCollector({ 
                componentType: ComponentType.Button,
                time: 60000,
                max: 1,
                filter: i => i.user.id === (isSlashCommand ? context.user.id : context.author.id)
            });

            collector.on('collect', async interaction => {
                try {
                    await interaction.update({ embeds: [embed], components: [] });
                    
                    if (interaction.customId === 'flee') {
                        battleLog.push('🏃 You fled from battle!');
                        return resolve({ aborted: true, playerHP, enemyHP });
                    }
                    
                    const result = interaction.customId === 'basic_attack'
                        ? this.handleBasicAttack(character, enemy, playerHP, enemyHP, battleLog)
                        : await this.handleSkillAttack(
                            parseInt(interaction.customId.split('_')[1]),
                            character,
                            enemy,
                            playerHP,
                            enemyHP,
                            skills,
                            battleLog
                        );
                    
                    resolve({ ...result, aborted: false });
                } catch (error) {
                    console.error('Interaction error:', error);
                    resolve({ aborted: false, playerHP, enemyHP });
                }
            });

            collector.on('end', async collected => {
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
    }

    async enemyTurn(character, enemy, playerHP, battleLog) {
        const attack = enemyHandler.calculateDamage(enemy, character, false);
        if (!attack.wasDodged) {
            playerHP = Math.max(0, playerHP - attack.damage);
            const method = enemy.attackPhrases[Math.floor(Math.random() * enemy.attackPhrases.length)];
            battleLog.push(attack.isCritical
                ? `💥 **CRITICAL!** ${enemy.name} ${method} for ${attack.damage} damage!`
                : `💥 ${enemy.name} ${method} for ${attack.damage} damage.`
            );
        } else {
            battleLog.push(`🍃 You dodged ${enemy.name}'s attack!`);
        }
        return { playerHP };
    }

    handleBasicAttack(character, enemy, playerHP, enemyHP, battleLog) {
        const attack = enemyHandler.calculateDamage(character, enemy, true);
        if (!attack.wasDodged) {
            enemyHP = Math.max(0, enemyHP - attack.damage);
            battleLog.push(attack.isCritical
                ? `🎯 **CRITICAL!** You strike for ${attack.damage} damage!`
                : `🗡️ You attack for ${attack.damage} damage.`
            );
        } else {
            battleLog.push(`🌀 ${enemy.name} dodges your attack!`);
        }
        return { playerHP, enemyHP };
    }

    async handleSkillAttack(skillId, character, enemy, playerHP, enemyHP, skills, battleLog) {
        const skill = skills.find(s => s.id === skillId);
        if (!skill) {
            battleLog.push('❌ Invalid skill! Using basic attack.');
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
    }

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
            const xpResult = await characterHandler.addXP(isSlashCommand ? context.user.id : context.author.id, result.xpEarned);
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
        
        await (isSlashCommand 
            ? context.editReply({ embeds: [embed] })
            : context.channel.send({ embeds: [embed] }));
    }
}

module.exports = new BattleCommand();