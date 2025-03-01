import { useState, useEffect, useMemo } from 'react';
import { DEFAULT_MAPPINGS, DISPLAY_NAMES, getCurrentMappings } from '../ColumnMappingEditor/columnMappingService';
import Papa from 'papaparse';  // Direkt import av Papaparse istället för require

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
 * Hook för att hantera kolumnmappningar för CSV-data
 * @returns {Object} Kolumnmappningsverktyg
 */
export function useColumnMapper() {
  const [currentMappings, setCurrentMappings] = useState(DEFAULT_MAPPINGS);
  const [missingColumns, setMissingColumns] = useState([]);

  useEffect(() => {
    const loadMappings = async () => {
      try {
        const mappings = await getCurrentMappings();
        console.log('Laddade aktuella mappningar:', mappings);
        setCurrentMappings(mappings);
      } catch (error) {
        console.error('Fel vid laddning av mappningar:', error);
        setCurrentMappings(DEFAULT_MAPPINGS);
      }
    };
    loadMappings();
  }, []);

  const findMatchingKey = (header) => {
    if (!header) return null;
    
    const normalizedHeader = normalizeText(header);
    
    const entry = Object.entries(currentMappings)
      .find(([originalName]) => normalizeText(originalName) === normalizedHeader);
    
    return entry ? entry[1] : null;
  };

  /**
   * Validerar CSV-innehåll mot konfigurerade mappningar
   */
  const validateColumns = (csvContent) => {
    try {
      // Använd importerad Papaparse istället för require
      const result = Papa.parse(csvContent, { 
        header: true, 
        preview: 1,
        skipEmptyLines: true
      });
      
      if (!result.meta || !result.meta.fields) {
        throw new Error('Kunde inte läsa kolumnnamn från CSV');
      }
      
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
    console.log('Validating headers:', headers);
    
    if (!headers || !Array.isArray(headers)) {
      console.error('Invalid headers input:', headers);
      return {
        isValid: false,
        missing: [],
        found: [],
        unknown: []
      };
    }

    const foundInternalNames = new Set();
    const missing = [];
    const found = [];
    const unknown = [];

    // Kontrollera varje header och hitta matchningar
    headers.forEach(header => {
      const internalName = findMatchingKey(header);
      if (internalName) {
        foundInternalNames.add(internalName);
        found.push({
          header,
          internalName,
          displayName: DISPLAY_NAMES[internalName]
        });
      } else {
        unknown.push(header);
      }
    });

    // Hitta saknade obligatoriska fält genom att jämföra med vad vi hittat
    Object.entries(currentMappings).forEach(([originalName, internalName]) => {
      if (!foundInternalNames.has(internalName)) {
        missing.push({
          original: originalName,
          internal: internalName,
          displayName: DISPLAY_NAMES[internalName]
        });
      }
    });

    // Uppdatera state för att visa varningar i UI
    setMissingColumns(missing);

    // Endast för debug-syfte
    console.log('Validation results:', {
      foundColumns: found.map(f => f.internalName),
      missingColumns: missing.map(m => m.internal),
      isValid: missing.length === 0
    });

    return {
      isValid: missing.length === 0,
      missing,
      found,
      unknown
    };
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
    standardizeRow(row) {
      if (!row || typeof row !== 'object') {
        console.error('Invalid row data:', row);
        return {};
      }

      const standardized = {};
      const rowEntries = Object.entries(row);
      const normalizedRowMap = new Map(
        rowEntries.map(([key, value]) => [normalizeText(key), value])
      );

      // Standardisera varje fält baserat på mappningen
      Object.entries(currentMappings).forEach(([originalName, internalName]) => {
        const normalizedKey = normalizeText(originalName);
        standardized[internalName] = normalizedRowMap.get(normalizedKey) ?? null;
      });

      return standardized;
    },

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