// Authentication and API helpers
const apiBase = '/api/v1';
let authToken = '';

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${apiBase}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// UI helpers
function $(selector) { return document.querySelector(selector); }
function $all(selector) { return Array.from(document.querySelectorAll(selector)); }
function on(el, evt, handler) { if (el) el.addEventListener(evt, handler); }

function setHidden(el, hidden) { if (el) { if (hidden) el.classList.add('hidden'); else el.classList.remove('hidden'); } }

// Auth flows
async function handleLogin(e) {
  e.preventDefault();
  const email = $('#login-email')?.value?.trim() || '';
  const password = $('#login-password')?.value?.trim() || '';
  try {
    const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    authToken = data.token;
    const emailEl = $('#user-email'); if (emailEl) emailEl.textContent = email;
    setHidden($('#auth-container'), true);
    setHidden($('#app-container'), false);
  } catch (err) {
    const errEl = $('#login-error'); if (errEl) errEl.textContent = 'ログインに失敗しました';
    console.error(err);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = $('#register-email')?.value?.trim() || '';
  const password = $('#register-password')?.value?.trim() || '';
  try {
    await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) });
    const msg = $('#register-message'); if (msg) msg.textContent = '登録に成功しました。ログインしてください。';
    setHidden($('#register-form-container'), true);
    setHidden($('#login-form-container'), false);
    const loginEmail = $('#login-email'); if (loginEmail) loginEmail.value = email;
  } catch (err) {
    const msg = $('#register-message'); if (msg) msg.textContent = '登録に失敗しました';
    console.error(err);
  }
}

// Tabs
function setupTabs() {
  $all('.tab-button').forEach(btn => on(btn, 'click', () => {
    $all('.tab-button').forEach(b => b.classList.remove('active', 'text-blue-600', 'border-blue-600'));
    btn.classList.add('active', 'text-blue-600', 'border-blue-600');
    const tab = btn.getAttribute('data-tab');
    setHidden($('#url-content'), tab !== 'url');
    setHidden($('#upload-content'), tab !== 'upload');
  }));
}

// Mode toggle
function setupMode() {
  const aiBtn = $('#ai-mode-button');
  const manualBtn = $('#manual-mode-button');
  on(aiBtn, 'click', () => { aiBtn.classList.add('bg-white', 'text-blue-600'); manualBtn?.classList.remove('bg-white', 'text-blue-600'); });
  on(manualBtn, 'click', () => { manualBtn.classList.add('bg-white', 'text-blue-600'); aiBtn?.classList.remove('bg-white', 'text-blue-600'); });
}

// Sliders
function setupSliders() {
  $all('[data-slider]')
    .forEach(container => {
      const minThumb = container.querySelector('[data-thumb="min"]');
      const maxThumb = container.querySelector('[data-thumb="max"]');
      const rangeEl = container.querySelector('.slider-range');
      const minLabel = container.querySelector('[data-value="min"]');
      const maxLabel = container.querySelector('[data-value="max"]');
      const track = container.querySelector('.slider-track');
      if (!minThumb || !maxThumb || !rangeEl || !minLabel || !maxLabel || !track) return;
      const min = +container.getAttribute('data-min');
      const max = +container.getAttribute('data-max');
      let curMin = +container.getAttribute('data-start-min');
      let curMax = +container.getAttribute('data-start-max');

      function update() {
        const left = ((curMin - min) / (max - min)) * 100;
        const right = ((curMax - min) / (max - min)) * 100;
        rangeEl.style.left = left + '%';
        rangeEl.style.right = (100 - right) + '%';
        minThumb.style.left = left + '%';
        maxThumb.style.left = right + '%';
        minLabel.textContent = String(curMin);
        maxLabel.textContent = String(curMax);
        updateSummary();
      }

      function attachDrag(thumb, isMin) {
        function onMove(e) {
          const rect = container.getBoundingClientRect();
          const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
          const value = Math.round(min + (x / rect.width) * (max - min));
          if (isMin) curMin = Math.min(value, curMax); else curMax = Math.max(value, curMin);
          update();
        }
        function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
        on(thumb, 'mousedown', () => { window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); });
      }

      attachDrag(minThumb, true);
      attachDrag(maxThumb, false);
      update();
    });
}

