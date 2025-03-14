/**
 * Databearbetning för Facebook-statistik
 */
import Papa from 'papaparse';
import { getAccountViewData, getPostViewData } from './webStorageService';

// Displaynamn för tillgängliga fält i per-konto vyn
export const ACCOUNT_VIEW_FIELDS = {
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
  'posts_per_day': 'Publiceringar per dag',
  'page_url': 'Facebook URL'  // Nytt fält för Facebook-sidans URL
};

// Displaynamn för tillgängliga fält i per-inlägg vyn
export const POST_VIEW_FIELDS = {
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

// Displaynamn för metadata-fält som inte är mätvärden
export const METADATA_FIELDS = {
  'post_id': 'Publicerings-ID',  // Ändrat från 'Post ID' till 'Publicerings-ID' för konsekvent namngivning
  'page_id': 'Sid-ID',
  'page_name': 'Sidnamn',
  'title': 'Titel',
  'description': 'Beskrivning',
  'publish_time': 'Publiceringstid',
  'post_type': 'Typ',
  'permalink': 'Länk',
  'page_url': 'Facebook URL'  // Nytt fält
};

/**
 * Normalisera text för konsistent jämförelse
 */
function normalizeText(text) {
  if (text === null || text === undefined) return '';
  return text.toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // Hantera multipla mellanslag
    .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Ta bort osynliga tecken
}

/**
 * Parse and process CSV data
 */
export const processCSVData = async (csvContent) => {
  return await getProcessedData();
};

/**
 * Hämtar data från localStorage/IndexedDB
 */
export const getProcessedData = async () => {
  const accountViewData = await getAccountViewData();
  const postViewData = await getPostViewData();
  
  return {
    rows: postViewData,
    accountViewData: accountViewData,
    postViewData: postViewData
  };
};

/**
 * Hjälpfunktion för att konvertera en dateString till Date-objekt
 * Hanterar olika datumformat
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    // Testa standardformat
    const date = new Date(dateStr);
    // Kontrollera att det är ett giltigt datum
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Testa svenska datumformat (YYYY-MM-DD HH:MM:SS)
    const svMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
    if (svMatch) {
      const [_, year, month, day, hour, minute, second] = svMatch;
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        hour ? parseInt(hour) : 0,
        minute ? parseInt(minute) : 0,
        second ? parseInt(second) : 0
      );
    }
    
    // Testa amerikanskt datumformat (MM/DD/YYYY HH:MM:SS)
    const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (usMatch) {
      const [_, month, day, year, hour, minute, second] = usMatch;
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        hour ? parseInt(hour) : 0,
        minute ? parseInt(minute) : 0,
        second ? parseInt(second) : 0
      );
    }
    
    // Fler format kan läggas till här efter behov
    
  } catch (error) {
    console.error('Fel vid datumparsning:', error);
  }
  
  return null;
}

/**
 * Beräknar antal dagar mellan två datum
 */
function daysBetween(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  
  const oneDay = 24 * 60 * 60 * 1000; // millisekunder per dag
  
  // Justera till UTC midnatt för konsekvent datumjämförelse
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);
  
  // Beräkna skillnaden i dagar, plus 1 för att inkludera både start- och slutdatum
  const diffDays = Math.round(Math.abs((end - start) / oneDay)) + 1;
  
  return diffDays;
}

/**
 * Formaterar ett datum till YYYY-MM-DD-format i lokal tidszon
 * (istället för att konvertera till UTC som toISOString gör)
 */
