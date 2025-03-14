/**
 * Web Data Processor
 * 
 * Webbversion av Facebook databearbetning som använder
 * webbläsarens API:er för att hantera och bearbeta data.
 * Stöd för att bearbeta flera CSV-filer och hantera stora datamängder.
 */
import Papa from 'papaparse';
import { saveProcessedData } from './webStorageService';
import { EXCLUDED_COLUMN_NAMES } from '../renderer/components/ColumnMappingEditor/columnMappingService';

// Summeringsbara värden för "Per konto"-vy
const SUMMARIZABLE_COLUMNS = [
  "impressions", "post_reach", "engagement_total", "reactions", 
  "comments", "shares", "total_clicks", "other_clicks", "link_clicks"
];

// Metadata och icke-summeringsbara värden
const NON_SUMMARIZABLE_COLUMNS = [
  "post_id", "page_id", "page_name", "title", "description",
  "publish_time", "post_type", "permalink"
];

// För att förhindra dubbelprocess med samma CSV
let processingCache = new Map();
// Cache för post_id för att förhindra dubletter mellan filer
let globalPostIdCache = new Set();

// Flagga för att endast logga kolumner en gång per session
let hasLoggedColumns = false;

// Flagga för att förhindra flera samtida bearbetningar av samma fil
let processingInProgress = false;
let processingQueue = [];

/**
 * Kontrollerar om ett kolumnnamn ska exkluderas från automatisk mappning
 */
function isExcludedColumn(columnName) {
  if (!columnName) return true;
  return EXCLUDED_COLUMN_NAMES.some(excluded => 
    normalizeText(columnName) === normalizeText(excluded)
  );
}

/**
 * Normaliserar text för konsekvent jämförelse
 * Returnerar tom sträng om null/undefined, annars lowercase, trimmat, utan multipla mellanslag
 */
function normalizeText(text) {
  if (text === null || text === undefined) return '';
  return text.toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // Hantera multipla mellanslag
    .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Ta bort osynliga tecken
}

/**
 * Genererar en enkel hash från en sträng för att identifiera unika filer
 */
function simpleHash(str) {
  let hash = 0;
  if (str.length === 0) return hash;
  
  // Använd bara de första 10000 tecknen för snabbhet
  for (let i = 0; i < Math.min(str.length, 10000); i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Konvertera till 32-bit heltal
  }
  
  return hash.toString();
}

/**
 * Identifierar och hanterar dubletter baserat på Post ID
 * Kan hantera dubletter både inom en fil och mellan filer
 * @param {Array} data - Rader att kontrollera för dubletter
 * @param {Object} columnMappings - Mapping från originalkolumnnamn till interna namn
 * @param {boolean} checkGlobalDuplicates - Om true, kontrollerar även mot global post_id cache
 */
