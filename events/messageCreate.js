const { Events } = require('discord.js');
const createCharacterFlow = require('../handlers/CreateCharacterFlow');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.content.startsWith('rpg ')) return;

        try {
            const args = message.content.slice('rpg '.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            // Handle create command
            if (['create', 'cc', 'createchar'].includes(commandName)) {
                return await createCharacterFlow(message, client.handler, true);
            }

            const command = client.commands.get(commandName) || 
                          client.commands.find(cmd => cmd.aliases?.includes(commandName));

            if (!command) return;

            // Create a proper mock interaction for prefix commands
            const mockInteraction = {
                user: message.author,
                channel: message.channel,
                guild: message.guild,
                member: message.member,
                replied: false,
                deferred: false,
                reply: async (content) => {
                    this.replied = true;
                    return message.channel.send(content);
                },
                editReply: async (content) => {
                    return message.channel.send(content);
                },
                deferReply: async () => {
                    this.deferred = true;
                    return Promise.resolve();
                },
                options: {
                    getString: (name) => args[0],
                    getInteger: (name) => {
                        if (args[1] && !isNaN(args[1])) {
                            return parseInt(args[1]);
                        }
                        return null;
                    },
                    getSubcommand: () => args[0] || 'list'
                }
            };

            if (command.executeMessage) {
                await command.executeMessage(message, args, client.handler);
            } else if (command.execute) {
                await command.execute(mockInteraction);
            } else {
                message.reply('This command is not properly configured.');
            }
            
        } catch (error) {
            console.error('Error in messageCreate:', error);
            message.reply('❌ An error occurred while executing that command.').catch(console.error);
        }
    }
};