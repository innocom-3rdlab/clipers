const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');
const YTDlpWrap = require('yt-dlp-wrap').default;
const ffmpeg = require('fluent-ffmpeg');
const { SpeechClient } = require('@google-cloud/speech');
const { Storage } = require('@google-cloud/storage');
const { LanguageServiceClient } = require('@google-cloud/language');
const util = require('util');
const ffprobe = require('ffprobe-static');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const execPromise = util.promisify(child_process.exec);

// --- サーバー設定 ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const ytDlpWrap = new YTDlpWrap();
const PORT = 3000;

// --- グローバル設定 & エラーハンドラ ---
process.on('unhandledRejection', (reason, promise) => { console.error('★★★★★ Unhandled Rejection at: ★★★★★', promise, 'reason:', reason); });
process.on('uncaughtException', (err, origin) => { console.error('★★★★★ Caught exception: ★★★★★', err, 'Exception origin:', origin); });

// --- Google Cloud & APIキー設定 ---
const keyFilePath = path.join(__dirname, 'google-credentials.json');
const speechClient = new SpeechClient({ keyFilename: keyFilePath });
const storage = new Storage({ keyFilename: keyFilePath });
const languageClient = new LanguageServiceClient({ keyFilename: keyFilePath });
const BUCKET_NAME = 'clipersworkstrage';
const JWT_SECRET = 'your-super-secret-key-for-jwt';
const GOOGLE_API_KEY = 'AIzaSyBnBhi9abL2VULcXSO12WSw47UE7T5xRIs';

// --- ディレクトリ設定 ---
const TEMP_DIR = path.join(__dirname, 'temp');
const DOWNLOAD_DIR = path.join(TEMP_DIR, 'downloads');
const CLIPS_DIR = path.join(TEMP_DIR, 'clips');
const AUDIO_DIR = path.join(TEMP_DIR, 'audio');
[TEMP_DIR, DOWNLOAD_DIR, CLIPS_DIR, AUDIO_DIR].forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

// --- データベース設定 ---
const dbFile = path.join(__dirname, 'db.json');
const adapter = new JSONFile(dbFile);
const defaultData = { users: [] };
const db = new Low(adapter, defaultData);

// サーバー起動時にDBを読み込む（ファイルがなければ作成される）
(async () => {
    await db.read();
    await db.write();
})();

app.use(cors());
app.use(express.json());

// --- データストア（インメモリ） ---
const jobs = new Map();
const jobSockets = new Map();

// --- WebSocket リアルタイム更新 ---
function pushUpdateToClient(jobId) {
    if (jobSockets.has(jobId)) {
        const ws = jobSockets.get(jobId);
        const job = jobs.get(jobId);
        if (ws && ws.readyState === WebSocket.OPEN && job) {
            ws.send(JSON.stringify({ type: 'jobUpdate', job }));
        }
    }
}

wss.on('connection', (ws) => {
    console.log('Client connected for real-time updates');
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'subscribe' && data.jobId) {
                jobSockets.set(data.jobId, ws);
                console.log(`Client subscribed to updates for job ${data.jobId}`);
                pushUpdateToClient(data.jobId);
                ws.on('close', () => {
                    console.log(`Client for job ${data.jobId} disconnected`);
                    jobSockets.delete(data.jobId);
                });
            }
        } catch (e) {
            console.error('Failed to handle WebSocket message:', e);
        }
    });
});

// --- 認証とAPIルート ---
const authenticateToken = (req, res, next) => { const token = (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]) || req.query.token; if (token == null) return res.sendStatus(401); jwt.verify(token, JWT_SECRET, (err, user) => { if (err) return res.sendStatus(403); req.user = user; next(); }); };
const router = express.Router();
router.post('/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

    await db.read();
    if (db.data.users.find(u => u.email === email)) {
        return res.status(409).json({ message: 'This email is already registered.' });
    }

    const newUser = { id: db.data.users.length + 1, email, password };
    db.data.users.push(newUser);
    await db.write();

    res.status(201).json({ message: 'User created' });
});

