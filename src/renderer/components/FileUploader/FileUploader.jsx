import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { 
  UploadCloud, 
  FileWarning, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  PlusCircle,
  HardDrive,
  Info
} from 'lucide-react';
import { handleFileUpload, getMemoryUsageStats, clearAllData, getUploadedFilesMetadata } from '@/utils/webStorageService';
import { processPostData, analyzeCSVFile } from '@/utils/webDataProcessor';
import { useColumnMapper } from './useColumnMapper';
import { MemoryIndicator } from '../MemoryIndicator/MemoryIndicator';
import { calculateMemoryWithNewFile } from '@/utils/memoryUtils';

export function FileUploader({ onDataProcessed, onCancel, existingData = null, isNewAnalysis = false }) {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [duplicateStats, setDuplicateStats] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [csvContent, setCsvContent] = useState(null);
  const [fileAnalysis, setFileAnalysis] = useState(null);
  const [memoryUsage, setMemoryUsage] = useState(null);
  const [memoryCheck, setMemoryCheck] = useState({ canAddFile: true, status: 'safe' });
  const [existingFiles, setExistingFiles] = useState([]);
  const [possibleDuplicate, setPossibleDuplicate] = useState(null);
  const fileInputRef = useRef(null);
  const { columnMappings, validateColumns, missingColumns } = useColumnMapper();

  // Kontrollera minnesanvändning och hämta existerande filer vid montering
  useEffect(() => {
    const checkMemoryAndFiles = async () => {
      try {
        const stats = await getMemoryUsageStats();
        setMemoryUsage(stats);
        
        // Hämta befintliga filer för att kontrollera dubletter
        const files = await getUploadedFilesMetadata();
        setExistingFiles(files);
      } catch (error) {
        console.error('Fel vid kontroll av minnesanvändning eller filmetadata:', error);
      }
    };
    
    checkMemoryAndFiles();
  }, []);

  // Kontrollera om filen redan finns
  const checkIfDuplicate = (selectedFile) => {
    if (!selectedFile || !existingFiles || existingFiles.length === 0) return false;
    
    const fileName = selectedFile.name;
    const duplicate = existingFiles.find(f => f.originalFileName === fileName);
    
    return duplicate;
  };

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      // Kontrollera om filen redan finns uppladdad
      const duplicate = checkIfDuplicate(selectedFile);
      if (duplicate && !isNewAnalysis) {
        setPossibleDuplicate({
          file: selectedFile,
          existingFile: duplicate
        });
        return;
      }
      
      setFile(selectedFile);
      setError(null);
      setValidationResult(null);
      setCsvContent(null);
      setPossibleDuplicate(null);
      
      // Analysera filen för minneshantering
      try {
        setIsLoading(true);
        
        // Läs filinnehållet
        const content = await handleFileUpload(selectedFile);
        
        // Analysera CSV-innehållet
        const analysis = await analyzeCSVFile(content);
        setFileAnalysis(analysis);
        
        // Kontrollera om det finns tillräckligt med minne
        if (memoryUsage) {
          const projection = calculateMemoryWithNewFile(analysis, memoryUsage);
          setMemoryCheck(projection);
          
          if (projection.status === 'critical') {
            setError('Varning: Minnesanvändningen kommer vara kritisk om denna fil läses in. Rensa data först.');
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Fel vid filanalys:', error);
        setIsLoading(false);
      }
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
        // Simulera filvalshändelse genom att anropa handleFileChange med ett objekt
        handleFileChange({ target: { files: [droppedFile] } });
      } else {
        setError('Endast CSV-filer stöds');
      }
    }
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const processData = async (content) => {
    try {
      setIsLoading(true);

      // Om det är en ny analys, rensa först befintlig data
      if (isNewAnalysis) {
        try {
          await clearAllData();
          console.log('Tidigare data rensad för ny analys');
        } catch (clearError) {
          console.error('Fel vid rensning av data för ny analys:', clearError);
          // Fortsätt ändå
        }
      }

      // Använd befintlig data-parameter för att bestämma om vi ska slå samman med befintlig data
      // Vi gör sammanslagning om:
      // 1. existingData är inte null OCH
      // 2. det inte är en ny analys
      const shouldMergeWithExisting = existingData && !isNewAnalysis;
      
      // Bearbeta data med rätt flagga för sammanslagning
      const processedData = await processPostData(
        content, 
        columnMappings, 
        shouldMergeWithExisting,
        file ? file.name : 'Facebook CSV' // Skicka filnamnet för att spara i metadata
      );
      
      if (processedData.meta?.stats?.duplicates > 0) {
        setDuplicateStats({
          duplicates: processedData.meta.stats.duplicates,
          totalRows: processedData.meta.stats.totalRows || processedData.rows.length + processedData.meta.stats.duplicates
        });
      }
      
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
        
        // Inkludera filnamnet i metadata
        if (file && processedData.meta) {
          processedData.meta.filename = file.name;
        }
        
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

    // Kontrollera om minnesanvändningen är kritisk
    if (!isNewAnalysis && memoryCheck && memoryCheck.status === 'critical' && !memoryCheck.canAddFile) {
      setError('Kan inte lägga till mer data: Minnesanvändningen skulle bli för hög. Rensa befintlig data först.');
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
      let validation;
      try {
        validation = validateColumns(content);
        setValidationResult(validation || { isValid: false, missing: [] });
      } catch (validationError) {
        console.error("Validation error:", validationError);
        setValidationResult({ isValid: false, missing: [] });
        setError(`Validering misslyckades: ${validationError.message}`);
        setIsLoading(false);
        return;
      }
      
      // Säkerställ att validation finns och att missing-egenskapen är en array
      if (!validation || !validation.missing || !Array.isArray(validation.missing)) {
        console.warn("Ogiltig validation-struktur:", validation);
        validation = { isValid: false, missing: [] };
        setValidationResult(validation);
      }
      
      if (!validation.isValid && validation.missing && validation.missing.length > 0) {
        console.log("Validation failed:", validation);
        setIsLoading(false);
        return;
      }

      // Om valideringen lyckas, fortsätt med bearbetning
      await processData(content);
      
    } catch (err) {
      console.error('Fel vid bearbetning:', err);
      setError(`Fel vid bearbetning: ${err.message}`);
      setIsLoading(false);
    }
  };

  const handleContinueAnyway = async () => {
    if (!csvContent) {
      console.error('CSV-innehåll saknas för fortsätt ändå');
      setError('CSV-innehåll saknas. Vänligen försök ladda upp filen igen.');
      return;
    }

    console.log("Continue anyway clicked, processing CSV despite missing columns");
    await processData(csvContent);
  };
  
  const handleContinueDespiteWarning = () => {
    if (possibleDuplicate) {
      setFile(possibleDuplicate.file);
      setPossibleDuplicate(null);
      
      // Utför filanalys direkt
      const analyzeUploadedFile = async () => {
        try {
          setIsLoading(true);
          const content = await handleFileUpload(possibleDuplicate.file);
          const analysis = await analyzeCSVFile(content);
          setFileAnalysis(analysis);
          
          if (memoryUsage) {
            const projection = calculateMemoryWithNewFile(analysis, memoryUsage);
            setMemoryCheck(projection);
          }
          
          setIsLoading(false);
        } catch (error) {
          console.error('Fel vid filanalys:', error);
          setIsLoading(false);
        }
      };
      
      analyzeUploadedFile();
    }
  };
  
  const handleCancelDuplicateUpload = () => {
    setPossibleDuplicate(null);
    setFile(null);
    
    // Säkerställ att fileInputRef.current finns innan vi sätter value
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMemoryUpdate = (stats) => {
    setMemoryUsage(stats);
    
    // Uppdatera minnesprojektion om det finns en fil
    if (fileAnalysis) {
      const projection = calculateMemoryWithNewFile(fileAnalysis, stats);
      setMemoryCheck(projection);
    }
  };
  
  // Visa varning om möjlig dublett
  if (possibleDuplicate) {
    return (
      <div className="space-y-4">
        <Alert className="bg-yellow-50 border-yellow-200">
          <Info className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Möjlig dubblettfil</AlertTitle>
          <AlertDescription className="text-yellow-700">
            <p className="mb-2">
              Det verkar som att du redan har lagt till en fil med samma namn. Är du säker på att du vill fortsätta?
            </p>
            <div className="bg-white p-3 rounded-md border border-yellow-300 mb-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="font-semibold">Ny fil:</span>
                <span>{possibleDuplicate.file.name}</span>
                
                <span className="font-semibold">Befintlig fil:</span>
                <span>{possibleDuplicate.existingFile.originalFileName}</span>
                
                <span className="font-semibold">Uppladdad:</span>
                <span>{new Date(possibleDuplicate.existingFile.uploadedAt).toLocaleString('sv-SE')}</span>
              </div>
            </div>
            <div className="flex space-x-4">
              <Button 
                variant="outline" 
                onClick={handleCancelDuplicateUpload}
              >
                Avbryt
              </Button>
              <Button 
                onClick={handleContinueDespiteWarning}
              >
                Fortsätt ändå
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Minnesindikator som visas om vi lägger till ny data (men inte för ny analys) */}
      {existingData && !isNewAnalysis && (
        <MemoryIndicator onUpdate={handleMemoryUpdate} />
      )}
      
      {validationResult && !validationResult.isValid && validationResult.missing && validationResult.missing.length > 0 && (
        <Alert variant="destructive">
          <FileWarning className="h-4 w-4" />
          <AlertTitle>Fel vid validering av CSV</AlertTitle>
          <AlertDescription>
            <p>Filen saknar nödvändiga kolumner:</p>
            <ul className="mt-2 list-disc list-inside">
              {validationResult.missing.map((col) => (
                <li key={col.internal || Math.random().toString()}>
                  <span className="font-semibold">{col.displayName || col.original || 'Okänd kolumn'}</span> (förväntat namn: {col.original || 'N/A'})
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
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl">
            {isNewAnalysis 
              ? 'Återställ data - Ladda CSV'
              : existingData 
                ? 'Lägg till mer Facebook-statistik'
                : 'Läs in Facebook-statistik'}
          </CardTitle>
          
          {existingData && !isNewAnalysis && (
            <div className="text-sm text-muted-foreground flex items-center">
              <HardDrive className="w-4 h-4 mr-1" />
              <span>Nuvarande: {existingData.length} inlägg</span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {existingData && !isNewAnalysis && memoryCheck.status === 'critical' && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Minnesbegränsning</AlertTitle>
              <AlertDescription>
                Systemet har inte tillräckligt med minne för att lägga till mer data. 
                Rensa befintlig data innan du fortsätter.
              </AlertDescription>
            </Alert>
          )}
          
          {existingData && !isNewAnalysis && memoryCheck.status === 'warning' && (
            <Alert className="mb-4 bg-yellow-50 border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">Minnesvarning</AlertTitle>
              <AlertDescription className="text-yellow-700">
                Att lägga till denna fil kommer använda {memoryCheck.projectedPercent}% av tillgängligt minne.
                Det kan påverka prestandan negativt.
              </AlertDescription>
            </Alert>
          )}
          
          {isNewAnalysis && (
            <Alert className="mb-4 bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Återställ data</AlertTitle>
              <AlertDescription className="text-blue-700">
                Om du fortsätter kommer all befintlig data att ersättas med denna nya analys.
              </AlertDescription>
            </Alert>
          )}
          
          <div 
            className={`
              border-2 border-dashed rounded-lg p-12 
              ${file ? 'border-primary bg-primary/5' : 'border-border'} 
              text-center cursor-pointer transition-colors
              ${!isNewAnalysis && memoryCheck.status === 'critical' && !memoryCheck.canAddFile ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={isNewAnalysis || memoryCheck.canAddFile ? handleBrowseClick : undefined}
          >
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={!isNewAnalysis && memoryCheck.status === 'critical' && !memoryCheck.canAddFile}
            />
            
            <div className="flex flex-col items-center justify-center space-y-4">
              {!isNewAnalysis && memoryCheck.status === 'critical' && !memoryCheck.canAddFile ? (
                <AlertCircle className="w-12 h-12 text-red-500" />
              ) : file ? (
                <FileWarning className="w-12 h-12 text-primary" />
              ) : existingData && !isNewAnalysis ? (
                <PlusCircle className="w-12 h-12 text-muted-foreground" />
              ) : (
                <UploadCloud className="w-12 h-12 text-muted-foreground" />
              )}
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {!isNewAnalysis && memoryCheck.status === 'critical' && !memoryCheck.canAddFile 
                    ? 'Kan inte lägga till mer data - Minnet är fullt' 
                    : file 
                      ? file.name
                      : existingData && !isNewAnalysis
                        ? 'Släpp CSV-fil här eller klicka för att lägga till mer data' 
                        : isNewAnalysis
                          ? 'Släpp CSV-fil här eller klicka för att återställa data'
                          : 'Släpp CSV-fil här eller klicka för att bläddra'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  {!isNewAnalysis && memoryCheck.status === 'critical' && !memoryCheck.canAddFile 
                    ? 'Du behöver rensa befintlig data innan du kan lägga till mer' 
                    : isNewAnalysis
                      ? 'Ladda upp en CSV-fil med Facebook-statistik för att återställa data. Befintlig data kommer tas bort.'
                      : 'Ladda upp en CSV-fil med Facebook-statistik. Denna data behandlas endast i din webbläsare och skickas inte till någon server.'}
                </p>
                
                {file && fileAnalysis && (
                  <div className="mt-2 text-sm text-primary">
                    <p>Filen innehåller {fileAnalysis.rows} rader och {fileAnalysis.columns} kolumner</p>
                    <p>Filstorlek: {(fileAnalysis.fileSize / 1024).toFixed(0)} KB</p>
                  </div>
                )}
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

          <div className="mt-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              Avbryt
            </Button>
            <Button 
              onClick={handleProcessFile}
              disabled={!file || isLoading || (!isNewAnalysis && memoryCheck.status === 'critical' && !memoryCheck.canAddFile)}
              className="min-w-[100px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bearbetar...
                </>
              ) : isNewAnalysis 
                  ? "Återställ data" 
                  : existingData 
                    ? "Lägg till data"
                    : "Bearbeta"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}