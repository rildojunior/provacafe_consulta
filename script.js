/* =============================================
   CONSULTA DE LOTES — script.js
   Configuração via interface (localStorage)
   ============================================= */

// Configurações fixas (estrutura da planilha)
const CONFIG = {
  CARD_VISIBLE_COLS: ['DATA', 'ENTREGA', 'SCs', 'BEBIDA', 'CATA', '17/18'],
  SEARCH_COL: 'NOME',
  FILTER_COLS: ['DATA', 'ENTREGA', 'BEBIDA'],
};

// Configurações salvas pelo usuário
function getSavedConfig() {
  return {
    SPREADSHEET_ID: localStorage.getItem('cfg_sheet_id') || '',
    API_KEY:        localStorage.getItem('cfg_api_key')  || '',
  };
}
function saveConfig(id, key) {
  localStorage.setItem('cfg_sheet_id', id.trim());
  localStorage.setItem('cfg_api_key',  key.trim());
}
function clearConfig() {
  localStorage.removeItem('cfg_sheet_id');
  localStorage.removeItem('cfg_api_key');
}

/* ── Estado Global ── */
const state = {
  sheets: [],
  activeSheet: null,
  allRows: [],
  filteredRows: [],
  headers: [],
  filters: {},
  searchTerm: '',
};

/* ── DOM Refs ── */
const $ = id => document.getElementById(id);
const sheetTabs       = $('sheetTabs');
const searchInput     = $('searchInput');
const clearSearchBtn  = $('clearSearch');
const filterToggleBtn = $('filterToggleBtn');
const filterPanel     = $('filterPanel');
const filterGrid      = $('filterGrid');
const filterBadge     = $('filterBadge');
const clearFiltersBtn = $('clearFiltersBtn');
const stateLoading    = $('stateLoading');
const stateEmpty      = $('stateEmpty');
const stateError      = $('stateError');
const stateErrorMsg   = $('stateErrorMsg');
const retryBtn        = $('retryBtn');
const cardsList       = $('cardsList');
const statusBar       = $('statusBar');
const modalOverlay    = $('modalOverlay');
const modalSheet      = $('modalSheet');
const modalTitle      = $('modalTitle');
const modalBody       = $('modalBody');
const modalClose      = $('modalClose');
const themeToggle     = $('themeToggle');
const configBtn       = $('configBtn');
const configOverlay   = $('configOverlay');
const configClose     = $('configClose');
const inputSheetId    = $('inputSpreadsheetId');
const inputApiKey     = $('inputApiKey');
const configSaveBtn   = $('configSaveBtn');
const configClearBtn  = $('configClearBtn');
const configStatus    = $('configStatus');
const toggleApiKey    = $('toggleApiKey');
const helpId          = $('helpId');
const helpKey         = $('helpKey');
const tipId           = $('tipId');
const tipKey          = $('tipKey');

/* ═══════════════════════════════════════
   INICIALIZAÇÃO
═══════════════════════════════════════ */
async function init() {
  loadTheme();
  updateConfigBtnStyle();

  const cfg = getSavedConfig();
  if (!cfg.SPREADSHEET_ID || !cfg.API_KEY) {
    showWelcomeScreen();
    return;
  }

  showState('loading');
  try {
    await loadSheets();
  } catch (e) {
    showError('Não foi possível carregar a planilha.\nVerifique a API Key e o ID nas configurações (⚙️).');
    console.error(e);
  }
}

/* ── Tela de boas-vindas (sem config) ── */
function showWelcomeScreen() {
  showState('welcome');
}