// Title settings UI
function getTitleSettings() {
  return {
    auto: $('#autoTitleToggle')?.checked ?? true,
    font: $('#title-font')?.value || '遊ゴシック',
    weight: +($('#title-weight')?.value || 700),
    mainSize: +($('#main-title-size')?.value || 80),
    mainColor: $('#main-title-color')?.value || '#FFFFFF',
    mainStrokeWidth: +($('#main-title-stroke')?.value || 2),
    mainStrokeColor: $('#main-title-stroke-color')?.value || '#000000',
    subSize: +($('#sub-title-size')?.value || 60),
    subColor: $('#sub-title-color')?.value || '#FFFFFF',
    subStrokeWidth: +($('#sub-title-stroke')?.value || 2),
    subStrokeColor: $('#sub-title-stroke-color')?.value || '#000000',
  };
}

function updateTitlePreview() {
  const s = getTitleSettings();
  const main = $('#preview-main-title');
  const sub = $('#preview-sub-title');
  if (main) {
    main.style.fontWeight = String(s.weight);
    main.style.fontSize = s.mainSize + 'px';
    main.style.color = s.mainColor;
    main.style.textShadow = `${s.mainStrokeColor} 0px 0px ${Math.max(1, s.mainStrokeWidth)}px`;
  }
  if (sub) {
    sub.style.fontSize = s.subSize + 'px';
    sub.style.color = s.subColor;
    sub.style.textShadow = `${s.subStrokeColor} 0px 0px ${Math.max(1, s.subStrokeWidth)}px`;
  }
}

$all('#main-title-size,#main-title-stroke,#main-title-color,#main-title-stroke-color,#sub-title-size,#sub-title-stroke,#sub-title-color,#sub-title-stroke-color,#title-font,#title-weight'.split(','))
  .forEach(sel => { const el = document.querySelector(sel); on(el, 'input', () => { updateTitlePreview(); updateSummary(); }); });

on($('#autoTitleToggle'), 'change', () => { setHidden($('#title-settings-container'), !($('#autoTitleToggle')?.checked)); updateSummary(); });

// Summary
function updateSummary() {
  const ul = $('#summary-list'); if (!ul) return;
  ul.innerHTML = '';

  // duration
  const duration = document.querySelector('[data-slider="duration"]');
  const dmin = duration?.querySelector('[data-value="min"]')?.textContent || '0';
  const dmax = duration?.querySelector('[data-value="max"]')?.textContent || '0';
  // count
  const count = document.querySelector('[data-slider="count"]');
  const cmin = count?.querySelector('[data-value="min"]')?.textContent || '0';
  const cmax = count?.querySelector('[data-value="max"]')?.textContent || '0';

  const li1 = document.createElement('li'); li1.textContent = `切り抜き時間: ${dmin}-${dmax} 秒`; ul.appendChild(li1);
  const li2 = document.createElement('li'); li2.textContent = `切り抜き本数: ${cmin}-${cmax} 本`; ul.appendChild(li2);

  const title = getTitleSettings();
  if (title.auto) {
    const li3 = document.createElement('li');
    li3.innerHTML = `タイトル自動生成: ON`;
    const li4 = document.createElement('li');
    li4.innerHTML = `メイン: フォント=${title.font}, 太さ=${title.weight}, サイズ=${title.mainSize}px, 色=${title.mainColor}, 縁=${title.mainStrokeWidth}px (${title.mainStrokeColor})`;
    const li5 = document.createElement('li');
    li5.innerHTML = `サブ: サイズ=${title.subSize}px, 色=${title.subColor}, 縁=${title.subStrokeWidth}px (${title.subStrokeColor})`;
    ul.appendChild(li3); ul.appendChild(li4); ul.appendChild(li5);
  } else {
    const li3 = document.createElement('li'); li3.textContent = 'タイトル自動生成: OFF'; ul.appendChild(li3);
  }
}

// Connection test
async function handleConnectionTest() {
  const urls = $('#video-urls')?.value?.trim()?.split(/\n+/).map(s => s.trim()).filter(Boolean) || [];
  if (urls.length === 0) return;
  const btn = $('#connection-test-button');
  const label = btn?.querySelector('.btn-text');
  const original = label?.textContent || '';
  if (btn) { btn.disabled = true; }
  if (label) label.textContent = '接続確認中...';
  try {
    const res = await apiFetch('/jobs/test-url', { method: 'POST', body: JSON.stringify({ url: urls[0] }) });
    if (label) label.textContent = `成功: ${res.title}`;
  } catch (_) {
    if (label) label.textContent = '失敗しました';
  } finally {
    setTimeout(() => { if (btn) btn.disabled = false; if (label) label.textContent = original; }, 1500);
  }
}