function handleDuplicates(data, columnMappings, checkGlobalDuplicates = true) {
  // Skapa en map för att identifiera post_id kolumnen
  const internalToExternal = {};
  Object.entries(columnMappings).forEach(([external, internal]) => {
    if (!isExcludedColumn(external)) {
      if (!internalToExternal[internal]) {
        internalToExternal[internal] = [];
      }
      internalToExternal[internal].push(external);
    }
  });
  
  // Hitta alla möjliga kolumnnamn för post_id
  const possiblePostIdColumns = internalToExternal['post_id'] || [];
  const normalizedPostIdColumns = possiblePostIdColumns.map(col => normalizeText(col));
  
  // Skapa en map för att hålla reda på unika post_ids
  const uniquePosts = new Map();
  const duplicateIds = new Set();
  let duplicateCount = 0;
  const totalRows = data.length;
  
  // För att spåra nya post IDs
  const newPostIds = new Set();
  
  // Identifiera och räkna dubletter
  data.forEach(row => {
    // Hitta post_id i denna rad
    let postId = null;
    
    // Sök genom alla möjliga post_id kolumner
    for (const key of Object.keys(row)) {
      const normKey = normalizeText(key);
      if (normalizedPostIdColumns.includes(normKey)) {
        postId = row[key];
        break;
      }
    }
    
    if (postId) {
      const postIdStr = String(postId);
      
      // Kontrollera om det är en dublett i denna datamängd
      if (uniquePosts.has(postIdStr)) {
        duplicateCount++;
        duplicateIds.add(postIdStr);
      } 
      // Kontrollera mot den globala cachen om det är aktiverat
      else if (checkGlobalDuplicates && globalPostIdCache.has(postIdStr)) {
        duplicateCount++;
        duplicateIds.add(postIdStr);
      }
      else {
        uniquePosts.set(postIdStr, row);
        newPostIds.add(postIdStr);
      }
    } else {
      // Om ingen post_id finns, använd hela raden som unik nyckel
      const rowStr = JSON.stringify(row);
      if (uniquePosts.has(rowStr)) {
        duplicateCount++;
      } else {
        uniquePosts.set(rowStr, row);
      }
    }
  });
  
  // Lägg till nya post IDs i den globala cachen
  if (checkGlobalDuplicates) {
    newPostIds.forEach(id => globalPostIdCache.add(id));
  }
  
  // Konvertera Map till array av unika rader
  const uniqueData = Array.from(uniquePosts.values());
  
  return {
    filteredData: uniqueData,
    stats: {
      totalRows,
      duplicates: duplicateCount,
      duplicateIds: Array.from(duplicateIds),
      uniquePostIds: uniqueData.length
    }
  };
}

/**
 * Mappar CSV-kolumnnamn till interna namn med hjälp av kolumnmappningar
 * Använder endast exakt matchning efter normalisering
 */
function mapColumnNames(row, columnMappings) {
  const mappedRow = {};
  
  // Normalisera kolumnmappningar
  const normalizedMappings = new Map();
  Object.entries(columnMappings).forEach(([originalCol, internalName]) => {
    if (!isExcludedColumn(originalCol)) {
      normalizedMappings.set(normalizeText(originalCol), internalName);
    }
  });
  
  // Utskrift för felsökning - enbart en gång per session
  if (!hasLoggedColumns) {
    console.log('Kolumner i CSV:', Object.keys(row).map(k => `"${k}"`).join(', '));
    console.log('Normaliserade mappningar:', Array.from(normalizedMappings.entries()).map(([k, v]) => `"${k}" -> "${v}"`).join(', '));
    hasLoggedColumns = true;
  }
  
  // För varje kolumn i raden, försök hitta en matchning
  Object.entries(row).forEach(([colName, value]) => {
    // Hoppa över kolumner som ska exkluderas
    if (isExcludedColumn(colName)) {
      return;
    }
    
    const normalizedColName = normalizeText(colName);
    const internalName = normalizedMappings.get(normalizedColName);
    
    if (internalName) {
      mappedRow[internalName] = value;
    }
  });
  
  return mappedRow;
}

/**
 * Bearbetar CSV-innehåll och returnerar aggregerad data
 * Optimerad för att undvika dubbelprocess och effektivisera bearbetning
 * @param {string} csvContent - CSV-innehåll att bearbeta
 * @param {Object} columnMappings - Kolumnmappningar att använda
 * @param {boolean} checkDuplicatesGlobally - Om true, kontrollerar dubletter mot global cache
 */
