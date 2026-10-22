/**
 * Generate CSV and Excel files from dataset
 */

const fs = require('fs');
const ExcelJS = require('exceljs');

function generateCSV(data, outputPath) {
  const columns = data.columns || [];
  const rows = data.rows || [];

  const header = columns.map(c => '"' + (c.label || c.key).replace(/"/g, '""') + '"').join(',');
  const lines = ['\ufeff' + header];

  for (const row of rows) {
    const cells = columns.map(c => {
      const val = String(row[c.key] ?? '').replace(/"/g, '""');
      return '"' + val + '"';
    });
    lines.push(cells.join(','));
  }

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
  return fs.statSync(outputPath).size;
}

async function generateExcel(data, outputPath) {
  const columns = data.columns || [];
  const rows = data.rows || [];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'ListBase.org';

  const ws = wb.addWorksheet('Data');
  ws.columns = columns.map(c => ({
    header: c.label || c.key,
    key: c.key,
    width: Math.max(12, (c.label || c.key).length + 3),
  }));

  for (const row of rows) ws.addRow(row);

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  if (columns.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  await wb.xlsx.writeFile(outputPath);
  return fs.statSync(outputPath).size;
}

module.exports = { generateCSV, generateExcel };
