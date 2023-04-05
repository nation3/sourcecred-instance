const sc = require('sourcecred').sourcecred;
const scUtils = require('./sourcecred-utils');

module.exports = {
    //exists - {"action":{"alias":{"address":"N\u0000sourcecred\u0000discourse\u0000user\u0000https://forum.nation3.org\u0000aahna\u0000","description":"discourse/[@aahna](https://forum.nation3.org/u/aahna/)"}
    //new    - {"action":{"alias":{"address":"N\u0000sourcecred\u0000dicourse\u0000user\u0000https://forum.nation3.org\u0000aahna\u0000","description":"discourse/[@aahna](https://forum.nation3.org/u/aahna)"}
    testAndUpdateDiscourseAccount: async (ledgerManager, lowerAccountToIdentityMap, passportData, chainId, tokenAddress) => {
        const {passport_id, owner_address, discourse_username} = passportData;
    
        console.info(`Reading Discourse data for: ${passport_id}`);
    
        if ((!discourse_username)) {
            console.info(`No Discourse username for passport ${passport_id}`)
            return;
        }
    
        //construct identity
        const discourseAddress = scUtils.createDiscourseIdentity(discourse_username);
    
        const hasAccount = lowerAccountToIdentityMap.has(discourseAddress.toLowerCase());
        if(hasAccount) {
            scUtils.testAndUpdateAccountPayoutAddress(
                ledgerManager, 
                lowerAccountToIdentityMap, 
                discourseAddress, 
                'discourse', 
                discourse_username, 
                passport_id, 
                owner_address, 
                chainId, 
                tokenAddress);              
        }
        else {
            addDiscourseIdentityAndSetPayoutAddress(
                ledgerManager, 
                discourseAddress, 
                discourse_username, 
                passport_id, 
                owner_address, 
                chainId, 
                tokenAddress);
        }
    }
}

function addDiscourseIdentityAndSetPayoutAddress(ledgerManager, scAddress, dUsername, passport_id, owner_address, chainId, tokenAddress) {
    console.log(`Creating a new SourceCred identity for ${dUsername} for passport ${passport_id}`)
       
    const baseIdentityProposal = scUtils.createDiscourseIdentityProposal(scAddress, dUsername);

    const baseIdentityId = sc.ledger.utils.ensureIdentityExists(
        ledgerManager.ledger,
        baseIdentityProposal,
    );

    console.log(`Base Identity ID ${JSON.stringify(baseIdentityId)}`);

    console.log(`Setting payout address for GitHub for passport ${passport_id} - gitHubUsername ${dUsername}`)

    ledgerManager.ledger.setPayoutAddress(baseIdentityId, owner_address ,chainId, tokenAddress);

    console.log(`Updated payout address to ${owner_address} for passport ${passport_id} - gitHubUsername ${dUsername}`)
}