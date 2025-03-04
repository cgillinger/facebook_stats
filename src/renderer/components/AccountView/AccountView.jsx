import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { summarizeByAccount, ACCOUNT_VIEW_FIELDS } from '@/utils/dataProcessing';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, FileDown, FileSpreadsheet, Calculator } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { readColumnMappings, formatValue, formatDate } from '../ColumnMappingEditor/columnMappingService';

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10 per sida' },
  { value: '20', label: '20 per sida' },
  { value: '50', label: '50 per sida' }
];

// Lista över fält som ska visa totalsumma
const FIELDS_WITH_TOTALS = [
  'impressions',
  'reactions',
  'total_clicks',
  'post_count',
  'comments',
  'other_clicks',
  'engagement_total',
  'shares',
  'link_clicks'
];

const AccountView = ({ data, selectedFields }) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [columnMappings, setColumnMappings] = useState({});
  const [summaryData, setSummaryData] = useState([]);
  const [totalSummary, setTotalSummary] = useState({});

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
    const loadSummaryData = async () => {
      try {
        const summary = await summarizeByAccount(data, selectedFields);
        setSummaryData(summary);
        
        // Beräkna totalsummor för alla fält
        if (Array.isArray(summary) && summary.length > 0) {
          const totals = {};
          selectedFields.forEach(field => {
            if (FIELDS_WITH_TOTALS.includes(field)) {
              totals[field] = summary.reduce((sum, account) => {
                return sum + (account[field] || 0);
              }, 0);
            }
          });
          setTotalSummary(totals);
        }
        
      } catch (error) {
        console.error('Failed to load summary data:', error);
        setSummaryData([]);
        setTotalSummary({});
      }
    };
    loadSummaryData();
  }, [data, selectedFields, columnMappings]);

  useEffect(() => {
    setCurrentPage(1);
  }, [data, pageSize]);

  const getValue = (obj, columnName) => {
    if (!obj || !columnMappings) return null;
    
    if (columnName === 'page_name') {
      return obj.page_name || 'Unknown';
    }
    if (columnName === 'page_id') {
      return obj.page_id;
    }
    
    return obj[columnName];
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

  const sortedData = React.useMemo(() => {
    if (!sortConfig.key || !Array.isArray(summaryData)) return summaryData;

    return [...summaryData].sort((a, b) => {
      const aValue = getValue(a, sortConfig.key);
      const bValue = getValue(b, sortConfig.key);

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return sortConfig.direction === 'asc' ? 
        aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [summaryData, sortConfig]);

  const paginatedData = React.useMemo(() => {
    if (!sortedData) return [];
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil((sortedData?.length || 0) / pageSize);

  const handleExportToExcel = async () => {
    try {
      const exportData = formatDataForExport(sortedData);
      const result = await window.electronAPI.exportToExcel(
        exportData,
        'facebook-statistik-konton.xlsx'
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
        'facebook-statistik-konton.csv'
      );
      if (result.success) {
        console.log('Export till CSV lyckades:', result.filePath);
      }
    } catch (error) {
      console.error('Export till CSV misslyckades:', error);
    }
  };

  const formatDataForExport = (data) => {
    return data.map(account => {
      const formattedAccount = {
        'Sidnamn': getValue(account, 'page_name') || 'Unknown'
      };
      
      selectedFields.forEach(field => {
        const displayName = ACCOUNT_VIEW_FIELDS[field] || field;
        formattedAccount[displayName] = formatValue(getValue(account, field));
      });
      
      return formattedAccount;
    });
  };

  if (selectedFields.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">
          Välj värden att visa i tabellen ovan
        </p>
      </Card>
    );
  }

  if (!Array.isArray(sortedData) || sortedData.length === 0) {
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
      <div className="flex justify-end space-x-2 mb-4">
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('page_name')}
              >
                <div className="flex items-center">
                  Sidnamn {getSortIcon('page_name')}
                </div>
              </TableHead>
              {selectedFields.map(field => (
                <TableHead 
                  key={field}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort(field)}
                >
                  <div className="flex items-center justify-end">
                    {ACCOUNT_VIEW_FIELDS[field] || field} {getSortIcon(field)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Totalsumma-rad med förbättrad styling */}
            <TableRow className="bg-primary/5 border-b-2 border-primary/20">
              <TableCell className="font-semibold text-primary-foreground flex items-center">
                <Calculator className="w-4 h-4 mr-2 text-primary" />
                <span className="text-primary">Totalt</span>
              </TableCell>
              {selectedFields.map(field => (
                <TableCell 
                  key={field} 
                  className="text-right font-semibold text-primary"
                >
                  {FIELDS_WITH_TOTALS.includes(field) 
                    ? formatValue(totalSummary[field]) 
                    : ''}
                </TableCell>
              ))}
            </TableRow>
            
            {/* Data-rader */}
            {paginatedData.map((account) => (
              <TableRow key={`${getValue(account, 'page_id')}-${getValue(account, 'page_name')}`}>
                <TableCell className="font-medium">
                  {getValue(account, 'page_name') || 'Unknown'}
                </TableCell>
                {selectedFields.map(field => (
                  <TableCell key={field} className="text-right">
                    {formatValue(getValue(account, field))}
                  </TableCell>
                ))}
              </TableRow>
            ))}
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

export default AccountView;