// node generate-csv.js

const fs = require('fs')
const path = require('path')
const csvParser = require('csv-parser')
const csvWriter = require('csv-writer')
const currencyDetails = require('./config/currencyDetails.json')
const nationAddress = currencyDetails.integrationCurrency.tokenAddress

// 0.50% of the weekly $NATION budget set in config/grain.json
const FLOOR = 0.01;

generateCSV()

/**
 * Generates CSV files compatible with Disperse.app, Gnosis Safe and Parcel.
 */
function generateCSV() {
    console.log('generateCSV')

    // Iterate the CSV files generated by SourceCred in output/grainIntegration/
    fs.readdir('output/grainIntegration/', function(err, files) {
        if (err) {
            console.error(err)
            return
        }
        
        files.forEach(function(file, index) {
            const filePath = path.join('output/grainIntegration/', file)
            if (filePath.endsWith('.csv') 
                    && !filePath.endsWith('_disperse.csv') 
                    && !filePath.endsWith('_gnosis.csv')
                    && !filePath.endsWith('_parcel.csv')) {
                // Read the rows of data from the CSV file
                let csvRows = []
                fs.createReadStream(filePath)
                    .pipe(csvParser(['receiver', 'amount']))
                    .on('data', (row) => insertRow(csvRows, row))
                    .on('end', () => {
                        console.log('\nfilePath', filePath)
                        console.table(csvRows.map(row => ({ receiver: row.receiver, amount: row.amount })))

                        // Convert amount format
                        convertAmountFormat(csvRows)

                        csvRows = pruneRows(csvRows);

                        // Generate CSV for Gnosis Safe
                        filePathGnosis = filePath.replace('.csv', '_gnosis.csv')
                        console.log('filePathGnosis', filePathGnosis)
                        writeToGnosisCSV(filePathGnosis, csvRows)
                    })
            }
        })
    })
}

function insertRow(rows, row) {
    let newRow = {};
    newRow.receiver = row.receiver
    newRow.amount = row.amount
    newRow.name = ''
    newRow.token_type = 'erc20'
    newRow.token_address = currencyDetails.integrationCurrency.tokenAddress

    rows.push(newRow)
}

function pruneRows(rows) {
    let pruned = rows.filter(row => row.amount >= FLOOR);
    return pruned;
}

/**
 * Convert the amount column to 18 decimal format:
 *   0x3e465ABFa9b2A7E18a610F489fb3510765461d13,"7718330904890492"
 *   -->
 *   0x3e465ABFa9b2A7E18a610F489fb3510765461d13,0.007718330904890492
 */
function convertAmountFormat(csvRows) {
    console.log('convertAmountFormat')

    csvRows.forEach(function(row, index) {
        // Prepend zeros
        while (row.amount.length <= 18) {
            row.amount = "0" + row.amount
        }

        // Add decimal
        row.amount = row.amount.substring(0, row.amount.length - 18) + "." + row.amount.substring(row.amount.length - 18, row.amount.length)
    })
}

function writeToGnosisCSV(filePathGnosis, csvRows) {
    console.log('writeToGnosisCSV')
    
    const writer = csvWriter.createObjectCsvWriter({
        path: filePathGnosis,
        header: [
            {id: 'token_type', title: 'token_type'},
            {id: 'token_address', title: 'token_address'},
            {id: 'receiver', title: 'receiver'},
            {id: 'amount', title: 'amount'},
            {id: 'id', title: 'id'}
        ]
    })

    writer.writeRecords(csvRows)
}
