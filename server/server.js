const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const youtubedl = require('youtube-dl-exec');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-super-secret-key-for-jwt';
const GOOGLE_API_KEY = 'AIzaSyBnBhi9abL2VULcXSO12WSw47UE7T5xRIs';

// --- 一時ディレクトリのセットアップ ---
const TEMP_DIR = path.join(__dirname, 'temp');
const DOWNLOAD_DIR = path.join(TEMP_DIR, 'downloads');
const CLIPS_DIR = path.join(TEMP_DIR, 'clips');
const AUDIO_DIR = path.join(TEMP_DIR, 'audio');
[TEMP_DIR, DOWNLOAD_DIR, CLIPS_DIR, AUDIO_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// --- In-memory Database ---
const users = [];
const jobs = new Map();

// (認証関連のコードは変更なし)
const authenticateToken = (req, res, next) => {
    const token = (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]) || req.query.token;
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- API Routes (変更なし) ---
const router = express.Router();
router.post('/auth/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    if (users.find(u => u.email === email)) return res.status(409).json({ message: 'This email is already registered.' });
    const newUser = { id: users.length + 1, email, password };
    users.push(newUser);
    res.status(201).json({ message: 'User created' });
});
router.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return res.status(401).json({ message: 'Invalid email or password.' });
    const accessToken = jwt.sign({ email: user.email, id: user.id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token: accessToken });
});
const extractYouTubeID = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};
router.post('/jobs/test-url', authenticateToken, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'URL is required.' });
    const videoId = extractYouTubeID(url);
    if (!videoId) return res.status(400).json({ message: '無効なYouTube URLです。' });
    try {
        const response = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
            params: { part: 'snippet', id: videoId, key: GOOGLE_API_KEY }
        });
        if (response.data.items && response.data.items.length > 0) {
            const videoTitle = response.data.items[0].snippet.title;
            res.json({ message: '接続に成功しました。', title: videoTitle });
        } else {
            throw new Error('動画が見つかりません。');
        }
    } catch (error) {
        console.error('YouTube API Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ message: 'YouTube APIとの通信に失敗しました。' });
    }
});
router.post('/jobs', authenticateToken, (req, res) => {
    const { sourceUrl, settings } = req.body;
    if (!sourceUrl || !settings) return res.status(400).json({ message: 'sourceUrl and settings are required.' });
    const jobId = uuidv4();
    const newJob = { jobId, userId: req.user.id, status: 'pending', progress: 0, sourceUrl, settings, createdAt: new Date(), clips: [] };
    jobs.set(jobId, newJob);
    processJob(jobId);
    res.status(202).json({ jobId });
});
router.get('/jobs/:jobId/status', authenticateToken, (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job || job.userId !== req.user.id) return res.status(404).json({ message: 'Job not found.' });
    res.json({ jobId: job.jobId, status: job.status, progress: job.progress });
});
router.get('/jobs/:jobId/results', authenticateToken, (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job || job.userId !== req.user.id) return res.status(404).json({ message: 'Job not found.' });
    if (job.status !== 'completed') return res.status(400).json({ message: 'Job is not completed yet.'});
    res.json({ jobId: job.jobId, status: job.status, clips: job.clips });
});
router.get('/clips/:clipId/download', authenticateToken, (req, res) => {
    const { clipId } = req.params;
    let foundClip = null;
    for (const job of jobs.values()) {
        const clip = job.clips.find(c => c.clipId === clipId);
        if (clip) {
            foundClip = clip;
            break;
        }
    }
    if (!foundClip || !fs.existsSync(foundClip.filePath)) {
        return res.status(404).json({ message: 'Clip not found.' });
    }
    try {
        const stat = fs.statSync(foundClip.filePath);
        res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Content-Length': stat.size,
            'Content-Disposition': `attachment; filename="${foundClip.fileName}"`
        });
        fs.createReadStream(foundClip.filePath).pipe(res);
    } catch (error) {
        res.status(500).json({ message: "ファイルの配信中にエラーが発生しました。" });
    }
});
app.use('/api/v1', router);


