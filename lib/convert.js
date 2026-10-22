/**
 * Dataset conversion utilities — extracted from dataflux-factory/scripts/convert-curated.js
 */

// Tag → category mapping
const TAG_TO_CATEGORY = {
  countries: 'geography', geography: 'geography', cities: 'geography',
  regions: 'geography', continents: 'geography', islands: 'geography',
  capitals: 'geography', demographics: 'geography', population: 'geography',
  rivers: 'geography', mountains: 'geography', lakes: 'geography',
  volcanoes: 'geography', borders: 'geography', postal: 'geography',

  science: 'science', chemistry: 'science', biology: 'science',
  physics: 'science', astronomy: 'science', geology: 'science',
  elements: 'science', space: 'science', animals: 'science',

  technology: 'tech', programming: 'tech', software: 'tech',
  web: 'tech', css: 'tech', html: 'tech', javascript: 'tech',
  emoji: 'tech', unicode: 'tech', fonts: 'tech', colors: 'tech',

  sports: 'sports', football: 'sports', soccer: 'sports',
  basketball: 'sports', tennis: 'sports', cricket: 'sports',
  olympics: 'sports', fifa: 'sports',

  finance: 'finance', economics: 'finance', trade: 'finance',
  currency: 'finance', stocks: 'finance', banking: 'finance',
  gdp: 'finance', inflation: 'finance',

  entertainment: 'entertainment', movies: 'entertainment',
  films: 'entertainment', gaming: 'entertainment', anime: 'entertainment',

  music: 'music', songs: 'music', albums: 'music',
  chords: 'music', guitar: 'music', piano: 'music',

  food: 'food', nutrition: 'food', cooking: 'food',
  recipes: 'food', restaurants: 'food', beverages: 'food',

  health: 'health', medicine: 'health', medical: 'health',

  education: 'education', universities: 'education', schools: 'education',

  history: 'history', historical: 'history', wars: 'history',

  environment: 'environment', climate: 'environment', energy: 'environment',

  politics: 'politics', government: 'politics', elections: 'politics',

  transport: 'transport', airports: 'transport', airlines: 'transport',
  trains: 'transport', railways: 'transport', ports: 'transport',

  culture: 'culture', religion: 'culture', heritage: 'culture',
  temples: 'culture', museums: 'culture',

  reference: 'reference', codes: 'reference', standards: 'reference',
  iso: 'reference', names: 'reference',

  language: 'language', linguistics: 'language', grammar: 'language',

  economy: 'economy', employment: 'economy', jobs: 'economy',

  society: 'society', crime: 'society', immigration: 'society',

  tourism: 'tourism', travel: 'tourism', hotels: 'tourism',

  agriculture: 'agriculture', crops: 'agriculture', farming: 'agriculture',

  time: 'time', calendar: 'time', holidays: 'time',

  units: 'units', measurements: 'units', conversion: 'units',

  law: 'law', legal: 'law',

  data: 'reference', dataset: 'reference',
};

const CATEGORY_PRIORITY = [
  'sports', 'finance', 'geography', 'science', 'tech', 'entertainment',
  'music', 'food', 'health', 'environment', 'politics', 'transport',
  'culture', 'education', 'economy', 'society', 'history', 'tourism',
  'agriculture', 'law', 'time', 'units', 'language', 'reference',
];

function inferCategory(tags, slug) {
  const votes = {};
  for (const tag of tags) {
    const cat = TAG_TO_CATEGORY[tag.toLowerCase()];
    if (cat) votes[cat] = (votes[cat] || 0) + 1;
  }
  const slugParts = slug.split('-');
  for (const part of slugParts) {
    const cat = TAG_TO_CATEGORY[part];
    if (cat && !votes[cat]) votes[cat] = (votes[cat] || 0) + 0.5;
  }
  if (Object.keys(votes).length === 0) return 'reference';

  const sorted = Object.entries(votes).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return CATEGORY_PRIORITY.indexOf(a[0]) - CATEGORY_PRIORITY.indexOf(b[0]);
  });
  return sorted[0][0];
}

