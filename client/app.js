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

function setHidden(el, hidden) { if (hidden) el.classList.add('hidden'); else el.classList.remove('hidden'); }

// Auth flows
async function handleLogin(e) {
  e.preventDefault();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value.trim();
  try {
    const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    authToken = data.token;
    $('#user-email').textContent = email;
    setHidden($('#auth-container'), true);
    setHidden($('#app-container'), false);
  } catch (err) {
    $('#login-error').textContent = 'ログインに失敗しました';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = $('#register-email').value.trim();
  const password = $('#register-password').value.trim();
  try {
    await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) });
    $('#register-message').textContent = '登録に成功しました。ログインしてください。';
    setHidden($('#register-form-container'), true);
    setHidden($('#login-form-container'), false);
    $('#login-email').value = email;
  } catch (err) {
    $('#register-message').textContent = '登録に失敗しました';
  }
}

// Tabs
function setupTabs() {
  $all('.tab-button').forEach(btn => btn.addEventListener('click', () => {
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
  aiBtn.addEventListener('click', () => { aiBtn.classList.add('bg-white', 'text-blue-600'); manualBtn.classList.remove('bg-white', 'text-blue-600'); });
  manualBtn.addEventListener('click', () => { manualBtn.classList.add('bg-white', 'text-blue-600'); aiBtn.classList.remove('bg-white', 'text-blue-600'); });
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
      const min = +container.getAttribute('data-min');
      const max = +container.getAttribute('data-max');
      let curMin = +container.getAttribute('data-start-min');
      let curMax = +container.getAttribute('data-start-max');
      const trackWidth = container.querySelector('.slider-track').clientWidth;

      function update() {
        const left = ((curMin - min) / (max - min)) * 100;
        const right = ((curMax - min) / (max - min)) * 100;
        rangeEl.style.left = left + '%';
        rangeEl.style.right = (100 - right) + '%';
        minThumb.style.left = left + '%';
        maxThumb.style.left = right + '%';
        minLabel.textContent = curMin;
        maxLabel.textContent = curMax;
        updateSummary();
      }

      function attachDrag(thumb, isMin) {
        function onMove(e) {
          const rect = container.getBoundingClientRect();
          const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
          const value = Math.round(min + (x / rect.width) * (max - min));
          if (isMin) curMin = Math.min(value, curMax);
          else curMax = Math.max(value, curMin);
          update();
        }
        function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
        thumb.addEventListener('mousedown', () => { window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); });
      }

      attachDrag(minThumb, true);
      attachDrag(maxThumb, false);
      update();
    });
}

// Title settings UI
function getTitleSettings() {
  return {
    auto: $('#autoTitleToggle').checked,
    font: $('#title-font').value,
    weight: +$('#title-weight').value,
    mainSize: +$('#main-title-size').value,
    mainColor: $('#main-title-color').value,
    mainStrokeWidth: +$('#main-title-stroke').value,
    mainStrokeColor: $('#main-title-stroke-color').value,
    subSize: +$('#sub-title-size').value,
    subColor: $('#sub-title-color').value,
    subStrokeWidth: +$('#sub-title-stroke').value,
    subStrokeColor: $('#sub-title-stroke-color').value,
  };
}

function updateTitlePreview() {
  const s = getTitleSettings();
  const main = $('#preview-main-title');
  const sub = $('#preview-sub-title');
  main.style.fontWeight = String(s.weight);
  main.style.fontSize = s.mainSize + 'px';
  main.style.color = s.mainColor;
  main.style.textShadow = `${s.mainStrokeColor} 0px 0px ${Math.max(1, s.mainStrokeWidth)}px`;
  sub.style.fontSize = s.subSize + 'px';
  sub.style.color = s.subColor;
  sub.style.textShadow = `${s.subStrokeColor} 0px 0px ${Math.max(1, s.subStrokeWidth)}px`;
}

$all('#main-title-size,#main-title-stroke,#main-title-color,#main-title-stroke-color,#sub-title-size,#sub-title-stroke,#sub-title-color,#sub-title-stroke-color,#title-font,#title-weight'.split(','))
  .forEach(sel => document.querySelector(sel).addEventListener('input', () => { updateTitlePreview(); updateSummary(); }));

