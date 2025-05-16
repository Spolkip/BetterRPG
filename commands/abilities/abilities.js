const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const skillHandler = require('../../handlers/abilities');
const CharacterHandler = require('../../handlers/characterHandler');

const commandData = {
    name: 'skills',
    description: 'Manage your character skills',
    aliases: ['abilities', 'skill'],
    usage: '[list|learn <id>|my-skills]'
};

class SkillsCommand {
    static _formatSkillDetails(skill) {
        return `**Type:** ${skill.is_passive ? 'Passive' : 'Active'} | ` +
               `**Cost:** ${skill.mana_cost} MP | ` +
               `**Cooldown:** ${skill.cooldown}s` +
               (skill.skill_level ? ` | **Level:** ${skill.skill_level}` : '');
    }

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

    static async _handleListSkills(context, character) {
        try {
            if (!character?.class_id) {
                throw new Error('Character missing class information');
            }

            console.log(`Listing skills for ${character.name}, class: ${character.class_id}`);

            const [availableSkills, learnedSkills] = await Promise.all([
                skillHandler.getSkillsForClass(character.class_id),
                skillHandler.getCharacterSkills(character.id).catch(() => [])
            ]);

            console.log(`Found ${availableSkills.length} available skills and ${learnedSkills.length} learned skills`);

            const learnedSkillIds = new Set(learnedSkills.map(s => s.id));
            const embed = this._buildSkillsEmbed(
                `Available ${character.class_name} Skills`, 
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

    static async _handleLearnSkill(context, character, skillId) {
        try {
            if (!skillId || isNaN(skillId)) {
                return context.reply('❌ Please provide a valid skill ID! Example: `rpg skills learn 301`');
            }

            // Pass the character ID (not user ID) to learnSkill
            console.log(`Attempting to learn skill ${skillId} for character ${character.id}`);
            const result = await skillHandler.learnSkill(character.id, skillId);
            
            // Ensure result exists and has success property
            if (result && typeof result.success !== 'undefined') {
                if (result.success) {
                    return context.reply(`🎉 Successfully learned: **${result.skillName}** (ID: ${skillId})`);
                }
                return context.reply(`❌ ${result.message || 'Failed to learn skill'}`);
            }

            // Fallback error if result format is unexpected
            return context.reply('❌ An unexpected error occurred while learning the skill.');
        } catch (error) {
            console.error('Failed to learn skill:', error);
            return context.reply('❌ An error occurred while learning the skill.');
        }
    }

    static async _handleMySkills(context, character) {
        try {
            // Important: pass the character.id (numeric DB ID) to getCharacterSkills
            console.log(`Getting skills for character: ${character.id} (user: ${context.user.id})`);
            
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
                    value: `${skill.description}\n${this._formatSkillDetails(skill)}`,
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

    static async handleCommand(context) {
        try {
            console.log(`Handling skills command for user: ${context.user.id}`);
            const character = await CharacterHandler.getCharacter(context.user.id);
            if (!character) {
                return context.reply('❌ You need to create a character first! Use `/create`');
            }
            
            console.log(`Found character: ${JSON.stringify(character)}`);

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

    static buildSlashCommand() {
        const command = new SlashCommandBuilder()
            .setName(commandData.name)
            .setDescription(commandData.description);

        command.addSubcommand(sub => 
            sub.setName('list')
               .setDescription('List available skills for your class')
        );

        command.addSubcommand(sub =>
            sub.setName('learn')
               .setDescription('Learn a new skill')
               .addIntegerOption(opt =>
                   opt.setName('skill_id')
                      .setDescription('ID of the skill to learn')
                      .setRequired(true)
               )
        );

        command.addSubcommand(sub =>
            sub.setName('my-skills')
               .setDescription('View your learned skills')
        );

        return command;
    }

    static async handlePrefixCommand(message, args) {
        const subcommand = args[0]?.toLowerCase() || 'list';
        const skillId = args[1] ? parseInt(args[1]) : null;

        console.log(`Handling prefix command skills with args: ${JSON.stringify(args)}`);

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