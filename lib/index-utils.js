/**
 * Update index.json and dump.json.gz in CDN repo
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SAMPLE_ROWS = 20;

function loadIndex(repoDir) {
  const indexPath = path.join(repoDir, 'index.json');
  if (!fs.existsSync(indexPath)) return null;
  return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
}

function loadDump(repoDir) {
  const dumpPath = path.join(repoDir, 'dump.json.gz');
  if (!fs.existsSync(dumpPath)) return null;
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(dumpPath)).toString());
}

function addToIndex(index, dataset, fileSize, filesInfo) {
  // Remove existing entry if updating
  index.datasets = index.datasets.filter(d => d.id !== dataset.id);

  index.datasets.push({
    id: dataset.id,
    name: dataset.name,
    category: dataset.category,
    record_count: dataset.record_count,
    columns: (dataset.columns || []).map(c => c.key || c),
    source: dataset.source || '',
    updated: dataset.updated || '',
    size: fileSize,
    files: filesInfo,
  });

  // Re-sort
  index.datasets.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));

  // Rebuild categories
  const catMap = {};
  for (const d of index.datasets) {
    catMap[d.category] = (catMap[d.category] || 0) + 1;
  }
  index.categories = Object.entries(catMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, dataset_count]) => ({ id, dataset_count }));

  // Update totals
  index.total_datasets = index.datasets.length;
  index.total_records = index.datasets.reduce((s, d) => s + (d.record_count || 0), 0);
  index.generated = new Date().toISOString();

  return index;
}

function addToDump(dump, dataset, filesInfo) {
  // Remove existing entry if updating
  dump.datasets = dump.datasets.filter(d => d.id !== dataset.id);

  dump.datasets.push({
    id: dataset.id,
    name: dataset.name,
    description: dataset.description || '',
    category: dataset.category,
    source: dataset.source || '',
    updated: dataset.updated || '',
    record_count: dataset.record_count,
    columns: dataset.columns || [],
    meta: dataset.meta || {},
    sample_rows: (dataset.rows || []).slice(0, SAMPLE_ROWS),
    files: filesInfo,
  });

  // Re-sort
  dump.datasets.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));

  // Update totals
  dump.total_datasets = dump.datasets.length;
  dump.total_records = dump.datasets.reduce((s, d) => s + (d.record_count || 0), 0);
  dump.generated = new Date().toISOString();

  return dump;
}

function saveIndex(repoDir, index) {
  fs.writeFileSync(path.join(repoDir, 'index.json'), JSON.stringify(index, null, 2));
}

function saveDump(repoDir, dump) {
  const gz = zlib.gzipSync(JSON.stringify(dump));
  fs.writeFileSync(path.join(repoDir, 'dump.json.gz'), gz);
}

function datasetExists(repoDir, slug) {
  const index = loadIndex(repoDir);
  if (!index) return false;
  return index.datasets.some(d => d.id === slug);
}

module.exports = {
  loadIndex,
  loadDump,
  addToIndex,
  addToDump,
  saveIndex,
  saveDump,
  datasetExists,
};
