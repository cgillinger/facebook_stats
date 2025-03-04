import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Save, AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { readColumnMappings, saveColumnMappings, resetMappingsToDefault, DISPLAY_NAMES, COLUMN_GROUPS } from './columnMappingService';

export function ColumnMappingEditor() {
  const [mappings, setMappings] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    console.log('ColumnMappingEditor: Börjar ladda mappningar');
    try {
      const data = await readColumnMappings();
      console.log('ColumnMappingEditor: Laddade mappningar:', data);
      setMappings(data);
      setError(null);
    } catch (err) {
      console.error('ColumnMappingEditor: Fel vid laddning:', err);
      setError('Kunde inte ladda kolumnmappningar: ' + err.message);
    } finally {
      setIsLoading(false);
      console.log('ColumnMappingEditor: Laddning slutförd');
    }
  };

  const handleSave = async () => {
    console.log('ColumnMappingEditor: Börjar spara ändringar');
    console.log('ColumnMappingEditor: Mappningar att spara:', mappings);
    
    setIsSaving(true);
    setError(null);
    
    try {
      await saveColumnMappings(mappings);
      console.log('ColumnMappingEditor: Sparning lyckades');
      setSuccessMessage("Ändringarna har sparats.");
      setSuccess(true);
      // Öka tiden till 10 sekunder för bättre synlighet
      setTimeout(() => {
        console.log('ColumnMappingEditor: Döljer success-meddelande');
        setSuccess(false);
      }, 10000);
    } catch (err) {
      console.error('ColumnMappingEditor: Fel vid sparning:', err);
      setError('Kunde inte spara ändringarna: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    console.log('ColumnMappingEditor: Börjar återställa till standard');
    setIsResetting(true);
    setError(null);
    
    try {
      // Använd resetMappingsToDefault-funktionen från columnMappingService
      await resetMappingsToDefault();
      
      // Ladda om mappningarna för att visa standardvärdena
      const standardMappings = await readColumnMappings();
      console.log('ColumnMappingEditor: Laddade standardmappningar:', standardMappings);
      setMappings(standardMappings);
      
      // Visa meddelande om framgång
      setSuccessMessage("Kolumnmappningarna har återställts till standardvärden.");
      setSuccess(true);
      setTimeout(() => {
        console.log('ColumnMappingEditor: Döljer success-meddelande');
        setSuccess(false);
      }, 10000);
    } catch (err) {
      console.error('ColumnMappingEditor: Fel vid återställning:', err);
      setError('Kunde inte återställa till standardvärden: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleValueChange = (originalName, newValue) => {
    console.log('ColumnMappingEditor: Ändrar mappning');
    console.log('Från:', originalName);
    console.log('Till:', newValue);
    
    // FÖRBÄTTRING 1: Validera det nya värdet innan vi gör några ändringar
    if (!newValue || newValue.trim() === '') {
      console.error('ColumnMappingEditor: Kolumnnamn kan inte vara tomt');
      setError(`Kolumnnamnet kan inte vara tomt. Ändring från "${originalName}" avbröts.`);
      return;
    }
    
    setMappings(prev => {
      // Skapa en kopia av det tidigare state:t
      const newMappings = { ...prev };
      console.log('ColumnMappingEditor: Tidigare mappningar:', JSON.stringify(newMappings, null, 2));
      
      // Spara det interna namnet som denna kolumn ska mappa till
      const internalName = newMappings[originalName];
      console.log('ColumnMappingEditor: Internt namn att bevara:', internalName);
      
      if (!internalName) {
        console.error(`ColumnMappingEditor: Kunde inte hitta internt namn för "${originalName}"`);
        // Om vi inte hittar det interna namnet, avbryt operationen
        return prev;
      }
      
      // FÖRBÄTTRING 2: Lägg till den nya mappningen innan vi tar bort den gamla
      newMappings[newValue] = internalName;
      console.log('ColumnMappingEditor: Efter tillägg av ny mappning:', JSON.stringify(newMappings, null, 2));
      
      // FÖRBÄTTRING 3: Ta endast bort den gamla mappningen om den nya kunde läggas till
      if (newMappings[newValue] === internalName) {
        // Den nya mappningen lades till framgångsrikt, nu kan vi ta bort den gamla
        if (newValue !== originalName) { // Undvik borttagning om samma namn
          delete newMappings[originalName];
          console.log('ColumnMappingEditor: Efter borttagning av gammal mappning:', JSON.stringify(newMappings, null, 2));
        }
      } else {
        console.error(`ColumnMappingEditor: Kunde inte lägga till ny mappning "${newValue}"`);
        // Om något gick fel, behåll den ursprungliga mappningen
        return prev;
      }
      
      // FÖRBÄTTRING 4: Verifiera att det interna namnet fortfarande finns i mappningarna
      const containsInternalName = Object.values(newMappings).includes(internalName);
      if (!containsInternalName) {
        console.error(`ColumnMappingEditor: Internt namn "${internalName}" saknas i uppdaterade mappningar!`);
        console.log('Försöker återställa ursprunglig mappning...');
        // Om det interna namnet saknas, återställ till ursprungligt tillstånd
        newMappings[originalName] = internalName;
        return newMappings;
      }
      
      return newMappings;
    });
  };

  // Helper function to get mappings in correct order for a group
  const getOrderedMappingsForGroup = (internalNames) => {
    console.log('ColumnMappingEditor: Hämtar ordnade mappningar för grupp');
    console.log('InternalNames:', internalNames);
    
    // Create a map of internal name to original name for quick lookup
    const internalToOriginal = Object.entries(mappings).reduce((acc, [original, internal]) => {
      acc[internal] = original;
      return acc;
    }, {});

    console.log('ColumnMappingEditor: Intern -> Original mappning:', internalToOriginal);

    // Return mappings in the order specified by internalNames
    const orderedMappings = internalNames.map(internalName => ({
      originalName: internalToOriginal[internalName],
      internalName
    })).filter(mapping => mapping.originalName !== undefined);

    console.log('ColumnMappingEditor: Ordnade mappningar:', orderedMappings);
    return orderedMappings;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p>Laddar kolumnmappningar...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hantera kolumnmappningar</CardTitle>
        <div className="text-sm text-muted-foreground">
          <div className="mb-4">
            När Meta ändrar kolumnnamn i exportfilerna behöver du uppdatera mappningarna här.
            Följ dessa steg:
          </div>
          <div className="ml-4 space-y-2">
            <div className="flex gap-2">
              <span>1.</span>
              <span>Ladda upp en ny CSV-fil från Meta</span>
            </div>
            <div className="flex gap-2">
              <span>2.</span>
              <span>Om filen inte kan läsas in, notera vilka kolumner som saknas</span>
            </div>
            <div className="flex gap-2">
              <span>3.</span>
              <span>Hitta kolumnen med det gamla namnet i <strong>Original kolumnnamn från Meta</strong> och ändra det till det nya namnet som Meta nu använder</span>
            </div>
            <div className="flex gap-2">
              <span>4.</span>
              <span>Klicka på Spara ändringar</span>
            </div>
            <div className="flex gap-2">
              <span>5.</span>
              <span className="font-semibold">VIKTIGT: Gå tillbaka och läs in CSV-filen igen. Dina ändringar börjar inte gälla förrän du läser in CSV-filen på nytt.</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {error && (
            <Alert variant="destructive" className="animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Fel</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200 animate-in fade-in duration-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Ändringarna sparade</AlertTitle>
              <AlertDescription className="text-green-700">
                <div className="space-y-2">
                  <p>{successMessage}</p>
                  <p className="font-semibold">Du måste nu gå tillbaka och läsa in CSV-filen igen för att ändringarna ska börja gälla.</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {Object.entries(COLUMN_GROUPS).map(([groupName, internalNames]) => (
            <div key={groupName}>
              <h3 className="text-lg font-semibold mb-2">{groupName}</h3>
              <div className="rounded-md border mb-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Visningsnamn</TableHead>
                      <TableHead>Original kolumnnamn från Meta</TableHead>
                      <TableHead>Internt namn (ändra ej)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getOrderedMappingsForGroup(internalNames).map(({ originalName, internalName }) => (
                      <TableRow key={internalName}>
                        <TableCell className="font-medium">
                          {DISPLAY_NAMES[internalName]}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={originalName || ''}
                            onChange={(e) => handleValueChange(originalName, e.target.value)}
                            className="max-w-sm"
                            disabled={isSaving || isResetting}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {internalName}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}

          <div className="flex justify-between">
            <Button 
              onClick={handleResetToDefault} 
              disabled={isResetting || isSaving}
              variant="outline"
              className="min-w-[170px]"
            >
              {isResetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Återställer...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Återställ till standard
                </>
              )}
            </Button>
            
            <Button 
              onClick={handleSave} 
              disabled={isSaving || isResetting}
              className="min-w-[100px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sparar...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Spara ändringar
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}