/* =============================================
   CONSULTA DE LOTES — script.js
   =============================================
   CONFIGURAÇÃO: edite as constantes abaixo
   ============================================= */

const CONFIG = {
  // ← Cole aqui o ID da sua planilha do Google Sheets
  SPREADSHEET_ID: 'SEU_SPREADSHEET_ID_AQUI',

  // ← Cole aqui a sua API Key do Google Sheets
  API_KEY: 'SUA_API_KEY_AQUI',

  // Colunas que aparecem nos CHIPS do card (resumo visível)
  CARD_VISIBLE_COLS: ['DATA', 'ENTREGA', 'SCs', 'BEBIDA', 'CATA'],

  // Coluna de busca principal
  SEARCH_COL: 'NOME',

  // Colunas com filtro por dropdown (excluindo NOME e colunas muito únicas)
  FILTER_COLS: ['ENTREGA', 'BEBIDA', 'CATA'],
};

/* ── Estado Global ── */
const state = {
  sheets: [],         // lista de abas [{title, index}]
  activeSheet: null,  // aba selecionada
  allRows: [],        // todos os registros da aba atual
  filteredRows: [],   // registros após filtro
  headers: [],        // cabeçalhos da planilha
  filters: {},        // { col: valor }
  searchTerm: '',
  loading: false,
};

/* ── DOM Refs ── */
const $ = id => document.getElementById(id);
const sheetTabs      = $('sheetTabs');
const searchInput    = $('searchInput');
const clearSearchBtn = $('clearSearch');
const filterToggleBtn= $('filterToggleBtn');
const filterPanel    = $('filterPanel');
const filterGrid     = $('filterGrid');
const filterBadge    = $('filterBadge');
const clearFiltersBtn= $('clearFiltersBtn');
const stateLoading   = $('stateLoading');
const stateEmpty     = $('stateEmpty');
const stateError     = $('stateError');
const stateErrorMsg  = $('stateErrorMsg');
const retryBtn       = $('retryBtn');
const cardsList      = $('cardsList');
const statusBar      = $('statusBar');
const modalOverlay   = $('modalOverlay');
const modalSheet     = $('modalSheet');
const modalTitle     = $('modalTitle');
const modalBody      = $('modalBody');
const modalClose     = $('modalClose');
const themeToggle    = $('themeToggle');

/* ═══════════════════════════════════════
   INICIALIZAÇÃO
═══════════════════════════════════════ */
async function init() {
  loadTheme();
  showState('loading');
  try {
    await loadSheets();
  } catch (e) {
    showError('Não foi possível carregar a planilha. Verifique a API Key e o ID.');
    console.error(e);
  }
}

/* ═══════════════════════════════════════
   GOOGLE SHEETS API
═══════════════════════════════════════ */

// Busca lista de abas (sheets) da planilha
async function loadSheets() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}?key=${CONFIG.API_KEY}&fields=sheets.properties`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  state.sheets = data.sheets.map(s => ({
    title: s.properties.title,
    index: s.properties.index,
  }));

  renderSheetTabs();
  selectSheet(state.sheets[0].title);
}

// Busca dados de uma aba específica
async function loadSheetData(sheetTitle) {
  showState('loading');
  const range = encodeURIComponent(`${sheetTitle}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${range}?key=${CONFIG.API_KEY}&valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  const rows = data.values || [];
  if (rows.length < 2) {
    state.headers = rows[0] || [];
    state.allRows = [];
  } else {
    state.headers = rows[0].map(h => h.toString().trim().toUpperCase());
    state.allRows = rows.slice(1).map(row => {
      const obj = {};
      state.headers.forEach((h, i) => {
        obj[h] = (row[i] !== undefined ? row[i].toString().trim() : '');
      });
      return obj;
    });
  }

  state.filters = {};
  state.searchTerm = searchInput.value.trim();
  buildFilterUI();
  applyFilters();
}

/* ═══════════════════════════════════════
   ABAS (SHEET TABS)
═══════════════════════════════════════ */
function renderSheetTabs() {
  sheetTabs.innerHTML = '';
  state.sheets.forEach(sheet => {
    const btn = document.createElement('button');
    btn.className = 'sheet-tab';
    btn.textContent = sheet.title;
    btn.dataset.title = sheet.title;
    btn.addEventListener('click', () => selectSheet(sheet.title));
    sheetTabs.appendChild(btn);
  });
}