// --- 高度な動画処理エンジン (AIワークフロー) ---
const processJob = async (jobId) => {
    const job = jobs.get(jobId);
    if (!job) return;

    let downloadedFilePath;
    let audioFilePath;

    try {
        job.status = 'processing';
        job.progress = 5;
        console.log(`[Job ${jobId}] ダウンロード開始...`);
        
        const fontFileName = 'NotoSansJP-VariableFont_wght.ttf';
        const fontPath = path.join(__dirname, 'fonts', fontFileName);
        if (!fs.existsSync(fontPath)) {
            throw new Error(`Font file not found. Make sure '${fontFileName}' is in the 'server/fonts' directory.`);
        }
        const escapedFontPath = fontPath.replace(/\\/g, '/').replace(/:/g, '\\:');

        // 1. 動画ダウンロード
        const downloadProc = youtubedl.exec(job.sourceUrl, { output: path.join(DOWNLOAD_DIR, `${jobId}.%(ext)s`), format: 'best[ext=mp4][height<=1080]/best[ext=mp4]/best' });
        downloadProc.stdout.on('data', data => {
            const match = data.toString().match(/\[download\]\s+(\d+\.?\d*)%/);
            if (match) job.progress = 5 + Math.round(parseFloat(match[1]) * 0.2);
        });
        await downloadProc;
        
        const downloadedFile = fs.readdirSync(DOWNLOAD_DIR).find(f => f.startsWith(jobId));
        if (!downloadedFile) throw new Error("Downloaded file not found.");
        downloadedFilePath = path.join(DOWNLOAD_DIR, downloadedFile);
        
        job.progress = 25;
        console.log(`[Job ${jobId}] ダウンロード完了`);

        // 2. 音声抽出
        console.log(`[Job ${jobId}] 音声抽出中...`);
        audioFilePath = path.join(AUDIO_DIR, `${jobId}.wav`);
        await new Promise((resolve, reject) => {
            ffmpeg(downloadedFilePath)
                .noVideo()
                .audioFrequency(16000)
                .audioChannels(1)
                .audioCodec('pcm_s16le')
                .on('end', resolve)
                .on('error', reject)
                .save(audioFilePath);
        });
        job.progress = 35;
        console.log(`[Job ${jobId}] 音声抽出完了`);

        // 3. AI音声分析 & ハイライト検出 (シミュレーション)
        console.log(`[Job ${jobId}] AI音声分析中...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // AI処理を模倣

        const transcribedText = "これはAIによる文字起こしのシミュレーションです。";
        console.log(`[Job ${jobId}] 文字起こし完了: ${transcribedText}`);

        const duration = await new Promise((resolve, reject) => ffmpeg.ffprobe(downloadedFilePath, (err, d) => err ? reject(err) : resolve(d.format.duration)));
        const clipCount = Math.floor(Math.random() * (job.settings.countMax - job.settings.countMin + 1)) + job.settings.countMin;
        const highlightPoints = Array.from({ length: clipCount }, () => {
            const clipDuration = Math.floor(Math.random() * (job.settings.durationMax - job.settings.durationMin + 1)) + job.settings.durationMin;
            const startTime = Math.random() * (duration - clipDuration);
            return { startTime: Math.max(0, startTime), duration: clipDuration };
        });
        
        console.log(`[Job ${jobId}] AI分析完了。${highlightPoints.length}個のハイライトを発見。`);
        job.progress = 50;
        
        // 4. クリップ生成
        const progressPerClip = 50 / highlightPoints.length;
        for (const [index, clipInfo] of highlightPoints.entries()) {
            const clipId = `${jobId.slice(0, 4)}-${index + 1}`;
            const outputFileName = `clip_${clipId}.mp4`;
            const outputPath = path.join(CLIPS_DIR, outputFileName);
            
            const titleSettings = job.settings.title;
            const escape = (text) => text.replace(/'/g, `''`).replace(/:/g, `\\:`).replace(/%/g, `\\%`);

            // 高度なレイアウトフィルター
            const filter = `[0:v]scale=-1:1080,crop=w='min(iw,ih*9/16)':h=ih[cropped];` +
                         `color=c=black:s=1080x1920[bg];` +
                         `[bg][cropped]overlay=x=(W-w)/2:y=H-h[v_on_bg];`+
                         `[v_on_bg]drawtext=fontfile='${escapedFontPath}':text='${escape(transcribedText)}':fontcolor=${titleSettings.mainColor}:fontsize=${titleSettings.mainSize}:x=(w-text_w)/2:y=150:borderw=${titleSettings.mainStrokeWidth}:bordercolor=${titleSettings.mainStrokeColor}[v_with_text]`;
            
            console.log(`[Job ${jobId}] クリップ生成中 ${index + 1}/${highlightPoints.length}...`);
            await new Promise((resolve, reject) => {
                ffmpeg(downloadedFilePath)
                    .seekInput(clipInfo.startTime)
                    .duration(clipInfo.duration)
                    .complexFilter(filter, 'v_with_text')
                    .on('end', resolve)
                    .on('error', (err) => reject(new Error(`ffmpeg error: ${err.message}`)))
                    .save(outputPath);
            });
            
            job.clips.push({ clipId, title: transcribedText, duration: Math.round(clipInfo.duration), thumbnailUrl: `https://placehold.co/400x225/E2E8F0/4A5568?text=Clip+${index+1}`, downloadUrl: `/api/v1/clips/${clipId}/download`, filePath: outputPath, fileName: outputFileName });
            job.progress = Math.round(job.progress + progressPerClip);
        }

        job.status = 'completed';
        job.progress = 100;
        console.log(`[Job ${jobId}] 処理完了`);

    } catch (error) {
        console.error(`[Job ${jobId}] 処理に失敗:`, error);
        job.status = 'failed';
    } finally {
        // クリーンアップ
        [downloadedFilePath, audioFilePath].forEach(fp => {
            if (fp && fs.existsSync(fp)) fs.unlink(fp, err => {
                if(err) console.error(`一時ファイルの削除に失敗: ${fp}`);
            });
        });
    }
};

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`API server is running on http://localhost:${PORT}`);
    console.log(`Frontend is available at http://localhost:${PORT}/`);
});
