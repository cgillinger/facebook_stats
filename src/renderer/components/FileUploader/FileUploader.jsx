import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Upload, FileWarning, Loader2, CheckCircle2, AlertCircle, FileDown } from 'lucide-react';
import { handleFileUpload } from '@/utils/webStorageService';
import { processFacebookData, clearProcessingCache } from '@/utils/webDataProcessor';
import { useColumnMapper } from './useColumnMapper';
import { Progress } from '../ui/progress';

export function FileUploader({ onDataProcessed, onCancel, isAddingFile = false, fileHistory = [] }) {
  const [files, setFiles] = useState([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [duplicateStats, setDuplicateStats] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [csvContent, setCsvContent] = useState(null);
  const [totalRows, setTotalRows] = useState(0);
  const [processedRows, setProcessedRows] = useState(0);
  
  const fileInputRef = useRef(null);
  const processingRef = useRef(false); // Ref för att undvika dubbla processer
  const { columnMappings, validateColumns, missingColumns } = useColumnMapper();

  // Beräkna processeringsförlopp
  const progressPercentage = files.length > 0 
    ? Math.round((currentFileIndex / files.length) * 100)
    : 0;

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length > 0) {
      // Rensa cache när nya filer väljs för att tvinga nybearbetning
      clearProcessingCache();
      
      // Filtrera för att bara behålla CSV-filer
      const csvFiles = selectedFiles.filter(file => 
        file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
      );
      
      if (csvFiles.length === 0) {
        setError('Endast CSV-filer stöds');
        return;
      }
      
      setFiles(csvFiles);
      setError(null);
      setValidationResult(null);
      setCsvContent(null);
      setCurrentFileIndex(0);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(event.dataTransfer.files);
      
      // Filtrera för att bara behålla CSV-filer
      const csvFiles = droppedFiles.filter(file => 
        file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
      );
      
      if (csvFiles.length === 0) {
        setError('Endast CSV-filer stöds');
        return;
      }
      
      // Rensa cache när nya filer väljs för att tvinga nybearbetning
      clearProcessingCache();
      
      setFiles(csvFiles);
      setError(null);
      setValidationResult(null);
      setCsvContent(null);
      setCurrentFileIndex(0);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current.click();
  };

  const processCSV = async (content, file) => {
    // Förhindra dubbelprocesser
    if (processingRef.current) {
      console.log('Bearbetning pågår redan, hoppar över');
      return;
    }
    
    try {
      processingRef.current = true;
      
      // Bearbeta CSV-data
      const processedData = await processFacebookData(content, columnMappings);
      
      // Kontrollera om dubletter hittades
      if (processedData.meta && processedData.meta.stats && processedData.meta.stats.duplicates > 0) {
        setDuplicateStats({
          duplicates: processedData.meta.stats.duplicates,
          totalRows: processedData.meta.stats.totalRows || processedData.rows.length + processedData.meta.stats.duplicates
        });
      }
      
      // Uppdatera processerade rader
      setProcessedRows(prevRows => prevRows + processedData.rows.length);
      
      // Skapa filinfo för historik
      const fileInfo = {
        name: file.name,
        size: file.size,
        rows: processedData.rows.length,
        duplicates: processedData.meta?.stats?.duplicates || 0,
        processedAt: new Date()
      };
      
      // Öka index för nästa fil
      setCurrentFileIndex(prevIndex => prevIndex + 1);
      
      // Skicka den bearbetade datan uppåt
      onDataProcessed(processedData, fileInfo);
      
      return processedData;
    } catch (err) {
      console.error('Fel vid bearbetning:', err);
      setError(`Fel vid bearbetning: ${err.message}`);
      throw err;
    } finally {
      processingRef.current = false;
    }
  };

  const processAllFiles = async () => {
    if (files.length === 0) {
      setError('Inga filer valda');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDuplicateStats(null);
    setTotalRows(0);
    setProcessedRows(0);
    
    // Processa varje fil en i taget
    for (let i = 0; i < files.length; i++) {
      try {
        setCurrentFileIndex(i);
        const file = files[i];
        
        // Läs filinnehållet
        const content = await handleFileUpload(file);
        
        // Validera kolumner först
        const validation = validateColumns(content);
        
        if (!validation.isValid && validation.missing.length > 0) {
          console.log(`Validation failed for file ${file.name}:`, validation);
          setValidationResult(validation);
          setCsvContent(content);
          setIsLoading(false);
          return;
        }
        
        // Om valideringen lyckas, fortsätt med bearbetning
        await processCSV(content, file);
        
      } catch (err) {
        console.error(`Fel vid bearbetning av fil ${files[i].name}:`, err);
        setError(`Fel vid bearbetning av fil ${files[i].name}: ${err.message}`);
        setIsLoading(false);
        return;
      }
    }
    
    // Visa kort framgångsmeddelande om alla filer bearbetats
    setShowSuccessMessage(true);
    setTimeout(() => {
      setShowSuccessMessage(false);
    }, 3000);
    
    setIsLoading(false);
  };

  // Hantera fortsätt ändå-fallet när kolumner saknas
  const handleContinueAnyway = async () => {
    if (!csvContent) {
      console.error('CSV-innehåll saknas för fortsätt ändå');
      return;
    }

    console.log("Continue anyway clicked, processing CSV despite missing columns");
    setIsLoading(true);
    
    try {
      const currentFile = files[currentFileIndex];
      await processCSV(csvContent, currentFile);
      
      // Återuppta bearbetning av resterande filer
      for (let i = currentFileIndex + 1; i < files.length; i++) {
        setCurrentFileIndex(i);
        const file = files[i];
        
        // Läs filinnehållet
        const content = await handleFileUpload(file);
        
        // Bearbeta filen utan validering (eftersom vi fortsätter ändå)
        await processCSV(content, file);
      }
      
      // Visa framgångsmeddelande
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
    } catch (err) {
      console.error('Fel vid bearbetning:', err);
      setError(`Fel vid bearbetning: ${err.message}`);
    } finally {
      setIsLoading(false);
      setValidationResult(null);
      setCsvContent(null);
    }
  };

  return (
    <div className="space-y-4">
      {showSuccessMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Bearbetning slutförd</AlertTitle>
          <AlertDescription className="text-green-700">
            {duplicateStats && duplicateStats.duplicates > 0 ? 
              `${duplicateStats.duplicates} dubletter har filtrerats bort av ${duplicateStats.totalRows} rader.` : 
              "CSV-data har bearbetats framgångsrikt!"}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isAddingFile ? "Lägg till fler filer" : "Läs in Facebook-statistik"}</CardTitle>
          {isAddingFile && (
            <CardDescription>
              Lägg till fler CSV-filer för att kombinera med befintlig data. Dubletter kommer att filtreras bort automatiskt.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div 
            className={`
              border-2 border-dashed rounded-lg p-12 
              ${files.length > 0 ? 'border-primary bg-primary/5' : 'border-border'} 
              text-center cursor-pointer transition-colors
            `}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
          >
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
            />
            
            <div className="flex flex-col items-center justify-center space-y-4">
              <Upload className="w-12 h-12 text-muted-foreground" />
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {files.length > 0 
                    ? `${files.length} fil${files.length > 1 ? 'er' : ''} valda` 
                    : 'Släpp CSV-fil här eller klicka för att bläddra'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Ladda upp en eller flera CSV-filer med Facebook-statistik. Denna data behandlas endast i din webbläsare och skickas inte till någon server.
                </p>
                
                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-medium">Valda filer:</h4>
                    <ul className="text-left text-sm space-y-1 max-h-32 overflow-y-auto p-2 bg-white/50 rounded border border-primary/20">
                      {files.map((file, index) => (
                        <li key={index} className="flex items-center">
                          <FileDown className="h-4 w-4 mr-2 text-primary/70" />
                          <span className={`truncate ${index === currentFileIndex && isLoading ? 'font-medium text-primary' : ''}`}>
                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Visa befintliga filer om det är tillägg */}
          {isAddingFile && fileHistory.length > 0 && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="text-sm font-medium mb-2">Tidigare inlästa filer:</h4>
              <ul className="text-sm space-y-1">
                {fileHistory.map((file, index) => (
                  <li key={index} className="flex items-center text-slate-600">
                    <FileDown className="h-4 w-4 mr-2 text-slate-400" />
                    {file.name} ({file.rows} rader)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Fel vid inläsning</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {validationResult && !validationResult.isValid && validationResult.missing.length > 0 && (
            <Alert variant="destructive" className="mt-4">
              <FileWarning className="h-4 w-4" />
              <AlertTitle>Fel vid validering av CSV</AlertTitle>
              <AlertDescription>
                <p>Filen saknar nödvändiga kolumner:</p>
                <ul className="mt-2 list-disc list-inside">
                  {validationResult.missing.map((col) => (
                    <li key={col.internal}>
                      <span className="font-semibold">{col.displayName || col.original}</span> (förväntat namn: {col.original})
                    </li>
                  ))}
                </ul>
                <p className="mt-2">
                  Uppdatera kolumnmappningarna via "Hantera kolumnmappningar" om Meta har ändrat kolumnnamnen.
                </p>
                <div className="flex space-x-4 mt-4">
                  <Button 
                    variant="default" 
                    onClick={handleContinueAnyway}
                  >
                    Fortsätt ändå
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Bearbetar fil {currentFileIndex + 1} av {files.length}
                </span>
                <span className="text-sm font-medium">{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}

          <div className="mt-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              Avbryt
            </Button>
            <Button 
              onClick={processAllFiles}
              disabled={files.length === 0 || isLoading}
              className="min-w-[100px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bearbetar...
                </>
              ) : "Bearbeta"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}