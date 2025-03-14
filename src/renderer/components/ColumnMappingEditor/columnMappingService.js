/**
 * Service för hantering av kolumnmappningar
 */
import { readColumnMappings as getStoredMappings, saveColumnMappings as storeColumnMappings } from '../../../utils/webStorageService';

// Endast kolumner som faktiskt används i vyerna - Svenska som standard
export const DEFAULT_MAPPINGS = {
  // Metadata (visas i PostView)
  "Publicerings-id": "post_id",
  "Sid-id": "page_id",
  "Sidnamn": "page_name",
  "Titel": "title",
  "Beskrivning": "description",
  "Publiceringstid": "publish_time",
  "Inläggstyp": "post_type",
  "Permalänk": "permalink",
  
  // Mätvärden
  "Visningar": "impressions",
  "Räckvidd": "post_reach",
  "Reaktioner, kommentarer och delningar": "engagement_total",
  "Reaktioner": "reactions",
  "Kommentarer": "comments",
  "Delningar": "shares",
  "Totalt antal klick": "total_clicks",
  "Övriga klick": "other_clicks",
  "Länkklick": "link_clicks"
};

// Explicita undantag som inte ska mappas automatiskt
export const EXCLUDED_COLUMN_NAMES = [
  "Ad impressions",  // Ska inte mappas till impressions
  "Ad CPM (USD)",    // Ska inte mappas till någon standard-kolumn
  "Ad spend (USD)",
  "Ad clicks",
  "Ad reach",
  "Paid Impressions",
  "Paid Reach",
  "Premium Impressions"
];

// Beskrivande namn för användargränssnittet
export const DISPLAY_NAMES = {
  'post_id': 'Publicerings-ID',  // Ändrat från 'Publicerings-id' till 'Publicerings-ID' för konsekvent namngivning
  'page_id': 'Sid-id',
  'page_name': 'Sidnamn',
  'title': 'Titel',
  'description': 'Beskrivning',
  'publish_time': 'Publiceringstid',
  'post_type': 'Inläggstyp',
  'permalink': 'Permalänk',
  'impressions': 'Visningar',
  'post_reach': 'Räckvidd',
  'average_reach': 'Genomsnittlig räckvidd',
  'engagement_total': 'Interaktioner',  // Ändrat från 'Reaktioner, kommentarer och delningar' till 'Interaktioner'
  'reactions': 'Reaktioner',
  'comments': 'Kommentarer',
  'shares': 'Delningar',
  'total_clicks': 'Totalt antal klick',
  'other_clicks': 'Övriga klick',
  'link_clicks': 'Länkklick',
  'post_count': 'Antal publiceringar',
  'posts_per_day': 'Publiceringar per dag',
  'page_url': 'Facebook URL'  // Nytt fält för Facebook URL
};

