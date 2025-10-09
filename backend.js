document.addEventListener('DOMContentLoaded', () => {
    // --- 定数とグローバル変数 ---
    const API_BASE_URL = 'http://localhost:3000'; // バックエンドAPIのURL
    let currentJobId = null; // 現在処理中のジョブID
    let pollingInterval = null; // ポーリング処理のインターバルID

    // --- UI要素の取得 ---
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterFormLink = document.getElementById('show-register-form');
    const showLoginFormLink = document.getElementById('show-login-form');
    const logoutButton = document.getElementById('logout-button');
    const userEmailSpan = document.getElementById('user-email');
    const loginErrorP = document.getElementById('login-error');
    const registerMessageP = document.getElementById('register-message');
    const processButton = document.getElementById('process-button');
    const videoUrlsTextarea = document.getElementById('video-urls');
    const summaryList = document.getElementById('summary-list');
    const processingStatusDiv = document.getElementById('processing-status');

    // --- 認証関連のロジック ---
    // ... 既存の認証コード (変更なし) ...
    // フォーム表示切り替え
    showRegisterFormLink.addEventListener('click', () => {
        loginForm.parentElement.classList.add('hidden');
        registerForm.parentElement.classList.remove('hidden');
    });

    showLoginFormLink.addEventListener('click', () => {
        registerForm.parentElement.classList.add('hidden');
        loginForm.parentElement.classList.remove('hidden');
    });
    
    // 新規登録処理
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerMessageP.textContent = '';
        registerMessageP.className = 'text-sm mt-2 text-center h-4';

        const email = e.target.email.value;
        const password = e.target.password.value;
        const button = e.target.querySelector('button');
        button.disabled = true;
        button.textContent = '登録中...';

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.status === 201) {
                registerMessageP.textContent = '登録が完了しました。ログインしてください。';
                registerMessageP.classList.add('text-green-600');
                registerForm.reset();
                setTimeout(() => showLoginFormLink.click(), 2000);
            } else {
                throw new Error(data.message || '登録に失敗しました。');
            }
        } catch (error) {
            registerMessageP.textContent = error.message;
            registerMessageP.classList.add('text-red-600');
        } finally {
            button.disabled = false;
            button.textContent = '登録する';
        }
    });
    
    // ログイン処理
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginErrorP.textContent = '';
        const button = e.target.querySelector('button');
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>サインイン中...';

        const email = e.target.email.value;
        const password = e.target.password.value;

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.status === 200 && data.token) {
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userEmail', email);
                initializeAppUI(); 
            } else {
                 throw new Error(data.message || 'メールアドレスまたはパスワードが正しくありません。');
            }
        } catch (error) {
            loginErrorP.textContent = error.message;
        } finally {
            button.disabled = false;
            button.textContent = 'サインイン';
        }
    });
    
    // ログアウト処理
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userEmail');
        if(pollingInterval) clearInterval(pollingInterval);
        initializeAppUI();
    });
    
    // --- UIの初期化と状態管理 ---
    const initializeAppUI = () => {
        const token = localStorage.getItem('authToken');
        const userEmail = localStorage.getItem('userEmail');

        if (token && userEmail) {
            authContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');
            userEmailSpan.textContent = userEmail;
            if (!appContainer.dataset.initialized) {
                initializeMainAppLogic();
                appContainer.dataset.initialized = 'true';
            }
        } else {
            authContainer.classList.remove('hidden');
            appContainer.classList.add('hidden');
            userEmailSpan.textContent = '';
        }
    };

    // --- メインアプリケーションのロジック ---
    const initializeMainAppLogic = () => {
        document.querySelectorAll('[data-slider]').forEach(initSlider);
        document.querySelectorAll('.toggle-switch').forEach(initToggle);
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;
                document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active', 'text-blue-600', 'border-blue-600', 'font-semibold'));
                button.classList.add('active', 'text-blue-600', 'border-blue-600', 'font-semibold');

                if (tab === 'url') {
                    document.getElementById('url-content').classList.remove('hidden');
                    document.getElementById('upload-content').classList.add('hidden');
                } else {
                    document.getElementById('url-content').classList.add('hidden');
                    document.getElementById('upload-content').classList.remove('hidden');
                }
            });
        });
         document.querySelectorAll('.mode-button').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.mode-button').forEach(b => b.classList.remove('active', 'z-10', 'ring-2', 'ring-blue-500'));
                button.classList.add('active', 'z-10', 'ring-2', 'ring-blue-500');
                updateSummary();
            });
        });

        // 「処理開始」ボタンのイベントリスナーを追加
        processButton.addEventListener('click', submitJob);
        
        videoUrlsTextarea.addEventListener('input', updateSummary);
        
        updateSummary();
    };

    // --- ジョブ投入処理 ---
    const submitJob = async () => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            alert('ログインセッションが切れました。再度ログインしてください。');
            logoutButton.click();
            return;
        }

        const sourceUrl = videoUrlsTextarea.value.trim().split('\n')[0]; // 最初のURLのみ取得
        if (!sourceUrl) {
            alert('動画URLを入力してください。');
            return;
        }

        // UIから設定値を取得
        const settings = {
            mode: document.querySelector('.mode-button.active').id.includes('ai') ? 'ai' : 'manual',
            durationMin: parseInt(document.querySelector('[data-slider="duration"] [data-value="min"]').textContent),
            durationMax: parseInt(document.querySelector('[data-slider="duration"] [data-value="max"]').textContent),
            countMin: parseInt(document.querySelector('[data-slider="count"] [data-value="min"]').textContent),
            countMax: parseInt(document.querySelector('[data-slider="count"] [data-value="max"]').textContent),
            autoTitle: document.querySelector('[data-target="#title-settings-container"]').dataset.state === 'on',
            autoSubtitle: document.querySelectorAll('.toggle-switch')[1].dataset.state === 'on',
        };
        
        // ボタンを無効化し、ローディング表示
        processButton.disabled = true;
        processButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>処理を準備中...';
        processingStatusDiv.classList.remove('hidden');

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/jobs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ sourceUrl, settings }),
            });
            
            const data = await response.json();

            if (response.status === 202 && data.jobId) {
                currentJobId = data.jobId;
                console.log('ジョブが正常に投入されました。Job ID:', currentJobId);
                // ここから次のステップ（ポーリング）を開始する
                // startPollingStatus(currentJobId); 
            } else {
                throw new Error(data.message || 'ジョブの投入に失敗しました。');
            }

        } catch (error) {
            console.error('ジョブ投入エラー:', error);
            alert(`エラー: ${error.message}`);
            processingStatusDiv.classList.add('hidden');
        } finally {
            // ポーリングが開始されるので、ここではボタンの有効化はしない
        }
    };
    
    // --- UIヘルパー関数 (スライダー、トグル、サマリー) ---
    function initSlider(sliderContainer) {
        // ... (以前の省略されたコードを実装)
        const minThumb = sliderContainer.querySelector('[data-thumb="min"]');
        const maxThumb = sliderContainer.querySelector('[data-thumb="max"]');
        const range = sliderContainer.querySelector('.slider-range');
        const track = sliderContainer.querySelector('.slider-track');
        const minValSpan = sliderContainer.querySelector('[data-value="min"]');
        const maxValSpan = sliderContainer.querySelector('[data-value="max"]');

        const config = sliderContainer.dataset;
        const minVal = parseInt(config.min);
        const maxVal = parseInt(config.max);
        let currentMin = parseInt(config.startMin);
        let currentMax = parseInt(config.startMax);

        function updateThumbs() {
            const trackWidth = track.offsetWidth;
            const minPos = ((currentMin - minVal) / (maxVal - minVal)) * trackWidth;
            const maxPos = ((currentMax - minVal) / (maxVal - minVal)) * trackWidth;
            minThumb.style.left = `${minPos}px`;
            maxThumb.style.left = `${maxPos}px`;
            range.style.left = `${minPos}px`;
            range.style.width = `${maxPos - minPos}px`;
            minValSpan.textContent = currentMin;
            maxValSpan.textContent = currentMax;
            updateSummary();
        }

        function handleMove(thumb, e) {
            const rect = track.getBoundingClientRect();
            let clientX = e.clientX || e.touches[0].clientX;
            const newX = clientX - rect.left;
            const percent = Math.max(0, Math.min(1, newX / rect.width));
            let newValue = Math.round(minVal + percent * (maxVal - minVal));

            if (thumb === minThumb) {
                currentMin = Math.min(newValue, currentMax - 1);
            } else {
                currentMax = Math.max(newValue, currentMin + 1);
            }
            updateThumbs();
        }
        
        [minThumb, maxThumb].forEach(thumb => {
            thumb.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const onMouseMove = (moveEvent) => handleMove(thumb, moveEvent);
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
             thumb.addEventListener('touchstart', (e) => {
                const onTouchMove = (moveEvent) => handleMove(thumb, moveEvent);
                const onTouchEnd = () => {
                    document.removeEventListener('touchmove', onTouchMove);
                    document.removeEventListener('touchend', onTouchEnd);
                };
                document.addEventListener('touchmove', onTouchMove);
                document.addEventListener('touchend', onTouchEnd);
            });
        });

        updateThumbs();
    }

    function initToggle(toggleButton) {
        toggleButton.addEventListener('click', () => {
            const currentState = toggleButton.dataset.state;
            const newState = currentState === 'on' ? 'off' : 'on';
            toggleButton.dataset.state = newState;
            
            const span = toggleButton.querySelector('span');
            if (newState === 'on') {
                toggleButton.classList.remove('bg-gray-200');
                toggleButton.classList.add('bg-blue-600');
                span.style.transform = 'translateX(1.25rem)';
            } else {
                toggleButton.classList.add('bg-gray-200');
                toggleButton.classList.remove('bg-blue-600');
                span.style.transform = 'translateX(0)';
            }
            
            const targetId = toggleButton.dataset.target;
            if (targetId) {
                document.querySelector(targetId).classList.toggle('hidden', newState === 'off');
            }
            updateSummary();
        });
    }

    function updateSummary() {
        const urlCount = videoUrlsTextarea.value.trim() ? videoUrlsTextarea.value.trim().split('\n').length : 0;
        
        if (urlCount === 0) {
            processButton.disabled = true;
            summaryList.innerHTML = '<li>動画URLを入力してください</li>';
            return;
        }
        processButton.disabled = false;
        
        const settings = {
            mode: document.querySelector('.mode-button.active').textContent.trim(),
            durationMin: document.querySelector('[data-slider="duration"] [data-value="min"]').textContent,
            durationMax: document.querySelector('[data-slider="duration"] [data-value="max"]').textContent,
            countMin: document.querySelector('[data-slider="count"] [data-value="min"]').textContent,
            countMax: document.querySelector('[data-slider="count"] [data-value="max"]').textContent,
            autoTitle: document.querySelector('[data-target="#title-settings-container"]').dataset.state,
        };

        summaryList.innerHTML = `
            <li>${urlCount}件の動画を処理 (URL: ${urlCount}件, ファイル: 0件)</li>
            <li>各動画から${settings.countMin}〜${settings.countMax}本のクリップを生成</li>
            <li>各クリップの長さ: ${settings.durationMin}〜${settings.durationMax}秒</li>
            <li>タイトル自動生成: ${settings.autoTitle.toUpperCase()}</li>
        `;
    }

    // --- ページ読み込み時の最初の処理 ---
    initializeAppUI();
});


