/* =============================================
   CONSULTA DE LOTES — script.js
   Configuração via interface (localStorage)
   ============================================= */

// Configurações fixas (estrutura da planilha)
const CONFIG = {
  CARD_VISIBLE_COLS: [
    'DATA',
    'ENTREGA',
    'SCs',
    'BEBIDA',
    'CATA',
    '17/18',
    'UMID.'
  ],
  SEARCH_COL: 'NOME',
  FILTER_COLS: ['DATA', 'ENTREGA', 'BEBIDA']
}

// Configurações salvas pelo usuário
function getSavedConfig() {
  return {
    SPREADSHEET_ID: localStorage.getItem('cfg_sheet_id') || '',
    API_KEY: localStorage.getItem('cfg_api_key') || ''
  }
}
function saveConfig(id, key) {
  localStorage.setItem('cfg_sheet_id', id.trim())
  localStorage.setItem('cfg_api_key', key.trim())
}
function clearConfig() {
  localStorage.removeItem('cfg_sheet_id')
  localStorage.removeItem('cfg_api_key')
}

/* ── Estado Global ── */
const state = {
  sheets: [],
  activeSheet: null,
  allRows: [],
  filteredRows: [],
  headers: [],
  filters: {},
  searchTerm: ''
}

/* ── DOM Refs ── */
const $ = id => document.getElementById(id)
const sheetTabs = $('sheetTabs')
const searchInput = $('searchInput')
const clearSearchBtn = $('clearSearch')
const filterToggleBtn = $('filterToggleBtn')
const filterPanel = $('filterPanel')
const filterGrid = $('filterGrid')
const filterBadge = $('filterBadge')
const clearFiltersBtn = $('clearFiltersBtn')
const stateLoading = $('stateLoading')
const stateEmpty = $('stateEmpty')
const stateError = $('stateError')
const stateErrorMsg = $('stateErrorMsg')
const retryBtn = $('retryBtn')
const cardsList = $('cardsList')
const statusBar = $('statusBar')
const modalOverlay = $('modalOverlay')
const modalSheet = $('modalSheet')
const modalTitle = $('modalTitle')
const modalBody = $('modalBody')
const modalClose = $('modalClose')
const refreshBtn = $('refreshBtn')
const themeToggle = $('themeToggle')
const configBtn = $('configBtn')
const configOverlay = $('configOverlay')
const configClose = $('configClose')
const inputSheetId = $('inputSpreadsheetId')
const inputApiKey = $('inputApiKey')
const configSaveBtn = $('configSaveBtn')
const configClearBtn = $('configClearBtn')
const configStatus = $('configStatus')
const toggleApiKey = $('toggleApiKey')
const helpId = $('helpId')
const helpKey = $('helpKey')
const tipId = $('tipId')
const tipKey = $('tipKey')

/* ═══════════════════════════════════════
   INICIALIZAÇÃO
═══════════════════════════════════════ */
async function init() {
  loadTheme()
  updateConfigBtnStyle()

  const cfg = getSavedConfig()
  if (!cfg.SPREADSHEET_ID || !cfg.API_KEY) {
    showWelcomeScreen()
    return
  }

  showState('loading')
  try {
    await loadSheets()
  } catch (e) {
    showError(
      'Não foi possível carregar a planilha.\nVerifique a API Key e o ID nas configurações (⚙️).'
    )
    console.error(e)
  }
}

/* ── Tela de boas-vindas (sem config) ── */
function showWelcomeScreen() {
  showState('welcome')
}

/* ═══════════════════════════════════════
   GOOGLE SHEETS API
═══════════════════════════════════════ */
async function loadSheets() {
  const cfg = getSavedConfig()
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cfg.SPREADSHEET_ID}?key=${cfg.API_KEY}&fields=sheets.properties`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${res.status}`)
  }
  const data = await res.json()

  state.sheets = data.sheets.map(s => ({
    title: s.properties.title,
    index: s.properties.index
  }))

  renderSheetTabs()
  selectSheet(state.sheets[0].title)
}