// Gruppera kolumner för bättre översikt
export const COLUMN_GROUPS = {
  'Metadata': ['post_id', 'page_id', 'page_name', 'title', 'description', 'publish_time', 'post_type', 'permalink', 'page_url'],
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
 * Kontrollerar om ett kolumnnamn ska exkluderas från automatisk mappning
 */
function isExcludedColumn(columnName) {
  if (!columnName) return true;
  return EXCLUDED_COLUMN_NAMES.some(excluded => 
    normalizeText(columnName) === normalizeText(excluded)
  );
}

/**
 * Återställer kolumnmappningar till standardvärden men bevarar användaranpassningar
 */
export async function resetMappingsToDefault() {
  try {
    console.log('Återställer kolumnmappningar till standard');

    // Hämta befintliga mappningar om de finns
    const currentMappings = cachedMappings || await getStoredMappings(DEFAULT_MAPPINGS);
    
    // Skapa en karta från internt namn -> externt namn
    const internalToExternal = {};
    for (const [externalName, internalName] of Object.entries(currentMappings)) {
      internalToExternal[internalName] = externalName;
    }
    
    // Skapa nya mappningar med standardvärden
    const newMappings = { ...DEFAULT_MAPPINGS };
    
    // Hitta alla interna namn som inte finns i DEFAULT_MAPPINGS
    // Dessa är troligen användaranpassningar som vi vill behålla
    for (const [externalName, internalName] of Object.entries(currentMappings)) {
      if (!Object.values(DEFAULT_MAPPINGS).includes(internalName)) {
        // Detta är en kolumn som inte finns i standarduppsättningen
        // Behåll användarens definition
        newMappings[externalName] = internalName;
      }
    }
    
    // Spara de nya mappningarna
    await storeColumnMappings(newMappings);
    
    // Uppdatera cachen
    cachedMappings = newMappings;
    
    console.log('Kolumnmappningar återställda:', newMappings);
    return newMappings;
  } catch (error) {
    console.error('Fel vid återställning av kolumnmappningar:', error);
    throw error;
  }
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

  // Logga alla kolumner för felsökning
  console.log('CSV-kolumner från validateRequiredColumns:', csvHeaders);

  // Skapa map av normaliserade headers
  const normalizedHeaders = new Set(
    csvHeaders.filter(header => !isExcludedColumn(header))
            .map(header => normalizeText(header))
  );

  // Hämta aktuella mappningar
  const currentMappings = cachedMappings || DEFAULT_MAPPINGS;
  
  // Hitta saknade kolumner
  const missingColumns = Object.entries(currentMappings)
    .filter(([originalName, internalName]) => {
      // Hoppa över exkluderade kolumnnamn
      if (isExcludedColumn(originalName)) {
        return false;
      }
      
      // Kontrollera om vi kan hitta kolumnen i headers genom exakt matchning
      return !normalizedHeaders.has(normalizeText(originalName));
    })
    .map(([originalName, internalName]) => ({
      original: originalName,
      internal: internalName,
      displayName: DISPLAY_NAMES[internalName]
    }));

  // Gruppera saknade kolumner på internt namn för att undvika dubbletter
  const uniqueMissingColumns = [];
  const processedInternals = new Set();
  
  missingColumns.forEach(col => {
    if (!processedInternals.has(col.internal)) {
      uniqueMissingColumns.push(col);
      processedInternals.add(col.internal);
    }
  });

  // Nödvändiga kolumner för att fungera
  const requiredInternalNames = [
    'impressions',     // Visningar
    'post_reach'       // Räckvidd
  ];
  
  // Kontrollera om alla nödvändiga kolumner finns
  const missingRequiredInternals = requiredInternalNames.filter(
    requiredName => uniqueMissingColumns.some(col => col.internal === requiredName)
  );

  return {
    isValid: missingRequiredInternals.length === 0,
    missingColumns: uniqueMissingColumns
  };
}

/**
 * Sparar uppdaterade kolumnmappningar till localStorage
 */
export async function saveColumnMappings(mappings) {
  try {
    // FÖRBÄTTRING: Validera att alla nödvändiga mappningar finns
    const requiredInternalNames = [
      'impressions',
      'post_reach',
      'total_clicks',
      'reactions',
      'comments',
      'shares'
    ];
    
    // Kontrollera att alla viktiga interna namn finns i mappningarna
    const missingInternals = requiredInternalNames.filter(
      name => !Object.values(mappings).includes(name)
    );
    
    if (missingInternals.length > 0) {
      const missingNames = missingInternals.map(name => DISPLAY_NAMES[name] || name).join(', ');
      console.error(`Saknade nödvändiga mappningar för: ${missingNames}`);
      throw new Error(`Viktiga kolumnmappningar saknas: ${missingNames}`);
    }
    
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
    throw new Error('Kunde inte spara kolumnmappningar: ' + error.message);
  }
}

/**
 * Formaterar värden för visning i UI
 */
export function formatValue(value) {
  if (value === null || value === undefined) return 'Saknas';
  if (value === 0) return '0';
  if (typeof value === 'number') return value.toLocaleString('sv-SE');
  return value || '-';
}

/**
 * Formaterar datum för visning enligt svensk standard
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateStr;
  }
}