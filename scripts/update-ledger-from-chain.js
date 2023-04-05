require('dotenv').config();
const sc = require('sourcecred').sourcecred;
const config = require("./config.js");
const fetch = require("node-fetch");
const csvParser = require('csv-parser');
const { Readable } = require('stream');
 
const discordUtils = require('./discord-utils');
const discourseUtils = require('./discourse-utils');
const githubUtils = require('./github-utils');


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
    await processDiscourseCitizens(ledgerManager, lowerAccountToIdentityMap, discourseFile);
}

async function processGitHubCitizens(ledgerManager, lowerAccountToIdentityMap, githubFile) {
    console.log('Processing GitHub CSV file');
    const promise = new Promise(function(resolve, reject)  {
        const readable = Readable.from(githubFile);
        readable.pipe(csvParser())
            .on('data', (row) => {
               githubUtils.testAndUpdateGithubAccount(ledgerManager, lowerAccountToIdentityMap, row, config.chainId, config.tokenAddress);
            })
            .on('end', () => {
                console.log('GitHub CSV file successfully processed');
                resolve(true);
            })
    });

    await promise;

    const result = await ledgerManager.persist();
    if (result.error) {
        console.error(`Failed to update the ledger after GitHub update: ${result.error}`);
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
               discordUtils.testAndUpdateDiscordAccount(ledgerManager, lowerAccountToIdentityMap, discordMemberMap, row, config.chainId, config.tokenAddress);
            })
            .on('end', () => {
                console.log('Discord CSV file successfully processed');
                resolve(true);
            })
    });

    await promise;

    const result = await ledgerManager.persist();
    if (result.error) {
        console.error(`Failed to update the ledger after Discord update: ${result.error}`);
        throw result.error
    };
}

async function processDiscourseCitizens(ledgerManager, lowerAccountToIdentityMap, discourseFile) {
    console.log('Processing Disoucrse CSV file');

    const promise = new Promise(function(resolve, reject)  {
        const readable = Readable.from(discourseFile);
        readable.pipe(csvParser())
            .on('data', (row) => {
               discourseUtils.testAndUpdateDiscourseAccount(ledgerManager, lowerAccountToIdentityMap, row, config.chainId, config.tokenAddress);
            })
            .on('end', () => {
                console.log('Discourse CSV file successfully processed');
                resolve(true);
            })
    });

    await promise;

    const result = await ledgerManager.persist();
    if (result.error) {
        console.error(`Failed to update the ledger after Discourse update: ${result.error}`);
        throw result.error
    };
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
