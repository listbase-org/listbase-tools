#!/usr/bin/env node

/**
 * Add a dataset to a ListBase CDN repo.
 *
 * Usage:
 *   node add-dataset.js --lang ms --input ./curated/ms-makanan/ [--repo ../listbase-cdn-ms]
 *   node add-dataset.js --lang ms --input ./curated/ms-makanan/ --push
 *   node add-dataset.js --lang ms --input ./curated/ms-makanan/ --pr
 *
 * Input directory must contain:
 *   data.json  — array of objects
 *   meta.json  — { slug, title, description, source, tags, ... }
 *
 * The script will:
 *   1. Clone CDN repo (if --repo not specified)
 *   2. Convert data+meta to ListBase format
 *   3. Generate CSV + Excel
 *   4. Update index.json + dump.json.gz
 *   5. Commit (+ push or PR if requested)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { inferCategory, inferColumns, flattenRows, buildListbaseMeta } = require('./lib/convert');
const { generateCSV, generateExcel } = require('./lib/generate-files');
const { loadIndex, loadDump, addToIndex, addToDump, saveIndex, saveDump, datasetExists } = require('./lib/index-utils');

// ============================================
// CLI
// ============================================

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}
const hasFlag = (name) => args.includes(`--${name}`);

const lang = getArg('lang');
const inputDir = getArg('input');
const repoArg = getArg('repo');
const doPush = hasFlag('push');
const doPR = hasFlag('pr');

if (!lang || !inputDir) {
  console.error(`Usage: node add-dataset.js --lang <lang> --input <dir> [--repo <dir>] [--push] [--pr]

Options:
  --lang <code>    Language code (e.g. ms, th, en)
  --input <dir>    Directory with data.json + meta.json
  --repo <dir>     CDN repo path (default: clones from GitHub)
  --push           Push after commit
  --pr             Create PR instead of pushing to master`);
  process.exit(1);
}

// ============================================
// Main
// ============================================

async function main() {
  const ORG = 'listbase-org';
  const REPO_NAME = `listbase-cdn-${lang}`;

  // 1. Resolve CDN repo path
  let repoDir = repoArg ? path.resolve(repoArg) : null;

  if (!repoDir) {
    repoDir = path.join('/tmp', REPO_NAME);
    console.log(`Cloning ${ORG}/${REPO_NAME}...`);
    if (fs.existsSync(repoDir)) {
      execSync(`cd "${repoDir}" && git pull`, { stdio: 'inherit' });
    } else {
      execSync(`git clone --depth 1 https://github.com/${ORG}/${REPO_NAME}.git "${repoDir}"`, { stdio: 'inherit' });
    }
  }

  if (!fs.existsSync(path.join(repoDir, 'index.json'))) {
    console.error(`Not a CDN repo: ${repoDir} (missing index.json)`);
    process.exit(1);
  }

  // 2. Read input
  const dataPath = path.join(path.resolve(inputDir), 'data.json');
  const metaPath = path.join(path.resolve(inputDir), 'meta.json');

  if (!fs.existsSync(dataPath)) { console.error(`Missing: ${dataPath}`); process.exit(1); }
  if (!fs.existsSync(metaPath)) { console.error(`Missing: ${metaPath}`); process.exit(1); }

  let rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

  const slug = meta.slug || path.basename(path.resolve(inputDir));
  console.log(`\nAdding: ${slug}`);

  // 3. Check duplicate
  if (datasetExists(repoDir, slug)) {
    console.error(`Dataset "${slug}" already exists in ${REPO_NAME}. Use a different slug or remove first.`);
    process.exit(1);
  }

  // 4. Convert
  // Handle both array and wrapped data
  let rows = Array.isArray(rawData) ? rawData : (rawData.data || rawData.rows || [rawData]);
  rows = flattenRows(rows);

  if (rows.length === 0) {
    console.error('No rows found in data.json');
    process.exit(1);
  }

  const tags = meta.tags || [];
  const category = meta.category || inferCategory(tags, slug);
  const columns = meta.columns || inferColumns(rows);
  const title = meta.title || slug;
  const description = meta.description || title;
  const source = meta.source?.repo_url || meta.source_url || meta.source || '';
  const updated = meta.updated || new Date().toISOString().slice(0, 7);

  const dataset = {
    id: slug,
    name: title,
    title: title,
    description: description,
    category: category,
    source: typeof source === 'string' ? source : source.repo_url || '',
    source_url: typeof source === 'string' ? source : source.repo_url || '',
    updated: updated,
    record_count: rows.length,
    columns: columns,
    rows: rows,
    meta: buildListbaseMeta(title, description, lang, rows.length, columns.length, typeof source === 'string' ? source : source.repo_url),
  };

  console.log(`  Category: ${category}`);
  console.log(`  Records:  ${rows.length}`);
  console.log(`  Columns:  ${columns.length}`);

  // 5. Write files
  const catDir = path.join(repoDir, category);
  fs.mkdirSync(catDir, { recursive: true });

  // JSON
  const jsonPath = path.join(catDir, `${slug}.json`);
  const jsonStr = JSON.stringify(dataset, null, 2);
  fs.writeFileSync(jsonPath, jsonStr);
  const jsonSize = Buffer.byteLength(jsonStr);
  console.log(`  JSON: ${(jsonSize / 1024).toFixed(0)} KB`);

  // CSV
  const langUpper = lang.toUpperCase();
  const csvName = `${slug}_${langUpper}.csv`;
  const csvPath = path.join(catDir, csvName);
  const csvSize = generateCSV(dataset, csvPath);
  console.log(`  CSV:  ${(csvSize / 1024).toFixed(0)} KB`);

  // Excel
  const xlsxName = `${slug}_${langUpper}.xlsx`;
  const xlsxPath = path.join(catDir, xlsxName);
  const xlsxSize = await generateExcel(dataset, xlsxPath);
  console.log(`  XLSX: ${(xlsxSize / 1024).toFixed(0)} KB`);

  const filesInfo = {
    csv: { name: csvName, size: csvSize },
    xlsx: { name: xlsxName, size: xlsxSize },
  };

  // 6. Update index.json + dump.json.gz
  let index = loadIndex(repoDir);
  index = addToIndex(index, dataset, jsonSize, filesInfo);
  saveIndex(repoDir, index);
  console.log(`  index.json updated (${index.total_datasets} datasets)`);

  let dump = loadDump(repoDir);
  dump = addToDump(dump, dataset, filesInfo);
  saveDump(repoDir, dump);
  console.log(`  dump.json.gz updated`);

  // 7. Git commit
  const branch = doPR ? `add-${slug}` : null;

  if (branch) {
    execSync(`cd "${repoDir}" && git checkout -b ${branch}`, { stdio: 'inherit' });
  }

  execSync(`cd "${repoDir}" && git add -A`, { stdio: 'pipe' });
  execSync(`cd "${repoDir}" && git commit -m "Add dataset: ${slug} (${rows.length} records)"`, { stdio: 'inherit' });

  if (doPush) {
    console.log(`\nPushing to ${ORG}/${REPO_NAME}...`);
    execSync(`cd "${repoDir}" && git push`, { stdio: 'inherit' });
    console.log(`Done! Live at: https://cdn.${lang}.listbase.org/${category}/${slug}.json`);
  } else if (doPR) {
    console.log(`\nCreating PR...`);
    execSync(`cd "${repoDir}" && git push -u origin ${branch}`, { stdio: 'inherit' });
    const prUrl = execSync(`cd "${repoDir}" && gh pr create --title "Add ${slug}" --body "New dataset: ${title}\n\n- ${rows.length} records\n- Category: ${category}\n- Source: ${source}" --auto --squash`, { encoding: 'utf-8' }).trim();
    console.log(`PR created: ${prUrl}`);
  } else {
    console.log(`\nCommitted locally. Run with --push or --pr to publish.`);
  }

  console.log(`\nDone: ${slug} → ${category}/`);
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