async function loadSheetData(sheetTitle) {
  showState('loading')
  const cfg = getSavedConfig()
  const range = encodeURIComponent(sheetTitle)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cfg.SPREADSHEET_ID}/values/${range}?key=${cfg.API_KEY}&valueRenderOption=FORMATTED_VALUE`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()

  const rows = data.values || []
  if (rows.length < 2) {
    state.headers = rows[0] || []
    state.allRows = []
  } else {
    state.headers = rows[0].map(h => h.toString().trim().toUpperCase())
    state.allRows = rows.slice(1).map(row => {
      const obj = {}
      state.headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? row[i].toString().trim() : ''
      })
      return obj
    })
  }

  state.filters = {}
  state.searchTerm = searchInput.value.trim()
  buildFilterUI()
  applyFilters({ animate: true })
}

/* ═══════════════════════════════════════
   ABAS (SHEET TABS)
═══════════════════════════════════════ */
function renderSheetTabs() {
  sheetTabs.innerHTML = ''
  state.sheets.forEach(sheet => {
    const btn = document.createElement('button')
    btn.className = 'sheet-tab'
    btn.textContent = sheet.title
    btn.dataset.title = sheet.title
    btn.addEventListener('click', () => selectSheet(sheet.title))
    sheetTabs.appendChild(btn)
  })
}

function selectSheet(title) {
  state.activeSheet = title
  document.querySelectorAll('.sheet-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.title === title)
  })
  loadSheetData(title).catch(e => {
    showError('Erro ao carregar dados desta aba.')
    console.error(e)
  })
}

/* ═══════════════════════════════════════
   FILTROS
═══════════════════════════════════════ */
function buildFilterUI() {
  filterGrid.innerHTML = ''
  const filterableCols = CONFIG.FILTER_COLS.filter(c =>
    state.headers.includes(c.toUpperCase())
  )

  filterableCols.forEach(col => {
    const colUpper = col.toUpperCase()

    const group = document.createElement('div')
    group.className = 'filter-group'

    const label = document.createElement('label')
    label.textContent = colUpper
    group.appendChild(label)

    // DATA usa campo de texto (busca parcial)
    if (colUpper === 'DATA') {
      const input = document.createElement('input')
      input.type = 'text'
      input.className = 'filter-select'
      input.placeholder = 'Ex: 01/2025'
      input.dataset.col = colUpper
      input.value = state.filters[colUpper] || ''
      input.addEventListener('input', () => {
        if (input.value.trim() === '') delete state.filters[colUpper]
        else state.filters[colUpper] = input.value.trim()
        applyFilters()
        updateFilterBadge()
      })
      group.appendChild(input)
      filterGrid.appendChild(group)
      return
    }

    // Demais colunas: dropdown com valores únicos
    const values = [
      ...new Set(
        state.allRows.map(r => r[colUpper] || '').filter(v => v !== '')
      )
    ].sort()
    if (values.length === 0) return

    const select = document.createElement('select')
    select.className = 'filter-select'
    select.dataset.col = colUpper

    const optAll = document.createElement('option')
    optAll.value = ''
    optAll.textContent = 'Todos'
    select.appendChild(optAll)

    values.forEach(v => {
      const opt = document.createElement('option')
      opt.value = v
      opt.textContent = v
      select.appendChild(opt)
    })

    if (state.filters[colUpper]) select.value = state.filters[colUpper]

    select.addEventListener('change', () => {
      if (select.value === '') delete state.filters[colUpper]
      else state.filters[colUpper] = select.value
      applyFilters()
      updateFilterBadge()
    })

    group.appendChild(select)
    filterGrid.appendChild(group)
  })
}

function updateFilterBadge() {
  const count = Object.keys(state.filters).length
  if (count > 0) {
    filterBadge.textContent = count
    filterBadge.style.display = 'inline'
    filterToggleBtn.classList.add('active')
  } else {
    filterBadge.style.display = 'none'
    filterToggleBtn.classList.remove('active')
  }
}

/* ═══════════════════════════════════════
   BUSCA E FILTROS
═══════════════════════════════════════ */
// Remove acentos e aproxima grafias de mesmo som (w→v, y→i, k→c, ph→f, th→t, z→s, letras dobradas)
function normalizeSearch(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/w/g, 'v')
    .replace(/y/g, 'i')
    .replace(/k/g, 'c')
    .replace(/z/g, 's')
    .replace(/([a-z])\1+/g, '$1')
}

// Menor distância de edição (com transposição) entre `term` e qualquer prefixo de `word`
function prefixEditDistance(term, word) {
  const m = term.length
  const n = word.length
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 1; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = term[i - 1] === word[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && term[i - 1] === word[j - 2] && term[i - 2] === word[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return Math.min(...d[m])
}

// Erros tolerados por palavra digitada: curtas exigem exatidão
function maxTypos(len) {
  if (len <= 3) return 0
  if (len <= 7) return 1
  return 2
}

// Cada palavra digitada precisa casar (com tolerância) com o início de alguma palavra do nome
function fuzzyMatch(termWords, nome) {
  const nameWords = nome.split(/\s+/).filter(Boolean)
  return termWords.every(tw => {
    const limit = maxTypos(tw.length)
    return nameWords.some(nw =>
      nw.startsWith(tw) || (limit > 0 && prefixEditDistance(tw, nw) <= limit)
    )
  })
}

function applyFilters({ animate = false } = {}) {
  const term = normalizeSearch(state.searchTerm)
  const termWords = term.split(/\s+/).filter(Boolean)

  const exact = []
  const fuzzy = []

  state.allRows.forEach(row => {
    for (const [col, val] of Object.entries(state.filters)) {
      if (!val) continue
      const cellVal = (row[col] || '').toLowerCase()
      // DATA: busca parcial (contém)
      if (col === 'DATA') {
        if (!cellVal.includes(val.toLowerCase())) return
      } else {
        if (cellVal !== val.toLowerCase()) return
      }
    }
    if (!term) return exact.push(row)
    const nome = normalizeSearch(row[CONFIG.SEARCH_COL] || '')
    if (nome.includes(term)) exact.push(row)
    else if (fuzzyMatch(termWords, nome)) fuzzy.push(row)
  })

  // Correspondências exatas primeiro, aproximadas depois
  state.filteredRows = exact.concat(fuzzy)

  renderCards({ animate })
  updateStatus()
}

/* ═══════════════════════════════════════
   COPIAR CARD
═══════════════════════════════════════ */
const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

function copyToClipboard(text) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text)
  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
  return Promise.resolve()
}

function formatBebidaForCopy(val) {
  const colorClass = getBebidaColorClass(val)
  const prefixMap = {
    'bebida-green': 'Duro',
    'bebida-yellow': 'Duro Riado',
    'bebida-red': 'Rio'
  }
  const prefix = prefixMap[colorClass]
  if (!prefix) return val
  const parts = (val || '').split(' ')
  const suffix =
    parts.length > 1
      ? ' ' +
        parts
          .slice(1)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ')
      : ''
  return prefix + suffix
}

function buildCopyText(row) {
  const fields = [
    { label: 'Nome', key: 'NOME' },
    { label: 'Quantidade', key: 'SCS' },
    { label: 'Bebida', key: 'BEBIDA' },
    { label: 'Cata', key: 'CATA' },
    { label: 'Umidade', key: 'UMID.' }
  ]
  return fields
    .filter(f => row[f.key] && row[f.key].trim() !== '')
    .map(
      f =>
        `${f.label}: ${f.key === 'BEBIDA' ? formatBebidaForCopy(row[f.key]) : row[f.key]}`
    )
    .join('\n')
}

/* ═══════════════════════════════════════
   BEBIDA — COR DINÂMICA
═══════════════════════════════════════ */
function getBebidaColorClass(val) {
  const code = (val || '').split(' ')[0].toUpperCase()
  const letters = code.replace(/[0-9]/g, '')
  if (!letters) return ''
  if (letters.includes('B')) return 'bebida-red'
  if (letters.includes('L')) return 'bebida-yellow'
  if (letters.includes('R')) return 'bebida-green'
  return ''
}

/* ═══════════════════════════════════════
   RENDER CARDS
═══════════════════════════════════════ */
function renderCards({ animate = false } = {}) {
  cardsList.innerHTML = ''

  if (state.filteredRows.length === 0) {
    showState('empty')
    return
  }
  showState('list')

  state.filteredRows.forEach((row, idx) => {
    const card = document.createElement('div')
    card.className = 'card' + (row['ENTREGA'] ? ' has-entrega' : '')
    if (animate) {
      card.classList.add('card--enter')
      card.style.animationDelay = `${Math.min(idx * 20, 160)}ms`
    }

    const cardHeader = document.createElement('div')
    cardHeader.className = 'card-header'

    const name = document.createElement('div')
    name.className = 'card-name'
    name.textContent = row[CONFIG.SEARCH_COL] || '(sem nome)'

    const copyBtn = document.createElement('button')
    copyBtn.className = 'btn-copy'
    copyBtn.title = 'Copiar'
    copyBtn.innerHTML = COPY_ICON
    copyBtn.addEventListener('click', e => {
      e.stopPropagation()
      copyToClipboard(buildCopyText(row)).then(() => {
        copyBtn.innerHTML = CHECK_ICON
        copyBtn.classList.add('copied')
        navigator.vibrate?.(10)
        setTimeout(() => {
          copyBtn.innerHTML = COPY_ICON
          copyBtn.classList.remove('copied')
        }, 1500)
      })
    })

    cardHeader.appendChild(name)
    cardHeader.appendChild(copyBtn)
    card.appendChild(cardHeader)

    const chips = document.createElement('div')
    chips.className = 'card-chips'

    CONFIG.CARD_VISIBLE_COLS.forEach(col => {
      const colUpper = col.toUpperCase()
      if (colUpper === CONFIG.SEARCH_COL) return
      const val = row[colUpper]
      if (colUpper === 'ENTREGA' && !val) return

      const chip = document.createElement('div')
      const chipHighlight =
        colUpper === 'BEBIDA' ? getBebidaColorClass(val) : ''
      chip.className = 'chip' + (chipHighlight ? ' ' + chipHighlight : '')

      const lbl = document.createElement('span')
      lbl.className =
        'chip-label' + (colUpper === 'ENTREGA' ? ' chip-label--entrega' : '')
      lbl.textContent = colUpper

      const vEl = document.createElement('span')
      vEl.className = 'chip-value' + (!val ? ' empty' : '')
      vEl.textContent = val || '—'

      chip.appendChild(lbl)
      chip.appendChild(vEl)
      chips.appendChild(chip)
    })

    card.appendChild(chips)

    const more = document.createElement('div')
    more.className = 'card-more'
    more.textContent = '▸ Ver detalhes'
    card.appendChild(more)

    card.addEventListener('click', () => openModal(row))
    cardsList.appendChild(card)
  })
}

/* ═══════════════════════════════════════
   MODAL DE DETALHES
═══════════════════════════════════════ */
function openModal(row) {
  modalTitle.textContent = row[CONFIG.SEARCH_COL] || '(sem nome)'
  modalBody.innerHTML = ''

  state.headers.forEach(col => {
    if (col === CONFIG.SEARCH_COL) return
    const val = row[col] || ''
    const div = document.createElement('div')
    div.className = 'modal-row'

    const lbl = document.createElement('span')
    lbl.className = 'modal-row-label'
    lbl.textContent = col

    const vEl = document.createElement('span')
    const modalHighlight = col === 'BEBIDA' ? getBebidaColorClass(val) : ''
    vEl.className =
      'modal-row-value' +
      (!val ? ' empty' : modalHighlight ? ' ' + modalHighlight : '')
    vEl.textContent = val || '—'

    div.appendChild(lbl)
    div.appendChild(vEl)
    modalBody.appendChild(div)
  })

  detailSheet.open()
}

function closeModal() {
  detailSheet.close()
}

/* ═══════════════════════════════════════
   BOTTOM SHEET — mola + arrastar para fechar
═══════════════════════════════════════ */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

// Onde o gesto iria parar (mesma curva da desaceleração do scroll no iOS)
function projectMomentum(velocity, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

// Resistência progressiva ao passar do limite, em vez de parar seco
function rubberband(overshoot, dimension, constant = 0.55) {
  return (
    (overshoot * dimension * constant) /
    (dimension + constant * Math.abs(overshoot))
  )
}

function createSheet(overlay, sheet) {
  const SCRIM_OPACITY = 0.45
  let y = 0
  let velocity = 0
  let raf = 0
  let isOpen = false

  const height = () => sheet.offsetHeight || window.innerHeight

  function render() {
    sheet.style.transform = `translate3d(0, ${y}px, 0)`
    const progress = Math.min(Math.max(y / height(), 0), 1)
    overlay.style.backgroundColor = `rgba(0,0,0,${SCRIM_OPACITY * (1 - progress)})`
  }

  function stop() {
    cancelAnimationFrame(raf)
    raf = 0
  }

  // Mola: response = rapidez em segundos; damping 1 = sem overshoot.
  // Parte sempre da posição e velocidade atuais, então pode ser interrompida.
  function springTo(target, { response = 0.35, damping = 1 } = {}, done) {
    stop()
    if (prefersReducedMotion.matches) {
      y = target
      velocity = 0
      render()
      done?.()
      return
    }
    const stiffness = ((2 * Math.PI) / response) ** 2
    const friction = (4 * Math.PI * damping) / response
    let last = performance.now()
    const step = now => {
      const dt = Math.min((now - last) / 1000, 0.064)
      last = now
      const n = Math.max(1, Math.ceil(dt / 0.004))
      const h = dt / n
      for (let i = 0; i < n; i++) {
        velocity += (-stiffness * (y - target) - friction * velocity) * h
        y += velocity * h
      }
      if (Math.abs(y - target) < 0.5 && Math.abs(velocity) < 10) {
        y = target
        velocity = 0
        render()
        raf = 0
        done?.()
        return
      }
      render()
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
  }

  function open() {
    isOpen = true
    if (overlay.style.display === 'none') {
      overlay.style.display = 'flex'
      sheet.scrollTop = 0
      y = height()
      velocity = 0
      render()
    }
    document.body.style.overflow = 'hidden'
    springTo(0)
  }

  // Sai pelo mesmo caminho por onde entrou (para baixo)
  function close(releaseVelocity) {
    if (!isOpen) return
    isOpen = false
    if (releaseVelocity !== undefined) velocity = releaseVelocity
    springTo(height(), { response: 0.3 }, () => {
      overlay.style.display = 'none'
      document.body.style.overflow = ''
    })
  }

  // Arrastar: segue o dedo 1:1 e herda a velocidade ao soltar
  let tracking = false
  let dragging = false
  let fromGrabArea = false
  let startY = 0
  let grabOffset = 0
  let samples = []

  sheet.addEventListener(
    'touchstart',
    e => {
      if (!isOpen || e.touches.length > 1) return
      tracking = true
      dragging = false
      startY = e.touches[0].clientY
      fromGrabArea = !!e.target.closest('.modal-handle, .modal-header')
      samples = [{ y: startY, t: e.timeStamp }]
    },
    { passive: true }
  )

  sheet.addEventListener(
    'touchmove',
    e => {
      if (!tracking) return
      const cy = e.touches[0].clientY
      if (!dragging) {
        const dy = cy - startY
        if (Math.abs(dy) < 10) return // histerese antes de decidir a direção
        if (fromGrabArea || (dy > 0 && sheet.scrollTop <= 0)) {
          dragging = true
          stop() // agarra a folha mesmo no meio de uma animação
          grabOffset = cy - y // respeita o ponto onde foi agarrada
        } else {
          tracking = false // é rolagem do conteúdo
          return
        }
      }
      e.preventDefault()
      const raw = cy - grabOffset
      y = raw < 0 ? rubberband(raw, height()) : raw
      render()
      samples.push({ y: cy, t: e.timeStamp })
      if (samples.length > 6) samples.shift()
    },
    { passive: false }
  )

  function endDrag(e) {
    tracking = false
    if (!dragging) return
    dragging = false
    const lastSample = samples[samples.length - 1]
    const recent = samples.filter(s => lastSample.t - s.t <= 100)
    const first = recent[0]
    const dt = (lastSample.t - first.t) / 1000
    // dedo parado antes de soltar = sem momento
    const v = dt > 0 && e.timeStamp - lastSample.t < 100 ? (lastSample.y - first.y) / dt : 0
    if (y + projectMomentum(v) > height() * 0.5) {
      close(v)
    } else {
      velocity = v
      springTo(0, { response: 0.3 })
    }
  }
  sheet.addEventListener('touchend', endDrag)
  sheet.addEventListener('touchcancel', endDrag)

  return {
    open,
    close,
    get isOpen() {
      return isOpen
    }
  }
}

const detailSheet = createSheet(modalOverlay, modalSheet)
const configSheet = createSheet(configOverlay, $('configSheet'))

/* ═══════════════════════════════════════
   MODAL DE CONFIGURAÇÃO
═══════════════════════════════════════ */
async function loadAppVersion() {
  const el = document.getElementById('configVersion')
  if (!el) return
  try {
    const keys = await caches.keys()
    const name = keys.find(k => k.startsWith('consulta-lotes-'))
    el.textContent = name ? name.replace('consulta-lotes-', '') : '—'
  } catch {
    el.textContent = '—'
  }
}

function openConfig() {
  const cfg = getSavedConfig()
  inputSheetId.value = cfg.SPREADSHEET_ID
  inputApiKey.value = cfg.API_KEY
  setConfigStatus('', '')
  loadAppVersion()
  configSheet.open()
}

function closeConfig() {
  configSheet.close()
}

function setConfigStatus(type, msg) {
  if (!type) {
    configStatus.style.display = 'none'
    return
  }
  configStatus.className = 'config-status ' + type
  configStatus.textContent = msg
  configStatus.style.display = 'block'
}

async function handleConfigSave() {
  const id = inputSheetId.value.trim()
  const key = inputApiKey.value.trim()

  if (!id || !key) {
    setConfigStatus('error', '⚠ Preencha o ID da planilha e a API Key.')
    return
  }

  configSaveBtn.disabled = true
  configSaveBtn.textContent = 'Verificando...'
  setConfigStatus('', '')

  // Testa a conexão antes de salvar
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}?key=${key}&fields=sheets.properties`
    const res = await fetch(url)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message || `Erro HTTP ${res.status}`)
    }
    const data = await res.json()
    const nSheets = data.sheets?.length || 0

    saveConfig(id, key)
    updateConfigBtnStyle()
    setConfigStatus(
      'success',
      `✓ Conectado! ${nSheets} aba(s) encontrada(s). Carregando dados...`
    )

    setTimeout(async () => {
      closeConfig()
      showState('loading')
      sheetTabs.innerHTML =
        '<span class="sheet-tab-loading">Carregando abas...</span>'
      try {
        await loadSheets()
      } catch (e) {
        showError('Erro ao carregar dados da planilha.')
      }
    }, 1200)
  } catch (e) {
    setConfigStatus(
      'error',
      `✗ ${e.message || 'Não foi possível conectar. Verifique os dados.'}`
    )
  } finally {
    configSaveBtn.disabled = false
    configSaveBtn.textContent = 'Salvar e conectar'
  }
}

