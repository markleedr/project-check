export interface CsvRow {
  cells: string[];
  line: number;
}

const DELIMITERS = [',', ';', '\t', '|'];

function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.search(/\r?\n/) + 1 || undefined);
  let best = ',';
  let bestCount = 0;
  for (const d of DELIMITERS) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** RFC 4180 reader. Quoted fields may hold commas and line breaks. */
export function readCsv(text: string): CsvRow[] {
  const body = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(body);

  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;

  const endRow = () => {
    cells.push(field);
    if (cells.some((c) => c.trim() !== '')) rows.push({ cells, line: rowLine });
    cells = [];
    field = '';
    rowLine = line;
  };

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field.trim() === '') {
      quoted = true;
      field = '';
    } else if (ch === delimiter) {
      cells.push(field);
      field = '';
    } else if (ch === '\r') {
      // skip
    } else if (ch === '\n') {
      line++;
      endRow();
    } else {
      field += ch;
    }
  }
  endRow();

  return rows.map((r) => ({ cells: r.cells.map((c) => c.trim()), line: r.line }));
}

export function decodeSpreadsheetText(buffer: ArrayBuffer): string {
  const bom = new Uint8Array(buffer.slice(0, 2));
  if (bom[0] === 0xff && bom[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer);
  }
  if (bom[0] === 0xfe && bom[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer);
  }
  return new TextDecoder('utf-8').decode(buffer);
}

/** LinkedIn ads manager files put four junk rows above the header. */
export function maybeSkipLinkedInPreamble(rows: CsvRow[]): CsvRow[] {
  if (rows.length < 6) return rows;
  const headerish = (cells: string[]) =>
    cells.some((c) => /campaign|ad set|adset|impressions|spend|amount spent/i.test(c));
  if (headerish(rows[0].cells)) return rows;
  for (let i = 1; i <= 4; i++) {
    if (headerish(rows[i]?.cells ?? [])) return rows.slice(i);
  }
  return rows;
}

export function rowsToObjects(rows: CsvRow[]): { headers: string[]; records: Record<string, string>[] } {
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].cells;
  const records = rows.slice(1).map((row) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h || `column_${i + 1}`] = row.cells[i] ?? '';
    });
    return rec;
  });
  return { headers, records };
}
