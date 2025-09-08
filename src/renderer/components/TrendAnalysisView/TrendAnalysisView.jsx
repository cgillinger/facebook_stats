import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { 
  TrendingUp, 
  LineChart, 
  FileSpreadsheet,
  AlertCircle,
  Info
} from 'lucide-react';
import { getValue } from '../ColumnMappingEditor/columnMappingService';

// Tillgängliga metrics för trendanalys
const TREND_METRICS = {
  'views': 'Sidvisningar',
  'average_reach': 'Genomsnittlig räckvidd', 
  'total_engagement': 'Interaktioner',
  'likes': 'Reaktioner',
  'comments': 'Kommentarer',
  'shares': 'Delningar',
  'total_clicks': 'Totalt antal klick',
  'other_clicks': 'Övriga klick',
  'link_clicks': 'Länkklick',
  'post_count': 'Antal publiceringar',
  'posts_per_day': 'Publiceringar per dag'
};

// Färger för linjediagram
const CHART_COLORS = [
  '#2563EB', '#16A34A', '#EAB308', '#DC2626', '#7C3AED', '#EA580C',
  '#0891B2', '#BE185D', '#059669', '#7C2D12', '#4338CA', '#C2410C'
];

// Månadsnamn för X-axel
const getMonthName = (month) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 
                 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
  return months[month - 1] || month.toString();
};