function selectSheet(title) {
  state.activeSheet = title;
  document.querySelectorAll('.sheet-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.title === title);
  });
  loadSheetData(title).catch(e => {
    showError('Erro ao carregar dados desta aba.');
    console.error(e);
  });
}

/* ═══════════════════════════════════════
   FILTROS
═══════════════════════════════════════ */
function buildFilterUI() {
  filterGrid.innerHTML = '';

  const filterableCols = CONFIG.FILTER_COLS.filter(c =>
    state.headers.includes(c.toUpperCase())
  );

  filterableCols.forEach(col => {
    const colUpper = col.toUpperCase();
    // Valores únicos desta coluna
    const values = [...new Set(
      state.allRows
        .map(r => r[colUpper] || '')
        .filter(v => v !== '')
    )].sort();

    if (values.length === 0) return;

    const group = document.createElement('div');
    group.className = 'filter-group';

    const label = document.createElement('label');
    label.textContent = colUpper;

    const select = document.createElement('select');
    select.className = 'filter-select';
    select.dataset.col = colUpper;

    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = 'Todos';
    select.appendChild(optAll);

    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });

    // Restaurar valor se já havia filtro
    if (state.filters[colUpper]) {
      select.value = state.filters[colUpper];
    }

    select.addEventListener('change', () => {
      if (select.value === '') {
        delete state.filters[colUpper];
      } else {
        state.filters[colUpper] = select.value;
      }
      applyFilters();
      updateFilterBadge();
    });

    group.appendChild(label);
    group.appendChild(select);
    filterGrid.appendChild(group);
  });
}

function updateFilterBadge() {
  const count = Object.keys(state.filters).length;
  if (count > 0) {
    filterBadge.textContent = count;
    filterBadge.style.display = 'inline';
    filterToggleBtn.classList.add('active');
  } else {
    filterBadge.style.display = 'none';
    filterToggleBtn.classList.remove('active');
  }
}

/* ═══════════════════════════════════════
   BUSCA E FILTROS
═══════════════════════════════════════ */
function applyFilters() {
  const term = state.searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  state.filteredRows = state.allRows.filter(row => {
    // Busca por NOME
    if (term) {
      const nome = (row[CONFIG.SEARCH_COL] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!nome.includes(term)) return false;
    }

    // Filtros por coluna
    for (const [col, val] of Object.entries(state.filters)) {
      if (val && (row[col] || '') !== val) return false;
    }

    return true;
  });

  renderCards();
  updateStatus();
}

/* ═══════════════════════════════════════
   RENDER CARDS
═══════════════════════════════════════ */
function renderCards() {
  cardsList.innerHTML = '';

  if (state.filteredRows.length === 0) {
    showState('empty');
    return;
  }

  showState('list');

  state.filteredRows.forEach((row, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.animationDelay = `${Math.min(idx * 30, 300)}ms`;

    // Nome
    const name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = row[CONFIG.SEARCH_COL] || '(sem nome)';
    card.appendChild(name);

    // Chips dos campos visíveis
    const chips = document.createElement('div');
    chips.className = 'card-chips';

    CONFIG.CARD_VISIBLE_COLS.forEach(col => {
      const colUpper = col.toUpperCase();
      if (colUpper === CONFIG.SEARCH_COL) return; // já mostrado no nome
      const val = row[colUpper];
      // Não mostrar ENTREGA se vazio
      if (colUpper === 'ENTREGA' && !val) return;

      const chip = document.createElement('div');
      chip.className = 'chip' + (colUpper === 'SCs' || colUpper === 'VALOR' ? ' highlight' : '');

      const lbl = document.createElement('span');
      lbl.className = 'chip-label';
      lbl.textContent = colUpper;

      const vEl = document.createElement('span');
      vEl.className = 'chip-value' + (!val ? ' empty' : '');
      vEl.textContent = val || '—';

      chip.appendChild(lbl);
      chip.appendChild(vEl);
      chips.appendChild(chip);
    });

    card.appendChild(chips);

    // Indicador "ver mais"
    const more = document.createElement('div');
    more.className = 'card-more';
    more.textContent = '▸ Ver detalhes';
    card.appendChild(more);

    card.addEventListener('click', () => openModal(row));
    cardsList.appendChild(card);
  });
}

