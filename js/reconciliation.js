// Motor de conciliação: cruza os registros do Sistema com os da Cielo
// usando bandeira (primeira palavra do campo Cartão) + valor da venda.
// Desenhado para permitir, no futuro, plugar outros adquirentes (Rede,
// Stone, Getnet...) bastando fornecer um extractor equivalente a
// `extractCieloKey` e reaproveitando `reconcile`.

import { normalizeText, firstWord, canonicalBrand, parseCurrency, currenciesEqual, roundCents } from './normalize.js';

export const STATUS = {
  CONSTA: 'Consta',
  NAO_CONSTA: 'Não Consta',
};

export const MOTIVO = {
  BANDEIRA_DIFERENTE: 'Bandeira diferente',
  VALOR_DIFERENTE: 'Valor diferente',
  NAO_ENCONTRADO: 'Registro não encontrado na Cielo',
  DUPLICADO: 'Registro duplicado',
};

function buildKey(brand, value) {
  return `${brand}|${roundCents(value).toFixed(2)}`;
}

/**
 * Normaliza um registro do sistema, extraindo a bandeira (primeira palavra
 * do campo Cartão) e o valor numérico da venda.
 */
function normalizeSistemaRecord(record) {
  const brand = canonicalBrand(firstWord(record['Cartão']));
  const value = parseCurrency(record['Valor da Venda']);
  return { brand, value, valid: brand !== '' && !Number.isNaN(value) };
}

/**
 * Normaliza um registro da Cielo, extraindo a bandeira e o valor bruto.
 */
function normalizeCieloRecord(record) {
  const brand = canonicalBrand(normalizeText(record['Bandeira']));
  const value = parseCurrency(record['Valor bruto']);
  return { brand, value, valid: brand !== '' && !Number.isNaN(value) };
}

/**
 * Executa a conciliação entre os registros do sistema e da Cielo.
 *
 * Estratégia: casamento 1-para-1 guloso, na ordem em que os registros do
 * sistema aparecem. Cada registro da Cielo só pode ser consumido por um
 * único registro do sistema, o que permite detectar duplicidades quando o
 * sistema tem mais ocorrências de uma combinação bandeira+valor do que a
 * Cielo.
 *
 * Retorna a lista de resultados (um por linha do sistema) já com status,
 * motivo da divergência e o registro Cielo correspondente (quando houver).
 */
export function reconcile(sistemaRecords, cieloRecords) {
  const cieloBuckets = new Map(); // key -> [{ record, used }]
  const cieloByValue = new Map(); // valueKey -> [{ record, used, brand }]
  const cieloByBrand = new Map(); // brand -> [{ record, used, value }]

  cieloRecords.forEach((record) => {
    const norm = normalizeCieloRecord(record);
    if (!norm.valid) return;

    const entry = { record, used: false, brand: norm.brand, value: norm.value };
    const key = buildKey(norm.brand, norm.value);
    if (!cieloBuckets.has(key)) cieloBuckets.set(key, []);
    cieloBuckets.get(key).push(entry);

    const valueKey = roundCents(norm.value).toFixed(2);
    if (!cieloByValue.has(valueKey)) cieloByValue.set(valueKey, []);
    cieloByValue.get(valueKey).push(entry);

    if (!cieloByBrand.has(norm.brand)) cieloByBrand.set(norm.brand, []);
    cieloByBrand.get(norm.brand).push(entry);
  });

  const results = sistemaRecords.map((sistemaRecord) => {
    const norm = normalizeSistemaRecord(sistemaRecord);

    if (!norm.valid) {
      return {
        sistemaRecord,
        cieloRecord: null,
        status: STATUS.NAO_CONSTA,
        motivo: 'Linha inválida (Cartão ou Valor da Venda ausente/ilegível)',
      };
    }

    const key = buildKey(norm.brand, norm.value);
    const bucket = cieloBuckets.get(key);
    const match = bucket && bucket.find((entry) => !entry.used);

    if (match) {
      match.used = true;
      return {
        sistemaRecord,
        cieloRecord: match.record,
        status: STATUS.CONSTA,
        motivo: '',
      };
    }

    let motivo;
    if (bucket && bucket.length > 0) {
      // Existiam correspondências exatas, mas todas já foram consumidas por
      // outras linhas do sistema: indica duplicidade no sistema.
      motivo = MOTIVO.DUPLICADO;
    } else {
      const valueKey = roundCents(norm.value).toFixed(2);
      const sameValue = (cieloByValue.get(valueKey) || []).some((entry) => !entry.used);
      const sameBrand = (cieloByBrand.get(norm.brand) || []).some((entry) => !entry.used);
      if (sameValue) {
        motivo = MOTIVO.BANDEIRA_DIFERENTE;
      } else if (sameBrand) {
        motivo = MOTIVO.VALOR_DIFERENTE;
      } else {
        motivo = MOTIVO.NAO_ENCONTRADO;
      }
    }

    return {
      sistemaRecord,
      cieloRecord: null,
      status: STATUS.NAO_CONSTA,
      motivo,
    };
  });

  const unmatchedCielo = [];
  cieloBuckets.forEach((bucket) => {
    bucket.forEach((entry) => {
      if (!entry.used) unmatchedCielo.push(entry.record);
    });
  });

  const conciliados = results.filter((r) => r.status === STATUS.CONSTA).length;
  const totalSistema = sistemaRecords.length;
  const totalCielo = cieloRecords.length;

  return {
    results,
    unmatchedCielo,
    summary: {
      totalSistema,
      totalCielo,
      conciliados,
      naoConciliados: totalSistema - conciliados,
      percentual: totalSistema > 0 ? (conciliados / totalSistema) * 100 : 0,
    },
  };
}

export { currenciesEqual };
