// node lower-case-payout-addresses.js

const readline = require('readline')
const fs = require('fs')

makePayoutAddressesLowerCase()

/**
 * Update payoutAddresses in the ledger.
 */
async function makePayoutAddressesLowerCase() {
  console.info('makePayoutAddressesLowerCase')

  let ledgerData = ''

  const rl = readline.createInterface({
    input: fs.createReadStream('./data/ledger.json')
  })
  rl.on('line', (line) => {
    if (line.indexOf('payoutAddress') == -1) {
      ledgerData += line + '\n'
    } else {
      console.info('line:', line)
      
      // Make the value of payoutAddress lower-case
      const ethAddress = line.substring(line.indexOf('payoutAddress') + 16, line.indexOf('payoutAddress') + 58)
      console.info('ethAddress:', ethAddress)

      line = line.replace(ethAddress, ethAddress.toLowerCase())
      console.info('line (lower-case):', line)

      ledgerData += line + '\n'
    }
  })
  rl.on('close', () => {
    console.info('close')
    fs.writeFileSync('./data/ledger.json', ledgerData)
  })
}
