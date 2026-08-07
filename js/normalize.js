// Funções utilitárias de normalização de texto, valores monetários e datas.
// Mantidas isoladas do restante da aplicação para facilitar testes e reuso
// por futuras regras de conciliação (novos adquirentes, novos critérios).

/**
 * Remove acentos, colapsa espaços e converte para caixa alta.
 * Trata null/undefined retornando string vazia.
 */
export function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacriticos (marcas de acento)
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Extrai a primeira palavra de um texto já normalizado (ou normaliza antes).
 */
export function firstWord(value) {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  return normalized.split(' ')[0];
}

// Mapa de apelidos de bandeiras: ponto único de configuração para lidar com
// nomenclaturas diferentes entre o sistema interno e os relatórios dos
// adquirentes (ex.: Cielo escreve "American Express" por extenso, enquanto o
// sistema abrevia para "Amex"). Adicionar novos adquirentes/variações aqui.
export const BRAND_ALIASES = {
  AMEX: 'AMERICAN EXPRESS',
  AMERICAEXPRESS: 'AMERICAN EXPRESS', // grafia sem espaço observada em exports do sistema
  'AMERICAN EXPRESS': 'AMERICAN EXPRESS',
  MASTER: 'MASTERCARD',
  MASTERCARD: 'MASTERCARD',
  MAESTRO: 'MASTERCARD', // Maestro é a bandeira de débito da Mastercard
  VISA: 'VISA',
  ELO: 'ELO',
  PIX: 'PIX',
  HIPERCARD: 'HIPERCARD',
  DINERS: 'DINERS CLUB',
  'DINERS CLUB': 'DINERS CLUB',
};

/**
 * Converte uma bandeira/cartão normalizado para sua forma canônica,
 * permitindo comparação consistente entre sistema e adquirente.
 */
export function canonicalBrand(normalizedBrand) {
  if (!normalizedBrand) return '';
  return BRAND_ALIASES[normalizedBrand] || normalizedBrand;
}

/**
 * Converte um valor monetário (número ou texto em diversos formatos) para
 * número em ponto flutuante. Trata:
 *  - números já nativos (retornados como estão)
 *  - prefixos de moeda ("R$")
 *  - separador de milhar "." e decimal ","
 *  - separador de milhar "," e decimal "." (formato en-US)
 *  - valores nulos/vazios (retorna NaN)
 */
export function parseCurrency(value) {
  if (value === null || value === undefined || value === '') return NaN;
  if (typeof value === 'number') return value;

  let str = String(value).trim();
  if (!str) return NaN;

  str = str.replace(/R\$\s?/gi, '').replace(/\s/g, '');
  if (!str) return NaN;

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    // O separador decimal é o último símbolo (, ou .) encontrado na string.
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (hasDot) {
    // Único ponto: decimal. Múltiplos pontos: milhar (raro nestes relatórios).
    const parts = str.split('.');
    if (parts.length > 2) {
      str = parts.join('');
    }
  }

  const num = parseFloat(str);
  return Number.isNaN(num) ? NaN : num;
}

/**
 * Arredonda para 2 casas decimais evitando erros de ponto flutuante,
 * usado para comparar valores monetários com tolerância de centavo.
 */
export function roundCents(value) {
  if (Number.isNaN(value)) return NaN;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Compara dois valores monetários com tolerância de meio centavo. */
export function currenciesEqual(a, b) {
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(roundCents(a) - roundCents(b)) < 0.005;
}

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/**
 * Converte um número serial de data do Excel para um objeto Date (UTC).
 */
export function excelSerialToDate(serial) {
  return new Date(EXCEL_EPOCH_MS + Math.round(serial) * 86400000);
}

/**
 * Formata uma célula de data (serial numérico, Date ou string) para dd/mm/aaaa.
 * Retorna a string original se não for possível interpretar como data.
 */
export function formatDateCell(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = excelSerialToDate(value);
    return formatDateUTC(date);
  }
  if (value instanceof Date) {
    return formatDateUTC(value);
  }
  return String(value).trim();
}

function formatDateUTC(date) {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/** Formata número como moeda brasileira para exibição. */
export function formatBRL(value) {
  if (Number.isNaN(value) || value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
