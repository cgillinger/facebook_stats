import React, { useState, useEffect } from 'react';
import { FileUploader } from "./components/FileUploader";
import MainView from "./components/MainView";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import { InfoIcon, AlertTriangle } from "lucide-react";
import { Button } from "./components/ui/button";
import { Upload, FileDown } from "lucide-react";
import { getStorageStats } from "@/utils/webStorageService";

function App() {
  const [processedData, setProcessedData] = useState(null);
  const [showFileUploader, setShowFileUploader] = useState(true);
  const [fileHistory, setFileHistory] = useState([]);
  const [storageStats, setStorageStats] = useState(null);
  const [isCheckingStorage, setIsCheckingStorage] = useState(false);
  
  // Kontrollera lagringsutrymme när appen startar
  useEffect(() => {
    // Vänta med att kontrollera lagring tills användaren har laddat data
  }, []);

  // Uppdatera lagringsstatus bara när vi har data
  useEffect(() => {
    if (processedData) {
      checkStorageUsage();
      
      const interval = setInterval(() => {
        checkStorageUsage();
      }, 60000); // Kontrollera varje minut
      
      return () => clearInterval(interval);
    }
  }, [processedData]);
  
  // Kontrollera lagringsutrymme
  const checkStorageUsage = async () => {
    try {
      setIsCheckingStorage(true);
      const stats = await getStorageStats();
      setStorageStats(stats);
      setIsCheckingStorage(false);
    } catch (error) {
      console.error('Fel vid lagringskontroll:', error);
      setIsCheckingStorage(false);
    }
  };

  const handleDataProcessed = (data, fileInfo) => {
    // Om detta är första filen, spara den som den är
    if (!processedData) {
      setProcessedData(data);
    } else {
      // Annars kombinera med befintlig data
      const combinedData = {
        // Behåll metadata från det första datasettet
        meta: {
          ...processedData.meta,
          stats: {
            totalRows: (processedData.meta.stats.totalRows || 0) + (data.meta.stats.totalRows || 0),
            duplicates: (processedData.meta.stats.duplicates || 0) + (data.meta.stats.duplicates || 0),
            // Vissa dubletter kan uppstå vid kombination, men vi räknar inte dem här
            duplicateIds: [...(processedData.meta.stats.duplicateIds || []), ...(data.meta.stats.duplicateIds || [])]
          }
        },
        // Kombinera rader från båda datamängderna
        rows: [...processedData.rows, ...data.rows],
        // Kombinera account view data
        accountViewData: [...processedData.accountViewData, ...data.accountViewData],
        // Kombinera post view data
        postViewData: [...processedData.postViewData, ...data.postViewData],
        // Behåll övriga egenskaper
        rowCount: (processedData.rowCount || 0) + (data.rowCount || 0)
      };
      
      setProcessedData(combinedData);
    }
    
    // Lägg till filen i historiken
    if (fileInfo) {
      setFileHistory(prev => [...prev, fileInfo]);
    }
    
    setShowFileUploader(false);
    console.log('Data processerad. Nuvarande datauppsättningar:', fileHistory.length + 1);
    
    // Uppdatera lagringsstatistik efter att ny data har bearbetats
    checkStorageUsage();
  };

  const handleLoadNewCSV = () => {
    setShowFileUploader(true);
  };

  const handleCancel = () => {
    if (processedData) {
      setShowFileUploader(false);
    }
  };

  const getTotalDuplicatesCount = () => {
    if (!processedData || !processedData.meta || !processedData.meta.stats) {
      return 0;
    }
    return processedData.meta.stats.duplicates || 0;
  };

  // Kontrollera om det finns dublettinformation
  const hasDuplicateInfo = getTotalDuplicatesCount() > 0;
  
  // Visa varning om lagringsutrymmet håller på att ta slut - men endast om vi har data
  // och användningen är över 90% (justerad från 80% för att minska falska positiva)
  const hasLowStorage = processedData && storageStats && 
    (storageStats.localStorage.fbUsed > 1024 * 1024) && // Minst 1MB FB-data
    (storageStats.localStorage.percentage > 90 || storageStats.total.percentage > 90);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container py-4">
          <h1 className="text-2xl font-bold text-foreground">
            Facebook Statistik
          </h1>
        </div>
      </header>

      <main className="container py-6">
        <div className="grid gap-6">
          {/* Visa varning om lagringsutrymmet håller på att ta slut */}
          {hasLowStorage && (
            <Alert variant="warning" className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Varning: Lagringsutrymmet börjar ta slut</AlertTitle>
              <AlertDescription className="text-amber-700">
                <p>Webbläsarens lagringsutrymme används till {Math.round(storageStats.total.percentage)}%. Detta kan påverka applikationens prestanda och stabilitet.</p>
                <p className="mt-2">Överväg att exportera dina data och rensa applikationens lagring genom att tömma webbläsarens data för denna sida.</p>
              </AlertDescription>
            </Alert>
          )}

          {showFileUploader ? (
            <FileUploader 
              onDataProcessed={handleDataProcessed} 
              onCancel={handleCancel}
              isAddingFile={processedData !== null}
              fileHistory={fileHistory}
            />
          ) : (
            <>
              {hasDuplicateInfo && (
                <Alert variant="info" className="bg-blue-50 border-blue-200">
                  <InfoIcon className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700">
                    {getTotalDuplicatesCount()} dubletter hittades och har filtrerats bort. Dessa räknas inte in i resultaten.
                  </AlertDescription>
                </Alert>
              )}
              
              {fileHistory.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Inlästa filer ({fileHistory.length})</h3>
                  <ul className="space-y-1">
                    {fileHistory.map((file, index) => (
                      <li key={index} className="text-xs text-slate-600 flex items-center">
                        <FileDown className="h-3 w-3 mr-1 text-slate-400" />
                        {file.name} ({file.rows} rader)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="flex justify-end gap-4">
                <Button 
                  variant="outline" 
                  onClick={handleLoadNewCSV}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Lägg till fler CSV-filer
                </Button>
              </div>
              
              <MainView 
                data={processedData.rows} 
                onDataProcessed={handleDataProcessed}
              />
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="container py-4 text-center text-sm text-muted-foreground">
          Facebook Statistik © {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}

export default App;