// Start processing
async function handleProcess() {
  const urls = $('#video-urls')?.value?.trim()?.split(/\n+/).map(s => s.trim()).filter(Boolean) || [];
  if (urls.length === 0) return;
  const duration = document.querySelector('[data-slider="duration"]');
  const count = document.querySelector('[data-slider="count"]');
  const settings = {
    durationMin: +(duration?.querySelector('[data-value="min"]')?.textContent || 0),
    durationMax: +(duration?.querySelector('[data-value="max"]')?.textContent || 0),
    countMin: +(count?.querySelector('[data-value="min"]')?.textContent || 0),
    countMax: +(count?.querySelector('[data-value="max"]')?.textContent || 0),
    title: getTitleSettings(),
  };

  setHidden($('#processing-status'), false);
  const msg = $('#processing-message'); if (msg) msg.textContent = '処理を開始しています...';
  const bar = $('#progress-bar'); if (bar) bar.style.width = '0%';
  const perc = $('#progress-percentage'); if (perc) perc.textContent = '0%';

  try {
    const { jobId } = await apiFetch('/jobs', { method: 'POST', body: JSON.stringify({ sourceUrl: urls[0], settings }) });
    await pollJob(jobId);
  } catch (e) {
    const m = $('#processing-message'); if (m) m.textContent = 'ジョブの開始に失敗しました';
    console.error(e);
  }
}

async function pollJob(jobId) {
  const tick = async () => {
    try {
      const s = await apiFetch(`/jobs/${jobId}/status`);
      const bar = $('#progress-bar'); if (bar) bar.style.width = `${s.progress}%`;
      const perc = $('#progress-percentage'); if (perc) perc.textContent = `${s.progress}%`;
      if (s.status === 'completed') {
        const r = await apiFetch(`/jobs/${jobId}/results`);
        renderResults(r.clips);
        const m = $('#processing-message'); if (m) m.textContent = '完了しました';
        return;
      }
      if (s.status === 'failed') {
        const m = $('#processing-message'); if (m) m.textContent = '処理に失敗しました';
        return;
      }
      setTimeout(tick, 1500);
    } catch (_) {
      setTimeout(tick, 2000);
    }
  };
  tick();
}

function renderResults(clips) {
  const grid = $('#clips-grid'); if (!grid) return;
  grid.innerHTML = '';
  setHidden($('#results-section'), false);
  clips.forEach(c => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow overflow-hidden';
    card.innerHTML = `
      <div class="relative">
        <img src="${c.thumbnailUrl}" alt="thumb" class="w-full aspect-video object-cover" />
        <span class="absolute top-2 left-2 text-xs bg-black bg-opacity-60 text-white px-2 py-1 rounded">${c.duration}s</span>
      </div>
      <div class="p-4 space-y-2">
        <p class="text-sm text-gray-700">${c.title}</p>
        <a href="${c.downloadUrl}" class="inline-flex items-center text-blue-600 text-sm hover:underline"><i class="fas fa-download mr-2"></i>ダウンロード</a>
      </div>`;
    grid.appendChild(card);
  });
}

// Event wiring
function init() {
  try {
    // auth
    on($('#login-form'), 'submit', handleLogin);
    on($('#register-form'), 'submit', handleRegister);
    on($('#show-register-form'), 'click', () => { setHidden($('#login-form-container'), true); setHidden($('#register-form-container'), false); });
    on($('#show-login-form'), 'click', () => { setHidden($('#register-form-container'), true); setHidden($('#login-form-container'), false); });
    on($('#logout-button'), 'click', () => { authToken = ''; setHidden($('#app-container'), true); setHidden($('#auth-container'), false); });

    setupTabs();
    setupMode();
    setupSliders();
    updateTitlePreview();
    updateSummary();

    on($('#connection-test-button'), 'click', handleConnectionTest);
    on($('#process-button'), 'click', handleProcess);
    on($('#reset-button'), 'click', () => { location.reload(); });
  } catch (e) {
    console.error('Initialization failed', e);
  }
}

document.addEventListener('DOMContentLoaded', init);
