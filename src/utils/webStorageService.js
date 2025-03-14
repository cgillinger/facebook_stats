/**
 * Web Storage Service
 * 
 * Ersätter Electrons filsystemåtkomst med webbaserade lösningar:
 * - localStorage för konfiguration och små datamängder
 * - IndexedDB för större datauppsättningar
 * - Web File API för filhantering
 */

// Konstanter
const STORAGE_KEYS = {
  COLUMN_MAPPINGS: 'facebook_stats_column_mappings',
  PROCESSED_DATA: 'facebook_stats_processed_data',
  ACCOUNT_VIEW_DATA: 'facebook_stats_account_view',
  POST_VIEW_DATA: 'facebook_stats_post_view',
  LAST_EXPORT_PATH: 'facebook_stats_last_export_path',
  DB_NAME: 'FacebookStatisticsDB',
  DB_VERSION: 1,
  STORE_POSTS: 'postData',
  STORE_ACCOUNTS: 'accountData',
};

// Storgränser
const STORAGE_LIMITS = {
  LOCAL_STORAGE_MAX: 5 * 1024 * 1024, // 5MB
  INDEXED_DB_ESTIMATED_MAX: 50 * 1024 * 1024 // 50MB uppskattning
};

// Använd en singleton för DB-anslutning
let dbInstance = null;

/**
 * Initierar och öppnar IndexedDB
 */
const openDatabase = () => {
  // Om vi redan har en instans, återanvänd den
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(STORAGE_KEYS.DB_NAME, STORAGE_KEYS.DB_VERSION);
      
      request.onerror = (event) => {
        console.error('IndexedDB-fel:', event.target.error);
        reject(event.target.error);
      };
      
      request.onupgradeneeded = (event) => {
        try {
          const db = event.target.result;
          
          console.log('Uppgraderar IndexedDB-schema');
          
          // Skapa object stores om de inte existerar
          if (!db.objectStoreNames.contains(STORAGE_KEYS.STORE_POSTS)) {
            console.log(`Skapar objektlager: ${STORAGE_KEYS.STORE_POSTS}`);
            db.createObjectStore(STORAGE_KEYS.STORE_POSTS, { keyPath: 'id', autoIncrement: true });
          }
          
          if (!db.objectStoreNames.contains(STORAGE_KEYS.STORE_ACCOUNTS)) {
            console.log(`Skapar objektlager: ${STORAGE_KEYS.STORE_ACCOUNTS}`);
            db.createObjectStore(STORAGE_KEYS.STORE_ACCOUNTS, { keyPath: 'id', autoIncrement: true });
          }
          
          console.log('IndexedDB-schema uppgraderat');
        } catch (error) {
          console.error('Fel vid schema-uppgradering:', error);
        }
      };
      
      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        console.log('IndexedDB öppnad framgångsrikt');
        resolve(dbInstance);
      };
    } catch (error) {
      console.error('Fel vid öppnande av IndexedDB:', error);
      resolve(null); // Returnera null istället för att avvisa för att tillåta fallback
    }
  });
};

/**
 * Sparar data i localStorage
 */
const saveToLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Fel vid sparande till localStorage (${key}):`, error);
    return false;
  }
};

/**
 * Hämtar data från localStorage
 */
const getFromLocalStorage = (key, defaultValue = null) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error(`Fel vid hämtning från localStorage (${key}):`, error);
    return defaultValue;
  }
};

/**
 * Hanterar uppladdning av CSV-fil
 */
export const handleFileUpload = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      resolve(event.target.result);
    };
    
    reader.onerror = (error) => {
      console.error('Filläsningsfel:', error);
      reject(error);
    };
    
    reader.readAsText(file);
  });
};

/**
 * Hanterar nedladdning av data som fil
 */
export const downloadFile = (data, filename, type = 'text/csv') => {
  // Skapa blob och nedladdningslänk
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  
  // Skapa och klicka på en tillfällig länk
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  // Städa upp
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }, 100);
  
  return { success: true, filePath: filename };
};

/**
 * Hanterar nedladdning av data som Excel-fil
 */
export const downloadExcel = async (data, filename) => {
  try {
    // Importera XLSX dynamiskt när funktionen anropas
    const XLSX = await import('xlsx');
    
    // Skapa arbetsbok
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Facebook Statistik');
    
    // Konvertera till binärdata
    const excelData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    
    // Skapa och ladda ner filen
    const blob = new Blob([excelData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Städa upp
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(link);
    }, 100);
    
    return { success: true, filePath: filename };
  } catch (error) {
    console.error('Excel-nedladdningsfel:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Läser kolumnmappningar från localStorage eller returnerar standard
 */
export const readColumnMappings = async (defaultMappings) => {
  const savedMappings = getFromLocalStorage(STORAGE_KEYS.COLUMN_MAPPINGS);
  return savedMappings || defaultMappings;
};

/**
 * Sparar kolumnmappningar till localStorage
 */
export const saveColumnMappings = async (mappings) => {
  return saveToLocalStorage(STORAGE_KEYS.COLUMN_MAPPINGS, mappings);
};

/**
 * Sparar bearbetad data till localStorage
 * Obs: Vi använder bara localStorage istället för IndexedDB för att undvika problem
 */
export const saveProcessedData = async (accountViewData, postViewData) => {
  try {
    // Försök spara i localStorage
    console.log('Sparar account data, antal rader:', accountViewData.length);
    saveToLocalStorage(STORAGE_KEYS.ACCOUNT_VIEW_DATA, accountViewData);
    
    // För post view data, dela upp i mindre bitar om det behövs
    console.log('Sparar post data, antal rader:', postViewData.length);
    
    // Dela upp data i mindre delar om det är större än 1MB
    const postViewString = JSON.stringify(postViewData);
    
    if (postViewString.length < 1000000) { // 1MB gräns
      saveToLocalStorage(STORAGE_KEYS.POST_VIEW_DATA, postViewData);
      console.log('Sparade all data i localStorage');
    } else {
      // Om för stort, spara bara det senaste
      saveToLocalStorage(STORAGE_KEYS.POST_VIEW_DATA, postViewData.slice(0, 1000));
      console.log('Postdatan var för stor, sparade endast de 1000 senaste inläggen');
    }
    
    return true;
  } catch (error) {
    console.error('Fel vid sparande av bearbetad data:', error);
    // Försök spara med begränsad mängd data vid fel
    try {
      saveToLocalStorage(STORAGE_KEYS.ACCOUNT_VIEW_DATA, accountViewData.slice(0, 100));
      saveToLocalStorage(STORAGE_KEYS.POST_VIEW_DATA, postViewData.slice(0, 100));
      console.log('Nödläge: Sparade begränsad data efter fel');
    } catch (e) {
      console.error('Kunde inte spara ens begränsad data:', e);
    }
    return false;
  }
};

/**
 * Hämtar bearbetad account view data
 */
export const getAccountViewData = () => {
  return getFromLocalStorage(STORAGE_KEYS.ACCOUNT_VIEW_DATA, []);
};

/**
 * Hämtar bearbetad post view data
 */
export const getPostViewData = async () => {
  try {
    // Hämta direkt från localStorage
    return getFromLocalStorage(STORAGE_KEYS.POST_VIEW_DATA, []);
  } catch (error) {
    console.error('Fel vid hämtning av bearbetad data:', error);
    return [];
  }
};

/**
 * Hämtar statistik om lagringsutrymme
 * @returns {Promise<Object>} - Information om lagringsutrymme
 */
export const getStorageStats = async () => {
  try {
    // Förenklade beräkningar för att undvika fel
    let localStorageUsed = 0;
    let fbLocalStorageUsed = 0;
    
    // Lista över alla nycklar som tillhör vår app
    const fbKeyPrefix = 'facebook_stats_';
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue; // Hoppa över null-nycklar
      
      try {
        const value = localStorage.getItem(key) || '';
        
        // Total storlek för alla nycklar
        localStorageUsed += (key.length + value.length) * 2; // Approximation i bytes
        
        // Storlek bara för facebook-relaterade nycklar
        if (key.startsWith(fbKeyPrefix)) {
          fbLocalStorageUsed += (key.length + value.length) * 2;
        }
      } catch (e) {
        console.warn(`Kunde inte beräkna storleken för nyckel ${key}:`, e);
      }
    }
    
    return {
      localStorage: {
        used: localStorageUsed,
        fbUsed: fbLocalStorageUsed,
        limit: STORAGE_LIMITS.LOCAL_STORAGE_MAX,
        percentage: (localStorageUsed / STORAGE_LIMITS.LOCAL_STORAGE_MAX) * 100
      },
      indexedDB: {
        totalItems: 0,
        estimatedSize: 0,
        fbItems: 0,
        fbSize: 0,
        percentage: 0
      },
      total: {
        used: localStorageUsed,
        fbUsed: fbLocalStorageUsed,
        limit: STORAGE_LIMITS.LOCAL_STORAGE_MAX,
        percentage: (localStorageUsed / STORAGE_LIMITS.LOCAL_STORAGE_MAX) * 100
      }
    };
  } catch (error) {
    console.error('Fel vid hämtning av lagringsstatistik:', error);
    return {
      error: error.message,
      localStorage: { used: 0, fbUsed: 0, limit: STORAGE_LIMITS.LOCAL_STORAGE_MAX, percentage: 0 },
      indexedDB: { totalItems: 0, estimatedSize: 0, fbItems: 0, fbSize: 0, percentage: 0 },
      total: { used: 0, fbUsed: 0, percentage: 0 }
    };
  }
};

/**
 * Öppnar extern URL i en ny flik
 */
export const openExternalLink = (url) => {
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
};