const sc = require('sourcecred').sourcecred;

//Ripped from SC ScourceCode
const COERCE_PATTERN = /[^A-Za-z0-9-]/g;

module.exports = {
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
        name = coerce(name.slice(0, 39));

        const baseIdentityProposal = {
            pluginName: 'discord', 
            name: scUtils.coerce(name),
            type: 'USER',
            alias: {
                description: `discord/${dUsername[0]}#${dUsername[1]}`,
                address: scAddress,
            }
        }

        return baseIdentityProposal;
    },
}