router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    await db.read();
    const user = db.data.users.find(u => u.email === email && u.password === password);

    if (!user) return res.status(401).json({ message: 'Invalid email or password.' });

    const accessToken = jwt.sign({ email: user.email, id: user.id }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token: accessToken });
});
const extractYouTubeID = (url) => { const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*$/; const match = url.match(regExp); return (match && match[2].length === 11) ? match[2] : null; };

const parseTimeToSeconds = (timeString) => {
    const parts = timeString.split(':').map(Number);
    if (parts.length === 2) { // MM:SS
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) { // HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return NaN; // 無効な形式
};
router.post('/jobs/test-url', authenticateToken, async (req, res) => { const { url } = req.body; if (!url) return res.status(400).json({ message: 'URL is required.' }); const videoId = extractYouTubeID(url); if (!videoId) return res.status(400).json({ message: '無効なYouTube URLです。' }); try { const response = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, { params: { part: 'snippet', id: videoId, key: GOOGLE_API_KEY } }); if (response.data.items && response.data.items.length > 0) { const videoTitle = response.data.items[0].snippet.title; res.json({ message: '接続に成功しました。', title: videoTitle }); } else { throw new Error('動画が見つかりません。'); } } catch (error) { res.status(500).json({ message: `YouTube API通信エラー: ${error.message}. APIキーが有効か確認してください。` }); } });
router.post('/jobs/get-video-metadata', authenticateToken, async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ message: 'URL is required.' });
    }

    const videoId = extractYouTubeID(url);
    if (!videoId) {
        return res.status(400).json({ message: '無効なYouTube URLです。' });
    }

    try {
        // yt-dlpで動画情報を取得 (ダウンロードはしない)
        const ytDlpInfo = await ytDlpWrap.execPromise([
            url,
            '--dump-json',
            '--no-playlist',
            '--skip-download'
        ]);
        const videoInfo = JSON.parse(ytDlpInfo);
        const title = videoInfo.title;
        const duration = videoInfo.duration; // 秒単位

        // yt-dlpのdump-jsonにはaudio_codec情報が含まれるので、それを利用
        const hasAudioTrack = videoInfo.audio_codec ? true : false;

        res.json({
            title: title,
            duration: duration, // 秒
            hasAudioTrack: hasAudioTrack,
            message: '動画メタデータを取得しました。'
        });

    } catch (error) {
        console.error('動画メタデータ取得エラー:', error);
        res.status(500).json({ message: `動画メタデータの取得に失敗しました: ${error.message}` });
    } finally {
        // 一時ファイルは生成されないため、クリーンアップは不要
    }
});

router.post('/jobs', authenticateToken, (req, res) => { const { sourceUrl, settings } = req.body; if (!sourceUrl || !settings) return res.status(400).json({ message: 'sourceUrl and settings are required.' }); const jobId = uuidv4(); const newJob = { jobId, userId: req.user.id, status: 'pending', progress: 0, statusMessage: 'Job created, waiting to start processing.', sourceUrl, settings, createdAt: new Date(), clips: [] }; jobs.set(jobId, newJob); processJob(jobId); res.status(202).json({ jobId }); });
router.get('/jobs/:jobId/status', authenticateToken, (req, res) => { const job = jobs.get(req.params.jobId); if (!job || job.userId !== req.user.id) return res.status(404).json({ message: 'Job not found.' }); res.json({ jobId: job.jobId, status: job.status, progress: job.progress, statusMessage: job.statusMessage }); });
router.get('/jobs/:jobId/results', authenticateToken, (req, res) => { const job = jobs.get(req.params.jobId); if (!job || job.userId !== req.user.id) return res.status(404).json({ message: 'Job not found.' }); if (job.status !== 'completed') return res.status(400).json({ message: 'Job is not completed yet.'}); res.json({ jobId: job.jobId, status: job.status, clips: job.clips }); });
router.get('/clips/:clipId/download', authenticateToken, (req, res) => { const { clipId } = req.params; let foundClip = null; let foundJob = null; for (const job of jobs.values()) { const clip = job.clips.find(c => c.clipId === clipId); if (clip) { foundClip = clip; foundJob = job; break; } } if (!foundJob || foundJob.userId !== req.user.id || !foundClip || !fs.existsSync(foundClip.filePath)) { return res.status(404).json({ message: 'Clip not found or unauthorized.' }); } try { const stat = fs.statSync(foundClip.filePath); res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': stat.size, 'Content-Disposition': `attachment; filename="${foundClip.fileName}"` }); fs.createReadStream(foundClip.filePath).pipe(res); } catch (error) { res.status(500).json({ message: "ファイルの配信中にエラーが発生しました。" }); } });
app.use('/api/v1', router);
app.use(express.static(path.join(__dirname, '../client')));
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, '../client/index.html')); });

