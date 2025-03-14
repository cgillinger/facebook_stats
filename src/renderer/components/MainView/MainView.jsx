import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Settings, Calendar } from 'lucide-react';
import AccountView from '../AccountView';
import PostView from '../PostView';
import { ColumnMappingEditor } from '../ColumnMappingEditor';
import { ACCOUNT_VIEW_FIELDS, POST_VIEW_FIELDS, getDateRange } from '@/utils/dataProcessing';

// Definiera fält som visas i per-post-vyn för Facebook
const POST_VIEW_AVAILABLE_FIELDS = {
  'post_id': 'Publicerings-ID',  // Lagt till Publicerings-ID som första alternativ
  'post_reach': 'Posträckvidd',
  'impressions': 'Sidvisningar',
  'engagement_total': 'Interaktioner',
  'reactions': 'Reaktioner',
  'comments': 'Kommentarer',
  'shares': 'Delningar',
  'total_clicks': 'Totalt antal klick',
  'other_clicks': 'Övriga klick',
  'link_clicks': 'Länkklick'
};

// Definiera fält som visas i per-konto-vyn för Facebook
// Tar bort page_url från valbara fält eftersom det nu visas alltid
const ACCOUNT_VIEW_AVAILABLE_FIELDS = {
  'impressions': 'Sidvisningar',
  'average_reach': 'Genomsnittlig räckvidd',
  'engagement_total': 'Interaktioner',
  'reactions': 'Reaktioner',
  'comments': 'Kommentarer',
  'shares': 'Delningar',
  'total_clicks': 'Totalt antal klick',
  'other_clicks': 'Övriga klick',
  'link_clicks': 'Länkklick',
  'post_count': 'Antal publiceringar',
  'posts_per_day': 'Publiceringar per dag'
};

// Komponent för att visa datumintervall
const DateRangeDisplay = ({ dateRange }) => {
  if (!dateRange) return null;
  
  return (
    <div className="flex items-center gap-2 py-2 px-4 text-sm text-muted-foreground bg-gray-50 rounded-md border border-gray-100 mt-2 mb-2">
      <Calendar className="h-4 w-4" />
      <span>Visar statistik för perioden {dateRange.start} till {dateRange.end}</span>
    </div>
  );
};

const ValueSelector = ({ availableFields, selectedFields, onSelectionChange }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
    {Object.entries(availableFields).map(([key, label]) => (
      <div key={key} className="flex items-center space-x-2">
        <Checkbox
          id={key}
          checked={selectedFields.includes(key)}
          onCheckedChange={(checked) => {
            if (checked) {
              onSelectionChange([...selectedFields, key]);
            } else {
              onSelectionChange(selectedFields.filter(f => f !== key));
            }
          }}
        />
        <Label htmlFor={key}>{label}</Label>
      </div>
    ))}
  </div>
);

const MainView = ({ data }) => {
  const [selectedFields, setSelectedFields] = useState([]);
  const [activeView, setActiveView] = useState('account');
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [dateRange, setDateRange] = useState(null);

  // Återställ valda fält när vyn ändras eller när ny data laddas
  useEffect(() => {
    setSelectedFields([]);
  }, [activeView, data]);

  // Beräkna datumintervall när data ändras
  useEffect(() => {
    if (data) {
      const range = getDateRange(data);
      setDateRange(range);
    }
  }, [data]);

  // Hämta rätt fält baserat på aktiv vy
  const getAvailableFields = () => {
    return activeView === 'account' ? ACCOUNT_VIEW_AVAILABLE_FIELDS : POST_VIEW_AVAILABLE_FIELDS;
  };

  if (!data) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {showColumnMapping ? (
        <div className="space-y-4">
          <Button 
            variant="outline" 
            onClick={() => setShowColumnMapping(false)}
          >
            Tillbaka till statistik
          </Button>
          <ColumnMappingEditor />
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Facebook Statistik</h1>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setShowColumnMapping(true)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Hantera kolumnmappningar
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Välj värden att visa</h2>
                <ValueSelector
                  availableFields={getAvailableFields()}
                  selectedFields={selectedFields}
                  onSelectionChange={setSelectedFields}
                />
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeView} onValueChange={setActiveView}>
            <TabsList>
              <TabsTrigger value="account">Per konto</TabsTrigger>
              <TabsTrigger value="post">Per post</TabsTrigger>
            </TabsList>
            
            {/* Visa datumintervall under flikarna */}
            <DateRangeDisplay dateRange={dateRange} />

            <TabsContent value="account">
              <AccountView data={data} selectedFields={selectedFields} />
            </TabsContent>

            <TabsContent value="post">
              <PostView data={data} selectedFields={selectedFields} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default MainView;