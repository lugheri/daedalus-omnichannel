/**
 * Leitura de planilhas CSV como o Excel em português as salva: separador `;`
 * (ou `,`), campos entre aspas com quebras de linha e aspas duplicadas, e
 * arquivo em UTF-8 ou Windows-1252 (o padrão do Excel no Windows).
 */

/** Texto do arquivo: UTF-8 se for válido; senão Windows-1252 (acentos do Excel). */
export function decodeSpreadsheet(content: Buffer): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch {
    text = new TextDecoder('windows-1252').decode(content);
  }
  // BOM do "CSV UTF-8" do Excel (U+FEFF no início do arquivo).
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Separador pela primeira linha: o que aparece mais entre `;` e `,`. */
export function detectDelimiter(text: string): ';' | ',' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const count = (char: string) => firstLine.split(char).length - 1;
  return count(';') >= count(',') ? ';' : ',';
}

/** Linhas → células. Aspas: `"a;b"` é uma célula; `""` dentro de aspas é uma aspa. */
export function parseCsv(text: string, delimiter: ';' | ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export type ContactColumn = 'name' | 'phone' | 'email';

/** Nomes de coluna aceitos (sem acento, minúsculos). */
const COLUMN_ALIASES: Record<ContactColumn, string[]> = {
  name: ['nome', 'nome completo', 'name', 'cliente', 'contato'],
  phone: ['telefone', 'celular', 'whatsapp', 'fone', 'tel', 'phone', 'mobile'],
  email: ['email', 'e-mail', 'mail'],
};

function normalizeHeader(header: string): string {
  // NFD separa "ã" em "a" + til; \p{Diacritic} remove os acentos soltos.
  return header
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

/** Qual coluna do arquivo é nome, telefone e e-mail (a primeira que bater). */
export function mapColumns(header: string[]): Partial<Record<ContactColumn, number>> {
  const normalized = header.map(normalizeHeader);
  const map: Partial<Record<ContactColumn, number>> = {};
  for (const [column, aliases] of Object.entries(COLUMN_ALIASES) as [ContactColumn, string[]][]) {
    const index = normalized.findIndex((h) => aliases.includes(h));
    if (index >= 0) map[column] = index;
  }
  return map;
}
