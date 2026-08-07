// Orquestra a aplicação: liga eventos de UI às regras de negócio
// (parsers, motor de conciliação e exportação).

import { readWorkbook, parseSistemaWorkbook, parseCieloWorkbook } from './parsers.js';
import { reconcile } from './reconciliation.js';
import { exportResultsToXlsx } from './export.js';
import * as ui from './ui.js';

const state = {
  files: { sistema: null, cielo: null },
  reconciliation: null, // { results, unmatchedCielo, summary, sistemaColumns, cieloColumns }
  displayRows: [],
  rowsById: new Map(),
  view: {
    search: '',
    status: 'all',
    sortKey: null,
    sortDir: 1,
    page: 1,
    pageSize: 25,
  },
};

ui.initDropzone('sistema', (file) => {
  state.files.sistema = file;
  refreshReconcileButton();
});

ui.initDropzone('cielo', (file) => {
  state.files.cielo = file;
  refreshReconcileButton();
});

function refreshReconcileButton() {
  ui.showUploadError('');
  ui.setReconcileEnabled(Boolean(state.files.sistema && state.files.cielo));
}

ui.onReconcileClick(runReconciliation);
ui.onExportClick(handleExport);

ui.onRowCheckToggle((id, checked) => {
  const row = state.rowsById.get(id);
  if (!row) return;
  row.checked = checked;
  ui.updateRowStatusCell(row);
});

ui.onRowObservacaoInput((id, value) => {
  const row = state.rowsById.get(id);
  if (!row) return;
  row.observacao = value;
});

ui.onSearchInput((value) => {
  state.view.search = value;
  state.view.page = 1;
  renderTable();
});

ui.onStatusFilterChange((status) => {
  state.view.status = status;
  state.view.page = 1;
  renderTable();
});

ui.onSortChange((key) => {
  if (state.view.sortKey === key) {
    state.view.sortDir *= -1;
  } else {
    state.view.sortKey = key;
    state.view.sortDir = 1;
  }
  renderTable();
});

ui.onPageChange((delta) => {
  state.view.page += delta;
  renderTable();
});

async function runReconciliation() {
  ui.showUploadError('');
  ui.showProgress();

  try {
    ui.setProgress(10, 'Lendo arquivo do Sistema…');
    const sistemaWorkbook = await readWorkbook(state.files.sistema);
    const { records: sistemaRecords, columns: sistemaColumns } = parseSistemaWorkbook(sistemaWorkbook);

    ui.setProgress(40, 'Lendo arquivo da Cielo…');
    const cieloWorkbook = await readWorkbook(state.files.cielo);
    const { records: cieloRecords, columns: cieloColumns } = parseCieloWorkbook(cieloWorkbook);

    ui.setProgress(70, 'Comparando registros…');
    await nextFrame();
    const { results, unmatchedCielo, summary } = reconcile(sistemaRecords, cieloRecords);

    ui.setProgress(95, 'Finalizando…');
    await nextFrame();

    state.reconciliation = { results, unmatchedCielo, summary, sistemaColumns, cieloColumns };
    state.displayRows = ui.buildDisplayRows(results);
    state.rowsById = new Map(state.displayRows.map((row) => [row.id, row]));
    state.view.page = 1;

    ui.setProgress(100, 'Concluído!');
    await nextFrame(150);

    ui.renderStats(summary);
    ui.showResults();
    renderTable();
  } catch (err) {
    console.error(err);
    ui.showUploadError(err.message || 'Ocorreu um erro ao processar os arquivos.');
  } finally {
    ui.hideProgress();
  }
}

function renderTable() {
  const filtered = filterAndSort(state.displayRows, state.view);
  state.view.page = ui.renderTable(filtered, state.view.page, state.view.pageSize);
}

function filterAndSort(rows, view) {
  const term = view.search.trim().toLowerCase();

  let filtered = rows.filter((row) => {
    if (view.status !== 'all' && row.status !== view.status) return false;
    if (!term) return true;
    return (
      row.cartao.toLowerCase().includes(term) ||
      row.motivo.toLowerCase().includes(term) ||
      row.valorFormatado.toLowerCase().includes(term) ||
      row.emissao.toLowerCase().includes(term) ||
      row.vencimento.toLowerCase().includes(term) ||
      row.observacao.toLowerCase().includes(term)
    );
  });

  if (view.sortKey) {
    const key = view.sortKey === 'valor' ? 'valorNumero' : view.sortKey;
    filtered = [...filtered].sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * view.sortDir;
      return String(va).localeCompare(String(vb), 'pt-BR') * view.sortDir;
    });
  }

  return filtered;
}

function handleExport() {
  if (!state.reconciliation) return;
  const { results, unmatchedCielo, sistemaColumns, cieloColumns } = state.reconciliation;
  exportResultsToXlsx({ results, displayRows: state.displayRows, unmatchedCielo, sistemaColumns, cieloColumns });
}

function nextFrame(delay = 0) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}
