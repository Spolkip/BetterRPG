const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const skillHandler = require('../../handlers/abilities');
const CharacterHandler = require('../../handlers/characterHandler');

// Command metadata
const commandData = {
    name: 'skills',
    description: 'Manage your character skills',
    aliases: ['abilities', 'skill'],
    usage: '[list|learn <id>|my-skills]'
};

class SkillsCommand {
    // Format skill details consistently
    static _formatSkillDetails(skill) {
        return `**Type:** ${skill.is_passive ? 'Passive' : 'Active'} | ` +
               `**Cost:** ${skill.mana_cost} MP | ` +
               `**Cooldown:** ${skill.cooldown}s` +
               (skill.skill_level ? ` | **Level:** ${skill.skill_level}` : '');
    }

    // Build skills embed
    static _buildSkillsEmbed(title, skills, learnedSkillIds) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(0x0099FF);

        if (!skills.length) {
            embed.setDescription('No skills available for your class yet!');
            return embed;
        }

        skills.forEach(skill => {
            const isLearned = learnedSkillIds.has(skill.id);
            embed.addFields({
                name: `${skill.name} (ID: ${skill.id}) ${isLearned ? '✅' : '🔒'}`,
                value: `${skill.description}\n${this._formatSkillDetails(skill)}\n` +
                       `**Status:** ${isLearned ? 'Learned' : `Requires Level ${skill.level_required}`}`,
                inline: false
            });
        });

        return embed;
    }

    // Handle listing skills
    static async _handleListSkills(context, character) {
        try {
            if (!character?.class_id) {
                throw new Error('Character missing class information');
            }

            const [availableSkills, learnedSkills] = await Promise.all([
                skillHandler.getSkillsForClass(character.class_id),
                skillHandler.getCharacterSkills(character.id).catch(() => []) // Graceful fallback
            ]);

            const learnedSkillIds = new Set(learnedSkills.map(s => s.id));
            const embed = this._buildSkillsEmbed(
                `Available ${character.class_id} Skills`, 
                availableSkills, 
                learnedSkillIds
            );

            return context.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Failed to list skills:', error);
            return context.reply(
                error.message.includes('missing') 
                    ? '❌ Your character data is incomplete. Please contact an admin.'
                    : '❌ Failed to load skills. Please try again later.'
            );
        }
    }

    // Handle learning skill
    static async _handleLearnSkill(context, character, skillId) {
        try {
            if (!skillId || isNaN(skillId)) {
                return context.reply('❌ Please provide a valid skill ID! Example: `rpg skills learn 301`');
            }

            const result = await skillHandler.learnSkill(character.id, skillId);
            
            return context.reply(
                result.success 
                    ? `🎉 Successfully learned: **${result.skillName}** (ID: ${skillId})`
                    : `❌ ${result.message}`
            );
        } catch (error) {
            console.error('Failed to learn skill:', error);
            return context.reply('❌ An error occurred while learning the skill.');
        }
    }

    // Handle showing learned skills
    static async _handleMySkills(context, character) {
        try {
            // First verify character exists
            const characterExists = await CharacterHandler.verifyCharacter(character.id);
            if (!characterExists) {
                throw new Error('Character not found in database');
            }

            const skills = await skillHandler.getCharacterSkills(character.id);
            
            if (!skills.length) {
                return context.reply("You haven't learned any skills yet!");
            }

            const embed = new EmbedBuilder()
                .setTitle('Your Learned Skills')
                .setColor(0x00FF99)
                .setDescription(`Total skills learned: ${skills.length}`);

            skills.forEach(skill => {
                embed.addFields({
                    name: `${skill.name} (ID: ${skill.id})`,
                    value: this._formatSkillDetails(skill),
                    inline: false
                });
            });

            return context.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Failed to show learned skills:', error);
            if (error.message.includes('not found')) {
                return context.reply('❌ Your character data is missing! Please recreate your character with `/create`.');
            }
            return context.reply('❌ Failed to load your skills.');
        }
    }

    // Main command handler
    static async handleCommand(context) {
        try {
            const character = await CharacterHandler.getCharacter(context.user.id);
            if (!character) {
                return context.reply('❌ You need to create a character first! Use `/create`');
            }

            const subcommand = context.options?.getSubcommand?.() || 'list';
            const skillId = context.options?.getInteger?.('skill_id');

            switch (subcommand) {
                case 'list': return this._handleListSkills(context, character);
                case 'learn': return this._handleLearnSkill(context, character, skillId);
                case 'my-skills': return this._handleMySkills(context, character);
                default: return context.reply('❌ Unknown subcommand. Use: list, learn <id>, or my-skills');
            }
        } catch (error) {
            console.error('Error in skills command:', error);
            return context.reply('❌ An error occurred while processing your command.');
        }
    }

    // Build slash command
    static buildSlashCommand() {
        return new SlashCommandBuilder()
            .setName(commandData.name)
            .setDescription(commandData.description)
            .addSubcommand(sub => 
                sub.setName('list')
                   .setDescription('List available skills for your class')
            )
            .addSubcommand(sub =>
                sub.setName('learn')
                   .setDescription('Learn a new skill')
                   .addIntegerOption(opt =>
                       opt.setName('skill_id')
                          .setDescription('ID of the skill to learn')
                          .setRequired(true)
                   )
            )
            .addSubcommand(sub =>
                sub.setName('my-skills')
                   .setDescription('View your learned skills')
            );
    }

    // Handle prefix command
    static async handlePrefixCommand(message, args) {
        const subcommand = args[0]?.toLowerCase() || 'list';
        const skillId = args[1] ? parseInt(args[1]) : null;

        const context = {
            user: message.author,
            reply: (content) => message.channel.send(content),
            options: {
                getSubcommand: () => {
                    if (['learn', 'add', 'acquire'].includes(subcommand)) return 'learn';
                    if (['my-skills', 'myskills', 'learned', 'known'].includes(subcommand)) return 'my-skills';
                    return 'list';
                },
                getInteger: () => skillId
            }
        };

        return this.handleCommand(context);
    }
}

// Export for both slash and prefix commands
module.exports = {
    ...commandData,
    data: SkillsCommand.buildSlashCommand(),
    
    async execute(interaction) {
        await interaction.deferReply();
        const context = {
            user: interaction.user,
            reply: interaction.editReply.bind(interaction),
            options: interaction.options
        };
        return SkillsCommand.handleCommand(context);
    },
    
    async executeMessage(message, args) {
        return SkillsCommand.handlePrefixCommand(message, args);
    }
};