/* ═══════════════════════════════════════
   GOOGLE SHEETS API
═══════════════════════════════════════ */
async function loadSheets() {
  const cfg = getSavedConfig();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cfg.SPREADSHEET_ID}?key=${cfg.API_KEY}&fields=sheets.properties`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();

  state.sheets = data.sheets.map(s => ({
    title: s.properties.title,
    index: s.properties.index,
  }));

  renderSheetTabs();
  selectSheet(state.sheets[0].title);
}

async function loadSheetData(sheetTitle) {
  showState('loading');
  const cfg = getSavedConfig();
  const range = encodeURIComponent(sheetTitle);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cfg.SPREADSHEET_ID}/values/${range}?key=${cfg.API_KEY}&valueRenderOption=FORMATTED_VALUE`;
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

    const group = document.createElement('div');
    group.className = 'filter-group';

    const label = document.createElement('label');
    label.textContent = colUpper;
    group.appendChild(label);

    // DATA usa campo de texto (busca parcial)
    if (colUpper === 'DATA') {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'filter-select';
      input.placeholder = 'Ex: 01/2025';
      input.dataset.col = colUpper;
      input.value = state.filters[colUpper] || '';
      input.addEventListener('input', () => {
        if (input.value.trim() === '') delete state.filters[colUpper];
        else state.filters[colUpper] = input.value.trim();
        applyFilters();
        updateFilterBadge();
      });
      group.appendChild(input);
      filterGrid.appendChild(group);
      return;
    }

    // Demais colunas: dropdown com valores únicos
    const values = [...new Set(
      state.allRows.map(r => r[colUpper] || '').filter(v => v !== '')
    )].sort();
    if (values.length === 0) return;

    const select = document.createElement('select');
    select.className = 'filter-select';
    select.dataset.col = colUpper;

    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = 'Todos';
    select.appendChild(optAll);

    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      select.appendChild(opt);
    });

    if (state.filters[colUpper]) select.value = state.filters[colUpper];

    select.addEventListener('change', () => {
      if (select.value === '') delete state.filters[colUpper];
      else state.filters[colUpper] = select.value;
      applyFilters();
      updateFilterBadge();
    });

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
  const term = state.searchTerm.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  state.filteredRows = state.allRows.filter(row => {
    if (term) {
      const nome = (row[CONFIG.SEARCH_COL] || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!nome.includes(term)) return false;
    }
    for (const [col, val] of Object.entries(state.filters)) {
      if (!val) continue;
      const cellVal = (row[col] || '').toLowerCase();
      // DATA: busca parcial (contém)
      if (col === 'DATA') {
        if (!cellVal.includes(val.toLowerCase())) return false;
      } else {
        if (cellVal !== val.toLowerCase()) return false;
      }
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

    const name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = row[CONFIG.SEARCH_COL] || '(sem nome)';
    card.appendChild(name);

    const chips = document.createElement('div');
    chips.className = 'card-chips';

    CONFIG.CARD_VISIBLE_COLS.forEach(col => {
      const colUpper = col.toUpperCase();
      if (colUpper === CONFIG.SEARCH_COL) return;
      const val = row[colUpper];
      if (colUpper === 'ENTREGA' && !val) return;

      const chip = document.createElement('div');
      chip.className = 'chip' + (colUpper === 'BEBIDA' ? ' highlight' : '');

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

    const more = document.createElement('div');
    more.className = 'card-more';
    more.textContent = '▸ Ver detalhes';
    card.appendChild(more);

    card.addEventListener('click', () => openModal(row));
    cardsList.appendChild(card);
  });
}

/* ═══════════════════════════════════════
   MODAL DE DETALHES
═══════════════════════════════════════ */
function openModal(row) {
  modalTitle.textContent = row[CONFIG.SEARCH_COL] || '(sem nome)';
  modalBody.innerHTML = '';

  state.headers.forEach(col => {
    if (col === CONFIG.SEARCH_COL) return;
    const val = row[col] || '';
    const div = document.createElement('div');
    div.className = 'modal-row';

    const lbl = document.createElement('span');
    lbl.className = 'modal-row-label';
    lbl.textContent = col;

    const vEl = document.createElement('span');
    const isHighlight = ['BEBIDA'].includes(col);
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
   MODAL DE CONFIGURAÇÃO
═══════════════════════════════════════ */
function openConfig() {
  const cfg = getSavedConfig();
  inputSheetId.value = cfg.SPREADSHEET_ID;
  inputApiKey.value  = cfg.API_KEY;
  setConfigStatus('', '');
  configOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeConfig() {
  configOverlay.style.display = 'none';
  document.body.style.overflow = '';
}

function setConfigStatus(type, msg) {
  if (!type) { configStatus.style.display = 'none'; return; }
  configStatus.className = 'config-status ' + type;
  configStatus.textContent = msg;
  configStatus.style.display = 'block';
}

async function handleConfigSave() {
  const id  = inputSheetId.value.trim();
  const key = inputApiKey.value.trim();

  if (!id || !key) {
    setConfigStatus('error', '⚠ Preencha o ID da planilha e a API Key.');
    return;
  }

  configSaveBtn.disabled = true;
  configSaveBtn.textContent = 'Verificando...';
  setConfigStatus('', '');

  // Testa a conexão antes de salvar
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}?key=${key}&fields=sheets.properties`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Erro HTTP ${res.status}`);
    }
    const data = await res.json();
    const nSheets = data.sheets?.length || 0;

    saveConfig(id, key);
    updateConfigBtnStyle();
    setConfigStatus('success', `✓ Conectado! ${nSheets} aba(s) encontrada(s). Carregando dados...`);

    setTimeout(async () => {
      closeConfig();
      showState('loading');
      sheetTabs.innerHTML = '<span class="sheet-tab-loading">Carregando abas...</span>';
      try {
        await loadSheets();
      } catch (e) {
        showError('Erro ao carregar dados da planilha.');
      }
    }, 1200);

  } catch (e) {
    setConfigStatus('error', `✗ ${e.message || 'Não foi possível conectar. Verifique os dados.'}`);
  } finally {
    configSaveBtn.disabled = false;
    configSaveBtn.textContent = 'Salvar e conectar';
  }
}

function updateConfigBtnStyle() {
  const cfg = getSavedConfig();
  configBtn.classList.toggle('has-config', !!(cfg.SPREADSHEET_ID && cfg.API_KEY));
}

/* ═══════════════════════════════════════
   STATUS BAR
═══════════════════════════════════════ */
function updateStatus() {
  const total = state.allRows.length;
  const shown = state.filteredRows.length;
  if (total === 0) { statusBar.textContent = 'Nenhum registro nesta aba.'; return; }
  if (shown === total) statusBar.textContent = `${total} registro${total !== 1 ? 's' : ''}`;
  else statusBar.textContent = `${shown} de ${total} registro${total !== 1 ? 's' : ''}`;
}

/* ═══════════════════════════════════════
   ESTADOS DA UI
═══════════════════════════════════════ */
function showState(s) {
  // Esconde tudo
  stateLoading.style.display = 'none';
  stateEmpty.style.display   = 'none';
  stateError.style.display   = 'none';
  cardsList.style.display    = 'none';

  // Remove tela de boas-vindas anterior, se houver
  const existing = document.getElementById('welcomeScreen');
  if (existing) existing.remove();

  if (s === 'loading') { stateLoading.style.display = 'flex'; }
  else if (s === 'empty')   { stateEmpty.style.display = 'flex'; }
  else if (s === 'error')   { stateError.style.display = 'flex'; }
  else if (s === 'list')    { cardsList.style.display = 'flex'; }
  else if (s === 'welcome') {
    const mainContent = document.getElementById('mainContent');
    const div = document.createElement('div');
    div.id = 'welcomeScreen';
    div.className = 'welcome-screen';
    div.innerHTML = `
      <span class="welcome-icon">☕</span>
      <h2 class="welcome-title">Bem-vindo!</h2>
      <p class="welcome-desc">Configure a conexão com sua planilha do Google Sheets para começar.</p>
      <button class="btn-welcome-config" id="welcomeConfigBtn">⚙️ Configurar agora</button>
    `;
    mainContent.appendChild(div);
    document.getElementById('welcomeConfigBtn').addEventListener('click', openConfig);
  }
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

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  state.searchTerm = '';
  clearSearchBtn.classList.remove('visible');
  searchInput.focus();
  applyFilters();
});

// Filtros
filterToggleBtn.addEventListener('click', () => {
  filterPanel.classList.toggle('open');
  filterToggleBtn.classList.toggle('active', filterPanel.classList.contains('open'));
});

clearFiltersBtn.addEventListener('click', () => {
  state.filters = {};
  document.querySelectorAll('.filter-select').forEach(s => s.value = '');
  document.querySelectorAll('.filter-group input[type="text"]').forEach(i => i.value = '');
  updateFilterBadge();
  applyFilters();
});

document.addEventListener('click', e => {
  if (
    filterPanel.classList.contains('open') &&
    !filterPanel.contains(e.target) &&
    !filterToggleBtn.contains(e.target)
  ) filterPanel.classList.remove('open');
});

// Modal detalhes
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

let touchStartY = 0;
modalSheet.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
modalSheet.addEventListener('touchend', e => {
  if (e.changedTouches[0].clientY - touchStartY > 80) closeModal();
}, { passive: true });

// Modal configuração
configBtn.addEventListener('click', openConfig);
configClose.addEventListener('click', closeConfig);
configOverlay.addEventListener('click', e => { if (e.target === configOverlay) closeConfig(); });
configSaveBtn.addEventListener('click', handleConfigSave);

configClearBtn.addEventListener('click', () => {
  if (!confirm('Remover configuração salva?')) return;
  clearConfig();
  updateConfigBtnStyle();
  inputSheetId.value = '';
  inputApiKey.value  = '';
  setConfigStatus('success', '✓ Configuração removida.');
});

// Mostrar/ocultar API key
toggleApiKey.addEventListener('click', () => {
  const isPass = inputApiKey.type === 'password';
  inputApiKey.type = isPass ? 'text' : 'password';
  toggleApiKey.textContent = isPass ? '🙈' : '👁';
});

// Dicas de ajuda
helpId.addEventListener('click', () => {
  const open = helpId.classList.toggle('active');
  tipId.style.display = open ? 'block' : 'none';
});
helpKey.addEventListener('click', () => {
  const open = helpKey.classList.toggle('active');
  tipKey.style.display = open ? 'block' : 'none';
});

// Retry
retryBtn.addEventListener('click', () => {
  if (state.activeSheet) {
    loadSheetData(state.activeSheet).catch(() => showError('Erro ao carregar dados.'));
  } else {
    init();
  }
});

// Tema
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
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