// --- Gemini APIによるタイトル生成 ---
async function generateTitleWithGemini(transcript) {
    if (!transcript || transcript.trim().length === 0) {
        return 'タイトル生成失敗';
    }
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GOOGLE_API_KEY}`;

        const prompt = `以下の動画書き起こしを要約し、視聴者の興味を引くような15文字程度の短いタイトルを1つだけ生成してください。タイトルのみを返してください.\n\n書き起こし:\n"""\n${transcript.substring(0, 8000)}\n"""`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        const title = response.data.candidates[0].content.parts[0].text.trim().replace(/"/g, '');
        return title;
    } catch (error) {
        console.error('Gemini APIでのタイトル生成エラー:', error.response ? error.response.data : error.message);
        return 'AI生成タイトル'; // エラー時のフォールバック
    }
}

// --- Speech-to-Text APIによる音声分析 ---
async function analyzeAudioWithSpeechToText(audioPath, settings, jobId) {
    const job = jobs.get(jobId);

    let duration = 0;
    try {
        const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`);
        duration = parseFloat(stdout);
    } catch (error) {
        console.error("音声ファイルの長さ取得エラー:", error);
        throw new Error('音声ファイルの長さを取得できませんでした。');
    }

    const recognitionConfig = {
        encoding: 'FLAC',
        sampleRateHertz: 16000,
        languageCode: 'ja-JP',
        model: 'default',
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
    };

    let response;
    let audioFileNameInGcs = null;

    try {
        if (duration < 60) {
            job.statusMessage = 'Speech-to-Text APIによる文字起こしを実行中...';
            pushUpdateToClient(jobId);
            const content = fs.readFileSync(audioPath).toString('base64');
            const audio = { content: content };
            const request = { audio, config: recognitionConfig };
            [response] = await speechClient.recognize(request);
        } else {
            const audioFileName = `${jobId}.flac`;
            const gcsUri = `gs://${BUCKET_NAME}/${audioFileName}`;
            audioFileNameInGcs = audioFileName;

            job.statusMessage = '音声ファイルをGoogle Cloud Storageにアップロード中...';
            pushUpdateToClient(jobId);
            try {
                await storage.bucket(BUCKET_NAME).upload(audioPath, { destination: audioFileName });
            } catch (uploadError) {
                console.error("GCSアップロードエラー:", uploadError);
                throw new Error(`GCSへのアップロードに失敗しました。バケット名(${BUCKET_NAME})と権限を確認してください。${uploadError.message}`);
            }

            job.statusMessage = 'Speech-to-Text APIによる文字起こしを実行中 (長時間かかります)...';
            pushUpdateToClient(jobId);
            const audio = { uri: gcsUri };
            const request = { audio, config: recognitionConfig };
            const [operation] = await speechClient.longRunningRecognize(request);
            [response] = await operation.promise();
        }

        const detailedTranscript = response.results.flatMap(result => result.alternatives[0].words.map(word => ({ word: word.word, startTime: parseFloat(word.startTime.seconds) + (word.startTime.nanos || 0) / 1e9, endTime: parseFloat(word.endTime.seconds) + (word.endTime.nanos || 0) / 1e9, })));
        const fullTranscript = response.results.map(result => result.alternatives[0].transcript).join('\n');
        
        job.statusMessage = '感情分析を実行中...';
        pushUpdateToClient(jobId);
        let sentiment = { score: 0, magnitude: 0 };
        if (fullTranscript.length > 0) {
            try {
                const textForSentiment = fullTranscript.substring(0, 5000);
                const [sentimentResult] = await languageClient.analyzeSentiment({ document: { content: textForSentiment, type: 'PLAIN_TEXT' } });
                sentiment = sentimentResult.documentSentiment || { score: 0, magnitude: 0 };
            } catch (sentimentError) {
                console.error("感情分析APIエラー:", sentimentError);
                job.statusMessage = `警告: 感情分析に失敗しました (${sentimentError.message})。処理は続行されます。`;
                pushUpdateToClient(jobId);
            }
        }

        job.statusMessage = 'AIによるタイトル生成中...';
        pushUpdateToClient(jobId);
        const generatedTitle = await generateTitleWithGemini(fullTranscript);

        let highlights = [];
        const desiredClipCount = Math.floor(Math.random() * (settings.countMax - settings.countMin + 1)) + settings.countMin;
        let excitementScoreTimeline = [];

        if (detailedTranscript.length > 1) {
            if (settings.keywords && settings.keywords.length > 0) {
                const keywordHighlights = [];
                settings.keywords.forEach(keyword => {
                    const lowerKeyword = keyword.toLowerCase();
                    for (let i = 0; i < detailedTranscript.length; i++) {
                        const wordInfo = detailedTranscript[i];
                        if (wordInfo.word.toLowerCase().includes(lowerKeyword) || lowerKeyword.includes(wordInfo.word.toLowerCase())) {
                            const clipDuration = Math.floor(Math.random() * (settings.durationMax - settings.durationMin + 1)) + settings.durationMin;
                            let start = Math.max(0, wordInfo.startTime - clipDuration / 2);
                            start = Math.min(start, duration - clipDuration);
                            keywordHighlights.push({ startTime: start, duration: clipDuration });
                            i += Math.floor(clipDuration / (wordInfo.endTime - wordInfo.startTime)) || 1;
                        }
                    }
                });
                keywordHighlights.sort((a, b) => a.startTime - b.startTime);
                const uniqueKeywordHighlights = [];
                if (keywordHighlights.length > 0) {
                    uniqueKeywordHighlights.push(keywordHighlights[0]);
                    for (let i = 1; i < keywordHighlights.length; i++) {
                        const lastHighlight = uniqueKeywordHighlights[uniqueKeywordHighlights.length - 1];
                        if (keywordHighlights[i].startTime > lastHighlight.startTime + lastHighlight.duration + 5) {
                            uniqueKeywordHighlights.push(keywordHighlights[i]);
                        }
                    }
                }
                highlights.push(...uniqueKeywordHighlights);
            }

            if (highlights.length < desiredClipCount) {
                const videoDuration = detailedTranscript[detailedTranscript.length - 1].startTime;
                const density = new Array(Math.ceil(videoDuration) + 1).fill(0);
                detailedTranscript.forEach(word => {
                    const second = Math.floor(word.startTime);
                    if (second < density.length) { density[second]++; }
                });
                const smoothedDensity = [];
                const smoothWindow = 5;
                for (let i = 0; i < density.length; i++) {
                    let sum = 0;
                    const start = Math.max(0, i - smoothWindow);
                    const end = Math.min(density.length - 1, i + smoothWindow);
                    for (let j = start; j <= end; j++) { sum += density[j]; }
                    smoothedDensity.push(sum);
                }
                excitementScoreTimeline = smoothedDensity.map(score => score * (1 + (sentiment ? sentiment.magnitude : 0)));
                const candidatePeaks = [];
                for (let i = 1; i < excitementScoreTimeline.length - 1; i++) {
                    if (excitementScoreTimeline[i] > excitementScoreTimeline[i-1] && excitementScoreTimeline[i] > excitementScoreTimeline[i+1] && excitementScoreTimeline[i] > 0) {
                        candidatePeaks.push({ time: i, score: excitementScoreTimeline[i] });
                    }
                }
                candidatePeaks.sort((a, b) => b.score - a.score);
                const minDistance = settings.durationMax * 2;
                const selectedTimes = [];
                for (const peak of candidatePeaks) {
                    if (selectedTimes.length >= desiredClipCount) break;
                    const isOverlappingWithExisting = highlights.some(h =>
                        (peak.time >= h.startTime && peak.time <= h.startTime + h.duration) ||
                        (h.startTime >= peak.time && h.startTime <= peak.time + settings.durationMax)
                    );
                    if (!isOverlappingWithExisting && !selectedTimes.some(time => Math.abs(time - peak.time) < minDistance)) {
                        selectedTimes.push(peak.time);
                        const clipDuration = Math.floor(Math.random() * (settings.durationMax - settings.durationMin + 1)) + settings.durationMin;
                        highlights.push({ startTime: peak.time, duration: clipDuration });
                    }
                }
            }
            highlights.sort((a, b) => b.startTime - a.startTime);
            highlights = highlights.slice(0, desiredClipCount);
        }

        return { highlights, transcript: fullTranscript.substring(0, 30), audioFileNameInGcs, sentiment, detailedTranscript, excitementScoreTimeline, generatedTitle };

    } catch (sttError) {
        console.error("Speech-to-Text APIエラー:", sttError);
        if (audioFileNameInGcs) {
            try { await storage.bucket(BUCKET_NAME).file(audioFileNameInGcs).delete(); } catch (delErr) { /* ignore */ }
        }
        throw new Error(`Speech-to-Text APIエラー: ${sttError.message}`);
    }
}