/* ═══════════════════════════════════════
   MODAL
═══════════════════════════════════════ */
function openModal(row) {
  modalTitle.textContent = row[CONFIG.SEARCH_COL] || '(sem nome)';
  modalBody.innerHTML = '';

  // Mostrar todas as colunas EXCETO NOME (já no título)
  state.headers.forEach(col => {
    if (col === CONFIG.SEARCH_COL) return;

    const val = row[col] || '';
    const div = document.createElement('div');
    div.className = 'modal-row';

    const lbl = document.createElement('span');
    lbl.className = 'modal-row-label';
    lbl.textContent = col;

    const vEl = document.createElement('span');
    const isHighlight = ['SCs', 'VALOR', 'BEBIDA', 'CATA'].includes(col);
    vEl.className = 'modal-row-value' + (!val ? ' empty' : isHighlight ? ' highlight' : '');
    vEl.textContent = val || '—';

    div.appendChild(lbl);
    div.appendChild(vEl);
    modalBody.appendChild(div);
  });

  modalOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.style.display = 'none';
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════════
   STATUS BAR
═══════════════════════════════════════ */
function updateStatus() {
  const total = state.allRows.length;
  const shown = state.filteredRows.length;
  if (total === 0) {
    statusBar.textContent = 'Nenhum registro encontrado nesta aba.';
    return;
  }
  if (shown === total) {
    statusBar.textContent = `${total} registro${total !== 1 ? 's' : ''}`;
  } else {
    statusBar.textContent = `${shown} de ${total} registro${total !== 1 ? 's' : ''}`;
  }
}

/* ═══════════════════════════════════════
   ESTADOS DA UI
═══════════════════════════════════════ */
function showState(s) {
  stateLoading.style.display = s === 'loading' ? 'flex' : 'none';
  stateEmpty.style.display   = s === 'empty'   ? 'flex' : 'none';
  stateError.style.display   = s === 'error'   ? 'flex' : 'none';
  cardsList.style.display    = s === 'list'    ? 'flex' : 'none';
}

function showError(msg) {
  stateErrorMsg.textContent = msg;
  showState('error');
}

/* ═══════════════════════════════════════
   TEMA
═══════════════════════════════════════ */
function loadTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
}

/* ═══════════════════════════════════════
   EVENTOS
═══════════════════════════════════════ */

// Busca
searchInput.addEventListener('input', () => {
  state.searchTerm = searchInput.value.trim();
  clearSearchBtn.classList.toggle('visible', state.searchTerm.length > 0);
  applyFilters();
});

// Limpar busca
clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  state.searchTerm = '';
  clearSearchBtn.classList.remove('visible');
  searchInput.focus();
  applyFilters();
});

// Toggle filtros
filterToggleBtn.addEventListener('click', () => {
  filterPanel.classList.toggle('open');
  filterToggleBtn.classList.toggle('active', filterPanel.classList.contains('open'));
});

// Limpar todos os filtros
clearFiltersBtn.addEventListener('click', () => {
  state.filters = {};
  document.querySelectorAll('.filter-select').forEach(s => s.value = '');
  updateFilterBadge();
  applyFilters();
});

// Modal
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

// Fechar modal com swipe down
let touchStartY = 0;
modalSheet.addEventListener('touchstart', e => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });
modalSheet.addEventListener('touchend', e => {
  const diff = e.changedTouches[0].clientY - touchStartY;
  if (diff > 80) closeModal();
}, { passive: true });

// Retry
retryBtn.addEventListener('click', () => {
  if (state.activeSheet) {
    loadSheetData(state.activeSheet).catch(e => showError('Erro ao carregar dados.'));
  } else {
    init();
  }
});

// Tema
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// Fechar painel de filtros ao clicar fora (em mobile)
document.addEventListener('click', e => {
  if (
    filterPanel.classList.contains('open') &&
    !filterPanel.contains(e.target) &&
    !filterToggleBtn.contains(e.target)
  ) {
    filterPanel.classList.remove('open');
  }
});

/* ═══════════════════════════════════════
   SERVICE WORKER (PWA)
═══════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

/* ── START ── */
init();
