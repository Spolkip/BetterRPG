const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const skillHandler = require('../../handlers/abilities');
const CharacterHandler = require('../../handlers/characterHandler');

const commandData = {
    name: 'skills',
    description: 'Manage your character skills',
    aliases: ['abilities', 'skill']
};

class SkillsCommand {
    static _formatSkillDetails(skill) {
        const details = [
            `**Type:** ${skill.is_passive ? 'Passive' : 'Active'}`,
            `**Level:** ${skill.skill_level || 1}`,
            skill.mana_cost ? `**Cost:** ${skill.mana_cost} MP` : null,
            skill.cooldown ? `**Cooldown:** ${skill.cooldown}s` : null
        ].filter(Boolean).join(' | ');
        
        return `${skill.description}\n${details}`;
    }

   static async _handleMySkills(context, character) {
        try {
            const skills = await skillHandler.getCharacterSkills(character.id);
            
            if (!skills || skills.length === 0) {
                return context.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Your Skills')
                            .setDescription("You haven't learned any skills yet!")
                            .setColor(0xFF0000)
                    ]
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('Your Learned Skills')
                .setColor(0x00FF00);

            skills.forEach(skill => {
                embed.addFields({
                    name: `${skill.name} ${skill.is_passive ? '🔹' : '🔸'}`,
                    value: this._formatSkillDetails(skill),
                    inline: false
                });
            });

            return context.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Failed to show skills:', error);
            return context.reply('❌ Failed to load your skills. Please try again later.');
        }
    }

    static async _handleLearnSkill(context, character, skillId) {
        try {
            if (!skillId || isNaN(skillId)) {
                return context.reply('❌ Please provide a valid skill ID (e.g. `301`)');
            }

            const result = await skillHandler.learnSkill(character.id, skillId);
            
            if (result.success) {
                return context.reply(`✅ ${result.message}`);
            }
            
            return context.reply(`❌ ${result.message}`);
        } catch (error) {
            console.error('Failed to learn skill:', error);
            return context.reply('❌ An error occurred while learning the skill.');
        }
    }

    static async _handleMySkills(context, character) {
        try {
            const skills = await skillHandler.getCharacterSkills(character.id);
            
            if (!skills || skills.length === 0) {
                return context.reply("You haven't learned any skills yet!");
            }

            const embed = new EmbedBuilder()
                .setTitle('Your Learned Skills')
                .setColor(0x00FF00)
                .setDescription(`Showing ${skills.length} skills`);

            // Filter only unlocked skills
            const learnedSkills = skills.filter(skill => skill.unlocked);
            
            if (learnedSkills.length === 0) {
                embed.setDescription("You have skills available but none are unlocked yet!");
            } else {
                learnedSkills.forEach(skill => {
                    embed.addFields({
                        name: `${skill.name} (ID: ${skill.id})`,
                        value: this._formatSkillDetails(skill),
                        inline: false
                    });
                });
            }

            return context.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Failed to show skills:', error);
            return context.reply('❌ Failed to load your skills. Please try again later.');
        }
    }

    static async handleCommand(context) {
        try {
            const character = await CharacterHandler.getCharacter(context.user.id);
            if (!character) {
                return context.reply('❌ You need to create a character first! Use `/create`');
            }

            let subcommand, skillId;
            
            if (context.options) { // Slash command
                subcommand = context.options.getSubcommand();
                skillId = context.options.getInteger('skill_id');
            } else { // Prefix command
                const args = context.args || [];
                subcommand = args[0]?.toLowerCase();
                skillId = args[1] ? parseInt(args[1]) : null;
            }

            // Handle subcommands
            if (!subcommand || ['list', 'show', 'all'].includes(subcommand)) {
                return this._handleListSkills(context, character);
            }
            if (['learn', 'add', 'train'].includes(subcommand)) {
                if (!skillId) {
                    return context.reply('❌ Please specify a skill ID to learn');
                }
                return this._handleLearnSkill(context, character, skillId);
            }
            if (['my-skills', 'myskills', 'learned', 'known'].includes(subcommand)) {
                return this._handleMySkills(context, character);
            }

            return context.reply('❌ Invalid command. Use: list, learn <id>, or my-skills');
        } catch (error) {
            console.error('Error in skills command:', error);
            return context.reply('❌ An error occurred while processing your command.');
        }
    }

    static buildSlashCommand() {
        return new SlashCommandBuilder()
            .setName(commandData.name)
            .setDescription(commandData.description)
            .addSubcommand(sub => sub
                .setName('list')
                .setDescription('List available skills for your class'))
            .addSubcommand(sub => sub
                .setName('learn')
                .setDescription('Learn a new skill')
                .addIntegerOption(opt => opt
                    .setName('skill_id')
                    .setDescription('ID of the skill to learn')
                    .setRequired(true)))
            .addSubcommand(sub => sub
                .setName('my-skills')
                .setDescription('View your learned skills'));
    }
}

module.exports = {
    ...commandData,
    data: SkillsCommand.buildSlashCommand(),
    
    // Slash command handler
    async execute(interaction) {
        await interaction.deferReply();
        const context = {
            user: interaction.user,
            reply: interaction.editReply.bind(interaction),
            options: interaction.options
        };
        return SkillsCommand.handleCommand(context);
    },
    
    // Prefix command handler
    async executeMessage(message, args) {
        const context = {
            user: message.author,
            reply: (content) => message.channel.send(content),
            args: args
        };
        return SkillsCommand.handleCommand(context);
    }
};