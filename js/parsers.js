// Leitura e interpretação das planilhas de origem (Sistema interno e Cielo).
// Os relatórios trazem linhas de cabeçalho/rodapé variáveis, por isso a
// localização da linha de cabeçalho real é feita por busca de texto em vez
// de um índice fixo — tornando o parser resiliente a pequenas mudanças de
// layout entre exportações.

/**
 * Lê um arquivo (File) e retorna o primeiro Workbook do SheetJS.
 */
export async function readWorkbook(file) {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: 'array', cellDates: false });
}

/**
 * Converte a primeira planilha do workbook em uma matriz de linhas (array de arrays).
 */
function sheetToMatrix(workbook, sheetName) {
  const name = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[name];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
}

function normalizeHeaderCell(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

/**
 * Procura, dentro da matriz de linhas, a primeira linha que contenha todas
 * as colunas obrigatórias informadas (comparação por texto, case-insensitive).
 * Retorna o índice da linha ou -1 se não encontrada.
 */
function findHeaderRowIndex(rows, requiredColumns) {
  const required = requiredColumns.map((c) => c.toLowerCase());
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const normalizedCells = row.map(normalizeHeaderCell);
    const hasAll = required.every((col) => normalizedCells.some((cell) => cell === col));
    if (hasAll) return i;
  }
  return -1;
}

function isRowEmpty(row) {
  if (!row) return true;
  return row.every((cell) => cell === null || cell === undefined || String(cell).trim() === '');
}

/**
 * Constrói objetos {coluna: valor} a partir da linha de cabeçalho e das linhas
 * seguintes, parando ao encontrar uma linha vazia ou uma linha de rodapé cuja
 * primeira célula normalizada esteja em `stopWords` (ex.: "total").
 */
function buildRecords(rows, headerRowIndex, stopWords = []) {
  const headerRow = rows[headerRowIndex];
  const columns = headerRow.map((cell) => (cell === null || cell === undefined ? '' : String(cell).trim()));
  const records = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isRowEmpty(row)) continue;

    const firstCell = normalizeHeaderCell(row[0]);
    if (stopWords.includes(firstCell)) break;

    const record = {};
    columns.forEach((col, idx) => {
      if (!col) return;
      record[col] = row[idx] === undefined ? null : row[idx];
    });
    records.push(record);
  }

  return records;
}

const SISTEMA_REQUIRED_COLUMNS = ['Emissão', 'Vencimento', 'Cartão', 'Valor da Venda'];
const CIELO_REQUIRED_COLUMNS = ['Bandeira', 'Valor bruto'];

/**
 * Faz o parse do relatório do sistema interno.
 * Retorna { records, columns } onde records é a lista de linhas de venda
 * (excluindo a linha de total) e columns a ordem original das colunas.
 */
export function parseSistemaWorkbook(workbook) {
  const rows = sheetToMatrix(workbook);
  const headerRowIndex = findHeaderRowIndex(rows, SISTEMA_REQUIRED_COLUMNS);
  if (headerRowIndex === -1) {
    throw new Error(
      'Não foi possível localizar as colunas esperadas (Emissão, Vencimento, Cartão, Valor da Venda) no arquivo do Sistema.'
    );
  }
  const records = buildRecords(rows, headerRowIndex, ['total']);
  const columns = rows[headerRowIndex].filter((c) => c !== null && c !== undefined && String(c).trim() !== '');
  return { records, columns };
}

/**
 * Faz o parse do relatório detalhado de vendas da Cielo.
 * Retorna { records, columns }.
 */
export function parseCieloWorkbook(workbook) {
  const rows = sheetToMatrix(workbook);
  const headerRowIndex = findHeaderRowIndex(rows, CIELO_REQUIRED_COLUMNS);
  if (headerRowIndex === -1) {
    throw new Error(
      'Não foi possível localizar as colunas esperadas (Bandeira, Valor bruto) no arquivo da Cielo.'
    );
  }
  const records = buildRecords(rows, headerRowIndex, []);
  const columns = rows[headerRowIndex].filter((c) => c !== null && c !== undefined && String(c).trim() !== '');
  return { records, columns };
}