function updateConfigBtnStyle() {}

/* ═══════════════════════════════════════
   STATUS BAR
═══════════════════════════════════════ */
function updateStatus() {
  const total = state.allRows.length
  const shown = state.filteredRows.length
  if (total === 0) {
    statusBar.textContent = 'Nenhum registro nesta aba.'
    return
  }
  if (shown === total)
    statusBar.textContent = `${total} registro${total !== 1 ? 's' : ''}`
  else
    statusBar.textContent = `${shown} de ${total} registro${total !== 1 ? 's' : ''}`
}

/* ═══════════════════════════════════════
   ESTADOS DA UI
═══════════════════════════════════════ */
function showState(s) {
  // Esconde tudo
  stateLoading.style.display = 'none'
  stateEmpty.style.display = 'none'
  stateError.style.display = 'none'
  cardsList.style.display = 'none'

  // Remove tela de boas-vindas anterior, se houver
  const existing = document.getElementById('welcomeScreen')
  if (existing) existing.remove()

  if (s === 'loading') {
    stateLoading.style.display = 'flex'
  } else if (s === 'empty') {
    stateEmpty.style.display = 'flex'
  } else if (s === 'error') {
    stateError.style.display = 'flex'
  } else if (s === 'list') {
    cardsList.style.display = 'flex'
  } else if (s === 'welcome') {
    const mainContent = document.getElementById('mainContent')
    const div = document.createElement('div')
    div.id = 'welcomeScreen'
    div.className = 'welcome-screen'
    div.innerHTML = `
      <span class="welcome-icon">☕</span>
      <h2 class="welcome-title">Bem-vindo!</h2>
      <p class="welcome-desc">Configure a conexão com sua planilha do Google Sheets para começar.</p>
      <button class="btn-welcome-config" id="welcomeConfigBtn">⚙️ Configurar agora</button>
    `
    mainContent.appendChild(div)
    document
      .getElementById('welcomeConfigBtn')
      .addEventListener('click', openConfig)
  }
}

