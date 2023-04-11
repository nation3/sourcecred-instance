const { Client, GatewayIntentBits } = require('discord.js');
const sc = require('sourcecred').sourcecred;
const scUtils = require('./sourcecred-utils');

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
    },

    testAndUpdateDiscordAccount: async (ledgerManager, lowerAccountToIdentityMap, discordMemberMap, passportData, chainId, tokenAddress) => {
        const {passport_id, owner_address, discord_username,discord_username_ens} = passportData;
    
        console.info(`Reading Discord data for: ${passport_id}`);
    
        if ((!discord_username) && (!discord_username_ens)) {
            console.info(`No Discord username for passport ${passport_id}`)
            return;
        }
    
        //get just the username from one of the two columns
        let discordUsernameAndDiscriminator = cleanDiscordUsername(discord_username);
        if (!discordUsernameAndDiscriminator) {
            discordUsernameAndDiscriminator = cleanDiscordUsername(discord_username_ens);
        }
    
        if (!discordUsernameAndDiscriminator) {
            console.info(`Invalid Discord username ${discord_username}/${discord_username_ens} provided, skipping Discord for passport ${passport_id}`)
            return;
        }
    
        //Discord idenitity is stored using the ID of the account, which we do not have, so have to have a Bot which can find it
        //N\u0000sourcecred\u0000discord\u0000MEMBER\u0000user\u0000976148126308122644\u0000
    
        const discordUserId = discordMemberMap.get(`${discordUsernameAndDiscriminator[0]}#${discordUsernameAndDiscriminator[1]}`);
    
        if(!discordUserId) {
            console.log(`No Discord Member found in Nation3 Discord with Username ${discordUsernameAndDiscriminator[0]}#${discordUsernameAndDiscriminator[1]} not setting Discord Identity for ${passport_id}`);
            return;
        }
    
        const dAddress = scUtils.createDiscordIdentity(discordUsernameAndDiscriminator, discordUserId);
    
        const hasAccount = lowerAccountToIdentityMap.has(dAddress.toLowerCase());
        if(hasAccount) {
            scUtils.testAndUpdateAccountPayoutAddress(
                ledgerManager, 
                lowerAccountToIdentityMap, 
                dAddress, 
                'discord', 
                discordUsernameAndDiscriminator, 
                passport_id, 
                owner_address,
                chainId,
                tokenAddress);              
        }
        else {
            addDiscordIdentityAndSetPayoutAddress(
                ledgerManager, 
                dAddress, 
                discordUsernameAndDiscriminator, 
                passport_id, 
                owner_address, 
                chainId,
                tokenAddress);
        }
    }
}

function addDiscordIdentityAndSetPayoutAddress(ledgerManager, scAddress, dUsername, passport_id, owner_address, chainId, tokenAddress) {
    console.log(`Creating a new SourceCred identity for ${dUsername} for passport ${passport_id}`)
       
    const baseIdentityProposal = scUtils.createDiscordIdentityProposal(scAddress, dUsername);

    const baseIdentityId = sc.ledger.utils.ensureIdentityExists(
        ledgerManager.ledger,
        baseIdentityProposal,
    );

    console.log(`Base Identity ID ${JSON.stringify(baseIdentityId)}`);

    console.log(`Setting payout address for Discord for passport ${passport_id} - discordUsername ${dUsername}`)

    ledgerManager.ledger.setPayoutAddress(baseIdentityId, owner_address , chainId, tokenAddress);

    console.log(`Updated payout address to ${owner_address} for passport ${passport_id} - discordUsername ${dUsername}`)
}

function cleanDiscordUsername(dUsername) {
    //https://discord.gg/grbsArn
    //Adelaide Isla#3410
    let processing = dUsername;

    if(!processing || processing.indexOf('#') < 0) {
        return null;
    }

    if(dUsername.indexOf('/') >= 0) {
        const regex = /.*\/(.*)/gm;
        processing = processing.replace(regex, '$1');
    }

    if(processing.startsWith('@')) {
        processing = processing.substring(0);
    }

    const hash = processing.lastIndexOf('#');
    const username = processing.substring(0, hash);
    const discriminator = processing.substring(hash + 1);

    return [username, discriminator];
}