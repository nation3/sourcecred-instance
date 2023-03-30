require('dotenv').config();
const sc = require('sourcecred').sourcecred;
const config = require("./config.js");
const fetch = require("node-fetch");
const csvParser = require('csv-parser')
const { Readable } = require("stream")

const SOURCECRED_URL =
  'https://raw.githubusercontent.com/nation3/nationcred-instance/gh-pages/';

const FILE_GH_CSV = 'https://raw.githubusercontent.com/nation3/nationcred-datasets/main/data-sources/github/output/github-usernames.csv';
const FILE_DISCORD_CSV = 'https://raw.githubusercontent.com/nation3/nationcred-datasets/main/data-sources/discord/output/discord-usernames.csv';
const FILE_DISCOURSE_CSV = 'https://raw.githubusercontent.com/nation3/nationcred-datasets/main/data-sources/discourse/output/discourse-usernames.csv';


  updateLedgerFromChain();

async function updateLedgerFromChain() {
    console.info('updateLedgerFromChain');

    //Get access to the ledger and create a writable version
    const ledgerManager = new sc.ledger.manager.LedgerManager({storage: new sc.ledger.storage.WritableGithubStorage({apiToken: process.env.SOURCECRED_GITHUB_TOKEN, repo: config.repo, branch: config.branch})})
    await ledgerManager.reloadLedger()
    console.info(`Ledger instance created`);
                                     
    const githubFile = await readCsv(FILE_GH_CSV);
    
    console.info(`Read Citizen Github data from Github`);

    const discordFile = await readCsv(FILE_DISCORD_CSV);

    console.info(`Read Citizen Discord data from Github`);

    const discourseFile = await readCsv(FILE_DISCOURSE_CSV);

    console.info(`Read Citizen Disource data from Github`);

    processGitHubCitizens(ledgerManager, githubFile);

}

async function processGitHubCitizens(ledgerManager, githubFile) {
    const readable = Readable.from(githubFile);
    readable.pipe(csvParser())
        .on('data', async (row) => {
            console.info(`Reading GitHub data for: ${row.passport_id}`);
            const ghUsername = row.github_username;
            const ghUsernameENS = row.github_username_ens;

            if ((!ghUsername) && (!ghUsernameENS)) {
                console.info(`No GitHub username for passport ${row.passport_id}`)
                return;
            }

            //get just the username from one of the two columns
            const githubUsername = ghUsername && ghUsername.length > 0
             ? cleanGithubUsername(ghUsername)
             : cleanGithubUsername(ghUsernameENS);

            //construct identity
            const ghAddress = sc.core.graph.NodeAddress.fromParts([
                "sourcecred",
                "github",
                "USERLIKE",
                "USER",
                githubUsername
            ]);

            //{"action":{"identity":{"address":"N\u0000sourcecred\u0000core\u0000IDENTITY\u0000VKoeRG5eG3wFrPwUP30quA\u0000","aliases":[],"id":"VKoeRG5eG3wFrPwUP30quA","name":"johnmark13-github","subtype":"USER"},"type":"CREATE_IDENTITY"},"ledgerTimestamp":1652751063468,"uuid":"l011nxUv5Cy7bsGjhgpZqw","version":"1"}
            //{"action":{"alias":{"address":"N\u0000sourcecred\u0000github\u0000USERLIKE\u0000USER\u0000johnmark13\u0000","description":"github/[@johnmark13](https://github.com/johnmark13)"},"identityId":"VKoeRG5eG3wFrPwUP30quA","type":"ADD_ALIAS"},"ledgerTimestamp":1652751063469,"uuid":"i57Hyx47nL5OUy01sxFqhA","version":"1"}
            //'NsourcecredgithubUSERLIKEuserJohnMark13'
            const account = ledgerManager.ledger.accountByAddress(ghAddress);
            if(account) {
                //ah it already exists, check payout address matches
                const uuid = account.identity.id;
                const existingAddress = account.payoutAddresses.get(`{"chainId":"${config.chainId}","tokenAddress":"${config.tokenAddress}","type":"EVM"}`);

                if(!existingAddress) {
                    console.log(`There was not a payout address set for passport ${row.passport_id} - gitHubUsername ${githubUsername}`);
                }
                
                if(existingAddress && existingAddress.toLowerCase() === row.owner_address.toLowerCase()) {
                    console.log(`Correct payout address already set for passport ${row.passport_id} - gitHubUsername ${githubUsername}`)
                }
                else {
                    //ledgerManager.ledger.setPayoutAddress(uuid, row.owner_address , config.chainId, config.tokenAddress);
                }                
            }
            else {
                //create identity

                //setPayoutAddress for new identity
            }
        });

        const result = await ledgerManager.persist();

        if (result.error) {
            console.error(`Filed to update the ledger: ${result.error}`);
            throw result.error
        };
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

    return processing.toLowerCase();
    
}

async function readCsv(remoteFile) {
    const response = await fetch(remoteFile);
    if (!response.ok) {
        console.error(`Error reading GitHub users: ${response.status}`);
        return "";
    }
    const raw = await response.text();
    return raw;
}
