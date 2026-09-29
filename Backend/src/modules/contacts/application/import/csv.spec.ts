import { decodeSpreadsheet, detectDelimiter, mapColumns, parseCsv } from './csv';

describe('CSV do Excel', () => {
  it('reads UTF-8 (with the BOM Excel adds) and Windows-1252 accents', () => {
    const utf8 = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Nome\nJoão')]);
    expect(decodeSpreadsheet(utf8)).toBe('Nome\nJoão');

    const cp1252 = Buffer.from([0x4a, 0x6f, 0xe3, 0x6f]); // "João" no Excel do Windows
    expect(decodeSpreadsheet(cp1252)).toBe('João');
  });

  it('detects ; (Excel pt-BR) or ,', () => {
    expect(detectDelimiter('Nome;Telefone;E-mail\n')).toBe(';');
    expect(detectDelimiter('name,phone\n')).toBe(',');
  });

  it('parses quoted cells with separators, line breaks and escaped quotes', () => {
    const text = 'Nome;Obs\r\n"Silva; Maria";"linha 1\nlinha 2"\r\n"Diz ""oi""";x\r\n';
    expect(parseCsv(text, ';')).toEqual([
      ['Nome', 'Obs'],
      ['Silva; Maria', 'linha 1\nlinha 2'],
      ['Diz "oi"', 'x'],
    ]);
  });

  it('maps columns by name, ignoring case, accents and spaces', () => {
    expect(mapColumns([' Nome Completo ', 'Celular', 'E-MAIL', 'Cidade'])).toEqual({
      name: 0,
      phone: 1,
      email: 2,
    });
    expect(mapColumns(['WhatsApp'])).toEqual({ phone: 0 });
    expect(mapColumns(['Cidade', 'Estado'])).toEqual({});
  });
});
