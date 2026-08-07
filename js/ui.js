// Camada de interface: manipulação do DOM, eventos e renderização.
// Não conhece regras de negócio — recebe dados já processados e apenas exibe.

import { formatDateCell, formatBRL } from './normalize.js';
import { STATUS } from './reconciliation.js';

const els = {
  dropzoneSistema: document.getElementById('dropzone-sistema'),
  dropzoneCielo: document.getElementById('dropzone-cielo'),
  fileSistema: document.getElementById('file-sistema'),
  fileCielo: document.getElementById('file-cielo'),
  btnReconcile: document.getElementById('btn-reconcile'),
  uploadError: document.getElementById('upload-error'),
  progressArea: document.getElementById('progress-area'),
  progressLabel: document.getElementById('progress-label'),
  progressFill: document.getElementById('progress-fill'),
  resultsSection: document.getElementById('results-section'),
  statTotalSistema: document.getElementById('stat-total-sistema'),
  statTotalCielo: document.getElementById('stat-total-cielo'),
  statConciliados: document.getElementById('stat-conciliados'),
  statNaoConciliados: document.getElementById('stat-nao-conciliados'),
  statPercentual: document.getElementById('stat-percentual'),
  searchInput: document.getElementById('search-input'),
  statusFilterGroup: document.querySelector('.status-filter'),
  btnExport: document.getElementById('btn-export'),
  tbody: document.getElementById('result-tbody'),
  tableEmpty: document.getElementById('table-empty'),
  paginationInfo: document.getElementById('pagination-info'),
  paginationPage: document.getElementById('pagination-page'),
  btnPrevPage: document.getElementById('btn-prev-page'),
  btnNextPage: document.getElementById('btn-next-page'),
  tableHeaders: document.querySelectorAll('.result-table thead th'),
};

export function initDropzone(kind, onFileChange) {
  const zone = kind === 'sistema' ? els.dropzoneSistema : els.dropzoneCielo;
  const input = kind === 'sistema' ? els.fileSistema : els.fileCielo;
  const filenameEl = zone.querySelector('[data-role="filename"]');
  const removeBtn = zone.querySelector('[data-role="remove"]');
  const hintEl = zone.querySelector('.dropzone__hint');

  function setFile(file) {
    if (file) {
      zone.classList.add('has-file');
      filenameEl.hidden = false;
      filenameEl.textContent = file.name;
      removeBtn.hidden = false;
      hintEl.hidden = true;
    } else {
      zone.classList.remove('has-file');
      filenameEl.hidden = true;
      removeBtn.hidden = true;
      hintEl.hidden = false;
    }
    onFileChange(file);
  }

  zone.addEventListener('click', (e) => {
    if (e.target === removeBtn) return;
    input.click();
  });

  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });

  input.addEventListener('change', () => {
    setFile(input.files[0] || null);
  });

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    input.value = '';
    setFile(null);
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.remove('is-dragover');
    });
  });

  zone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) {
      input.files = e.dataTransfer.files;
      setFile(file);
    }
  });
}

export function setReconcileEnabled(enabled) {
  els.btnReconcile.disabled = !enabled;
}

export function onReconcileClick(handler) {
  els.btnReconcile.addEventListener('click', handler);
}

export function onExportClick(handler) {
  els.btnExport.addEventListener('click', handler);
}

export function showUploadError(message) {
  if (!message) {
    els.uploadError.hidden = true;
    els.uploadError.textContent = '';
    return;
  }
  els.uploadError.hidden = false;
  els.uploadError.textContent = message;
}

export function showProgress() {
  els.progressArea.hidden = false;
  els.resultsSection.hidden = true;
}

export function hideProgress() {
  els.progressArea.hidden = true;
}

export function setProgress(percent, label) {
  els.progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  if (label) els.progressLabel.textContent = label;
}

export function renderStats(summary) {
  els.statTotalSistema.textContent = summary.totalSistema.toLocaleString('pt-BR');
  els.statTotalCielo.textContent = summary.totalCielo.toLocaleString('pt-BR');
  els.statConciliados.textContent = summary.conciliados.toLocaleString('pt-BR');
  els.statNaoConciliados.textContent = summary.naoConciliados.toLocaleString('pt-BR');
  els.statPercentual.textContent = `${summary.percentual.toFixed(1)}%`;
}

export function showResults() {
  els.resultsSection.hidden = false;
}

export function onSearchInput(handler) {
  els.searchInput.addEventListener('input', (e) => handler(e.target.value));
}

export function onStatusFilterChange(handler) {
  els.statusFilterGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    els.statusFilterGroup.querySelectorAll('.chip').forEach((c) => c.classList.remove('chip--active'));
    btn.classList.add('chip--active');
    handler(btn.dataset.status);
  });
}

