import { useState, useEffect, useMemo } from 'react';
import { EXCLUDED_COLUMN_NAMES, DISPLAY_NAMES, getCurrentMappings } from '../ColumnMappingEditor/columnMappingService';
import Papa from 'papaparse';

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
 * Normalisera text för konsekvent jämförelse
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
 * Hook för att hantera kolumnmappningar för CSV-data
 * @returns {Object} Kolumnmappningsverktyg
 */
export function useColumnMapper() {
  const [currentMappings, setCurrentMappings] = useState({});
  const [missingColumns, setMissingColumns] = useState([]);

  useEffect(() => {
    const loadMappings = async () => {
      try {
        const mappings = await getCurrentMappings();
        console.log('Laddade aktuella mappningar:', mappings);
        setCurrentMappings(mappings);
      } catch (error) {
        console.error('Fel vid laddning av mappningar:', error);
        setCurrentMappings({});
      }
    };
    loadMappings();
  }, []);

  /**
   * Validerar CSV-innehåll mot konfigurerade mappningar
   */
  const validateColumns = (csvContent) => {
    try {
      const result = Papa.parse(csvContent, { 
        header: true, 
        preview: 5,
        skipEmptyLines: true
      });
      
      if (!result.meta || !result.meta.fields) {
        throw new Error('Kunde inte läsa kolumnnamn från CSV');
      }
      
      // Logga alla kolumner för felsökning
      console.log('CSV-kolumner från validering:', result.meta.fields);
      
      const headers = result.meta.fields;
      return validateHeaders(headers);
    } catch (error) {
      console.error('Fel vid validering av CSV:', error);
      return { isValid: false, missing: [], found: [], unknown: [] };
    }
  };

  /**
   * Validerar headers mot konfigurerade mappningar
   */
  const validateHeaders = (headers) => {
    console.log('Validering av headers:', headers);
    
    if (!headers || !Array.isArray(headers)) {
      console.error('Invalid headers input:', headers);
      return {
        isValid: false,
        missing: [],
        found: [],
        unknown: []
      };
    }

    // Kontrollera vilka kolumnnamn som finns i CSV-filen
    const normalizedHeadersMap = new Map();
    headers.forEach(header => {
      // Hoppa över exkluderade kolumner
      if (!isExcludedColumn(header)) {
        normalizedHeadersMap.set(normalizeText(header), header);
      }
    });
    
    console.log('Normaliserade headers:', Array.from(normalizedHeadersMap.keys()));

    // Skapa map av alla interna namn som används i mappningen
    const internalNames = new Set();
    const externalToInternal = new Map();
    
    Object.entries(currentMappings).forEach(([externalName, internalName]) => {
      if (!isExcludedColumn(externalName)) {
        internalNames.add(internalName);
        externalToInternal.set(normalizeText(externalName), internalName);
      }
    });

    // Hitta vilka interna namn som finns i CSV-headern
    const foundInternalNames = new Set();
    const foundExternalNames = new Map(); // internalName -> externalName
    
    for (const [normHeader, originalHeader] of normalizedHeadersMap.entries()) {
      const internalName = externalToInternal.get(normHeader);
      if (internalName) {
        foundInternalNames.add(internalName);
        foundExternalNames.set(internalName, originalHeader);
      }
    }

    // Nödvändiga kolumner för att fungera
    const requiredInternalNames = [
      'impressions',     // Visningar
      'post_reach'       // Räckvidd
    ];
    
    // Hitta saknade nödvändiga kolumner
    const missingRequired = requiredInternalNames.filter(name => !foundInternalNames.has(name));
    
    console.log('Hittade interna namn:', Array.from(foundInternalNames));
    console.log('Saknade nödvändiga kolumner:', missingRequired);

    // Skapa en lista över saknade kolumner för UI
    const missing = [];
    
    // Lägg till saknade kolumner i listan
    Array.from(internalNames)
      .filter(internalName => !foundInternalNames.has(internalName))
      .forEach(internalName => {
        // Hitta externalName för detta interna namn
        const externalName = Object.entries(currentMappings).find(
          ([_, internal]) => internal === internalName
        )?.[0];
        
        if (externalName) {
          missing.push({
            original: externalName,
            internal: internalName,
            displayName: DISPLAY_NAMES[internalName]
          });
        }
      });

    // Uppdatera state för saknade kolumner (används för UI-meddelanden)
    setMissingColumns(missing);

    const isValid = missingRequired.length === 0;
    
    console.log('Validering slutförd:', {
      isValid,
      saknade: missing.length,
      nödvändigaSaknade: missingRequired.length
    });

    // Skapa resultatet
    return {
      isValid: isValid,
      missing: missing,
      found: Array.from(foundInternalNames).map(internalName => ({
        header: foundExternalNames.get(internalName),
        internalName: internalName,
        displayName: DISPLAY_NAMES[internalName]
      })),
      unknown: headers.filter(header => 
        !Array.from(foundExternalNames.values()).includes(header) && !isExcludedColumn(header)
      )
    };
  };

  /**
   * Konverterar en rad från CSV till standardiserat format 
   * genom exakt matchning mot kolumnmappningar
   */
  const standardizeRow = (row) => {
    if (!row || typeof row !== 'object') {
      console.error('Invalid row data:', row);
      return {};
    }

    const standardized = {};
    
    // Skapa Map för snabb uppslag
    const normalizedMappings = new Map();
    Object.entries(currentMappings).forEach(([externalName, internalName]) => {
      if (!isExcludedColumn(externalName)) {
        normalizedMappings.set(normalizeText(externalName), internalName);
      }
    });
    
    // För varje kolumn i raden, hitta motsvarande internt namn
    Object.entries(row).forEach(([colName, value]) => {
      const normalizedColName = normalizeText(colName);
      const internalName = normalizedMappings.get(normalizedColName);
      
      if (internalName) {
        standardized[internalName] = value;
      }
    });

    return standardized;
  };

  return useMemo(() => ({
    /**
     * Validerar headers mot konfigurerade mappningar
     */
    validateHeaders,
    
    /**
     * Validerar CSV-innehåll mot konfigurerade mappningar
     */
    validateColumns,

    /**
     * Konverterar en rad från CSV till standardiserat format
     */
    standardizeRow,

    /**
     * Returnerar mappning mellan original och interna namn
     */
    columnMappings: currentMappings,

    /**
     * Returnerar användarvänliga visningsnamn
     */
    displayNames: DISPLAY_NAMES,

    /**
     * Returnerar lista över saknade kolumner
     */
    missingColumns
  }), [currentMappings, missingColumns]);
}