// --- メインの動画処理ワークフロー ---
const processJob = async (jobId) => {
    const job = jobs.get(jobId);
    if (!job) return;
    let downloadedFilePath, audioFilePath, audioFileNameInGcs;
    try {
        job.status = 'processing'; job.progress = 5; job.statusMessage = '動画のダウンロードを開始します...'; pushUpdateToClient(jobId);
        
        const fontFileName = 'NotoSansJP-VariableFont_wght.ttf';
        const fontPath = path.join(__dirname, 'fonts', fontFileName);
        if (!fs.existsSync(fontPath)) { throw new Error(`Font file not found: ${fontPath}`); }
        const escapedFontPath = fontPath.replace(/\\/g, '/').replace(/:/g, '\\:');
        
        const uniqueId = Date.now();
        downloadedFilePath = path.join(DOWNLOAD_DIR, `${uniqueId}.mp4`);
        await ytDlpWrap.execPromise([
            job.sourceUrl,
            '-f', 'bestvideo+bestaudio',
            '--merge-output-format', 'mp4',
            '--no-playlist',
            '-o', downloadedFilePath,
        ]);

        job.statusMessage = 'ダウンロード済み動画の音声トラックを確認中...';
        pushUpdateToClient(jobId);
        let hasAudioTrack = false;
        try {
            const { stdout } = await execPromise(`ffprobe -v quiet -print_format json -show_streams "${downloadedFilePath}"`);
            const streamsData = JSON.parse(stdout);
            hasAudioTrack = streamsData.streams && streamsData.streams.some(s => s.codec_type === 'audio');
        } catch (ffprobeError) {
            console.error(`ffprobeでの音声トラック確認中に重大なエラー: ${ffprobeError.message}`);
            job.statusMessage = `警告: 動画の音声トラック確認に失敗しました (${ffprobeError.message})。音声なしとして処理を続行します。`;
            pushUpdateToClient(jobId);
            hasAudioTrack = false;
        }

        if (!hasAudioTrack) {
            job.statusMessage = '警告: ダウンロードした動画に音声トラックが見つかりませんでした。音声なしで処理を続行します。';
            pushUpdateToClient(jobId);
        }

        job.progress = 25; job.statusMessage = '音声の抽出を開始します...'; pushUpdateToClient(jobId);
        
        audioFilePath = path.join(AUDIO_DIR, `${jobId}.flac`);
        await new Promise((resolve, reject) => { ffmpeg(downloadedFilePath).noVideo().audioFrequency(16000).audioChannels(1).audioCodec('flac').on('end', resolve).on('error', reject).save(audioFilePath); });
        
        job.progress = 35; job.statusMessage = '各種分析処理を実行中...'; pushUpdateToClient(jobId);

        let highlightPoints = [];
        let fullDetailedTranscript = [];
        let excitementScoreTimeline = [];
        let generatedTitle = 'AI生成タイトル';

        if (job.settings.startTime && job.settings.endTime) {
            const userStartTime = parseTimeToSeconds(job.settings.startTime);
            const userEndTime = parseTimeToSeconds(job.settings.endTime);
            if (!isNaN(userStartTime) && !isNaN(userEndTime) && userEndTime > userStartTime) {
                highlightPoints.push({ startTime: userStartTime, duration: userEndTime - userStartTime });
                job.statusMessage = `ユーザー指定の時間 (${job.settings.startTime}-${job.settings.endTime}) でクリップ生成準備中...`;
            } else {
                job.statusMessage = `無効な時間指定のため、AI分析を実行します...`;
            }
        }

        if (highlightPoints.length === 0) { 
            job.statusMessage = 'AIによる音声分析を実行中です...'; pushUpdateToClient(jobId);
            const analysisResult = await analyzeAudioWithSpeechToText(audioFilePath, job.settings, jobId);
            audioFileNameInGcs = analysisResult.audioFileNameInGcs;
            highlightPoints = analysisResult.highlights || [];
            fullDetailedTranscript = analysisResult.detailedTranscript || [];
            excitementScoreTimeline = analysisResult.excitementScoreTimeline || [];
            generatedTitle = analysisResult.generatedTitle || 'AI生成タイトル';
            
            job.statusMessage = `AI分析完了。${highlightPoints.length}個のハイライトを発見。クリップ生成準備中...`;
        }
        
        if (job.settings.desiredDuration && highlightPoints.length > 0) {
            const desiredDurationSeconds = parseTimeToSeconds(job.settings.desiredDuration);
            if (!isNaN(desiredDurationSeconds) && desiredDurationSeconds > 0) {
                highlightPoints.forEach(clipInfo => {
                    clipInfo.duration = desiredDurationSeconds;
                });
                job.statusMessage += ` クリップの長さを${job.settings.desiredDuration}に調整中...`;
            }
        }
        
        job.progress = 50;
        pushUpdateToClient(jobId);

        const progressPerClip = highlightPoints.length > 0 ? 50 / highlightPoints.length : 0;
        for (const [index, clipInfo] of highlightPoints.entries()) {
            const clipId = `${jobId.slice(0, 4)}-${index + 1}`;
            const outputFileName = `clip_${clipId}.mp4`;
            const outputPath = path.join(CLIPS_DIR, outputFileName);

            job.statusMessage = `クリップ ${index + 1}/${highlightPoints.length} を生成中...`;
            job.progress = Math.round(50 + (index) * progressPerClip);
            pushUpdateToClient(jobId);

            await new Promise((resolve, reject) => {
                const clipFfmpeg = ffmpeg(downloadedFilePath);
                
                const actualStartTime = clipInfo.startTime;
                const actualDuration = clipInfo.duration;

                const complexFilter = [];
                let videoChain = '[0:v]scale=w=1080:h=-1,pad=w=1080:h=1920:x=(ow-iw)/2:y=(oh-ih)/2:color=black';

                if (generatedTitle) {
                    const titleText = generatedTitle.replace(/'/g, "''").replace(/:/g, "\\:").replace(/,/g, "\\,");
                    videoChain += `,drawtext=fontfile='${escapedFontPath}':text='${titleText}':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=150:borderw=4:bordercolor=black`;
                }

                if (job.settings.addCaptions && fullDetailedTranscript.length > 0) {
                    const clipDetailedTranscript = fullDetailedTranscript.filter(word =>
                        word.startTime >= actualStartTime && word.endTime <= (actualStartTime + actualDuration)
                    );

                    let currentLine = '';
                    let lineStartTime = 0;
                    let lineEndTime = 0;
                    const maxLineLength = 20;
                    const lines = [];

                    clipDetailedTranscript.forEach((word, index) => {
                        if (currentLine === '') { lineStartTime = word.startTime; }
                        currentLine += word.word;
                        lineEndTime = word.endTime;

                        const isEndOfSentence = word.word.match(/[。？！.!?]$/);
                        const isLineTooLong = currentLine.length >= maxLineLength;
                        const isLastWord = index === clipDetailedTranscript.length - 1;

                        if (isEndOfSentence || isLineTooLong || isLastWord) {
                            lines.push({ text: currentLine, startTime: lineStartTime, endTime: lineEndTime });
                            currentLine = '';
                        }
                    });

                    lines.forEach(line => {
                        const text = line.text.replace(/'/g, "''").replace(/:/g, "\\:").replace(/,/g, "\\,");
                        let fontColor = 'white';
                        let borderColor = 'black';
                        const excitementThreshold = 10;
                        const timeIndex = Math.floor(line.startTime);
                        const excitement = excitementScoreTimeline[timeIndex] || 0;

                        if (excitement > excitementThreshold) { borderColor = 'yellow'; }

                        if (job.settings.highlightKeywords && job.settings.highlightKeywords.length > 0) {
                            if (job.settings.highlightKeywords.some(k => text.toLowerCase().includes(k.toLowerCase()))) {
                                fontColor = 'yellow';
                            }
                        }

                        videoChain += `,drawtext=fontfile='${escapedFontPath}':text='${text}':fontsize=48:fontcolor=${fontColor}:x=(w-text_w)/2:y=h-th-40:enable='between(t,${line.startTime - actualStartTime},${line.endTime - actualStartTime})':borderw=3.5:bordercolor=${borderColor}`;
                    });
                }
                complexFilter.push(`${videoChain}[v_out]`);

                let bgmFilePath = '';
                if (job.settings.bgmAtmosphere) {
                    if (job.settings.bgmAtmosphere === 'positive') { bgmFilePath = path.join(TEMP_DIR, 'bgm', 'positive_bgm.mp3'); }
                    else if (job.settings.bgmAtmosphere === 'epic') { bgmFilePath = path.join(TEMP_DIR, 'bgm', 'epic_bgm.mp3'); }
                }

                if (job.settings.bgmAtmosphere && fs.existsSync(bgmFilePath)) {
                    clipFfmpeg.input(bgmFilePath);
                    complexFilter.push('[0:a]volume=1.0[a_main]', '[1:a]volume=0.3[a_bgm]', '[a_main][a_bgm]amerge=inputs=2[a_out]');
                } else {
                    complexFilter.push('[0:a]anull[a_out]');
                }

                clipFfmpeg
                    .complexFilter(complexFilter)
                    .outputOptions([
                        '-map [v_out]',
                        '-map [a_out]'
                    ])
                    .setStartTime(actualStartTime)
                    .setDuration(actualDuration)
                    .save(outputPath)
                    .on('end', resolve)
                    .on('error', (err, stdout, stderr) => {
                        console.error('FFmpeg Error:', err.message);
                        console.error('FFmpeg Stdout:', stdout);
                        console.error('FFmpeg Stderr:', stderr);
                        reject(new Error(`FFmpeg処理中にエラーが発生しました: ${err.message}. 詳細: ${stderr}`));
                    });
            });

            job.clips.push({ clipId, title: `Clip ${index+1}`, duration: Math.round(clipInfo.duration), thumbnailUrl: `https://placehold.co/400x225/E2E8F0/4A5568?text=Clip+${index+1}`, downloadUrl: `/api/v1/clips/${clipId}/download`, filePath: outputPath, fileName: outputFileName });
            job.progress = Math.round(50 + (index + 1) * progressPerClip);
            pushUpdateToClient(jobId);
        }

        job.status = 'completed'; job.progress = 100; job.statusMessage = '全ての処理が完了しました！'; pushUpdateToClient(jobId);

    } catch (error) {
        console.error(`[Job ${jobId}] 処理に失敗:`, error);
        job.status = 'failed';
        job.statusMessage = `エラーが発生しました: ${error.message}`;
        pushUpdateToClient(jobId);
    } finally {
        job.statusMessage = '一時ファイルをクリーンアップしています...'; pushUpdateToClient(jobId);
        [downloadedFilePath, audioFilePath].forEach(fp => { if (fp && fs.existsSync(fp)) { fs.unlink(fp, err => { if(err) console.error(`一時ファイルの削除に失敗: ${fp}`); }); } });
        if (audioFileNameInGcs) {
            try { await storage.bucket(BUCKET_NAME).file(audioFileNameInGcs).delete(); } catch (gcsError) { console.error(`GCSファイルの削除に失敗:`, gcsError); }
        }
        job.statusMessage = 'クリーンアップ完了。'; pushUpdateToClient(jobId);
    }
};

// --- サーバー起動 ---
server.listen(PORT, () => {
    console.log(`API and WebSocket server is running on http://localhost:${PORT}`);
});