function showError(msg) {
  stateErrorMsg.textContent = msg
  showState('error')
}

/* ═══════════════════════════════════════
   TEMA
═══════════════════════════════════════ */
function loadTheme() {
  const saved = localStorage.getItem('theme') || 'light'
  applyTheme(saved)
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  themeToggle.innerHTML =
    theme === 'dark'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 0a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V1a1 1 0 0 1 1-1ZM4.929 3.515a1 1 0 0 0-1.414 1.414l2.828 2.828a1 1 0 0 0 1.414-1.414L4.93 3.515ZM1 11a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H1ZM18 12a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1ZM17.657 16.243a1 1 0 0 0-1.414 1.414l2.828 2.828a1 1 0 1 0 1.414-1.414l-2.828-2.828ZM7.757 17.657a1 1 0 1 0-1.414-1.414L3.515 19.07a1 1 0 1 0 1.414 1.414l2.828-2.828ZM20.485 4.929a1 1 0 0 0-1.414-1.414l-2.828 2.828a1 1 0 1 0 1.414 1.414l2.828-2.828ZM13 19a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0v-4ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" fill="currentColor"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M8.23129 2.24048C9.24338 1.78695 10.1202 2.81145 9.80357 3.70098C8.72924 6.71928 9.38932 10.1474 11.6193 12.3765C13.8606 14.617 17.3114 15.2755 20.3395 14.1819C21.2206 13.8637 22.2173 14.7319 21.7817 15.7199C21.7688 15.7491 21.7558 15.7782 21.7427 15.8074C20.9674 17.5266 19.7272 19.1434 18.1227 20.2274C16.4125 21.3828 14.3957 22.0001 12.3316 22.0001H12.3306C9.93035 21.9975 7.6057 21.1603 5.75517 19.6321C3.90463 18.1039 2.64345 15.9797 2.18793 13.6237C1.73241 11.2677 2.11094 8.82672 3.2586 6.71917C4.34658 4.72121 6.17608 3.16858 8.20153 2.25386L8.23129 2.24048Z" fill="currentColor"/></svg>`
  localStorage.setItem('theme', theme)
}

/* ═══════════════════════════════════════
   EVENTOS
═══════════════════════════════════════ */

// Busca
searchInput.addEventListener('input', () => {
  state.searchTerm = searchInput.value.trim()
  clearSearchBtn.classList.toggle('visible', state.searchTerm.length > 0)
  applyFilters()
})

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = ''
  state.searchTerm = ''
  clearSearchBtn.classList.remove('visible')
  searchInput.focus()
  applyFilters()
})

// Filtros
filterToggleBtn.addEventListener('click', () => {
  filterPanel.classList.toggle('open')
  filterToggleBtn.classList.toggle(
    'active',
    filterPanel.classList.contains('open')
  )
})

clearFiltersBtn.addEventListener('click', () => {
  state.filters = {}
  document.querySelectorAll('.filter-select').forEach(s => (s.value = ''))
  document
    .querySelectorAll('.filter-group input[type="text"]')
    .forEach(i => (i.value = ''))
  updateFilterBadge()
  applyFilters()
})

document.addEventListener('click', e => {
  if (
    filterPanel.classList.contains('open') &&
    !filterPanel.contains(e.target) &&
    !filterToggleBtn.contains(e.target)
  )
    filterPanel.classList.remove('open')
})

// Modal detalhes
modalClose.addEventListener('click', closeModal)
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal()
})

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return
  if (detailSheet.isOpen) closeModal()
  else if (configSheet.isOpen) closeConfig()
})

// Modal configuração
configBtn.addEventListener('click', openConfig)
configClose.addEventListener('click', closeConfig)
configOverlay.addEventListener('click', e => {
  if (e.target === configOverlay) closeConfig()
})
configSaveBtn.addEventListener('click', handleConfigSave)

configClearBtn.addEventListener('click', () => {
  if (!confirm('Remover configuração salva?')) return
  clearConfig()
  updateConfigBtnStyle()
  inputSheetId.value = ''
  inputApiKey.value = ''
  setConfigStatus('success', '✓ Configuração removida.')
})

// Mostrar/ocultar API key
toggleApiKey.addEventListener('click', () => {
  const isPass = inputApiKey.type === 'password'
  inputApiKey.type = isPass ? 'text' : 'password'
  toggleApiKey.textContent = isPass ? '🙈' : '👁'
})

// Dicas de ajuda
helpId.addEventListener('click', () => {
  const open = helpId.classList.toggle('active')
  tipId.style.display = open ? 'block' : 'none'
})
helpKey.addEventListener('click', () => {
  const open = helpKey.classList.toggle('active')
  tipKey.style.display = open ? 'block' : 'none'
})

// Retry
retryBtn.addEventListener('click', () => {
  if (state.activeSheet) {
    loadSheetData(state.activeSheet).catch(() =>
      showError('Erro ao carregar dados.')
    )
  } else {
    init()
  }
})

// Refresh
refreshBtn.addEventListener('click', async () => {
  if (!state.activeSheet) return
  refreshBtn.classList.add('loading')
  try {
    await loadSheetData(state.activeSheet)
  } catch (e) {
    showError('Erro ao atualizar dados.')
    console.error(e)
  } finally {
    refreshBtn.classList.remove('loading')
  }
})

// Tema
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light'
  const next = current === 'dark' ? 'light' : 'dark'
  if (document.startViewTransition) document.startViewTransition(() => applyTheme(next))
  else applyTheme(next)
})

/* ═══════════════════════════════════════
   SERVICE WORKER (PWA)
═══════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {})
  })
}

/* ── START ── */
init()
