const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { parse } = require("papaparse");

// Definiera filvägar
const dataFolder = path.join(app.getPath("userData"), "data");
const outputFolder = path.join(app.getPath("userData"), "output");
const configFolder = path.join(app.getPath("userData"), "config");
const inputFile = path.join(dataFolder, "facebook_data.csv");
const columnMappingFile = path.join(configFolder, "column-mappings.json");

// Skapa output-mappen om den inte finns
if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
}

// Ladda kolumnmappningen
let columnMappings = {};
if (fs.existsSync(columnMappingFile)) {
    const mappingData = fs.readFileSync(columnMappingFile, "utf-8");
    columnMappings = JSON.parse(mappingData);
}

// Summeringsbara värden för "Per konto"-vy
const SUMMARIZABLE_COLUMNS = Object.values(columnMappings).filter(col => [
    "Views", "Reactions, Comments and Shares", "Reactions", "Comments", "Shares",
    "Engaged users", "Total clicks", "Other Clicks", "Link Clicks"
].includes(col));

// Metadata och icke-summeringsbara värden
const NON_SUMMARIZABLE_COLUMNS = Object.values(columnMappings).filter(col => [
    "Post ID", "Page ID", "Page name", "Title", "Description",
    "Publish time", "Date", "Post type", "Permalink"
].includes(col));

// Laddar och bearbetar CSV-data
function processFacebookData() {
    if (!fs.existsSync(inputFile)) {
        console.error("CSV-filen saknas!");
        return;
    }

    const csvData = fs.readFileSync(inputFile, "utf-8");
    const parsedData = parse(csvData, { header: true, skipEmptyLines: true });

    if (!parsedData.data || parsedData.data.length === 0) {
        console.error("Ingen data hittades i CSV-filen.");
        return;
    }

    let perKonto = {};
    let perPost = [];

    parsedData.data.forEach(row => {
        const mappedRow = {};
        Object.keys(columnMappings).forEach(originalCol => {
            if (row[originalCol] !== undefined) {
                mappedRow[columnMappings[originalCol]] = row[originalCol];
            }
        });

        const pageID = mappedRow["Page ID"];
        if (!pageID) return;

        // Skapa konto-objekt om det inte finns
        if (!perKonto[pageID]) {
            perKonto[pageID] = { "Page ID": pageID };
            SUMMARIZABLE_COLUMNS.forEach(col => perKonto[pageID][col] = 0);
        }

        // Summera värden
        SUMMARIZABLE_COLUMNS.forEach(col => {
            if (mappedRow[col] && !isNaN(parseFloat(mappedRow[col]))) {
                perKonto[pageID][col] += parseFloat(mappedRow[col]);
            }
        });

        // Spara per inlägg-data
        perPost.push(mappedRow);
    });

    // Konvertera till arrays
    const perKontoArray = Object.values(perKonto);

    // Spara output
    fs.writeFileSync(path.join(outputFolder, "per_konto_vy.json"), JSON.stringify(perKontoArray, null, 2));
    fs.writeFileSync(path.join(outputFolder, "per_post_vy.json"), JSON.stringify(perPost, null, 2));

    console.log("Bearbetning klar! Filer sparade i output.");
}

// Exponera funktionen
module.exports = { processFacebookData };