export async function processFacebookData(csvContent, columnMappings, checkDuplicatesGlobally = true) {
  // Skapa en cache-nyckel baserad på innehållet
  const cacheKey = simpleHash(csvContent);
  
  // Om denna fil redan bearbetats, återanvänd resultatet
  if (processingCache.has(cacheKey)) {
    console.log('Återanvänder tidigare bearbetad data (cache hit)');
    return processingCache.get(cacheKey);
  }
  
  // Om bearbetning redan pågår, köa denna begäran
  if (processingInProgress) {
    console.log('Bearbetning pågår redan, köar begäran');
    return new Promise((resolve, reject) => {
      processingQueue.push({
        csvContent,
        columnMappings,
        checkDuplicatesGlobally,
        resolve,
        reject,
        cacheKey
      });
    });
  }
  
  // Sätt flaggor för att börja bearbeta
  processingInProgress = true;
  hasLoggedColumns = false;  // Tillåt loggning av kolumner för denna nya fil
  
  return new Promise((resolve, reject) => {
    try {
      console.log('Börjar bearbeta CSV-data');
      
      Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: async (results) => {
          if (!results.data || results.data.length === 0) {
            processingInProgress = false;
            reject(new Error('Ingen data hittades i CSV-filen.'));
            return;
          }
          
          console.log('CSV-data analyserad:', {
            rows: results.data.length,
            columns: Object.keys(results.data[0]).length
          });
          
          // Identifiera och filtrera dubletter
          const { filteredData, stats } = handleDuplicates(
            results.data, 
            columnMappings, 
            checkDuplicatesGlobally
          );
          
          console.log('Dubbletthantering klar:', {
            originalRows: stats.totalRows,
            filteredRows: filteredData.length,
            duplicatesRemoved: stats.duplicates,
            uniquePostIds: stats.uniquePostIds
          });
          
          let perKonto = {};
          let perPost = [];
          
          // Bearbeta varje unik rad
          filteredData.forEach(row => {
            // Mappa kolumnnamn till interna namn
            const mappedRow = mapColumnNames(row, columnMappings);
            
            // Extrahera sid-ID (page_id)
            const pageID = mappedRow['page_id'] || 'unknown';
            if (!pageID || pageID === 'unknown') {
              console.warn('Rad utan giltigt sid-ID:', row);
              return;
            }
            
            // Skapa konto-objekt om det inte finns
            if (!perKonto[pageID]) {
              perKonto[pageID] = { 
                "page_id": pageID,
                "page_name": mappedRow["page_name"] || 'Okänd sida'
              };
              
              // Initiera alla summeringsbara fält till 0
              SUMMARIZABLE_COLUMNS.forEach(col => {
                perKonto[pageID][col] = 0;
              });
            }
            
            // Summera värden
            SUMMARIZABLE_COLUMNS.forEach(col => {
              const value = mappedRow[col];
              if (value !== undefined && value !== null && !isNaN(parseFloat(value))) {
                perKonto[pageID][col] += parseFloat(value);
              }
            });
            
            // Spara per inlägg-data
            perPost.push(mappedRow);
          });
          
          // Beräkna genomsnittlig räckvidd för konton
          Object.values(perKonto).forEach(account => {
            const accountPosts = perPost.filter(post => post.page_id === account.page_id);
            // Filtrera poster med giltiga räckviddsvärden
            const validReachPosts = accountPosts.filter(post => 
              post.post_reach !== undefined && 
              post.post_reach !== null && 
              !isNaN(parseFloat(post.post_reach))
            );
            
            if (validReachPosts.length > 0) {
              const totalReach = validReachPosts.reduce((sum, post) => 
                sum + parseFloat(post.post_reach), 0
              );
              account.average_reach = Math.round(totalReach / validReachPosts.length);
            } else {
              account.average_reach = 0;
            }
            
            // Beräkna post_count
            account.post_count = accountPosts.length;
            
            // Beräkna posts_per_day
            // Leta efter tidigaste och senaste publiceringstid
            let earliestDate = null;
            let latestDate = null;
            
            accountPosts.forEach(post => {
              const pubDate = post.publish_time ? new Date(post.publish_time) : null;
              if (pubDate && !isNaN(pubDate.getTime())) {
                if (!earliestDate || pubDate < earliestDate) earliestDate = pubDate;
                if (!latestDate || pubDate > latestDate) latestDate = pubDate;
              }
            });
            
            if (earliestDate && latestDate) {
              const daysDiff = Math.max(1, Math.ceil((latestDate - earliestDate) / (1000 * 60 * 60 * 24)));
              account.posts_per_day = parseFloat((account.post_count / daysDiff).toFixed(2));
            } else {
              account.posts_per_day = account.post_count;
            }
          });
          
          // Konvertera till arrays
          const perKontoArray = Object.values(perKonto);
          
          // Skapa resultatet
          const result = {
            accountViewData: perKontoArray,
            postViewData: perPost,
            rows: perPost,
            rowCount: perPost.length,
            meta: {
              processedAt: new Date(),
              stats: stats
            }
          };
          
          try {
            // Spara data via webStorageService
            await saveProcessedData(perKontoArray, perPost);
            console.log('Bearbetning klar! Data sparad i webbläsaren.');
          } catch (storageError) {
            console.error('Varning: Kunde inte spara all data i webbläsaren:', storageError);
            console.log('Fortsätter med bearbetad data i minnet.');
          }
          
          // Cachea resultatet för framtida användning
          processingCache.set(cacheKey, result);
          
          // Återställ flagga och hantera nästa köade bearbetning om den finns
          processingInProgress = false;
          
          if (processingQueue.length > 0) {
            const nextProcess = processingQueue.shift();
            console.log('Bearbetar nästa köade förfrågning');
            processFacebookData(
              nextProcess.csvContent, 
              nextProcess.columnMappings,
              nextProcess.checkDuplicatesGlobally
            )
              .then(nextProcess.resolve)
              .catch(nextProcess.reject);
          }
          
          resolve(result);
        },
        error: (error) => {
          processingInProgress = false;
          console.error('Fel vid CSV-parsning:', error);
          reject(error);
        }
      });
    } catch (error) {
      processingInProgress = false;
      console.error('Oväntat fel vid bearbetning:', error);
      reject(error);
    }
  });
}