function inferType(value) {
  if (value === null || value === undefined) return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    if (/^-?\d+(\.\d+)?$/.test(value) && value.length < 15) return 'number';
  }
  return 'string';
}

function inferColumns(rows) {
  if (!rows || rows.length === 0) return [];
  const keySet = new Set();
  const typeSamples = {};

  for (const row of rows.slice(0, 50)) {
    for (const [key, value] of Object.entries(row)) {
      keySet.add(key);
      if (!typeSamples[key] && value !== null && value !== undefined && value !== '') {
        typeSamples[key] = value;
      }
    }
  }

  return Array.from(keySet)
    .filter(key => key !== '')
    .map(key => ({
      key,
      label: key.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim(),
      type: inferType(typeSamples[key]),
    }));
}

const DROP_COLUMNS = new Set([
  'thumbnail', 'thumbnail_width', 'thumbnail_height',
  'image', 'img', 'icon', 'logo', 'photo', 'picture', 'poster', 'avatar',
]);

function flattenRows(rows) {
  return rows.map(row => {
    const flat = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === '' || DROP_COLUMNS.has(key.toLowerCase())) continue;
      if (value === null || value === undefined) {
        flat[key] = '';
      } else if (Array.isArray(value)) {
        flat[key] = value.map(v =>
          typeof v === 'object' && v !== null
            ? Object.values(v).filter(Boolean).join(': ')
            : String(v)
        ).filter(Boolean).join(', ');
      } else if (typeof value === 'object') {
        const parts = [];
        for (const [k, v] of Object.entries(value)) {
          if (v == null || v === '') continue;
          if (Array.isArray(v)) { if (v.length) parts.push(`${k}: ${v.join(', ')}`); }
          else if (typeof v === 'object') { const inner = Object.values(v).filter(Boolean).join(', '); if (inner) parts.push(`${k}: ${inner}`); }
          else parts.push(`${k}: ${v}`);
        }
        flat[key] = parts.join('; ');
      } else {
        flat[key] = value;
      }
    }
    return flat;
  });
}

// Meta text templates per language
const META_I18N = {
  en: { free: 'Free Download', contains: 'Contains', records: 'records', fields: 'fields', download: 'Download', available: 'Available in Excel, CSV, PDF formats', downloadFormats: 'Download in Excel, CSV, PDF formats', freeDownload: 'Available for free download in Excel, CSV, and PDF formats', source: 'Data sourced from' },
  th: { free: 'ดาวน์โหลดฟรี', contains: 'มีทั้งหมด', records: 'รายการ', fields: 'คอลัมน์', download: 'ดาวน์โหลด', available: 'มีในรูปแบบ Excel, CSV, PDF', downloadFormats: 'ดาวน์โหลดในรูปแบบ Excel, CSV, PDF', freeDownload: 'ดาวน์โหลดฟรีในรูปแบบ Excel, CSV และ PDF', source: 'แหล่งข้อมูล' },
  ms: { free: 'Muat turun percuma', contains: 'Mengandungi', records: 'rekod', fields: 'medan', download: 'Muat turun', available: 'Tersedia dalam format Excel, CSV, PDF', downloadFormats: 'Muat turun dalam format Excel, CSV, PDF', freeDownload: 'Muat turun percuma dalam format Excel, CSV dan PDF', source: 'Sumber data' },
  // Add more as needed
};

function buildListbaseMeta(title, description, lang, recordCount, columnCount, source) {
  const t = META_I18N[lang] || META_I18N.en;
  return {
    title: `${title} - ${t.free}`,
    description: `${description} ${t.contains} ${recordCount} ${t.records}. ${t.downloadFormats}.`,
    seo_title: `${title} | ListBase`,
    seo_description: `${t.download} ${title} — ${recordCount} ${t.records}. ${t.available}.`,
    key_takeaways: [
      `${t.contains} ${recordCount} ${t.records} / ${columnCount} ${t.fields}`,
      t.freeDownload,
      `${t.source}: ${source || 'open data'}`,
    ],
  };
}

module.exports = {
  inferCategory,
  inferColumns,
  inferType,
  flattenRows,
  buildListbaseMeta,
  TAG_TO_CATEGORY,
  META_I18N,
};