// Smooth curve generation för mjuka linjer
const createSmoothPath = (points) => {
  if (points.length < 2) return '';
  
  if (points.length === 2) {
    const [p1, p2] = points;
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
  }
  
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    const current = points[i];
    const previous = points[i - 1];
    
    if (i === 1) {
      const next = points[i + 1] || current;
      const cp1x = previous.x + (current.x - previous.x) * 0.3;
      const cp1y = previous.y + (current.y - previous.y) * 0.3;
      const cp2x = current.x - (next.x - previous.x) * 0.1;
      const cp2y = current.y - (next.y - previous.y) * 0.1;
      
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${current.x} ${current.y}`;
    } else if (i === points.length - 1) {
      const beforePrev = points[i - 2] || previous;
      const cp1x = previous.x + (current.x - beforePrev.x) * 0.1;
      const cp1y = previous.y + (current.y - beforePrev.y) * 0.1;
      const cp2x = current.x - (current.x - previous.x) * 0.3;
      const cp2y = current.y - (current.y - previous.y) * 0.3;
      
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${current.x} ${current.y}`;
    } else {
      const next = points[i + 1];
      const beforePrev = points[i - 2] || previous;
      const cp1x = previous.x + (current.x - beforePrev.x) * 0.1;
      const cp1y = previous.y + (current.y - beforePrev.y) * 0.1;
      const cp2x = current.x - (next.x - previous.x) * 0.1;
      const cp2y = current.y - (next.y - previous.y) * 0.1;
      
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${current.x} ${current.y}`;
    }
  }
  
  return path;
};

const TrendAnalysisView = ({ data, meta }) => {
  const [selectedMetric, setSelectedMetric] = useState('total_engagement');
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [hoveredDataPoint, setHoveredDataPoint] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Gruppera data per månad och konto från publish_time
  const monthlyAccountData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { months: [], accountData: {} };
    }

    // Gruppera posts per månad och konto
    const monthlyGroups = {};
    const allMonths = new Set();
    
    data.forEach(post => {
      const publishTime = getValue(post, 'publish_time');
      const accountId = getValue(post, 'account_id');
      const accountName = getValue(post, 'account_name') || 'Okänd sida';
      
      if (!publishTime || !accountId) return;
      
      const date = new Date(publishTime);
      if (isNaN(date.getTime())) return;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      allMonths.add(monthKey);
      
      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = {};
      }
      
      if (!monthlyGroups[monthKey][accountId]) {
        monthlyGroups[monthKey][accountId] = {
          account_id: accountId,
          account_name: accountName,
          posts: []
        };
      }
      
      monthlyGroups[monthKey][accountId].posts.push(post);
    });

    // Sortera månader kronologiskt
    const sortedMonths = Array.from(allMonths).sort();
    
    // Beräkna metrics per månad och konto
    const accountData = {};
    
    Object.entries(monthlyGroups).forEach(([monthKey, accounts]) => {
      Object.entries(accounts).forEach(([accountId, accountInfo]) => {
        if (!accountData[accountId]) {
          accountData[accountId] = {
            account_id: accountId,
            account_name: accountInfo.account_name,
            monthlyData: {}
          };
        }
        
        // Beräkna metrics för denna månad
        let totalLikes = 0, totalComments = 0, totalShares = 0;
        let totalClicks = 0, totalOtherClicks = 0, totalLinkClicks = 0;
        let totalViews = 0, totalReach = 0;
        
        accountInfo.posts.forEach(post => {
          totalLikes += (getValue(post, 'likes') || 0);
          totalComments += (getValue(post, 'comments') || 0);
          totalShares += (getValue(post, 'shares') || 0);
          totalClicks += (getValue(post, 'total_clicks') || 0);
          totalOtherClicks += (getValue(post, 'other_clicks') || 0);
          totalLinkClicks += (getValue(post, 'link_clicks') || 0);
          totalViews += (getValue(post, 'views') || 0);
          totalReach += (getValue(post, 'reach') || 0);
        });
        
        const monthlyMetrics = {
          likes: totalLikes,
          comments: totalComments,
          shares: totalShares,
          total_clicks: totalClicks,
          other_clicks: totalOtherClicks,
          link_clicks: totalLinkClicks,
          views: totalViews,
          total_engagement: totalLikes + totalComments + totalShares,
          post_count: accountInfo.posts.length,
          average_reach: accountInfo.posts.length > 0 
            ? Math.round(totalReach / accountInfo.posts.length) 
            : 0
        };
        
        // Beräkna posts_per_day för månaden
        const [year, month] = monthKey.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        monthlyMetrics.posts_per_day = Math.round((accountInfo.posts.length / daysInMonth) * 10) / 10;
        
        accountData[accountId].monthlyData[monthKey] = monthlyMetrics;
      });
    });

    return {
      months: sortedMonths,
      accountData: Object.values(accountData).sort((a, b) => a.account_name.localeCompare(b.account_name))
    };
  }, [data]);

  // Generera linjediagram-data
  const chartLines = useMemo(() => {
    if (!selectedAccounts.length || !selectedMetric) return [];
    
    return monthlyAccountData.accountData
      .filter(account => selectedAccounts.includes(account.account_id))
      .map((account, index) => {
        const points = monthlyAccountData.months.map(monthKey => {
          const monthData = account.monthlyData[monthKey];
          return {
            month: monthKey,
            value: monthData ? (monthData[selectedMetric] || 0) : 0,
            account: account
          };
        });
        
        return {
          account_id: account.account_id,
          account_name: account.account_name,
          color: CHART_COLORS[index % CHART_COLORS.length],
          points: points
        };
      });
  }, [monthlyAccountData, selectedAccounts, selectedMetric]);

  // Y-axel range
  const yAxisRange = useMemo(() => {
    if (chartLines.length === 0) return { min: 0, max: 100 };
    
    const allValues = chartLines.flatMap(line => line.points.map(p => p.value));
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const padding = (max - min) * 0.1 || 10;
    
    return {
      min: Math.max(0, min - padding),
      max: max + padding
    };
  }, [chartLines]);

  const handleAccountToggle = (accountId) => {
    setSelectedAccounts(current => 
      current.includes(accountId) 
        ? current.filter(id => id !== accountId)
        : [...current, accountId]
    );
  };

  const handleToggleAllAccounts = () => {
    const allAccountIds = monthlyAccountData.accountData.map(account => account.account_id);
    if (selectedAccounts.length === allAccountIds.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(allAccountIds);
    }
  };

  const allAccountsSelected = selectedAccounts.length === monthlyAccountData.accountData.length && monthlyAccountData.accountData.length > 0;

  const handleMetricChange = (metricKey) => {
    setSelectedMetric(metricKey);
  };

  const handleMouseMove = (event, point) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
    setHoveredDataPoint(point);
  };

  const showChart = selectedMetric && selectedAccounts.length > 0 && monthlyAccountData.months.length > 0;

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trendanalys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Ingen data tillgänglig</AlertTitle>
            <AlertDescription>
              Ladda upp CSV-data från Facebook för att se trendanalys.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (monthlyAccountData.accountData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trendanalys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Inga konton hittades</AlertTitle>
            <AlertDescription>
              Kunde inte hitta giltiga konton med publiceringsdatum i den uppladdade datan.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            Trendanalys över tid
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={!showChart}
            >
              Exportera PNG
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {meta?.dateRange && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Tidsperiod</AlertTitle>
              <AlertDescription>
                Data från {meta.dateRange.startDate} till {meta.dateRange.endDate} 
                ({monthlyAccountData.months.length} månader)
              </AlertDescription>
            </Alert>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-medium">
                  Välj Facebook-konton ({selectedAccounts.length} valda)
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleAllAccounts}
                >
                  {allAccountsSelected ? 'Avmarkera alla' : 'Välj alla'}
                </Button>
              </div>
              
              <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2 bg-gray-50">
                {monthlyAccountData.accountData.map(account => (
                  <Label 
                    key={account.account_id} 
                    className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded"
                  >
                    <Checkbox
                      checked={selectedAccounts.includes(account.account_id)}
                      onCheckedChange={() => handleAccountToggle(account.account_id)}
                    />
                    <span className="text-sm font-medium">
                      {account.account_name}
                    </span>
                  </Label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-medium mb-3 block">
                Välj datapunkt att analysera
              </Label>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {Object.entries(TREND_METRICS).map(([key, label]) => (
                  <Label 
                    key={key} 
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="trendMetric"
                      value={key}
                      checked={selectedMetric === key}
                      onChange={() => handleMetricChange(key)}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm">{label}</span>
                  </Label>
                ))}
              </div>
            </div>
          </div>

          {selectedMetric && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <h3 className="text-lg font-bold text-blue-900">
                Visar: {TREND_METRICS[selectedMetric]}
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                Utveckling över tid för valda konton
              </p>
            </div>
          )}

          {showChart ? (
            <div className="space-y-4">
              {/* Legenda */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {chartLines.map(line => (
                  <div key={line.account_id} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full border flex-shrink-0"
                      style={{ backgroundColor: line.color }}
                    />
                    <span className="text-sm font-medium truncate" title={line.account_name}>
                      {line.account_name.length > 20 
                        ? line.account_name.substring(0, 17) + '...' 
                        : line.account_name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Linjediagram */}
              <div className="relative">
                <svg 
                  width="100%" 
                  height="500" 
                  viewBox="0 0 1000 500"
                  className="border rounded bg-gray-50"
                  onMouseLeave={() => setHoveredDataPoint(null)}
                >
                  {/* Grid */}
                  <defs>
                    <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />

                  {/* Y-axel */}
                  {[0, 25, 50, 75, 100].map(percent => {
                    const yPos = 450 - (percent / 100) * 380;
                    const value = yAxisRange.min + (percent / 100) * (yAxisRange.max - yAxisRange.min);
                    return (
                      <g key={percent}>
                        <line x1="70" y1={yPos} x2="930" y2={yPos} stroke="#d1d5db" strokeWidth="1"/>
                        <text x="65" y={yPos + 4} textAnchor="end" fontSize="14" fill="#6b7280">
                          {Math.round(value).toLocaleString()}
                        </text>
                      </g>
                    );
                  })}

                  {/* X-axel månader */}
                  {monthlyAccountData.months.map((monthKey, index) => {
                    const [year, month] = monthKey.split('-').map(Number);
                    const xPos = 70 + (index / Math.max(1, monthlyAccountData.months.length - 1)) * 860;
                    return (
                      <g key={monthKey}>
                        <line x1={xPos} y1="70" x2={xPos} y2="450" stroke="#d1d5db" strokeWidth="1"/>
                        <text x={xPos} y="475" textAnchor="middle" fontSize="14" fill="#6b7280">
                          {getMonthName(month)}
                        </text>
                        <text x={xPos} y="490" textAnchor="middle" fontSize="12" fill="#9ca3af">
                          {year}
                        </text>
                      </g>
                    );
                  })}

                  {/* Linjer */}
                  {chartLines.map(line => {
                    if (line.points.length < 1) return null;

                    const pathPoints = line.points.map((point, index) => {
                      const x = 70 + (index / Math.max(1, monthlyAccountData.months.length - 1)) * 860;
                      const y = 450 - ((point.value - yAxisRange.min) / (yAxisRange.max - yAxisRange.min)) * 380;
                      return { x, y, point };
                    });

                    return (
                      <g key={line.account_id}>
                        {/* Mjuk linje */}
                        {line.points.length > 1 && (
                          <path
                            d={createSmoothPath(pathPoints)}
                            fill="none"
                            stroke={line.color}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        
                        {/* Punkter */}
                        {pathPoints.map(({ x, y, point }, index) => (
                          <circle
                            key={index}
                            cx={x}
                            cy={y}
                            r="5"
                            fill={line.color}
                            stroke="white"
                            strokeWidth="2"
                            className="cursor-pointer"
                            onMouseEnter={(e) => handleMouseMove(e, { ...point, account_name: line.account_name, color: line.color })}
                          />
                        ))}
                      </g>
                    );
                  })}

                  {/* Tooltip */}
                  {hoveredDataPoint && (
                    <g>
                      {(() => {
                        const tooltipWidth = 200;
                        const tooltipHeight = 70;
                        let tooltipX = mousePosition.x + 15;
                        let tooltipY = mousePosition.y - 35;
                        
                        if (tooltipX + tooltipWidth > 980) {
                          tooltipX = mousePosition.x - tooltipWidth - 15;
                        }
                        if (tooltipY < 15) {
                          tooltipY = mousePosition.y + 15;
                        }
                        if (tooltipY + tooltipHeight > 480) {
                          tooltipY = mousePosition.y - tooltipHeight - 15;
                        }
                        
                        const [year, month] = hoveredDataPoint.month.split('-').map(Number);
                        
                        return (
                          <>
                            <rect
                              x={tooltipX} y={tooltipY} 
                              width={tooltipWidth} height={tooltipHeight}
                              fill="rgba(0,0,0,0.85)" rx="6"
                            />
                            <text x={tooltipX + 12} y={tooltipY + 20} fill="white" fontSize="13" fontWeight="bold">
                              {hoveredDataPoint.account_name}
                            </text>
                            <text x={tooltipX + 12} y={tooltipY + 38} fill="white" fontSize="12">
                              {getMonthName(month)} {year}
                            </text>
                            <text x={tooltipX + 12} y={tooltipY + 55} fill="white" fontSize="12">
                              {TREND_METRICS[selectedMetric]}: {hoveredDataPoint.value.toLocaleString()}
                            </text>
                          </>
                        );
                      })()}
                    </g>
                  )}
                </svg>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <LineChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Välj konton och datapunkt för att visa trend</p>
              <p className="text-sm">
                {selectedAccounts.length === 0 
                  ? "Markera minst ett Facebook-konto i listan ovan"
                  : monthlyAccountData.months.length === 0
                  ? "Ingen tidsdata hittades i uppladdade CSV-filer"
                  : "Valda konton är redo - väntar på datapunkt-val"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TrendAnalysisView;