/**
 * Rensar bearbetningscachen
 * Används för att tvinga en ny bearbetning när det behövs
 */
export function clearProcessingCache() {
  processingCache.clear();
  console.log('Bearbetningscachen rensad');
}

/**
 * Rensar den globala post ID cachen
 * Används när man vill börja om från början utan dublettdetektion mellan filer
 */
export function resetGlobalPostIdCache() {
  globalPostIdCache.clear();
  console.log('Global post ID cache rensad');
}

/**
 * Returnerar en lista med unika sidnamn från data
 */
export function getUniquePageNames(data) {
  if (!Array.isArray(data)) return [];
  
  // Extrahera och deduplicera sidnamn
  const pageNames = new Set();
  
  data.forEach(post => {
    const pageName = post.page_name || 'Unknown';
    if (pageName) {
      pageNames.add(pageName);
    }
  });
  
  return Array.from(pageNames).sort();
}

/**
 * Extraherar datumintervall från data
 * @param {Array} data - Data att analysera
 * @returns {Object|null} - Datumintervall {start, end} eller null
 */
export function getDateRange(data) {
  if (!Array.isArray(data) || data.length === 0) return null;
  
  // Samla alla giltiga publiceringsdatum
  const dates = data
    .map(item => item.publish_time || item.date)
    .filter(date => date);
  
  if (dates.length === 0) return null;
  
  // Hitta tidigaste och senaste datum
  let earliestDate = new Date(dates[0]);
  let latestDate = new Date(dates[0]);
  
  dates.forEach(date => {
    const currentDate = new Date(date);
    if (!isNaN(currentDate.getTime())) {
      if (currentDate < earliestDate) earliestDate = currentDate;
      if (currentDate > latestDate) latestDate = currentDate;
    }
  });
  
  // Formatera datum
  const formatDate = (date) => {
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  return {
    start: formatDate(earliestDate),
    end: formatDate(latestDate)
  };
}

/**
 * Exportfunktioner för användning i komponenter
 */
export { SUMMARIZABLE_COLUMNS, NON_SUMMARIZABLE_COLUMNS };