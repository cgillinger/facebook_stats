/**
 * Web Data Processor
 * 
 * Webbversion av Facebook databearbetning som använder
 * webbläsarens API:er för att hantera och bearbeta data.
 */
import Papa from 'papaparse';
import { saveProcessedData } from './webStorageService';
import { DEFAULT_MAPPINGS } from '../renderer/components/ColumnMappingEditor/columnMappingService';

// Summeringsbara värden för "Per konto"-vy
const SUMMARIZABLE_COLUMNS = Object.values(DEFAULT_MAPPINGS).filter(col => [
  "impressions", "engagement_total", "reactions", "comments", "shares",
  "total_clicks", "other_clicks", "link_clicks"
].includes(col));

// Metadata och icke-summeringsbara värden
const NON_SUMMARIZABLE_COLUMNS = Object.values(DEFAULT_MAPPINGS).filter(col => [
  "post_id", "page_id", "page_name", "title", "description",
  "publish_time", "post_type", "permalink"
].includes(col));

/**
 * Normaliserar text för konsekvent jämförelse
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
 * Identifierar och hanterar dubletter baserat på Post ID
 * @param {Array} data - Rader att kontrollera för dubletter
 * @param {Object} columnMappings - Mapping från originalkolumnnamn till interna namn
 */
function handleDuplicates(data, columnMappings) {
  // Skapa en map för att hålla reda på unika post_ids
  const uniquePosts = new Map();
  const duplicateIds = new Set();
  let duplicateCount = 0;
  const totalRows = data.length;
  
  // Först identifiera och räkna dubletter
  data.forEach(row => {
    // Använd normaliserade kolumnnamn baserat på mappning
    // Hitta värdet för post_id oavsett vilket original kolumnnamn det har i CSV-filen
    let postId = null;
    
    // Hitta det interna namnet för post_id
    const postIdKey = Object.entries(columnMappings)
      .find(([_, internalName]) => internalName === 'post_id');
      
    if (postIdKey) {
      // Använd originalkolumnnamn från mappning
      postId = row[postIdKey[0]];
    }
    
    // Fallback till vanliga kolonnamn om mappning inte hjälpte
    if (!postId) {
      postId = row['Post ID'] || row['post_id'] || row['PostID'] || row['post-id'];
    }
    
    if (postId) {
      const postIdStr = String(postId);
      
      if (uniquePosts.has(postIdStr)) {
        duplicateCount++;
        duplicateIds.add(postIdStr);
      } else {
        uniquePosts.set(postIdStr, row);
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
  
  // Konvertera Map till array av unika rader
  const uniqueData = Array.from(uniquePosts.values());
  
  return {
    filteredData: uniqueData,
    stats: {
      totalRows,
      duplicates: duplicateCount,
      duplicateIds: Array.from(duplicateIds)
    }
  };
}

/**
 * Mappar CSV-kolumnnamn till interna namn med hjälp av kolumnmappningar
 */
function mapColumnNames(row, columnMappings) {
  const mappedRow = {};
  
  Object.entries(row).forEach(([originalCol, value]) => {
    // Hitta matchande mappning via normaliserad textjämförelse
    const normalizedCol = normalizeText(originalCol);
    
    let internalName = null;
    for (const [mapKey, mapValue] of Object.entries(columnMappings)) {
      if (normalizeText(mapKey) === normalizedCol) {
        internalName = mapValue;
        break;
      }
    }
    
    // Om ingen mappning hittades, använd originalkolumnen
    if (!internalName) {
      internalName = originalCol;
    }
    
    mappedRow[internalName] = value;
  });
  
  return mappedRow;
}

/**
 * Bearbetar CSV-innehåll och returnerar aggregerad data
 */
export async function processFacebookData(csvContent, columnMappings) {
  return new Promise((resolve, reject) => {
    try {
      Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (!results.data || results.data.length === 0) {
            reject(new Error('Ingen data hittades i CSV-filen.'));
            return;
          }
          
          console.log('CSV-data analyserad:', {
            rows: results.data.length,
            columns: Object.keys(results.data[0]).length
          });
          
          // Identifiera och filtrera dubletter - uppdaterat för att använda kolumnmappningar
          const { filteredData, stats } = handleDuplicates(results.data, columnMappings);
          
          console.log('Dubbletthantering klar:', {
            originalRows: stats.totalRows,
            filteredRows: filteredData.length,
            duplicatesRemoved: stats.duplicates
          });
          
          let perKonto = {};
          let perPost = [];
          
          // Bearbeta varje unik rad
          filteredData.forEach(row => {
            // Mappa kolumnnamn till interna namn
            const mappedRow = mapColumnNames(row, columnMappings);
            
            const pageID = mappedRow["page_id"] || 
                         mappedRow["Page ID"] || 
                         row["Page ID"] || 
                         'unknown';
            
            if (!pageID) return;
            
            // Säkerställ att page_name finns
            if (!mappedRow["page_name"]) {
              mappedRow["page_name"] = 
                mappedRow["Page name"] || 
                row["Page name"] || 
                'Okänd sida';
            }
            
            // Skapa konto-objekt om det inte finns
            if (!perKonto[pageID]) {
              perKonto[pageID] = { 
                "page_id": pageID,
                "page_name": mappedRow["page_name"]
              };
              SUMMARIZABLE_COLUMNS.forEach(col => perKonto[pageID][col] = 0);
            }
            
            // Beräkna engagement_total om det behövs
            if (!mappedRow["engagement_total"] && mappedRow["reactions"] && mappedRow["comments"] && mappedRow["shares"]) {
              const reactions = parseFloat(mappedRow["reactions"]) || 0;
              const comments = parseFloat(mappedRow["comments"]) || 0;
              const shares = parseFloat(mappedRow["shares"]) || 0;
              mappedRow["engagement_total"] = reactions + comments + shares;
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
          
          // Beräkna genomsnittlig räckvidd för konton
          Object.values(perKonto).forEach(account => {
            const accountPosts = perPost.filter(post => post.page_id === account.page_id);
            const validReachPosts = accountPosts.filter(post => post.post_reach !== undefined && post.post_reach !== null);
            
            if (validReachPosts.length > 0) {
              const totalReach = validReachPosts.reduce((sum, post) => sum + (parseFloat(post.post_reach) || 0), 0);
              account.average_reach = Math.round(totalReach / validReachPosts.length);
            } else {
              account.average_reach = 0;
            }
          });
          
          // Konvertera till arrays
          const perKontoArray = Object.values(perKonto);
          
          // Spara data via webStorageService
          saveProcessedData(perKontoArray, perPost)
            .then(() => {
              console.log('Bearbetning klar! Data sparad i webbläsaren.');
              resolve({
                accountViewData: perKontoArray,
                postViewData: perPost,
                rows: perPost,
                rowCount: perPost.length,
                meta: {
                  processedAt: new Date(),
                  stats: stats
                }
              });
            })
            .catch((error) => {
              console.error('Kunde inte spara bearbetad data:', error);
              reject(error);
            });
        },
        error: (error) => {
          console.error('Fel vid CSV-parsning:', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('Oväntat fel vid bearbetning:', error);
      reject(error);
    }
  });
}

/**
 * Returnerar en lista med unika sidnamn från data
 */
export function getUniquePageNames(data) {
  if (!Array.isArray(data)) return [];
  
  // Extrahera och deduplicera sidnamn
  const pageNames = new Set();
  
  data.forEach(post => {
    const pageName = post.page_name || 
                    post['Page name'] || 
                    post['page_name'];
    if (pageName) {
      pageNames.add(pageName);
    }
  });
  
  return Array.from(pageNames).sort();
}

/**
 * Exportfunktioner för användning i komponenter
 */
export { SUMMARIZABLE_COLUMNS, NON_SUMMARIZABLE_COLUMNS };