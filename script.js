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
const refreshBtn      = $('refreshBtn');
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
   COPIAR CARD
═══════════════════════════════════════ */
const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function copyToClipboard(text) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  return Promise.resolve();
}

function buildCopyText(row) {
  const fields = [
    { label: 'Nome',       key: 'NOME' },
    { label: 'Quantidade', key: 'SCS' },
    { label: 'Bebida',     key: 'BEBIDA' },
    { label: 'Cata',       key: 'CATA' },
    { label: 'Umidade',    key: 'UMID.' },
  ];
  return fields
    .filter(f => row[f.key] && row[f.key].trim() !== '')
    .map(f => `${f.label}: ${row[f.key]}`)
    .join('\n');
}

/* ═══════════════════════════════════════
   BEBIDA — COR DINÂMICA
═══════════════════════════════════════ */
function getBebidaColorClass(val) {
  const code = (val || '').split(' ')[0].toUpperCase();
  const letters = code.replace(/[0-9]/g, '');
  if (!letters) return '';
  if (letters.includes('B')) return 'bebida-red';
  if (letters.includes('L')) return 'bebida-yellow';
  if (letters.includes('R')) return 'bebida-green';
  return '';
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
    card.className = 'card' + (row['ENTREGA'] ? ' has-entrega' : '');
    card.style.animationDelay = `${Math.min(idx * 30, 300)}ms`;

    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';

    const name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = row[CONFIG.SEARCH_COL] || '(sem nome)';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-copy';
    copyBtn.title = 'Copiar';
    copyBtn.innerHTML = COPY_ICON;
    copyBtn.addEventListener('click', e => {
      e.stopPropagation();
      copyToClipboard(buildCopyText(row)).then(() => {
        copyBtn.innerHTML = CHECK_ICON;
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerHTML = COPY_ICON;
          copyBtn.classList.remove('copied');
        }, 1500);
      });
    });

    cardHeader.appendChild(name);
    cardHeader.appendChild(copyBtn);
    card.appendChild(cardHeader);

    const chips = document.createElement('div');
    chips.className = 'card-chips';

    CONFIG.CARD_VISIBLE_COLS.forEach(col => {
      const colUpper = col.toUpperCase();
      if (colUpper === CONFIG.SEARCH_COL) return;
      const val = row[colUpper];
      if (colUpper === 'ENTREGA' && !val) return;

      const chip = document.createElement('div');
      const chipHighlight = colUpper === 'BEBIDA' ? getBebidaColorClass(val) : '';
      chip.className = 'chip' + (chipHighlight ? ' ' + chipHighlight : '');

      const lbl = document.createElement('span');
      lbl.className = 'chip-label' + (colUpper === 'ENTREGA' ? ' chip-label--entrega' : '');
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
    const modalHighlight = col === 'BEBIDA' ? getBebidaColorClass(val) : '';
    vEl.className = 'modal-row-value' + (!val ? ' empty' : modalHighlight ? ' ' + modalHighlight : '');
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

function updateConfigBtnStyle() {}

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
  themeToggle.innerHTML = theme === 'dark'
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 0a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V1a1 1 0 0 1 1-1ZM4.929 3.515a1 1 0 0 0-1.414 1.414l2.828 2.828a1 1 0 0 0 1.414-1.414L4.93 3.515ZM1 11a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H1ZM18 12a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1ZM17.657 16.243a1 1 0 0 0-1.414 1.414l2.828 2.828a1 1 0 1 0 1.414-1.414l-2.828-2.828ZM7.757 17.657a1 1 0 1 0-1.414-1.414L3.515 19.07a1 1 0 1 0 1.414 1.414l2.828-2.828ZM20.485 4.929a1 1 0 0 0-1.414-1.414l-2.828 2.828a1 1 0 1 0 1.414 1.414l2.828-2.828ZM13 19a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0v-4ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" fill="currentColor"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M8.23129 2.24048C9.24338 1.78695 10.1202 2.81145 9.80357 3.70098C8.72924 6.71928 9.38932 10.1474 11.6193 12.3765C13.8606 14.617 17.3114 15.2755 20.3395 14.1819C21.2206 13.8637 22.2173 14.7319 21.7817 15.7199C21.7688 15.7491 21.7558 15.7782 21.7427 15.8074C20.9674 17.5266 19.7272 19.1434 18.1227 20.2274C16.4125 21.3828 14.3957 22.0001 12.3316 22.0001H12.3306C9.93035 21.9975 7.6057 21.1603 5.75517 19.6321C3.90463 18.1039 2.64345 15.9797 2.18793 13.6237C1.73241 11.2677 2.11094 8.82672 3.2586 6.71917C4.34658 4.72121 6.17608 3.16858 8.20153 2.25386L8.23129 2.24048Z" fill="currentColor"/></svg>`;
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

// Refresh
refreshBtn.addEventListener('click', async () => {
  if (!state.activeSheet) return;
  refreshBtn.classList.add('loading');
  try {
    await loadSheetData(state.activeSheet);
  } catch (e) {
    showError('Erro ao atualizar dados.');
    console.error(e);
  } finally {
    refreshBtn.classList.remove('loading');
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