function formatDateStr(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Extraherar datumintervall från data baserat på publiceringstid
 * @param {Array} data - Array med postdata
 * @returns {Object|null} Datumintervall med start- och slutdatum som strängar i format YYYY-MM-DD
 */
export function getDateRange(data) {
  if (!Array.isArray(data) || data.length === 0) return null;
  
  let earliestDate = null;
  let latestDate = null;
  
  data.forEach(post => {
    const publishDate = parseDate(post.publish_time);
    if (publishDate) {
      if (!earliestDate || publishDate < earliestDate) {
        earliestDate = publishDate;
      }
      if (!latestDate || publishDate > latestDate) {
        latestDate = publishDate;
      }
    }
  });
  
  if (!earliestDate || !latestDate) return null;
  
  // Använd formatDateStr som bevarar lokal tidszon
  // istället för toISOString() som konverterar till UTC först
  return {
    start: formatDateStr(earliestDate),
    end: formatDateStr(latestDate)
  };
}

/**
 * Summerar data per konto
 */
export const summarizeByAccount = (data, selectedFields) => {
  if (!Array.isArray(data) || data.length === 0 || !selectedFields) {
    return [];
  }
  
  // Hitta det fullständiga datumintervallet i hela datauppsättningen
  let globalEarliestDate = null;
  let globalLatestDate = null;
  
  data.forEach(post => {
    const publishDate = parseDate(post.publish_time);
    if (publishDate) {
      if (!globalEarliestDate || publishDate < globalEarliestDate) {
        globalEarliestDate = publishDate;
      }
      if (!globalLatestDate || publishDate > globalLatestDate) {
        globalLatestDate = publishDate;
      }
    }
  });
  
  // Beräkna totalt antal dagar i perioden
  const totalPeriodDays = daysBetween(globalEarliestDate, globalLatestDate);
  console.log(`Hela perioden: ${formatDateStr(globalEarliestDate)} till ${formatDateStr(globalLatestDate)} (${totalPeriodDays} dagar)`);
  
  // Gruppera per konto-ID
  const groupedByAccount = data.reduce((acc, post) => {
    const accountId = post.page_id;
    if (!accountId) return acc;
    
    if (!acc[accountId]) {
      acc[accountId] = {
        page_id: accountId,
        page_name: post.page_name || 'Okänt konto',
        posts: []
      };
    }
    
    acc[accountId].posts.push(post);
    return acc;
  }, {});
  
  // Räkna ut summerade värden för varje konto
  const summaryData = Object.values(groupedByAccount).map(account => {
    // Alltid inkludera page_url oavsett valda fält
    const summary = {
      page_id: account.page_id,
      page_name: account.page_name,
      page_url: `https://www.facebook.com/${account.page_id}`  // Lägg till Facebook URL för alla konton
    };
    
    // Beräkna summa/genomsnitt för varje valt fält
    selectedFields.forEach(field => {
      if (field === 'page_url') {
        // Redan satt ovan, hoppa över
        return;
      }
      else if (field === 'average_reach') {
        // Specialhantering för genomsnittlig räckvidd
        const totalReach = account.posts.reduce((sum, post) => {
          return sum + (post.post_reach || 0);
        }, 0);
        summary.average_reach = account.posts.length > 0 
          ? Math.round(totalReach / account.posts.length) 
          : 0;
      } 
      else if (field === 'post_count') {
        // Specialhantering för antal publiceringar
        summary.post_count = account.posts.length;
      }
      else if (field === 'posts_per_day') {
        // Uppdaterad beräkning: använd hela CSV-perioden istället för bara aktiv period
        const postCount = account.posts.length;
        
        // Använd hela perioden som finns i CSV:n för beräkningen
        const postsPerDay = totalPeriodDays > 0 
          ? parseFloat((postCount / totalPeriodDays).toFixed(2)) 
          : postCount; // Fallback för konstiga fall
        
        summary.posts_per_day = postsPerDay;
      }
      else {
        // Summera övriga värden
        summary[field] = account.posts.reduce((sum, post) => {
          return sum + (post[field] || 0);
        }, 0);
      }
    });
    
    return summary;
  });
  
  return summaryData;
};

/**
 * Returnerar en lista med unika sidnamn från data
 */
export function getUniquePageNames(data) {
  if (!Array.isArray(data)) return [];
  
  // Extrahera och deduplicera sidnamn
  const pageNames = new Set();
  
  data.forEach(post => {
    const pageName = post.page_name || 
                     post['Page name'];
    if (pageName) {
      pageNames.add(pageName);
    }
  });
  
  return Array.from(pageNames).sort();
}