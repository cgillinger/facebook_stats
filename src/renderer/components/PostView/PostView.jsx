import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ChevronLeft, 
  ChevronRight, 
  FileDown, 
  FileSpreadsheet, 
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { 
  readColumnMappings, 
  getValue, 
  formatValue,
  formatDate,
  DISPLAY_NAMES 
} from '../ColumnMappingEditor/columnMappingService';

// Konstanter för sidstorlek
const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10 per sida' },
  { value: '20', label: '20 per sida' },
  { value: '50', label: '50 per sida' },
  { value: '100', label: '100 per sida' }
];

// Funktionskomponent för posttyp-badge med färgkodning
const PostTypeBadge = ({ type }) => {
  // Färgkodning baserat på inläggstyp
  const getTypeColor = (postType) => {
    const lowerType = postType?.toLowerCase() || '';
    
    if (lowerType.includes('photo') || lowerType.includes('bild')) {
      return 'bg-blue-100 text-blue-800';
    } else if (lowerType.includes('link') || lowerType.includes('länk')) {
      return 'bg-purple-100 text-purple-800';
    } else if (lowerType.includes('video')) {
      return 'bg-red-100 text-red-800';
    } else if (lowerType.includes('status') || lowerType.includes('text') || lowerType.includes('text')) {
      return 'bg-green-100 text-green-800';
    } else if (lowerType.includes('event') || lowerType.includes('evenemang')) {
      return 'bg-yellow-100 text-yellow-800';
    } else if (lowerType.includes('offer') || lowerType.includes('erbjudande')) {
      return 'bg-orange-100 text-orange-800';
    } else {
      return 'bg-gray-100 text-gray-800';
    }
  };
  
  if (!type) return null;
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(type)}`}>
      {type}
    </span>
  );
};

const PostView = ({ data, selectedFields }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'publish_time', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [uniqueAccounts, setUniqueAccounts] = useState([]);
  const [columnMappings, setColumnMappings] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState({ field: null, rowId: null, copied: false });
  
  // Ladda kolumnmappningar när komponenten monteras
  useEffect(() => {
    const loadMappings = async () => {
      try {
        const mappings = await readColumnMappings();
        setColumnMappings(mappings);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load column mappings:', error);
        setIsLoading(false);
      }
    };
    loadMappings();
  }, []);
  
  // Hämta unika konton från data
  useEffect(() => {
    if (data && Array.isArray(data)) {
      const accountsSet = new Set();
      for (const post of data) {
        const accountName = getValue(post, 'account_name');
        if (accountName) {
          accountsSet.add(accountName);
        }
      }
      setUniqueAccounts(Array.from(accountsSet).sort());
    }
  }, [data]);
  
  // Återställ kopieringsstatus efter 1,5 sekunder
  useEffect(() => {
    if (copyStatus.copied) {
      const timer = setTimeout(() => {
        setCopyStatus({ field: null, rowId: null, copied: false });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [copyStatus]);
  
  // Återställ till första sidan när data, pageSize eller valt konto ändras
  useEffect(() => {
    setCurrentPage(1);
  }, [data, pageSize, selectedAccount]);
  
  // Hantera kopiera till urklipp
  const handleCopyValue = useCallback((value, field, rowId) => {
    if (value === undefined || value === null) return;
    
    // Konvertera till sträng och se till att formatering tas bort för numeriska värden
    let rawValue;
    
    // Kontrollera om värdet är numeriskt och behöver rensas från formatering
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(value.replace(/\s+/g, '')))) {
      rawValue = String(value).replace(/\s+/g, '').replace(/\D/g, '');
    } else {
      // För icke-numeriska värden, behåll texten som den är
      rawValue = String(value);
    }
    
    navigator.clipboard.writeText(rawValue)
      .then(() => {
        setCopyStatus({ field, rowId, copied: true });
        console.log(`Kopierade ${rawValue} till urklipp`);
      })
      .catch(err => {
        console.error('Kunde inte kopiera till urklipp:', err);
      });
  }, []);
  
  // Hantera klick på extern länk
  const handleExternalLink = useCallback((url) => {
    if (!url) return;
    
    try {
      if (window.electronAPI?.openExternalLink) {
        window.electronAPI.openExternalLink(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Failed to open external link:', error);
    }
  }, []);
  
  // Hantera sortering av kolumner
  const handleSort = useCallback((key) => {
    setSortConfig(currentSort => ({
      key,
      direction: currentSort.key === key && currentSort.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);
  
  // Hämta ikon för sortering
  const getSortIcon = useCallback((columnKey) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="h-4 w-4 ml-1" /> : 
      <ArrowDown className="h-4 w-4 ml-1" />;
  }, [sortConfig]);
  
  // Hämta visningsnamn för ett fält
  const getDisplayName = useCallback((field) => {
    return DISPLAY_NAMES[field] || field;
  }, []);
  
  // Filtrera data baserat på valt konto
  const filteredData = React.useMemo(() => {
    if (!Array.isArray(data)) return [];
    
    if (selectedAccount === 'all') {
      return data;
    }
    
    return data.filter(post => {
      const accountName = getValue(post, 'account_name');
      return accountName === selectedAccount;
    });
  }, [data, selectedAccount]);
  
  // Sortera data baserat på aktuell sorteringskonfiguration
  const sortedData = React.useMemo(() => {
    if (!filteredData || !Array.isArray(filteredData) || filteredData.length === 0) return [];
    if (!sortConfig.key) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = getValue(a, sortConfig.key);
      const bValue = getValue(b, sortConfig.key);
      
      // Hantera null/undefined värden
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      
      // Sortera datumfält
      if (sortConfig.key === 'publish_time' || sortConfig.key === 'date') {
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);
        
        if (isNaN(aDate.getTime()) && isNaN(bDate.getTime())) return 0;
        if (isNaN(aDate.getTime())) return 1;
        if (isNaN(bDate.getTime())) return -1;
        
        return sortConfig.direction === 'asc' ? 
          aDate.getTime() - bDate.getTime() : 
          bDate.getTime() - aDate.getTime();
      }
      
      // Sortera numeriska värden
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // Sortera strängar
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return sortConfig.direction === 'asc' ? 
        aStr.localeCompare(bStr) : 
        bStr.localeCompare(aStr);
    });
  }, [filteredData, sortConfig]);
  
  // Paginera data
  const paginatedData = React.useMemo(() => {
    if (!sortedData) return [];
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);
  
  const totalPages = Math.ceil((sortedData?.length || 0) / pageSize);
  
  // Exportera data till Excel
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
  
  // Exportera data till CSV
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
  
  // Formatera data för export
  const formatDataForExport = (data) => {
    if (!data) return [];
    
    return data.map(post => {
      const exportRow = {
        'Sidnamn': getValue(post, 'account_name') || '-',
        'Publiceringstid': formatDate(getValue(post, 'publish_time')),
        'Inläggstyp': getValue(post, 'post_type') || '-'
      };
      
      // Lägg till beskrivning om den finns
      const description = getValue(post, 'description');
      if (description) {
        exportRow['Beskrivning'] = description;
      }
      
      // Lägg till permalänk om den finns
      const permalink = getValue(post, 'permalink');
      if (permalink) {
        exportRow['Permalänk'] = permalink;
      }
      
      // Lägg till valda statistikfält
      for (const field of selectedFields) {
        if (field !== 'description' && field !== 'post_type' && field !== 'publish_time') {
          const displayName = getDisplayName(field);
          const value = getValue(post, field);
          exportRow[displayName] = value !== null ? value : '-';
        }
      }
      
      return exportRow;
    });
  };
  
  // Kopieringsikon-komponent med hover-effekt och tooltip
  const CopyButton = ({ value, field, rowId }) => {
    const isCopied = copyStatus.copied && copyStatus.field === field && copyStatus.rowId === rowId;
    
    // Visa inte kopieringsknapp för tomma värden eller null/undefined
    if (value === undefined || value === null || value === '' || value === '-') {
      return null;
    }
    
    return (
      <button
        onClick={(e) => {
          e.stopPropagation(); // Förhindra att andra event triggas
          handleCopyValue(value, field, rowId);
        }}
        className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:text-primary"
        title="Kopiera till urklipp"
      >
        {isCopied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    );
  };
  
  // Om inga fält är valda, visa meddelande
  if (selectedFields.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          Välj värden att visa i tabellen ovan
        </p>
      </Card>
    );
  }
  
  // Om data laddar, visa laddningsmeddelande
  if (isLoading) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          Laddar data...
        </p>
      </Card>
    );
  }
  
  // Om ingen data finns, visa meddelande
  if (!Array.isArray(filteredData) || filteredData.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          Ingen data tillgänglig för vald period
        </p>
      </Card>
    );
  }
  
  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Visa sida:</span>
            <Select
              value={selectedAccount}
              onValueChange={setSelectedAccount}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Välj sida" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla sidor</SelectItem>
                {uniqueAccounts.map(account => (
                  <SelectItem key={account} value={account}>{account}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Visar {sortedData.length} inlägg {selectedAccount !== 'all' ? `från ${selectedAccount}` : 'från alla sidor'}
          </div>
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
      
      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                onClick={() => handleSort('account_name')}
              >
                <div className="flex items-center">
                  Sidnamn {getSortIcon('account_name')}
                </div>
              </TableHead>
              
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                onClick={() => handleSort('publish_time')}
              >
                <div className="flex items-center">
                  Publiceringsdatum {getSortIcon('publish_time')}
                </div>
              </TableHead>
              
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('post_type')}
              >
                <div className="flex items-center">
                  Typ {getSortIcon('post_type')}
                </div>
              </TableHead>
              
              {selectedFields.includes('description') && (
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 min-w-[200px]"
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center">
                    Beskrivning {getSortIcon('description')}
                  </div>
                </TableHead>
              )}
              
              {selectedFields.filter(field => 
                !['description', 'publish_time', 'post_type'].includes(field)
              ).map(field => (
                <TableHead 
                  key={field}
                  className="cursor-pointer hover:bg-muted/50 text-right whitespace-nowrap"
                  onClick={() => handleSort(field)}
                >
                  <div className="flex items-center justify-end">
                    {getDisplayName(field)} {getSortIcon(field)}
                  </div>
                </TableHead>
              ))}
              
              <TableHead className="w-12 text-center">
                Länk
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((post, index) => {
              const postId = getValue(post, 'post_id');
              const permalink = getValue(post, 'permalink');
              
              return (
                <TableRow key={`${postId || index}`}>
                  <TableCell className="text-center font-medium">
                    {(currentPage - 1) * pageSize + index + 1}
                  </TableCell>
                  
                  <TableCell className="whitespace-nowrap">
                    {getValue(post, 'account_name') || '-'}
                  </TableCell>
                  
                  <TableCell className="whitespace-nowrap">
                    <div className="group flex items-center">
                      <span>{formatDate(getValue(post, 'publish_time')) || '-'}</span>
                      <CopyButton 
                        value={formatDate(getValue(post, 'publish_time'))} 
                        field="publish_time" 
                        rowId={`${postId || index}`} 
                      />
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <PostTypeBadge type={getValue(post, 'post_type')} />
                  </TableCell>
                  
                  {selectedFields.includes('description') && (
                    <TableCell className="max-w-xs">
                      <div className="truncate group flex items-center">
                        <span className="truncate" title={getValue(post, 'description')}>
                          {getValue(post, 'description') || '-'}
                        </span>
                        <CopyButton 
                          value={getValue(post, 'description')} 
                          field="description" 
                          rowId={`${postId || index}`} 
                        />
                      </div>
                    </TableCell>
                  )}
                  
                  {selectedFields.filter(field => 
                    !['description', 'publish_time', 'post_type'].includes(field)
                  ).map(field => (
                    <TableCell key={field} className="text-right">
                      <div className="flex items-center justify-end group">
                        <span>{formatValue(getValue(post, field))}</span>
                        <CopyButton 
                          value={getValue(post, field)} 
                          field={field} 
                          rowId={`${postId || index}`} 
                        />
                      </div>
                    </TableCell>
                  ))}
                  
                  <TableCell className="text-center">
                    {permalink && (
                      <button
                        onClick={() => handleExternalLink(permalink)}
                        className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
                        title="Öppna inlägg i webbläsare"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="sr-only">Öppna inlägg</span>
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        
        <div className="flex items-center justify-between p-4 border-t">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Visa</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(newSize) => {
                setPageSize(Number(newSize));
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