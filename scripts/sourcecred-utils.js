const sc = require('sourcecred').sourcecred;

//Ripped from SC ScourceCode
const COERCE_PATTERN = /[^A-Za-z0-9-]/g;

const scUtils = {
    coerce: (name) =>  {
        const coerced = name.replace(COERCE_PATTERN, "-");
        return coerced;
    },

    createGitHubIdentity: (githubUsername) => {
        const ghAddress = sc.core.graph.NodeAddress.fromParts([
            "sourcecred",
            "github",
            "USERLIKE",
            "USER",
            githubUsername
        ]);

        return ghAddress;
    },

    //create identity            
    //from sc.plugins.github._createIdentity(user); 
    createGitHubIdentityProposal: (scAddress, ghUsername) => {
        const baseIdentityProposal = {
            pluginName: 'github', 
            name: scUtils.coerce(ghUsername),
            type: 'USER',
            alias: {
                description: `github/[@${ghUsername}](https://github.com/${ghUsername})`,
                address: scAddress,
            }
        }

        return baseIdentityProposal;
    },

    createDiscourseIdentity: (discourseUsername) => {
        //{"action":{"alias":{"address":"N\u0000sourcecred\u0000discourse\u0000user\u0000https://forum.nation3.org\u0000ChauzeixT\u0000","description":"discourse/[@ChauzeixT](https://forum.nation3.org/u/ChauzeixT/)"},"identityId":"2RWMgjp7c7u5Von9EFDQQg","type":"ADD_ALIAS"},"ledgerTimestamp":1652442120485,"uuid":"ajZ5Z5gYjzgIAzK3ILjG3w","version":"1"}
        const dAddress = sc.core.graph.NodeAddress.fromParts([
            "sourcecred",
            "discourse",
            "user",
            "https://forum.nation3.org",
            discourseUsername
        ]);

        return dAddress;
    },

    createDiscourseIdentityProposal: (scAddress, dUsername) => {
        const baseIdentityProposal = {
            pluginName: 'discourse', 
            name: scUtils.coerce(dUsername),
            type: 'USER',
            alias: {
                description: `discourse/[@${dUsername}](https://forum.nation3.org/u/${dUsername})`,
                address: scAddress,
            }
        }

        return baseIdentityProposal;
    },

    createDiscordIdentity: (dUsername, dId) => {
        const dAddress = sc.core.graph.NodeAddress.fromParts([
            "sourcecred",
            "discord",
            "MEMBER",
            "user",
            dId
        ]);

        return dAddress;
    },

    createDiscordIdentityProposal: (scAddress, dUsername) => {
        let name = dUsername[0];
        name = scUtils.coerce(name.slice(0, 39));

        const baseIdentityProposal = {
            pluginName: 'discord', 
            name: name,
            type: 'USER',
            alias: {
                description: `discord/${dUsername[0]}#${dUsername[1]}`,
                address: scAddress,
            }
        }

        return baseIdentityProposal;
    },

    testAndUpdateAccountPayoutAddress: (ledgerManager, lowerAccountToIdentityMap, scAddress, platform, username, passport_id, owner_address, chainId, tokenAddress) => {
        const uuid = lowerAccountToIdentityMap.get(scAddress.toLowerCase());
        const account = ledgerManager.ledger.account(uuid);
        
        const existingAddress = account.payoutAddresses.get(`{"chainId":"${chainId}","tokenAddress":"${tokenAddress}","type":"EVM"}`);
    
        if(!existingAddress) {
            console.log(`There was not a payout address set for passport ${passport_id} - platform ${platform} - username ${username}`);
        }
        
        if(existingAddress && existingAddress.toLowerCase() === owner_address.toLowerCase()) {
            console.log(`Correct payout address already set for passport ${passport_id} - platform ${platform} - username ${username}`)
        }
        else {
            console.log(`Payout address not correctly set for GitHub for passport ${passport_id} - platform ${platform} - username ${username}`)
            
            ledgerManager.ledger.setPayoutAddress(uuid, owner_address , chainId, tokenAddress);
    
            console.log(`Updated payout address to ${owner_address} for passport ${passport_id} - platform ${platform} - username ${username}`)
        }  
    }
}

module.exports = scUtils;