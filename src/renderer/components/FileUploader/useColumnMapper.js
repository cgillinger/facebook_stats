import { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  DEFAULT_MAPPINGS, 
  DISPLAY_NAMES, 
  getCurrentMappings, 
  normalizeText,
  findMatchingColumnKey
} from '../ColumnMappingEditor/columnMappingService';

/**
 * Hook för att hantera kolumnmappningar för CSV-data
 * @returns {Object} Kolumnmappningsverktyg
 */
export function useColumnMapper() {
  const [currentMappings, setCurrentMappings] = useState(DEFAULT_MAPPINGS);
  const [missingColumns, setMissingColumns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Ladda mappningar när komponenten monteras
  useEffect(() => {
    const loadMappings = async () => {
      try {
        setIsLoading(true);
        // Vi kan fortsätta använda async här eftersom detta är i useEffect
        const mappings = await getCurrentMappings();
        console.log('useColumnMapper: Laddade aktuella mappningar:', mappings);
        setCurrentMappings(mappings);
        setMissingColumns([]);
      } catch (error) {
        console.error('useColumnMapper: Fel vid laddning av mappningar:', error);
        setCurrentMappings(DEFAULT_MAPPINGS);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadMappings();
  }, []);

  /**
   * Validerar CSV-innehåll mot konfigurerade mappningar
   * @param {string} csvContent - CSV-filens innehåll
   * @returns {Object} - Resultat av valideringen
   */
  const validateColumns = (csvContent) => {
    try {
      // Använd Papaparse för att hämta kolumnrubriker
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
      return { 
        isValid: false, 
        missing: [], 
        found: [], 
        unknown: [] 
      };
    }
  };

  /**
   * Validerar headers mot konfigurerade mappningar
   * Använder enbart exakta matchningar mot mappningar
   * @param {Array} headers - Lista med kolumnrubriker
   * @returns {Object} - Resultat av valideringen
   */
  const validateHeaders = (headers) => {
    console.log('Validerar headers:', headers);
    
    if (!headers || !Array.isArray(headers)) {
      console.error('Ogiltiga headers:', headers);
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

    // Gå igenom varje header och försök hitta matchning mot konfigurerade mappningar
    headers.forEach(header => {
      const internalName = findMatchingColumnKey(header, currentMappings);
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

    // Hitta saknade obligatoriska fält
    const requiredFields = new Set(Object.values(currentMappings));
    requiredFields.forEach(internalName => {
      if (!foundInternalNames.has(internalName)) {
        // Hitta original kolumnnamn för detta interna namn
        const originalName = Object.entries(currentMappings)
          .find(([_, internal]) => internal === internalName)?.[0];
          
        missing.push({
          original: originalName,
          internal: internalName,
          displayName: DISPLAY_NAMES[internalName]
        });
      }
    });

    // Uppdatera state för att visa varningar i UI
    setMissingColumns(missing);

    console.log('Valideringsresultat:', {
      hittadeKolumner: found.map(f => f.internalName),
      saknadKolumner: missing.map(m => m.internal),
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
    validateHeaders,
    validateColumns,
    columnMappings: currentMappings,
    displayNames: DISPLAY_NAMES,
    missingColumns,
    isLoading
  }), [currentMappings, missingColumns, isLoading]);
}