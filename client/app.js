document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = '/api/v1';
    const WS_URL = `ws://${window.location.host}`;

    // --- DOM要素の取得 ---
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterFormLink = document.getElementById('show-register-form');
    const showLoginFormLink = document.getElementById('show-login-form');
    const logoutButton = document.getElementById('logout-button');
    const userEmailSpan = document.getElementById('user-email');
    const processButton = document.getElementById('process-button');
    const videoUrlsTextarea = document.getElementById('video-urls');
    const connectionTestButton = document.getElementById('connection-test-button');
    const summaryList = document.getElementById('summary-list');
    const settingsSection = document.getElementById('settings-section');
    const resultsSection = document.getElementById('results-section');
    const clipsGrid = document.getElementById('clips-grid');
    const resetButton = document.getElementById('reset-button');
    const titleSettingsContainer = document.getElementById('title-settings-container');
    const statusLog = document.getElementById('status-log');
    const analysisGraphContainer = document.getElementById('analysis-graph-container');
    const excitementChartCanvas = document.getElementById('excitement-chart');

    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');
    const keywordsTextarea = document.getElementById('keywords');
    const desiredDurationInput = document.getElementById('desired-duration');
    const addCaptionsToggle = document.getElementById('addCaptionsToggle');
    const highlightKeywordsTextarea = document.getElementById('highlight-keywords');
    const bgmAtmosphereSelect = document.getElementById('bgm-atmosphere');
    const cameraWorkSelect = document.getElementById('camera-work');
    const captionSettingsContainer = document.getElementById('caption-settings-container');

    const loadVideoButton = document.getElementById('load-video-button');
    const videoMetadataDisplay = document.getElementById('video-metadata-display');
    const metadataTitle = document.getElementById('metadata-title');
    const metadataDuration = document.getElementById('metadata-duration');
    const metadataAudioTrack = document.getElementById('metadata-audio-track');
    const costEstimateDisplay = document.getElementById('cost-estimate-display');
    const estimatedCostSpan = document.getElementById('estimated-cost');

    // --- 状態管理 ---
    let socket = null;
    let currentSettings = {
        mode: 'ai',
        durationMin: 50,
        durationMax: 120,
        countMin: 3,
        countMax: 8,
        autoTitle: true,
        autoSubtitle: true,
        startTime: '',
        endTime: '',
        keywords: '',
        desiredDuration: 0,
        addCaptions: true,
        highlightKeywords: '',
        bgmAtmosphere: '',
        cameraWork: '',
        videoMetadata: null,
        title: {
            font: 'Noto Sans JP',
            weight: '700',
            mainSize: 80,
            mainColor: '#FFFFFF',
            mainStrokeWidth: 2,
            mainStrokeColor: '#000000',
            subSize: 60,
            subColor: '#FFFFFF',
            subStrokeWidth: 2,
            subStrokeColor: '#000000',
        }
    };

    // --- 汎用関数 ---
    const getToken = () => localStorage.getItem('authToken');

    const apiFetch = async (endpoint, options = {}) => {
        const token = getToken();
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
            if (response.status === 401 || response.status === 403) {
                handleLogout();
                throw new Error('セッションが切れました。再度ログインしてください。');
            }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: '不明なエラーが発生しました。' }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return response.json();
            }
            return response.text();
        } catch (error) {
            console.error('API Fetch Error:', error);
            throw error;
        }
    };

    // --- UI更新関数 ---
    const updateUIForAuthState = () => {
        const token = getToken();
        if (token) {
            if (authContainer) authContainer.classList.add('hidden');
            if (appContainer) appContainer.classList.remove('hidden');
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (userEmailSpan) userEmailSpan.textContent = payload.email;
            } catch (e) { handleLogout(); return; }
            if (appContainer && !appContainer.dataset.initialized) {
                 initializeMainApp();
                 appContainer.dataset.initialized = 'true';
            }
        } else {
            if (authContainer) authContainer.classList.remove('hidden');
            if (appContainer) appContainer.classList.add('hidden');
        }
    };
    
    const updateSummary = () => {
        if (!summaryList) return;
        const { durationMin, durationMax, countMin, countMax, autoTitle, autoSubtitle, startTime, endTime, keywords, desiredDuration, addCaptions, highlightKeywords, bgmAtmosphere, cameraWork, title } = currentSettings;
        let summaryHTML = `
            <li><i class="fas fa-clock text-gray-400 mr-2"></i>長さ: ${durationMin}〜${durationMax}秒</li>
            <li><i class="fas fa-list-ol text-gray-400 mr-2"></i>本数: ${countMin}〜${countMax}本</li>
            <li><i class="fas fa-heading text-gray-400 mr-2"></i>タイトル: ${autoTitle ? 'ON' : 'OFF'}</li>
            <li><i class="fas fa-closed-captioning text-gray-400 mr-2"></i>サブタイトル: ${autoSubtitle ? 'ON' : 'OFF'}</li>
        `;
        if (startTime && endTime) {
            summaryHTML += `<li><i class="fas fa-video text-gray-400 mr-2"></i>時間指定: ${startTime} - ${endTime}</li>`;
        }
        if (keywords) {
            summaryHTML += `<li><i class="fas fa-tags text-gray-400 mr-2"></i>キーワード: ${keywords}</li>`;
        }
        if (desiredDuration > 0) {
            summaryHTML += `<li><i class="fas fa-ruler-horizontal text-gray-400 mr-2"></i>希望尺: ${desiredDuration}秒</li>`;
        }
        summaryHTML += `<li><i class="fas fa-closed-captioning text-gray-400 mr-2"></i>テロップ: ${addCaptions ? 'ON' : 'OFF'}</li>`;
        if (addCaptions && highlightKeywords) {
            summaryHTML += `<ul class="list-disc list-inside pl-5 text-xs text-gray-500"><li>強調キーワード: ${highlightKeywords}</li></ul>`;
        }
        if (bgmAtmosphere) {
            summaryHTML += `<li><i class="fas fa-music text-gray-400 mr-2"></i>BGM: ${bgmAtmosphere}</li>`;
        }
        if (cameraWork) {
            summaryHTML += `<li><i class="fas fa-camera text-gray-400 mr-2"></i>カメラワーク: ${cameraWork}</li>`;
        }
        if (autoTitle) {
            summaryHTML += `<ul class="list-disc list-inside pl-5 text-xs text-gray-500"><li>フォント: ${title.font}, ${title.weight === '700' ? '太字' : '標準'}</li></ul>`;
        }
        summaryList.innerHTML = summaryHTML;
    };
    
    const updateTitlePreview = () => {
        const mainTitle = document.getElementById('preview-main-title');
        const subTitle = document.getElementById('preview-sub-title');
        if (!mainTitle || !subTitle) return;

        const { font, weight, mainSize, mainColor, mainStrokeWidth, mainStrokeColor, subSize, subColor, subStrokeWidth, subStrokeColor } = currentSettings.title;
        mainTitle.style.fontFamily = `'${font}', sans-serif`;
        mainTitle.style.fontWeight = weight;
        mainTitle.style.fontSize = `${mainSize / 2.8}px`;
        mainTitle.style.color = mainColor;
        mainTitle.style.textShadow = `${mainStrokeWidth}px ${mainStrokeWidth}px 0 ${mainStrokeColor}, -${mainStrokeWidth}px -${mainStrokeWidth}px 0 ${mainStrokeColor}, ${mainStrokeWidth}px -${mainStrokeWidth}px 0 ${mainStrokeColor}, -${mainStrokeWidth}px ${mainStrokeWidth}px 0 ${mainStrokeColor}`;
        subTitle.style.display = currentSettings.autoSubtitle ? 'block' : 'none';
        subTitle.style.fontFamily = `'${font}', sans-serif`;
        subTitle.style.fontWeight = weight;
        subTitle.style.fontSize = `${subSize / 2.8}px`;
        subTitle.style.color = subColor;
        subTitle.style.textShadow = `${subStrokeWidth}px ${subStrokeWidth}px 0 ${subStrokeColor}, -${subStrokeWidth}px -${subStrokeWidth}px 0 ${subStrokeColor}, ${subStrokeWidth}px -${subStrokeWidth}px 0 ${subStrokeColor}, -${subStrokeWidth}px ${subStrokeWidth}px 0 ${subStrokeColor}`;
    };

    const renderClips = (clips) => {
        if (!clipsGrid) return;
        clipsGrid.innerHTML = '';
        if (!clips || clips.length === 0) {
            clipsGrid.innerHTML = '<p class="col-span-full text-center text-gray-500">クリップが生成されませんでした。動画が短いか、音声が少ない可能性があります。</p>';
            return;
        }
        clips.forEach(clip => {
            const downloadUrlWithToken = `${clip.downloadUrl}?token=${getToken()}`;
            const clipCard = `
                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                    <div class="bg-gray-200 aspect-video flex items-center justify-center">
                        <img src="${clip.thumbnailUrl}" alt="Clip thumbnail" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<i class=\'fas fa-film text-4xl text-gray-400\'></i>';">
                    </div>
                    <div class="p-4">
                        <p class="font-semibold text-sm mb-2 truncate" title="${clip.title}">${clip.title}</p>
                        <div class="flex justify-between items-center text-xs text-gray-500 mb-4">
                            <span><i class="fas fa-clock mr-1"></i>${clip.duration}秒</span>
                        </div>
                        <a href="${downloadUrlWithToken}" class="w-full bg-blue-600 text-white text-sm text-center py-2 px-3 rounded-md hover:bg-blue-700 flex items-center justify-center" download>
                            <i class="fas fa-download mr-2"></i>ダウンロード
                        </a>
                    </div>
                </div>`;
            clipsGrid.innerHTML += clipCard;
        });
    };
    
    const resetUI = () => {
        if (settingsSection) settingsSection.classList.remove('hidden');
        if (resultsSection) resultsSection.classList.add('hidden');
        if (analysisGraphContainer) analysisGraphContainer.classList.add('hidden');
        const processingStatus = document.getElementById('processing-status');
        if (processingStatus) processingStatus.classList.add('hidden');
        if (statusLog) statusLog.innerHTML = '';
        if (processButton) {
            processButton.disabled = false;
            processButton.innerHTML = '<i class="fas fa-cogs mr-2"></i>処理開始';
        }
        if (videoUrlsTextarea) videoUrlsTextarea.value = '';
        currentSettings.videoMetadata = null;
        if (videoMetadataDisplay) videoMetadataDisplay.classList.add('hidden');
        if (costEstimateDisplay) costEstimateDisplay.classList.add('hidden');
        updateSummary();
    };

    // --- イベントハンドラ ---
    const handleAuthFormSubmit = async (e, formType) => {
        e.preventDefault();
        const form = e.target;
        if (!form) return;
        const button = form.querySelector('button[type="submit"]');
        const originalButtonText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const endpoint = formType === 'login' ? '/auth/login' : '/auth/register';
        const errorEl = document.getElementById(`${formType}-error`);
        if(errorEl) errorEl.textContent = '';
        try {
            const result = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(data) });
            if (formType === 'login') {
                localStorage.setItem('authToken', result.token);
                updateUIForAuthState();
            } else {
                alert('登録が成功しました。ログインしてください。');
                form.reset();
                if (showLoginFormLink) showLoginFormLink.click();
            }
        } catch (error) {
            if(errorEl) errorEl.textContent = error.message;
        } finally {
            button.disabled = false;
            button.innerHTML = originalButtonText;
        }
    };
    
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
        if (appContainer) appContainer.dataset.initialized = 'false';
        updateUIForAuthState();
    };

    const handleProcessButtonClick = async () => {
        if (!videoUrlsTextarea || !processButton) return;
        const sourceUrl = videoUrlsTextarea.value.trim().split('\n')[0];
        if (!sourceUrl) { alert('動画URLを入力してください。'); return; }
        if (!currentSettings.videoMetadata) { alert('まず動画を読み込んでください。'); return; }
        processButton.disabled = true;
        processButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>処理中...';
        const processingStatus = document.getElementById('processing-status');
        if (processingStatus) processingStatus.classList.remove('hidden');
        if (statusLog) statusLog.innerHTML = '';
        if (clipsGrid) clipsGrid.innerHTML = '';
        if (resultsSection) resultsSection.classList.remove('hidden');
        if (settingsSection) settingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        try {
            const data = await apiFetch('/jobs', { method: 'POST', body: JSON.stringify({ sourceUrl, settings: currentSettings }) });
            startWebSocketStatusListener(data.jobId);
        } catch (error) {
            alert(`エラー: ${error.message}`);
            resetUI();
        }
    };

    const handleLoadVideo = async () => {
        if (!videoUrlsTextarea || !loadVideoButton) return;
        const url = videoUrlsTextarea.value.trim().split('\n')[0];
        if (!url) { alert('動画URLを入力してください。'); return; }
        const buttonTextSpan = loadVideoButton.querySelector('.btn-text');
        const originalText = buttonTextSpan.textContent;
        const icon = loadVideoButton.querySelector('i');
        buttonTextSpan.textContent = '読み込み中...';
        loadVideoButton.disabled = true;
        if (costEstimateDisplay) costEstimateDisplay.classList.add('hidden');
        if (estimatedCostSpan) estimatedCostSpan.textContent = '計算中...';
        if (videoMetadataDisplay) videoMetadataDisplay.classList.add('hidden');

        try {
            const result = await apiFetch('/jobs/get-video-metadata', { method: 'POST', body: JSON.stringify({ url }) });
            currentSettings.videoMetadata = result;
            
            if (metadataTitle) metadataTitle.textContent = result.title;
            if (metadataDuration) metadataDuration.textContent = `${result.duration}秒`;
            if (metadataAudioTrack) metadataAudioTrack.textContent = result.hasAudioTrack ? 'あり' : 'なし';
            if (videoMetadataDisplay) videoMetadataDisplay.classList.remove('hidden');

            if (buttonTextSpan) buttonTextSpan.textContent = '読み込み完了';
            if (icon) icon.className = 'fas fa-check-circle text-green-500 mr-2';
            
            calculateCost();
            if (costEstimateDisplay) costEstimateDisplay.classList.remove('hidden');

        } catch (error) {
            if (buttonTextSpan) buttonTextSpan.textContent = '読み込み失敗';
            if (icon) icon.className = 'fas fa-times-circle text-red-500 mr-2';
            alert(`エラー: ${error.message}`);
            currentSettings.videoMetadata = null;
            if (videoMetadataDisplay) videoMetadataDisplay.classList.add('hidden');
            if (costEstimateDisplay) costEstimateDisplay.classList.add('hidden');
        }
        setTimeout(() => {
            if (buttonTextSpan) buttonTextSpan.textContent = originalText;
            if (icon) icon.className = 'fas fa-video mr-2';
            if (loadVideoButton) loadVideoButton.disabled = false;
        }, 3000);
    };

    const calculateCost = () => {
        if (!estimatedCostSpan || !costEstimateDisplay) return;
        if (!currentSettings.videoMetadata) {
            estimatedCostSpan.textContent = '動画を読み込んでください';
            costEstimateDisplay.classList.remove('hidden');
            return;
        }

        const { duration, hasAudioTrack } = currentSettings.videoMetadata;
        const { durationMin, durationMax, countMin, countMax, addCaptions, highlightKeywords, bgmAtmosphere, cameraWork } = currentSettings;

        let baseCost = 0;
        let sttCostPerSecond = 0.0004;
        let nlCostPerText = 0.001;
        let ffmpegCostPerSecond = 0.0001;
        let bgmCost = 0.01;
        let cameraWorkCostPerSecond = 0.0005;

        let totalProcessingDuration = duration;
        if (currentSettings.startTime && currentSettings.endTime) {
            const userStartTime = parseTimeToSeconds(currentSettings.startTime);
            const userEndTime = parseTimeToSeconds(currentSettings.endTime);
            if (!isNaN(userStartTime) && !isNaN(userEndTime) && userEndTime > userStartTime) {
                totalProcessingDuration = userEndTime - userStartTime;
            }
        }
        
        if (hasAudioTrack) {
            baseCost += totalProcessingDuration * sttCostPerSecond;
        }

        baseCost += totalProcessingDuration * ffmpegCostPerSecond;
        baseCost += ((durationMin + durationMax) / 2) * ((countMin + countMax) / 2) * ffmpegCostPerSecond;

        if (addCaptions) {
            baseCost += totalProcessingDuration * ffmpegCostPerSecond * 0.5;
            if (highlightKeywords) {
                baseCost += totalProcessingDuration * ffmpegCostPerSecond * 0.2;
            }
        }
        if (bgmAtmosphere) {
            baseCost += bgmCost;
        }
        if (cameraWork === 'zoom_on_emotion') {
            baseCost += totalProcessingDuration * cameraWorkCostPerSecond;
        }

        if (hasAudioTrack) {
            baseCost += totalProcessingDuration * nlCostPerText / 1000;
        }

        const estimatedCostYen = Math.round(baseCost * 150);
        estimatedCostSpan.textContent = `約 ${estimatedCostYen} 円`;
    };

    const startWebSocketStatusListener = (jobId) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
        }

        socket = new WebSocket(WS_URL);

        socket.onopen = () => {
            console.log('WebSocket connected, subscribing to job');
            socket.send(JSON.stringify({ type: 'subscribe', jobId: jobId }));
        };

        socket.onclose = () => {
            console.log('WebSocket disconnected.');
        };

        socket.onerror = (err) => {
            console.error('WebSocket error:', err);
            logStatusMessage('リアルタイム更新でエラーが発生しました。', 'error');
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'jobUpdate') {
                    const job = data.job;
                    
                    logStatusMessage(job.statusMessage, job.status);

                    const progressBar = document.getElementById('progress-bar');
                    const progressPercentage = document.getElementById('progress-percentage');
                    if(progressBar && progressPercentage) {
                        progressBar.style.width = `${job.progress}%`;
                        progressPercentage.textContent = `${job.progress}%`;
                    }

                    if (job.status === 'completed' || job.status === 'failed') {
                        if (socket) socket.close();
                        
                        if(progressBar) {
                            progressBar.classList.remove('bg-blue-600');
                            progressBar.classList.toggle('bg-green-500', job.status === 'completed');
                            progressBar.classList.toggle('bg-red-500', job.status === 'failed');
                        }

                        if (job.status === 'completed') {
                            setTimeout(() => fetchResults(job.jobId), 500);
                        }
                    }
                }
            } catch (e) {
                console.error('Error processing WebSocket message:', e);
            }
        };
    };

    const logStatusMessage = (message, status) => {
        if (!statusLog) return;
        const entry = document.createElement('div');
        const timestamp = new Date().toLocaleTimeString();
        entry.innerHTML = `<span class="text-gray-500 mr-2">${timestamp}</span>`;

        if (status === 'failed') {
            entry.className = 'text-red-400';
            entry.innerHTML += `[エラー] ${message}`;
        } else {
            entry.className = 'text-white';
            entry.innerHTML += message;
        }
        
        statusLog.appendChild(entry);
        statusLog.parentElement.scrollTop = statusLog.parentElement.scrollHeight;
    };

    const fetchResults = async (jobId) => {
        try {
            // クリップ情報と分析情報を並行して取得
            const [clipsData, analysisData] = await Promise.all([
                apiFetch(`/jobs/${jobId}/results`),
                apiFetch(`/jobs/${jobId}/analysis`).catch(e => {
                    console.warn('Analysis data could not be fetched, graph will not be shown.');
                    return null; // 分析データがなくてもエラーにしない
                })
            ]);

            if (settingsSection) settingsSection.classList.add('hidden');
            if (resultsSection) resultsSection.classList.remove('hidden');
            if (resultsSection) resultsSection.scrollIntoView({ behavior: 'smooth' });
            
            renderClips(clipsData.clips);

            if (analysisData && analysisGraphContainer) {
                analysisGraphContainer.classList.remove('hidden');
                renderAnalysisChart(analysisData);
            }

        } catch (error) {
            alert(`結果の取得に失敗: ${error.message}`);
        }
    };

    let chartInstance = null;
    const renderAnalysisChart = (analysisData) => {
        if (!excitementChartCanvas) return;
        const { excitementScoreTimeline, highlights } = analysisData;

        const ctx = excitementChartCanvas.getContext('2d');
        if (chartInstance) {
            chartInstance.destroy();
        }

        const labels = excitementScoreTimeline.map((_, i) => i);
        const highlightAnnotations = highlights.map(h => ({
            type: 'box',
            xMin: h.startTime,
            xMax: h.startTime + h.duration,
            backgroundColor: 'rgba(255, 215, 0, 0.2)',
            borderColor: 'rgba(255, 215, 0, 0.5)',
            borderWidth: 1,
        }));

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '盛り上がりスコア',
                    data: excitementScoreTimeline,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: '時間 (秒)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'スコア'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    },
                    annotation: {
                        annotations: highlightAnnotations
                    }
                }
            }
        });
    };
    
    const initializeSliders = () => {
        document.querySelectorAll('[data-slider]').forEach(sliderContainer => {
            const type = sliderContainer.dataset.slider;
            const minVal = parseInt(sliderContainer.dataset.min, 10);
            const maxVal = parseInt(sliderContainer.dataset.max, 10);
            const minThumb = sliderContainer.querySelector('[data-thumb="min"]');
            const maxThumb = sliderContainer.querySelector('[data-thumb="max"]');
            const range = sliderContainer.querySelector('.slider-range');
            const minValueEl = sliderContainer.querySelector('[data-value="min"]');
            const maxValueEl = sliderContainer.querySelector('[data-value="max"]');

            if (!minThumb || !maxThumb || !range || !minValueEl || !maxValueEl) return;

            const updateThumbs = () => {
                const minPos = ((currentSettings[`${type}Min`] - minVal) / (maxVal - minVal)) * 100;
                const maxPos = ((currentSettings[`${type}Max`] - minVal) / (maxVal - minVal)) * 100;
                minThumb.style.left = `${minPos}%`;
                maxThumb.style.left = `${maxPos}%`;
                range.style.left = `${minPos}%`;
                range.style.width = `${maxPos - minPos}%`;
                minValueEl.textContent = currentSettings[`${type}Min`];
                maxValueEl.textContent = currentSettings[`${type}Max`];
            };
            const handleMouseMove = (e, thumbType) => {
                e.preventDefault();
                const rect = sliderContainer.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const percent = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
                let newValue = Math.round(minVal + (percent / 100) * (maxVal - minVal));
                if (thumbType === 'min') {
                    currentSettings[`${type}Min`] = Math.min(newValue, currentSettings[`${type}Max`]);
                } else {
                    currentSettings[`${type}Max`] = Math.max(newValue, currentSettings[`${type}Min`]);
                }
                updateThumbs();
                updateSummary();
                calculateCost();
            };
            
            [minThumb, maxThumb].forEach(thumb => {
                const eventRoot = window.matchMedia('(hover: none)').matches ? thumb : document;
                const thumbType = thumb.dataset.thumb;
                const onStart = (e) => {
                    const onMove = (moveEvent) => handleMouseMove(moveEvent, thumbType);
                    const onEnd = () => {
                        eventRoot.removeEventListener(e.type === 'touchstart' ? 'touchmove' : 'mousemove', onMove);
                        eventRoot.removeEventListener(e.type === 'touchstart' ? 'touchend' : 'mouseup', onEnd);
                    };
                    eventRoot.addEventListener(e.type === 'touchstart' ? 'touchmove' : 'mousemove', onMove);
                    eventRoot.addEventListener(e.type === 'touchstart' ? 'touchend' : 'mouseup', onEnd);
                };
                thumb.addEventListener('mousedown', onStart);
                thumb.addEventListener('touchstart', onStart, { passive: true });
            });
            updateThumbs();
        });
    };
    
    const initializeToggles = () => {
        if (addCaptionsToggle) {
            addCaptionsToggle.addEventListener('change', (e) => {
                currentSettings.addCaptions = e.target.checked;
                if (captionSettingsContainer) {
                    captionSettingsContainer.style.display = e.target.checked ? 'block' : 'none';
                }
                updateSummary();
                calculateCost();
            });
            if (captionSettingsContainer) {
                 captionSettingsContainer.style.display = currentSettings.addCaptions ? 'block' : 'none';
            }
        }
        const autoTitleToggle = document.getElementById('autoTitleToggle');
        if (autoTitleToggle) {
            autoTitleToggle.addEventListener('change', (e) => {
                currentSettings.autoTitle = e.target.checked;
                if (titleSettingsContainer) {
                    titleSettingsContainer.style.maxHeight = e.target.checked ? `${titleSettingsContainer.scrollHeight}px` : '0px';
                    titleSettingsContainer.style.opacity = e.target.checked ? '1' : '0';
                }
                updateSummary();
                updateTitlePreview();
                calculateCost();
            });
        }
        const autoSubtitleToggle = document.getElementById('autoSubtitleToggle');
        if (autoSubtitleToggle) {
            autoSubtitleToggle.addEventListener('change', (e) => {
                currentSettings.autoSubtitle = e.target.checked;
                updateSummary();
                updateTitlePreview();
                calculateCost();
            });
        }
    };

    const initializeTitleSettings = () => {
        const inputs = {
            'title-font': 'font', 'title-weight': 'weight',
            'main-title-size': 'mainSize', 'main-title-color': 'mainColor', 'main-title-stroke': 'mainStrokeWidth', 'main-title-stroke-color': 'mainStrokeColor',
            'sub-title-size': 'subSize', 'sub-title-color': 'subColor', 'sub-title-stroke': 'subStrokeWidth', 'sub-title-stroke-color': 'subStrokeColor',
        };
        Object.entries(inputs).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', (e) => {
                    currentSettings.title[key] = e.target.value;
                    const valEl = document.getElementById(`${id}-val`);
                    if(valEl) valEl.textContent = e.target.value;
                    updateSummary();
                    updateTitlePreview();
                    calculateCost();
                });
            }
        });
    };

    const initializeNewSettings = () => {
        if (startTimeInput) startTimeInput.addEventListener('input', (e) => { currentSettings.startTime = e.target.value; updateSummary(); calculateCost(); });
        if (endTimeInput) endTimeInput.addEventListener('input', (e) => { currentSettings.endTime = e.target.value; updateSummary(); calculateCost(); });
        if (keywordsTextarea) keywordsTextarea.addEventListener('input', (e) => { currentSettings.keywords = e.target.value; updateSummary(); calculateCost(); });
        if (desiredDurationInput) desiredDurationInput.addEventListener('input', (e) => { currentSettings.desiredDuration = parseInt(e.target.value) || 0; updateSummary(); calculateCost(); });
        if (highlightKeywordsTextarea) highlightKeywordsTextarea.addEventListener('input', (e) => { currentSettings.highlightKeywords = e.target.value; updateSummary(); calculateCost(); });
        if (bgmAtmosphereSelect) bgmAtmosphereSelect.addEventListener('change', (e) => { currentSettings.bgmAtmosphere = e.target.value; updateSummary(); calculateCost(); });
        if (cameraWorkSelect) cameraWorkSelect.addEventListener('change', (e) => { currentSettings.cameraWork = e.target.value; updateSummary(); calculateCost(); });
    };
    
    const initializeMainApp = () => {
        if (processButton) processButton.addEventListener('click', handleProcessButtonClick);
        if (loadVideoButton) loadVideoButton.addEventListener('click', handleLoadVideo);
        if (resetButton) resetButton.addEventListener('click', resetUI);
        initializeSliders();
        initializeToggles();
        initializeTitleSettings();
        initializeNewSettings();
        updateSummary();
        updateTitlePreview();
        resetUI();
    };
    
    // --- アプリケーション起動 ---
    try {
        // Google OAuthリダイレクトからのトークンを処理
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('token');
        if (tokenFromUrl) {
            localStorage.setItem('authToken', tokenFromUrl);
            // URLからトークンを削除してクリーンな状態にする
            history.replaceState(null, '', window.location.pathname);
        }

        if (showRegisterFormLink) {
            showRegisterFormLink.addEventListener('click', (e) => { 
                e.preventDefault(); 
                const loginContainer = document.getElementById('login-form-container');
                const registerContainer = document.getElementById('register-form-container');
                if (loginContainer) loginContainer.classList.add('hidden');
                if (registerContainer) registerContainer.classList.remove('hidden');
            });
        }
        if (showLoginFormLink) {
            showLoginFormLink.addEventListener('click', (e) => { 
                e.preventDefault(); 
                const loginContainer = document.getElementById('login-form-container');
                const registerContainer = document.getElementById('register-form-container');
                if (loginContainer) loginContainer.classList.remove('hidden');
                if (registerContainer) registerContainer.classList.add('hidden');
            });
        }
        if (loginForm) loginForm.addEventListener('submit', (e) => handleAuthFormSubmit(e, 'login'));
        if (registerForm) registerForm.addEventListener('submit', (e) => handleAuthFormSubmit(e, 'register'));
        if (logoutButton) logoutButton.addEventListener('click', handleLogout);

        updateUIForAuthState();
    } catch (e) {
        console.error("Initialization failed", e);
        document.body.innerHTML = '<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert"><strong class="font-bold">致命的なエラー:</strong><span class="block sm:inline"> アプリケーションの初期化に失敗しました。コンソールを確認してください。</span></div>';
    }
});