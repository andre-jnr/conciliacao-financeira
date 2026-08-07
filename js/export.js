// Geração do arquivo Excel de resultado da conciliação.

/**
 * Monta e dispara o download de um .xlsx contendo:
 *  - Aba "Conciliação": todas as colunas originais do Sistema + todas as
 *    colunas originais da Cielo (quando houver correspondência) + Status +
 *    Motivo da divergência.
 *  - Aba "Cielo sem correspondência": lançamentos da Cielo que não foram
 *    consumidos por nenhuma linha do sistema (ex.: vendas ainda não
 *    lançadas no sistema interno).
 */
export function exportResultsToXlsx({ results, unmatchedCielo, sistemaColumns, cieloColumns, fileName }) {
  const mainRows = results.map(({ sistemaRecord, cieloRecord, status, motivo }) => {
    const row = {};
    sistemaColumns.forEach((col) => {
      row[`Sistema - ${col}`] = sistemaRecord[col] ?? '';
    });
    cieloColumns.forEach((col) => {
      row[`Cielo - ${col}`] = cieloRecord ? cieloRecord[col] ?? '' : '';
    });
    row['Status'] = status;
    row['Motivo da divergência'] = motivo || '';
    return row;
  });

  const unmatchedRows = unmatchedCielo.map((cieloRecord) => {
    const row = {};
    cieloColumns.forEach((col) => {
      row[`Cielo - ${col}`] = cieloRecord[col] ?? '';
    });
    row['Observação'] = 'Encontrado na Cielo sem lançamento correspondente no Sistema';
    return row;
  });

  const workbook = XLSX.utils.book_new();

  const mainSheet = XLSX.utils.json_to_sheet(mainRows);
  XLSX.utils.book_append_sheet(workbook, mainSheet, 'Conciliação');

  if (unmatchedRows.length > 0) {
    const unmatchedSheet = XLSX.utils.json_to_sheet(unmatchedRows);
    XLSX.utils.book_append_sheet(workbook, unmatchedSheet, 'Cielo sem correspondência');
  }

  const finalName = fileName || `conciliacao-financeira-${todayStamp()}.xlsx`;
  XLSX.writeFile(workbook, finalName);
}

function todayStamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
