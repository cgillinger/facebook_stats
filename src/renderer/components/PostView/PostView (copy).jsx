import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import { readColumnMappings } from '../ColumnMappingEditor/columnMappingService';

// Interna konstanter för metadata-fält
const INTERNAL_FIELDS = {
  POST_ID: 'post_id',
  PAGE_NAME: 'page_name',
  TITLE: 'title',
  DESCRIPTION: 'description',
  DATE: 'date',
  PERMALINK: 'permalink'
};

// Svenska visningsnamn för interna fält
const DISPLAY_NAMES = {
  'video_views_3s': 'Visningar',
  'engagement_total': 'Reaktioner, kommentarer och delningar',
  'reactions': 'Reaktioner',
  'comments': 'Kommentarer',
  'shares': 'Delningar',
  'total_clicks': 'Totalt antal klick',
  'other_clicks': 'Övriga klick',
  'link_clicks': 'Länkklick',
  [INTERNAL_FIELDS.TITLE]: 'Titel',
  [INTERNAL_FIELDS.DATE]: 'Datum',
  [INTERNAL_FIELDS.PAGE_NAME]: 'Sidnamn',
  [INTERNAL_FIELDS.PERMALINK]: 'Länk'
};

const PostView = ({ data, selectedFields }) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [columnMappings, setColumnMappings] = useState({});
  const [reverseMappings, setReverseMappings] = useState({});

  // Ladda kolumnmappningar
  useEffect(() => {
    const loadMappings = async () => {
      try {
        const mappings = await readColumnMappings();
        setColumnMappings(mappings);
        
        // Skapa omvänd mappning (internt namn -> CSV-kolumnnamn)
        const reverse = Object.entries(mappings).reduce((acc, [csvName, internalName]) => {
          acc[internalName] = csvName;
          return acc;
        }, {});
        setReverseMappings(reverse);

        console.log('Loaded mappings:', { mappings, reverse });
      } catch (error) {
        console.error('Kunde inte ladda kolumnmappningar:', error);
      }
    };
    loadMappings();
  }, []);

  // Hämta värde från CSV-rad med mappning
  const getValue = (row, internalName) => {
    const csvColumnName = reverseMappings[internalName];
    if (!csvColumnName) {
      console.warn(`No mapping found for internal name: ${internalName}`);
      return '';
    }

    const value = row[csvColumnName];
    
    // Numeriska värden
    if (typeof value === 'number' || !isNaN(value)) {
      return parseFloat(value) || 0;
    }
    
    return value || '';
  };

  // Sorteringsfunktion
  const sortData = (dataToSort, sortKey, direction) => {
    return [...dataToSort].sort((a, b) => {
      const aValue = getValue(a, sortKey);
      const bValue = getValue(b, sortKey);

      // Numerisk sortering
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // String sortering
      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();
      
      if (aString < bString) return direction === 'asc' ? -1 : 1;
      if (aString > bString) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Hantera sortering
  const handleSort = (key) => {
    setSortConfig((currentSort) => ({
      key,
      direction: currentSort.key === key && currentSort.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Hämta sorteringsikon
  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="h-4 w-4 ml-1" /> : 
      <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Hantera externa länkar
  const handleExternalLink = async (url) => {
    try {
      await window.electronAPI.openExternalLink(url);
    } catch (error) {
      console.error('Failed to open external link:', error);
    }
  };

  // Sortera data
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key || !data) return data;
    return sortData(data, sortConfig.key, sortConfig.direction);
  }, [data, sortConfig, reverseMappings]);

  if (selectedFields.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          Välj värden att visa i tabellen ovan
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="w-2/5 cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort(INTERNAL_FIELDS.TITLE)}
              >
                <div className="flex items-center">
                  {DISPLAY_NAMES[INTERNAL_FIELDS.TITLE]} {getSortIcon(INTERNAL_FIELDS.TITLE)}
                </div>
              </TableHead>
              <TableHead 
                className="w-24 whitespace-nowrap cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort(INTERNAL_FIELDS.DATE)}
              >
                <div className="flex items-center">
                  {DISPLAY_NAMES[INTERNAL_FIELDS.DATE]} {getSortIcon(INTERNAL_FIELDS.DATE)}
                </div>
              </TableHead>
              <TableHead 
                className="w-32 cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort(INTERNAL_FIELDS.PAGE_NAME)}
              >
                <div className="flex items-center">
                  {DISPLAY_NAMES[INTERNAL_FIELDS.PAGE_NAME]} {getSortIcon(INTERNAL_FIELDS.PAGE_NAME)}
                </div>
              </TableHead>
              {selectedFields.map(field => (
                <TableHead 
                  key={field}
                  className="w-32 cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort(field)}
                >
                  <div className="flex items-center">
                    {DISPLAY_NAMES[field]} {getSortIcon(field)}
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-16 text-center">
                {DISPLAY_NAMES[INTERNAL_FIELDS.PERMALINK]}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((post) => (
              <TableRow key={getValue(post, INTERNAL_FIELDS.POST_ID)}>
                <TableCell className="max-w-xl">
                  <div className="flex flex-col">
                    <span className="font-medium truncate">
                      {getValue(post, INTERNAL_FIELDS.TITLE) || 'Ingen titel'}
                    </span>
                    {getValue(post, INTERNAL_FIELDS.DESCRIPTION) && (
                      <span className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {getValue(post, INTERNAL_FIELDS.DESCRIPTION)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {getValue(post, INTERNAL_FIELDS.DATE)}
                </TableCell>
                <TableCell>{getValue(post, INTERNAL_FIELDS.PAGE_NAME)}</TableCell>
                {selectedFields.map(field => (
                  <TableCell key={field} className="text-right">
                    {getValue(post, field).toLocaleString()}
                  </TableCell>
                ))}
                <TableCell className="text-center">
                  {getValue(post, INTERNAL_FIELDS.PERMALINK) && (
                    <button
                      onClick={() => handleExternalLink(getValue(post, INTERNAL_FIELDS.PERMALINK))}
                      className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
                      title="Öppna i webbläsare"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span className="sr-only">Öppna inlägg</span>
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default PostView;