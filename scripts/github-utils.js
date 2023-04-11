const sc = require('sourcecred').sourcecred;
const scUtils = require('./sourcecred-utils');

module.exports = {
    testAndUpdateGithubAccount: async (ledgerManager, lowerAccountToIdentityMap, passportData, chainId, tokenAddress) => {
        const {passport_id, owner_address, github_username, github_username_ens} = passportData;
    
        console.info(`Reading GitHub data for: ${passport_id}`);
    
        if ((!github_username) && (!github_username_ens)) {
            console.info(`No GitHub username for passport ${passport_id}`)
            return;
        }
    
        //get just the username from one of the two columns
        const tidiedGithubUsername = github_username && github_username.length > 0
        ? cleanGithubUsername(github_username)
        : cleanGithubUsername(github_username_ens);
    
        //construct identity
        const ghAddress = scUtils.createGitHubIdentity(tidiedGithubUsername);
    
        const hasAccount = lowerAccountToIdentityMap.has(ghAddress.toLowerCase());
        if(hasAccount) {
            scUtils.testAndUpdateAccountPayoutAddress(
                ledgerManager, 
                lowerAccountToIdentityMap, 
                ghAddress, 
                'github', 
                tidiedGithubUsername, 
                passport_id, 
                owner_address, 
                chainId, 
                tokenAddress);              
        }
        else {
            addGitHubIdentityAndSetPayoutAddress(
                ledgerManager, 
                ghAddress, 
                tidiedGithubUsername, 
                passport_id, 
                owner_address, 
                chainId, 
                tokenAddress);
        }
    }
}

function addGitHubIdentityAndSetPayoutAddress(ledgerManager, scAddress, ghUsername, passport_id, owner_address, chainId, tokenAddress) {
    console.log(`Creating a new SourceCred identity for ${ghUsername} for passport ${passport_id}`)
       
    const baseIdentityProposal = scUtils.createGitHubIdentityProposal(scAddress, ghUsername);

    const baseIdentityId = sc.ledger.utils.ensureIdentityExists(
        ledgerManager.ledger,
        baseIdentityProposal,
    );

    console.log(`Base Identity ID ${JSON.stringify(baseIdentityId)}`);

    console.log(`Setting payout address for GitHub for passport ${passport_id} - gitHubUsername ${ghUsername}`)

    ledgerManager.ledger.setPayoutAddress(baseIdentityId, owner_address, chainId, tokenAddress);

    console.log(`Updated payout address to ${owner_address} for passport ${passport_id} - gitHubUsername ${ghUsername}`)
}

function cleanGithubUsername(ghUsername) {
    //https://github.com/luisivan
    //@adelaideisla
    let processing = ghUsername;
    if(ghUsername.indexOf('/') >= 0) {
        const regex = /.*\/(.*)/gm;
        processing = processing.replace(regex, '$1');
    }

    if(processing.startsWith('@')) {
        processing = processing.substring(0);
    }

    return processing;
}