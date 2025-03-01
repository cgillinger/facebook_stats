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
};

// IndexedDB konfiguration
const DB_CONFIG = {
  name: 'FacebookStatisticsDB',
  version: 1,
  stores: {
    csvData: { keyPath: 'id', autoIncrement: true }
  }
};

/**
 * Initierar och öppnar IndexedDB
 */
const openDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);
    
    request.onerror = (event) => {
      console.error('IndexedDB-fel:', event.target.error);
      reject(event.target.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Skapa object stores om de inte existerar
      if (!db.objectStoreNames.contains('csvData')) {
        db.createObjectStore('csvData', { keyPath: 'id', autoIncrement: true });
      }
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
  });
};

/**
 * Sparar data i IndexedDB
 */
const saveToIndexedDB = async (storeName, data) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Hämtar data från IndexedDB
 */
const getFromIndexedDB = async (storeName, key) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = key ? store.get(key) : store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Sparar konfigurationsdata i localStorage
 */
const saveConfig = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Fel vid sparande av ${key}:`, error);
    return false;
  }
};

/**
 * Hämtar konfigurationsdata från localStorage
 */
const getConfig = (key, defaultValue = null) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error(`Fel vid hämtning av ${key}:`, error);
    return defaultValue;
  }
};

/**
 * Hanterar uppladdning av CSV-fil
 */
const handleFileUpload = (file) => {
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
const downloadFile = (data, filename, type = 'text/csv') => {
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
const downloadExcel = async (data, filename) => {
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
const readColumnMappings = async (defaultMappings) => {
  const savedMappings = getConfig(STORAGE_KEYS.COLUMN_MAPPINGS);
  return savedMappings || defaultMappings;
};

/**
 * Sparar kolumnmappningar till localStorage
 */
const saveColumnMappings = async (mappings) => {
  return saveConfig(STORAGE_KEYS.COLUMN_MAPPINGS, mappings);
};

/**
 * Sparar bearbetad data till localStorage eller IndexedDB beroende på storlek
 */
const saveProcessedData = async (accountViewData, postViewData) => {
  try {
    // Spara account view data
    saveConfig(STORAGE_KEYS.ACCOUNT_VIEW_DATA, accountViewData);
    
    // Spara post view data
    const postViewString = JSON.stringify(postViewData);
    if (postViewString.length < 5000000) { // ~5MB gräns
      saveConfig(STORAGE_KEYS.POST_VIEW_DATA, postViewData);
    } else {
      // För större datamängder, använd IndexedDB
      await saveToIndexedDB('csvData', { 
        timestamp: Date.now(), 
        postViewData: postViewData 
      });
    }
    
    return true;
  } catch (error) {
    console.error('Fel vid sparande av bearbetad data:', error);
    return false;
  }
};

/**
 * Hämtar bearbetad account view data
 */
const getAccountViewData = () => {
  return getConfig(STORAGE_KEYS.ACCOUNT_VIEW_DATA, []);
};

/**
 * Hämtar bearbetad post view data
 */
const getPostViewData = async () => {
  try {
    // Försök hämta från localStorage först
    const localData = getConfig(STORAGE_KEYS.POST_VIEW_DATA);
    if (localData) return localData;
    
    // Annars hämta från IndexedDB
    const dbData = await getFromIndexedDB('csvData');
    if (dbData && dbData.length > 0) {
      // Returnera den senaste (sortera efter timestamp)
      const sortedData = dbData.sort((a, b) => b.timestamp - a.timestamp);
      return sortedData[0].postViewData;
    }
    
    return [];
  } catch (error) {
    console.error('Fel vid hämtning av bearbetad data:', error);
    return [];
  }
};

/**
 * Öppnar extern URL i en ny flik
 */
const openExternalLink = (url) => {
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
};

export {
  STORAGE_KEYS,
  readColumnMappings,
  saveColumnMappings,
  handleFileUpload,
  downloadFile,
  downloadExcel,
  saveProcessedData,
  getAccountViewData,
  getPostViewData,
  openExternalLink
};