$('#autoTitleToggle').addEventListener('change', () => { setHidden($('#title-settings-container'), !$('#autoTitleToggle').checked); updateSummary(); });

// Summary
function updateSummary() {
  const ul = $('#summary-list');
  ul.innerHTML = '';

  // duration
  const duration = document.querySelector('[data-slider="duration"]');
  const dmin = duration.querySelector('[data-value="min"]').textContent;
  const dmax = duration.querySelector('[data-value="max"]').textContent;
  // count
  const count = document.querySelector('[data-slider="count"]');
  const cmin = count.querySelector('[data-value="min"]').textContent;
  const cmax = count.querySelector('[data-value="max"]').textContent;

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
  const urls = $('#video-urls').value.trim().split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (urls.length === 0) return;
  const btn = $('#connection-test-button');
  const original = btn.querySelector('.btn-text').textContent;
  btn.disabled = true; btn.querySelector('.btn-text').textContent = '接続確認中...';
  try {
    const res = await apiFetch('/jobs/test-url', { method: 'POST', body: JSON.stringify({ url: urls[0] }) });
    btn.querySelector('.btn-text').textContent = `成功: ${res.title}`;
  } catch (_) {
    btn.querySelector('.btn-text').textContent = '失敗しました';
  } finally {
    setTimeout(() => { btn.disabled = false; btn.querySelector('.btn-text').textContent = original; }, 1500);
  }
}

// Start processing
async function handleProcess() {
  const urls = $('#video-urls').value.trim().split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (urls.length === 0) return;
  const duration = document.querySelector('[data-slider="duration"]');
  const count = document.querySelector('[data-slider="count"]');
  const settings = {
    durationMin: +duration.querySelector('[data-value="min"]').textContent,
    durationMax: +duration.querySelector('[data-value="max"]').textContent,
    countMin: +count.querySelector('[data-value="min"]').textContent,
    countMax: +count.querySelector('[data-value="max"]').textContent,
    title: getTitleSettings(),
  };

  setHidden($('#processing-status'), false);
  $('#processing-message').textContent = '処理を開始しています...';
  $('#progress-bar').style.width = '0%';
  $('#progress-percentage').textContent = '0%';

  try {
    const { jobId } = await apiFetch('/jobs', { method: 'POST', body: JSON.stringify({ sourceUrl: urls[0], settings }) });
    await pollJob(jobId);
  } catch (e) {
    $('#processing-message').textContent = 'ジョブの開始に失敗しました';
  }
}

async function pollJob(jobId) {
  const tick = async () => {
    try {
      const s = await apiFetch(`/jobs/${jobId}/status`);
      $('#progress-bar').style.width = `${s.progress}%`;
      $('#progress-percentage').textContent = `${s.progress}%`;
      if (s.status === 'completed') {
        const r = await apiFetch(`/jobs/${jobId}/results`);
        renderResults(r.clips);
        $('#processing-message').textContent = '完了しました';
        return;
      }
      if (s.status === 'failed') {
        $('#processing-message').textContent = '処理に失敗しました';
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
  const grid = $('#clips-grid');
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
  // auth
  $('#login-form').addEventListener('submit', handleLogin);
  $('#register-form').addEventListener('submit', handleRegister);
  $('#show-register-form').addEventListener('click', () => { setHidden($('#login-form-container'), true); setHidden($('#register-form-container'), false); });
  $('#show-login-form').addEventListener('click', () => { setHidden($('#register-form-container'), true); setHidden($('#login-form-container'), false); });
  $('#logout-button').addEventListener('click', () => { authToken = ''; setHidden($('#app-container'), true); setHidden($('#auth-container'), false); });

  setupTabs();
  setupMode();
  setupSliders();
  updateTitlePreview();
  updateSummary();

  $('#connection-test-button').addEventListener('click', handleConnectionTest);
  $('#process-button').addEventListener('click', handleProcess);
  $('#reset-button').addEventListener('click', () => { location.reload(); });
}

document.addEventListener('DOMContentLoaded', init);
