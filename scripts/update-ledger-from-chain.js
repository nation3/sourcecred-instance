require('dotenv').config();
const sc = require('sourcecred').sourcecred;
const config = require("./config.js");
const fetch = require("node-fetch");
const csvParser = require('csv-parser');
const { Readable } = require('stream');
const scUtils = require('./sourcecred-utils');
const discordUtils = require('./discord-utils');


const SOURCECRED_URL =
  'https://raw.githubusercontent.com/nation3/nationcred-instance/gh-pages/';

const FILE_GH_CSV = 'https://raw.githubusercontent.com/nation3/nationcred-datasets/main/data-sources/github/output/github-usernames.csv';
const FILE_DISCORD_CSV = 'https://raw.githubusercontent.com/nation3/nationcred-datasets/main/data-sources/discord/output/discord-usernames.csv';
const FILE_DISCOURSE_CSV = 'https://raw.githubusercontent.com/nation3/nationcred-datasets/main/data-sources/discourse/output/discourse-usernames.csv';


  updateLedgerFromChain();

async function updateLedgerFromChain() {
    console.info('updateLedgerFromChain');

    //Get access to the ledger and create a writable version
    const ledgerManager = new sc.ledger.manager.LedgerManager({storage: new sc.ledger.storage.WritableGithubStorage({apiToken: process.env.SOURCECRED_GITHUB_TOKEN, repo: config.repo, branch: config.branch, message:"Testing message"})})
    await ledgerManager.reloadLedger()
    console.info(`Ledger instance created`);
                                     
    const githubFile = await readCsv(FILE_GH_CSV);
    
    console.info(`Read Citizen Github data from Github`);

    const discordFile = await readCsv(FILE_DISCORD_CSV);

    console.info(`Read Citizen Discord data from Github`);

    const discourseFile = await readCsv(FILE_DISCOURSE_CSV);

    console.info(`Read Citizen Disource data from Github`);

    const lowerAccountToIdentityMap = new Map();

    ledgerManager.ledger._aliasAddressToIdentity.forEach((value, key) => {
        lowerAccountToIdentityMap.set(key.toLowerCase(),value);
    });

    await processGitHubCitizens(ledgerManager, lowerAccountToIdentityMap, githubFile);
    await processDiscordCitizens(ledgerManager, lowerAccountToIdentityMap, discordFile);
}

async function processGitHubCitizens(ledgerManager, lowerAccountToIdentityMap, githubFile) {
    console.log('Processing GitHub CSV file');
    const promise = new Promise(function(resolve, reject)  {
        const readable = Readable.from(githubFile);
        readable.pipe(csvParser())
            .on('data', (row) => {
               testAndUpdateGithubAccount(ledgerManager, lowerAccountToIdentityMap, row);
            })
            .on('end', () => {
                console.log('GitHub CSV file successfully processed');
                resolve(true);
            })
    });

    await promise;

    const result = await ledgerManager.persist();
    if (result.error) {
        console.error(`Failed to update the ledger: ${result.error}`);
        throw result.error
    };
}

async function processDiscordCitizens(ledgerManager, lowerAccountToIdentityMap, discordFile) {
    console.log('Processing Discord CSV file');

    //reading DIscord data from Guild
    const discordMemberMap = await discordUtils.getDiscordMembers(config.guildId);

    const promise = new Promise(function(resolve, reject)  {
        const readable = Readable.from(discordFile);
        readable.pipe(csvParser())
            .on('data', (row) => {
               testAndUpdateDiscordAccount(ledgerManager, lowerAccountToIdentityMap, discordMemberMap, row);
            })
            .on('end', () => {
                console.log('Discord CSV file successfully processed');
                resolve(true);
            })
    });

    await promise;

    const result = await ledgerManager.persist();
    if (result.error) {
        console.error(`Failed to update the ledger: ${result.error}`);
        throw result.error
    };
}

function testAndUpdateGithubAccount(ledgerManager, lowerAccountToIdentityMap, passportData) {
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
        testAndUpdateAccountPayoutAddress(ledgerManager, lowerAccountToIdentityMap, ghAddress, 'github', tidiedGithubUsername, passport_id, owner_address);              
    }
    else {
        addGitHubIdentityAndSetPayoutAddress(ledgerManager, ghAddress, tidiedGithubUsername, passport_id, owner_address)
    }
}