export function onSortChange(handler) {
  els.tableHeaders.forEach((th) => {
    th.addEventListener('click', () => handler(th.dataset.sort));
  });
}

export function onPageChange(handler) {
  els.btnPrevPage.addEventListener('click', () => handler(-1));
  els.btnNextPage.addEventListener('click', () => handler(1));
}

/**
 * Converte os resultados da conciliação em linhas prontas para exibição
 * (Emissão, Vencimento, Cartão, Valor da Venda, Status, Motivo), acrescidas
 * dos campos de revisão manual (Conferido / Observação) preenchidos pela
 * equipe. `id` é o índice original em `results` — estável mesmo quando a
 * linha é reordenada ou filtrada na tela, usado para localizar a linha ao
 * processar o clique no checkbox ou a digitação na observação.
 */
export function buildDisplayRows(results) {
  return results.map((r, index) => {
    const rec = r.sistemaRecord;
    const valorNumero = Number(rec['Valor da Venda']);
    return {
      id: index,
      emissao: formatDateCell(rec['Emissão']),
      vencimento: formatDateCell(rec['Vencimento']),
      cartao: String(rec['Cartão'] ?? '').trim(),
      valorFormatado: formatBRL(valorNumero),
      valorNumero,
      status: r.status,
      motivo: r.motivo || '',
      checked: false,
      observacao: '',
    };
  });
}

/** Determina rótulo e classe do badge de status, considerando a revisão manual. */
function statusBadgeInfo(row) {
  if (row.checked) return { label: 'Conferido', cls: 'status-badge--conferido' };
  if (row.status === STATUS.CONSTA) return { label: row.status, cls: 'status-badge--consta' };
  return { label: row.status, cls: 'status-badge--nao-consta' };
}

function rowClasses(row) {
  if (row.checked) return 'row--conferido';
  if (row.status === STATUS.NAO_CONSTA) return 'row--nao-consta';
  return '';
}

export function onRowCheckToggle(handler) {
  els.tbody.addEventListener('change', (e) => {
    const checkbox = e.target.closest('.row-check');
    if (!checkbox) return;
    const id = Number(checkbox.closest('tr').dataset.rowId);
    handler(id, checkbox.checked);
  });
}

export function onRowObservacaoInput(handler) {
  els.tbody.addEventListener('input', (e) => {
    const input = e.target.closest('.row-observacao');
    if (!input) return;
    const id = Number(input.closest('tr').dataset.rowId);
    handler(id, input.value);
  });
}

/** Atualiza apenas o badge de status e o destaque da linha após marcar/desmarcar "Conferido". */
export function updateRowStatusCell(row) {
  const tr = els.tbody.querySelector(`tr[data-row-id="${row.id}"]`);
  if (!tr) return;
  const { label, cls } = statusBadgeInfo(row);
  tr.querySelector('.status-cell').innerHTML = `<span class="status-badge ${cls}">${escapeHtml(label)}</span>`;
  tr.className = rowClasses(row);
}

export function renderTable(rows, page, pageSize) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  els.tbody.innerHTML = '';
  els.tableEmpty.hidden = pageRows.length > 0;

  pageRows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.dataset.rowId = String(row.id);
    tr.className = rowClasses(row);

    const { label, cls } = statusBadgeInfo(row);

    tr.innerHTML = `
      <td>${escapeHtml(row.emissao)}</td>
      <td>${escapeHtml(row.vencimento)}</td>
      <td>${escapeHtml(row.cartao)}</td>
      <td>${escapeHtml(row.valorFormatado)}</td>
      <td class="status-cell"><span class="status-badge ${cls}">${escapeHtml(label)}</span></td>
      <td class="motivo-cell">${escapeHtml(row.motivo)}</td>
      <td class="check-cell"><input type="checkbox" class="row-check" aria-label="Marcar como conferido"></td>
      <td class="obs-cell"><input type="text" class="row-observacao" placeholder="Escreva uma observação…" aria-label="Observação"></td>
    `;

    tr.querySelector('.row-check').checked = row.checked;
    tr.querySelector('.row-observacao').value = row.observacao;

    els.tbody.appendChild(tr);
  });

  els.paginationInfo.textContent =
    total === 0
      ? 'Nenhum registro'
      : `Mostrando ${start + 1}–${Math.min(start + pageSize, total)} de ${total} registros`;
  els.paginationPage.textContent = `${safePage} / ${totalPages}`;
  els.btnPrevPage.disabled = safePage <= 1;
  els.btnNextPage.disabled = safePage >= totalPages;

  return safePage;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}
