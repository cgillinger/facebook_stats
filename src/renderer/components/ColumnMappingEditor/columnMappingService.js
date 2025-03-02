/**
 * Service för hantering av kolumnmappningar
 */
import { readColumnMappings as getStoredMappings, saveColumnMappings as storeColumnMappings } from '../../../utils/webStorageService';

// Endast kolumner som faktiskt används i vyerna
export const DEFAULT_MAPPINGS = {
  // Metadata (visas i PostView)
  "Post ID": "post_id",
  "Page ID": "page_id",
  "Page name": "page_name",
  "Title": "title",
  "Description": "description",
  "Publish time": "publish_time",
  "Post type": "post_type",
  "Permalink": "permalink",
  
  // Mätvärden
  "Impressions": "impressions",
  "Reach": "post_reach",
  "Reactions, Comments and Shares": "engagement_total",
  "Reactions": "reactions",
  "Comments": "comments",
  "Shares": "shares",
  "Total clicks": "total_clicks",
  "Other Clicks": "other_clicks",
  "Link Clicks": "link_clicks"
};

// Beskrivande namn för användargränssnittet
export const DISPLAY_NAMES = {
  'post_id': 'Post ID',
  'page_id': 'Sid-ID',
  'page_name': 'Sidnamn',
  'title': 'Titel',
  'description': 'Beskrivning',
  'publish_time': 'Publiceringstid',
  'post_type': 'Typ',
  'permalink': 'Länk',
  'impressions': 'Sidvisningar',
  'post_reach': 'Posträckvidd',
  'average_reach': 'Genomsnittlig räckvidd',
  'engagement_total': 'Reaktioner, kommentarer och delningar',
  'reactions': 'Reaktioner',
  'comments': 'Kommentarer',
  'shares': 'Delningar',
  'total_clicks': 'Totalt antal klick',
  'other_clicks': 'Övriga klick',
  'link_clicks': 'Länkklick',
  'post_count': 'Antal publiceringar',
  'posts_per_day': 'Publiceringar per dag'
};

// Gruppera kolumner för bättre översikt
export const COLUMN_GROUPS = {
  'Metadata': ['post_id', 'page_id', 'page_name', 'title', 'description', 'publish_time', 'post_type', 'permalink'],
  'Räckvidd och visningar': ['impressions', 'post_reach', 'average_reach'],
  'Engagemang': ['engagement_total', 'reactions', 'comments', 'shares', 'total_clicks', 'other_clicks', 'link_clicks'],
  'Publiceringsstatistik': ['post_count', 'posts_per_day']
};

let cachedMappings = null;

/**
 * Normalisera text för konsistent jämförelse
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
 * Hämtar aktuella mappningar, antingen från cache eller localStorage
 */
export async function getCurrentMappings() {
  if (cachedMappings) {
    console.log('Returning cached mappings');
    return cachedMappings;
  }

  try {
    // Hämta mappningar från localStorage via webStorageService
    const mappings = await getStoredMappings(DEFAULT_MAPPINGS);
    console.log('Läst mappningar från localStorage:', mappings);
    cachedMappings = mappings;
    return cachedMappings;
  } catch (error) {
    console.log('Kunde inte läsa mappningar, använder default:', error);
    return DEFAULT_MAPPINGS;
  }
}

/**
 * Läser kolumnmappningar från localStorage eller returnerar default
 */
export async function readColumnMappings() {
  return getCurrentMappings();
}

/**
 * Validerar att alla nödvändiga kolumner finns i CSV-data
 */
export function validateRequiredColumns(csvHeaders) {
  if (!csvHeaders || !Array.isArray(csvHeaders)) {
    console.error('Invalid csvHeaders:', csvHeaders);
    return { isValid: false, missingColumns: [] };
  }

  // Skapa map av normaliserade headers
  const normalizedHeaders = new Set(
    csvHeaders.map(header => normalizeText(header))
  );

  // Hitta saknade kolumner
  const missingColumns = Object.entries(DEFAULT_MAPPINGS)
    .filter(([originalName]) => !normalizedHeaders.has(normalizeText(originalName)))
    .map(([originalName, internalName]) => ({
      original: originalName,
      internal: internalName,
      displayName: DISPLAY_NAMES[internalName]
    }));

  return {
    isValid: missingColumns.length === 0,
    missingColumns
  };
}

/**
 * Sparar uppdaterade kolumnmappningar till localStorage
 */
export async function saveColumnMappings(mappings) {
  try {
    console.log('Sparar nya kolumnmappningar:', mappings);
    
    // Spara mappningar i localStorage via webStorageService
    await storeColumnMappings(mappings);
    console.log('Kolumnmappningar sparade framgångsrikt till localStorage');
    
    // Uppdatera cache med nya mappningar
    cachedMappings = mappings;
    console.log('Cache uppdaterad med nya mappningar');
    return true;
  } catch (error) {
    console.error('Fel vid sparande av kolumnmappningar:', error);
    throw new Error('Kunde inte spara kolumnmappningar');
  }
}