async function testAndUpdateDiscordAccount(ledgerManager, lowerAccountToIdentityMap, discordMemberMap, passportData) {
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
        console.log(`No Discord Member found in Nation3 Dicsord with Username ${discordUsernameAndDiscriminator[0]}#${discordUsernameAndDiscriminator[1]} not setting Discord Identity for ${passport_id}`);
        return;
    }

    const dAddress = scUtils.createDiscordIdentity(discordUsernameAndDiscriminator, discordUserId);

    const hasAccount = lowerAccountToIdentityMap.has(dAddress.toLowerCase());
    if(hasAccount) {
        testAndUpdateAccountPayoutAddress(ledgerManager, lowerAccountToIdentityMap, dAddress, 'discord', discordUsernameAndDiscriminator, passport_id, owner_address);              
    }
    else {
        addDiscordIdentityAndSetPayoutAddress(ledgerManager, dAddress, discordUsernameAndDiscriminator, passport_id, owner_address)
    }
}

function testAndUpdateAccountPayoutAddress(ledgerManager, lowerAccountToIdentityMap, scAddress, platform, username, passport_id, owner_address) {
    const uuid = lowerAccountToIdentityMap.get(scAddress.toLowerCase());
    const account = ledgerManager.ledger.account(uuid);
    
    const existingAddress = account.payoutAddresses.get(`{"chainId":"${config.chainId}","tokenAddress":"${config.tokenAddress}","type":"EVM"}`);

    if(!existingAddress) {
        console.log(`There was not a payout address set for passport ${passport_id} - platform ${platform} - username ${username}`);
    }
    
    if(existingAddress && existingAddress.toLowerCase() === owner_address.toLowerCase()) {
        console.log(`Correct payout address already set for passport ${passport_id} - platform ${platform} - username ${username}`)
    }
    else {
        console.log(`Payout address not correctly set for GitHub for passport ${passport_id} - platform ${platform} - username ${username}`)
        
        ledgerManager.ledger.setPayoutAddress(uuid, owner_address , config.chainId, config.tokenAddress);

        console.log(`Updated payout address to ${owner_address} for passport ${passport_id} - platform ${platform} - username ${username}`)
    }  
}

function addGitHubIdentityAndSetPayoutAddress(ledgerManager, scAddress, ghUsername, passport_id, owner_address) {
    console.log(`Creating a new SourceCred identity for ${ghUsername} for passport ${passport_id}`)
       
    const baseIdentityProposal = scUtils.createGitHubIdentityProposal(scAddress, ghUsername);

    const baseIdentityId = sc.ledger.utils.ensureIdentityExists(
        ledgerManager.ledger,
        baseIdentityProposal,
    );

    console.log(`Base Identity ID ${JSON.stringify(baseIdentityId)}`);

    console.log(`Setting payout address for GitHub for passport ${passport_id} - gitHubUsername ${ghUsername}`)

    ledgerManager.ledger.setPayoutAddress(baseIdentityId, owner_address , config.chainId, config.tokenAddress);

    console.log(`Updated payout address to ${owner_address} for passport ${passport_id} - gitHubUsername ${ghUsername}`)
}

function addDiscordIdentityAndSetPayoutAddress(ledgerManager, scAddress, dUsername, passport_id, owner_address) {
    console.log(`Creating a new SourceCred identity for ${dUsername} for passport ${passport_id}`)
       
    const baseIdentityProposal = scUtils.createDiscordIdentityProposal(scAddress, dUsername);

    const baseIdentityId = sc.ledger.utils.ensureIdentityExists(
        ledgerManager.ledger,
        baseIdentityProposal,
    );

    console.log(`Base Identity ID ${JSON.stringify(baseIdentityId)}`);

    console.log(`Setting payout address for Discord for passport ${passport_id} - discordUsername ${dUsername}`)

    ledgerManager.ledger.setPayoutAddress(baseIdentityId, owner_address , config.chainId, config.tokenAddress);

    console.log(`Updated payout address to ${owner_address} for passport ${passport_id} - discordUsername ${dUsername}`)
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

async function readCsv(remoteFile) {
    const response = await fetch(remoteFile);
    if (!response.ok) {
        console.error(`Error reading GitHub users: ${response.status}`);
        return "";
    }
    const raw = await response.text();
    return raw;
}
