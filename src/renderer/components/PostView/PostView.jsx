import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, ChevronLeft, ChevronRight, FileDown, FileSpreadsheet } from 'lucide-react';
import { POST_VIEW_FIELDS, METADATA_FIELDS, getUniquePageNames } from '../../../utils/dataProcessing';
import { readColumnMappings, DISPLAY_NAMES, formatDate, formatValue } from '../ColumnMappingEditor/columnMappingService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';

const ALL_ACCOUNTS = 'all_accounts';

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10 per sida' },
  { value: '20', label: '20 per sida' },
  { value: '50', label: '50 per sida' }
];

const PostView = ({ data, selectedFields }) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [columnMappings, setColumnMappings] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedAccount, setSelectedAccount] = useState(ALL_ACCOUNTS);
  const [uniqueAccounts, setUniqueAccounts] = useState([]);

  useEffect(() => {
    const loadMappings = async () => {
      try {
        const mappings = await readColumnMappings();
        setColumnMappings(mappings);
      } catch (error) {
        console.error('Failed to load column mappings:', error);
      }
    };
    loadMappings();
  }, []);

  useEffect(() => {
    if (data) {
      const accounts = getUniquePageNames(data);
      setUniqueAccounts(accounts);
      setSelectedAccount(ALL_ACCOUNTS);
    }
  }, [data]);

  useEffect(() => {
    setCurrentPage(1);
  }, [data, pageSize, selectedAccount]);

  const getOriginalColumnName = (internalName) => {
    const foundEntry = Object.entries(columnMappings)
      .find(([_, mapped]) => mapped === internalName);
    
    return foundEntry ? foundEntry[0] : null;
  };

  const getValue = (obj, columnName) => {
    if (!obj) return null;
    
    // Direkt åtkomst om attributet redan finns i objektet
    if (columnName in obj) {
      return safeParseValue(obj[columnName]);
    }
    
    // Specialfall för post_reach och impressions som kan finnas under andra namn
    if (columnName === 'post_reach') {
      if ('post_reach' in obj) return safeParseValue(obj['post_reach']);
      if ('Reach' in obj) return safeParseValue(obj['Reach']);
      if ('reach' in obj) return safeParseValue(obj['reach']);
    }
    
    if (columnName === 'impressions') {
      if ('impressions' in obj) return safeParseValue(obj['impressions']);
      if ('Impressions' in obj) return safeParseValue(obj['Impressions']);
      if ('Views' in obj) return safeParseValue(obj['Views']);
      if ('views' in obj) return safeParseValue(obj['views']);
    }
    
    // Specialfall för page_name
    if (columnName === 'page_name') {
      if ('page_name' in obj) return safeParseValue(obj['page_name']);
      if ('Page name' in obj) return safeParseValue(obj['Page name']);
    }
    
    // Specialfall för title
    if (columnName === 'title') {
      if ('title' in obj) return safeParseValue(obj['title']);
      if ('Title' in obj) return safeParseValue(obj['Title']);
    }
    
    // Beräkna total engagement (reactions + comments + shares)
    if (columnName === 'engagement_total') {
      let reactions = 0, comments = 0, shares = 0;
      
      // Försök hämta värden på olika sätt
      if ('reactions' in obj) reactions = safeParseValue(obj['reactions']) || 0;
      else if ('Reactions' in obj) reactions = safeParseValue(obj['Reactions']) || 0;
      else {
        const reactionsColumn = getOriginalColumnName('reactions');
        if (reactionsColumn && reactionsColumn in obj) {
          reactions = safeParseValue(obj[reactionsColumn]) || 0;
        }
      }
      
      if ('comments' in obj) comments = safeParseValue(obj['comments']) || 0;
      else if ('Comments' in obj) comments = safeParseValue(obj['Comments']) || 0;
      else {
        const commentsColumn = getOriginalColumnName('comments');
        if (commentsColumn && commentsColumn in obj) {
          comments = safeParseValue(obj[commentsColumn]) || 0;
        }
      }
      
      if ('shares' in obj) shares = safeParseValue(obj['shares']) || 0;
      else if ('Shares' in obj) shares = safeParseValue(obj['Shares']) || 0;
      else {
        const sharesColumn = getOriginalColumnName('shares');
        if (sharesColumn && sharesColumn in obj) {
          shares = safeParseValue(obj[sharesColumn]) || 0;
        }
      }
      
      return reactions + comments + shares;
    }

    // Försök hitta värdet genom att använda kolumnmappningen
    if (columnMappings) {
      const originalColumn = getOriginalColumnName(columnName);
      if (originalColumn && originalColumn in obj) {
        const value = obj[originalColumn];
        if (value !== undefined) {
          if (columnName === 'publish_time') return formatDate(value);
          return safeParseValue(value);
        }
      }
      
      // Prova alternativa varianter (camelCase, snake_case, etc)
      const possibleKeys = [
        columnName,                              // Exakt match
        columnName.toLowerCase(),                // lowercase
        columnName.toUpperCase(),                // UPPERCASE
        columnName.charAt(0).toUpperCase() + columnName.slice(1), // Capitalized
        columnName.replace(/_/g, ' '),          // snake_case -> "space case"
        columnName.replace(/ /g, '_'),          // "space case" -> snake_case
      ];
      
      for (const key of possibleKeys) {
        if (key in obj) {
          const value = obj[key];
          if (value !== undefined) {
            if (columnName === 'publish_time') return formatDate(value);
            return safeParseValue(value);
          }
        }
      }
    }
    
    return null;
  };

  const safeParseValue = (value) => {
    if (value === null || value === undefined) return null;
    
    // Om det är ett nummer eller kan tolkas som ett
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && !isNaN(value) && value.trim() !== '') {
      const numValue = parseFloat(value);
      return isNaN(numValue) ? value : numValue;
    }
    
    return value;
  };

  const handleExportToExcel = async () => {
    try {
      const exportData = formatDataForExport(sortedData);
      const result = await window.electronAPI.exportToExcel(
        exportData,
        'facebook-statistik-inlagg.xlsx'
      );
      if (result.success) {
        console.log('Export till Excel lyckades:', result.filePath);
      }
    } catch (error) {
      console.error('Export till Excel misslyckades:', error);
    }
  };

  const handleExportToCSV = async () => {
    try {
      const exportData = formatDataForExport(sortedData);
      const result = await window.electronAPI.exportToCSV(
        exportData,
        'facebook-statistik-inlagg.csv'
      );
      if (result.success) {
        console.log('Export till CSV lyckades:', result.filePath);
      }
    } catch (error) {
      console.error('Export till CSV misslyckades:', error);
    }
  };

  const formatDataForExport = (data) => {
    return data.map(post => {
      const formattedPost = {
        'Titel': getValue(post, 'title') || 'Ingen titel',
        'Beskrivning': getValue(post, 'description') || 'Ingen beskrivning',
        'Datum': formatDate(getValue(post, 'publish_time')),
        'Sidnamn': getValue(post, 'page_name')
      };

      selectedFields.forEach(field => {
        const displayName = getDisplayName(field);
        formattedPost[displayName] = getValue(post, field);
      });

      return formattedPost;
    });
  };

  const sortData = (dataToSort, sortKey, direction) => {
    return [...dataToSort].sort((a, b) => {
      const aValue = getValue(a, sortKey);
      const bValue = getValue(b, sortKey);

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  };

  const handleSort = (key) => {
    setSortConfig((currentSort) => ({
      key,
      direction: currentSort.key === key && currentSort.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="h-4 w-4 ml-1" /> : 
      <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const handleExternalLink = async (url) => {
    try {
      if (window.electronAPI?.openExternalLink) {
        await window.electronAPI.openExternalLink(url);
      } else {
        // För webversionen, öppna i ny flik
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Failed to open external link:', error);
    }
  };

  const getDisplayName = (field) => {
    return POST_VIEW_FIELDS[field] || METADATA_FIELDS[field] || DISPLAY_NAMES[field] || field;
  };

  const filteredData = React.useMemo(() => {
    if (!data) return [];
    if (selectedAccount === ALL_ACCOUNTS) return data;
    return data.filter(post => {
      const pageName = getValue(post, 'page_name');
      return pageName === selectedAccount;
    });
  }, [data, selectedAccount]);

  const sortedData = React.useMemo(() => {
    if (!sortConfig.key || !filteredData) return filteredData;
    return sortData(filteredData, sortConfig.key, sortConfig.direction);
  }, [filteredData, sortConfig, columnMappings]);

  const paginatedData = React.useMemo(() => {
    if (!sortedData) return [];
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil((sortedData?.length || 0) / pageSize);

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
      <div className="flex justify-between items-center p-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground">Visa konto:</span>
          <Select
            value={selectedAccount}
            onValueChange={setSelectedAccount}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Välj konto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ACCOUNTS}>Alla konton</SelectItem>
              {uniqueAccounts.map(account => (
                <SelectItem key={account} value={account}>
                  {account}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleExportToCSV}
            aria-label="Exportera till CSV"
          >
            <FileDown className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleExportToExcel}
            aria-label="Exportera till Excel"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      <div className="rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="w-1/4 cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('title')}
              >
                <div className="flex items-center">
                  {getDisplayName('title')} {getSortIcon('title')}
                </div>
              </TableHead>
              <TableHead 
                className="w-24 whitespace-nowrap cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('publish_time')}
              >
                <div className="flex items-center">
                  {getDisplayName('publish_time')} {getSortIcon('publish_time')}
                </div>
              </TableHead>
              <TableHead 
                className="w-28 cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('page_name')}
              >
                <div className="flex items-center">
                  {getDisplayName('page_name')} {getSortIcon('page_name')}
                </div>
              </TableHead>
              {selectedFields.map(field => (
                <TableHead 
                  key={field}
                  className="w-28 cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort(field)}
                >
                  <div className="flex items-center">
                    {getDisplayName(field)} {getSortIcon(field)}
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-12 text-center">
                {getDisplayName('permalink')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((post, index) => (
              <TableRow key={`post-${index}`}>
                <TableCell className="max-w-md">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground line-clamp-2">
                      {getValue(post, 'title') || 'Ingen titel'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDate(getValue(post, 'publish_time'))}
                </TableCell>
                <TableCell>{formatValue(getValue(post, 'page_name'))}</TableCell>
                {selectedFields.map(field => (
                  <TableCell key={field} className="text-right">
                    {formatValue(getValue(post, field))}
                  </TableCell>
                ))}
                <TableCell className="text-center">
                  {getValue(post, 'permalink') && (
                    <button
                      onClick={() => handleExternalLink(getValue(post, 'permalink'))}
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

        <div className="flex items-center justify-between p-4 border-t">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Visa</span>
            <Select
              value={pageSize.toString()}
              onValueChange={size => {
                setPageSize(Number(size));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-6">
            <span className="text-sm text-muted-foreground">
              Visar {((currentPage - 1) * pageSize) + 1} till {Math.min(currentPage * pageSize, sortedData?.length || 0)} av {sortedData?.length || 0}
            </span>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Föregående sida</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Nästa sida</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PostView;