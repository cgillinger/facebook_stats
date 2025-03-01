import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Upload, FileWarning, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { handleFileUpload } from '@/utils/webStorageService';
import { processFacebookData } from '@/utils/webDataProcessor';
import { useColumnMapper } from './useColumnMapper';

export function FileUploader({ onDataProcessed, onCancel }) {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [duplicateStats, setDuplicateStats] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [csvContent, setCsvContent] = useState(null);
  const fileInputRef = useRef(null);
  const { columnMappings, validateColumns, missingColumns } = useColumnMapper();

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setValidationResult(null);
      setCsvContent(null);
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
      const droppedFile = event.dataTransfer.files[0];
      if (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        setError(null);
        setValidationResult(null);
        setCsvContent(null);
      } else {
        setError('Endast CSV-filer stöds');
      }
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current.click();
  };

  const processCSV = async (content) => {
    try {
      setIsLoading(true);
      // Bearbeta CSV-data
      const processedData = await processFacebookData(content, columnMappings);
      
      // Kontrollera om dubletter hittades
      if (processedData.meta && processedData.meta.stats && processedData.meta.stats.duplicates > 0) {
        setDuplicateStats({
          duplicates: processedData.meta.stats.duplicates,
          totalRows: processedData.meta.stats.totalRows || processedData.rows.length + processedData.meta.stats.duplicates
        });
      }
      
      // Visa kort framgångsmeddelande
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
        // Skicka den bearbetade datan uppåt
        onDataProcessed(processedData);
      }, 1500);
    } catch (err) {
      console.error('Fel vid bearbetning:', err);
      setError(`Fel vid bearbetning: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessFile = async () => {
    if (!file) {
      setError('Ingen fil vald');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDuplicateStats(null);
    setValidationResult(null);

    try {
      // Läs filinnehållet med Web File API
      const content = await handleFileUpload(file);
      setCsvContent(content);
      
      // Validera kolumner först
      const validation = validateColumns(content);
      setValidationResult(validation);
      
      if (!validation.isValid && validation.missing.length > 0) {
        console.log("Validation failed:", validation);
        setIsLoading(false);
        return;
      }

      // Om valideringen lyckas, fortsätt med bearbetning
      await processCSV(content);
      
    } catch (err) {
      console.error('Fel vid bearbetning:', err);
      setError(`Fel vid bearbetning: ${err.message}`);
      setIsLoading(false);
    }
  };

  // Hantera fortsätt ändå-fallet när kolumner saknas
  const handleContinueAnyway = async () => {
    if (!csvContent) {
      console.error('CSV-innehåll saknas för fortsätt ändå');
      return;
    }

    console.log("Continue anyway clicked, processing CSV despite missing columns");
    await processCSV(csvContent);
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
          <CardTitle>Läs in Facebook-statistik</CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className={`
              border-2 border-dashed rounded-lg p-12 
              ${file ? 'border-primary bg-primary/5' : 'border-border'} 
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
            />
            
            <div className="flex flex-col items-center justify-center space-y-4">
              <Upload className="w-12 h-12 text-muted-foreground" />
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {file ? file.name : 'Släpp CSV-fil här eller klicka för att bläddra'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Ladda upp en CSV-fil med Facebook-statistik. Denna data behandlas endast i din webbläsare och skickas inte till någon server.
                </p>
              </div>
            </div>
          </div>

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

          <div className="mt-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              Avbryt
            </Button>
            <Button 
              onClick={handleProcessFile}
              disabled={!file || isLoading}
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