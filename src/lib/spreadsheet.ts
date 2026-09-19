import { decodeSpreadsheetText, maybeSkipLinkedInPreamble, readCsv, rowsToObjects } from './csv';
import type { FileKind } from './columns';

export function isExcelName(name: string): boolean {
  return /\.xlsx?$/i.test(name);
}

export async function excelBufferToCsv(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return '';
  return XLSX.utils.sheet_to_csv(sheet, { dateNF: 'yyyy-mm-dd' });
}

export async function recordsFromFile(
  file: File,
  kind: FileKind,
): Promise<{ headers: string[]; records: Record<string, string>[] }> {
  const buffer = await file.arrayBuffer();
  const text = isExcelName(file.name) ? await excelBufferToCsv(buffer) : decodeSpreadsheetText(buffer);
  let rows = readCsv(text);
  if (kind === 'ads' || kind === 'spend') rows = maybeSkipLinkedInPreamble(rows);
  return rowsToObjects(rows);
}
