const { Client, GatewayIntentBits } = require('discord.js');


module.exports = {
    getDiscordMembers: async (guildId) => {
        const token = process.env.SOURCECRED_DISCORD_TOKEN;
        const client = new Client({ 
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] 
        });

        client.once('ready', () => {
            console.log('Discord Bot is Go!');
        });

        await client.login(token);

        const discordMembers = new Map();

        const guild = client.guilds.resolve(guildId);
            
        const rawMembers = await guild.members.fetch();

        rawMembers.forEach((member) => {
            discordMembers.set(`${member.user.username}#${member.user.discriminator}`, member.id);
        });

        client.destroy();
        
        return discordMembers;        
    }
}