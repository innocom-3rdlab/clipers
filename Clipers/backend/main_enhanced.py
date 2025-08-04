import os
import sys

# 現在のディレクトリをPythonパスに追加
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from fastapi import FastAPI, HTTPException, Body # type: ignore
from fastapi.middleware.cors import CORSMiddleware # type: ignore
from pydantic import BaseModel # type: ignore
import yt_dlp # type: ignore
import tempfile
from typing import Optional, List
import json
from improved_audio_analyzer import ImprovedAudioAnalyzer, YouTubeEngagementAnalyzer, ComprehensiveAnalyzer
from visualization import AudioVisualizer
from video_evaluation_framework import VideoEvaluationFramework
from gemini_analyzer import GeminiAnalyzer # GeminiAnalyzerをインポート
from datetime import datetime
import re
from config import get_youtube_api_key, get_gemini_api_key
from user_attribute_analyzer import UserAttributeAnalyzer

app = FastAPI(title="YouTube盛り上がり分析ツール (Enhanced)", version="2.1.0-gemini")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VideoRequest(BaseModel):
    url: str

class VideoInfo(BaseModel):
    title: str
    duration: Optional[int]
    description: Optional[str]
    view_count: Optional[int]
    like_count: Optional[int]

class AudioAnalysisRequest(BaseModel):
    url: str
    download_audio: bool = True
    youtube_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None # Gemini APIキーを追加

class AudioAnalysisResponse(BaseModel):
    video_info: VideoInfo
    audio_file_path: Optional[str]
    transcript_file_path: Optional[str] # 字幕ファイルパスを追加
    audio_duration: Optional[float]
    sample_rate: Optional[int]
    debug_info: dict

# 分析器のインスタンスを作成
improved_analyzer = ImprovedAudioAnalyzer()
engagement_analyzer = YouTubeEngagementAnalyzer()
comprehensive_analyzer = ComprehensiveAnalyzer()
visualizer = AudioVisualizer()
evaluation_framework = VideoEvaluationFramework()

def parse_vtt(file_path: str) -> str:
    """VTTファイルからテキストのみを抽出する"""
    if not os.path.exists(file_path):
        return ""
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # タイムスタンプ行と空行を除外し、テキストのみを結合
    text_lines = [line.strip() for line in lines if not re.match(r'^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}', line) and 'WEBVTT' not in line and line.strip() != '']
    return ' '.join(text_lines)

@app.get("/")
async def root():
    return {"message": "YouTube盛り上がり分析ツール API (Enhanced v2.1.0-gemini)"}

@app.post("/download-audio-enhanced", response_model=AudioAnalysisResponse)
async def download_audio_enhanced(request: AudioAnalysisRequest):
    """
    改善版：YouTube動画から音声をダウンロードする
    """
    debug_info = {}
    
    try:
        # 一時ディレクトリを作成
        temp_dir = tempfile.mkdtemp()
        debug_info['temp_dir'] = temp_dir
        print(f"一時ディレクトリ作成: {temp_dir}")
        
        # 最適化されたyt-dlpの設定（字幕取得機能付き）
        ydl_opts = {
            'format': 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio[ext=webm]/bestaudio/best',
            'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '192',
            }],
            'quiet': False,
            'no_warnings': False,
            # 403エラー回避のための設定
            'nocheckcertificate': True,
            'ignoreerrors': False,
            'no_color': True,
            'extractor_retries': 3,
            'fragment_retries': 3,
            'skip_unavailable_fragments': True,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            # 音声抽出の改善設定
            'extractaudio': True,
            'audioformat': 'wav',
            'audioquality': '192K',
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['ja', 'en', 'en-US'], # 日本語と英語の字幕を優先
            'writethumbnail': False,
            'writeinfojson': False,
            'writedescription': False,
            'writeannotations': False,
            'writestats': False,
            'writecomments': False,
            'getcomments': False,
            # 追加の音声抽出設定
            'prefer_ffmpeg': True,
            'keepvideo': False,
            'audio_only': True,
            # より具体的な音声フォーマット指定
            'format_sort': ['ext:m4a', 'ext:mp3', 'ext:webm', 'ext:ogg'],
            'format_sort_force': True
        }
        
        debug_info['ydl_opts'] = ydl_opts
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # 動画情報を取得
            print("動画情報を取得中...")
            info = ydl.extract_info(request.url, download=False)
            
            debug_info['video_info'] = {
                'title': info.get('title'),
                'duration': info.get('duration'),
            }
            
            # 音声をダウンロード
            if request.download_audio:
                print("音声ダウンロード開始...")
                try:
                    ydl.download([request.url])
                    print("ダウンロード完了")
                except Exception as download_error:
                    debug_info['download_error'] = str(download_error)
                    print(f"ダウンロードエラー: {download_error}")
                    # ダウンロードエラーが発生してもメタデータは利用可能
                    print("メタデータのみで分析を続行します")
                
                # ダウンロードされたファイルを探す
                print(f"ダウンロード後のファイル一覧: {os.listdir(temp_dir)}")
                all_files = os.listdir(temp_dir)
                debug_info['all_files'] = all_files
                
                # 各ファイルの詳細情報を記録
                file_details = []
                for file in all_files:
                    file_path = os.path.join(temp_dir, file)
                    file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
                    file_details.append({
                        'name': file,
                        'size': file_size,
                        'extension': os.path.splitext(file)[1].lower()
                    })
                debug_info['file_details'] = file_details
                
                # 音声ファイルを探す（複数のフォーマットをサポート）
                audio_extensions = ['.wav', '.mp3', '.m4a', '.webm', '.ogg', '.flac', '.aac', '.opus']
                audio_files = []
                
                for file in all_files:
                    file_lower = file.lower()
                    if any(file_lower.endswith(ext) for ext in audio_extensions):
                        audio_files.append(file)
                
                debug_info['audio_files_found'] = audio_files
                
                if audio_files:
                    # 最初に見つかった音声ファイルを使用
                    audio_file = audio_files[0]
                    audio_file_path = os.path.join(temp_dir, audio_file)
                    
                    # WAVファイルでない場合は変換を試みる
                    if not audio_file.lower().endswith('.wav'):
                        try:
                            import subprocess
                            wav_file_path = os.path.join(temp_dir, f"{os.path.splitext(audio_file)[0]}.wav")
                            print(f"音声ファイルをWAVに変換中: {audio_file} -> {os.path.basename(wav_file_path)}")
                            
                            # FFmpegで変換
                            result = subprocess.run([
                                'ffmpeg', '-i', audio_file_path, 
                                '-acodec', 'pcm_s16le', 
                                '-ar', '44100', 
                                '-ac', '2', 
                                wav_file_path, '-y'
                            ], capture_output=True, text=True, cwd=temp_dir)
                            
                            if result.returncode == 0 and os.path.exists(wav_file_path):
                                audio_file_path = wav_file_path
                                print(f"変換成功: {wav_file_path}")
                            else:
                                print(f"変換失敗: {result.stderr}")
                        except Exception as conv_error:
                            print(f"変換エラー: {conv_error}")
                            # 変換に失敗しても元のファイルを使用
                    
                    debug_info['audio_file_path'] = audio_file_path
                    print(f"音声ファイルが見つかりました: {audio_file_path}")
                else:
                    audio_file_path = None
                    debug_info['error'] = "音声ファイルが見つかりません"
                    print("音声ファイルが見つかりませんでした")
                    
                    # 代替手段として、yt-dlpの直接的な音声抽出を試みる
                    print("代替手段として直接的な音声抽出を試みます...")
                    try:
                        # 音声専用の設定で再試行
                        fallback_opts = {
                            'format': 'bestaudio',
                            'outtmpl': os.path.join(temp_dir, 'audio_only.%(ext)s'),
                            'extractaudio': True,
                            'audioformat': 'wav',
                            'audioquality': '192K',
                            'quiet': False,
                            'no_warnings': False,
                            'nocheckcertificate': True,
                            'http_headers': {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                            }
                        }
                        
                        with yt_dlp.YoutubeDL(fallback_opts) as ydl_fallback:
                            ydl_fallback.download([request.url])
                        
                        # 再試行後のファイルを確認
                        fallback_files = os.listdir(temp_dir)
                        debug_info['fallback_files'] = fallback_files
                        
                        # 音声ファイルを再検索
                        fallback_audio_files = [f for f in fallback_files if any(f.lower().endswith(ext) for ext in ['.wav', '.mp3', '.m4a', '.webm', '.ogg', '.flac', '.aac', '.opus'])]
                        
                        if fallback_audio_files:
                            audio_file_path = os.path.join(temp_dir, fallback_audio_files[0])
                            debug_info['fallback_audio_file'] = audio_file_path
                            print(f"代替手段で音声ファイルを取得しました: {audio_file_path}")
                        else:
                            print("代替手段でも音声ファイルの取得に失敗しました")
                            
                    except Exception as fallback_error:
                        debug_info['fallback_error'] = str(fallback_error)
                        print(f"代替手段エラー: {fallback_error}")
                    
                    # 最終手段として、メタデータのみで分析を続行
                    print("メタデータのみで分析を続行します")
            else:
                audio_file_path = None
            
            # 字幕ファイルを探す (.vtt)
            subtitle_file = next((f for f in all_files if f.endswith('.vtt')), None)
            transcript_file_path = os.path.join(temp_dir, subtitle_file) if subtitle_file else None
            
            return AudioAnalysisResponse(
                video_info=VideoInfo(
                    title=info.get('title', ''),
                    duration=info.get('duration'),
                    description=info.get('description', ''),
                    view_count=info.get('view_count'),
                    like_count=info.get('like_count')
                ),
                audio_file_path=audio_file_path,
                transcript_file_path=transcript_file_path,
                audio_duration=info.get('duration'),
                sample_rate=44100, # yt-dlpのデフォルトに合わせる
                debug_info=debug_info
            )
            
    except Exception as e:
        debug_info['error'] = str(e)
        raise HTTPException(status_code=400, detail=f"音声ダウンロードに失敗しました: {str(e)}")

@app.post("/analyze-audio-accurate")
async def analyze_audio_accurate(request: AudioAnalysisRequest):
    """
    正確なdB測定による音声分析
    """
    try:
        # まず音声をダウンロード
        audio_response = await download_audio_enhanced(request)
        
        if audio_response.audio_file_path:
            # 正確な音声分析を実行
            analysis_result = improved_analyzer.analyze_audio_accurate(audio_response.audio_file_path)
            
            return {
                "video_info": audio_response.video_info,
                "audio_analysis": analysis_result,
                "audio_file_path": audio_response.audio_file_path
            }
        else:
            # 音声ファイルがダウンロードできない場合、メタデータのみで結果を返す
            print("音声ファイルがダウンロードできませんでした。メタデータのみで結果を返します。")
            
            return {
                "video_info": audio_response.video_info,
                "audio_analysis": {
                    "error": "音声ファイルのダウンロードに失敗しました",
                    "overall_excitement_score": 0,
                    "excitement_points": [],
                    "volume_analysis": {
                        "mean_volume": 0,
                        "max_volume": 0,
                        "rms_volume": 0
                    },
                    "duration": audio_response.video_info.duration or 0
                },
                "audio_file_path": None,
                "warning": "音声ファイルのダウンロードに失敗しました。メタデータのみを表示しています。"
            }
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"音声分析に失敗しました: {str(e)}")

@app.post("/analyze-engagement")
async def analyze_engagement(request: AudioAnalysisRequest):
    """
    YouTube動画のエンゲージメント分析
    """
    try:
        if not request.youtube_api_key:
            raise HTTPException(status_code=400, detail="YouTube API keyが必要です")
        
        # APIキーを設定
        engagement_analyzer.set_api_key(request.youtube_api_key)
        
        # 動画IDを抽出
        video_id = engagement_analyzer.extract_video_id(request.url)
        if not video_id:
            raise HTTPException(status_code=400, detail="有効なYouTube URLではありません")
        
        # エンゲージメント分析を実行
        engagement_result = engagement_analyzer.get_video_engagement_data(video_id)
        
        return {
            "video_url": request.url,
            "video_id": video_id,
            "engagement_analysis": engagement_result
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"エンゲージメント分析に失敗しました: {str(e)}")

@app.post("/analyze-comprehensive")
async def analyze_comprehensive(request: AudioAnalysisRequest):
    """
    包括的な動画分析（音声 + エンゲージメント）
    """
    try:
        # まず音声をダウンロード
        audio_response = await download_audio_enhanced(request)
        
        if audio_response.audio_file_path:
            # APIキーを設定（comprehensive_analyzerのengagement_analyzerにも設定）
            if request.youtube_api_key:
                comprehensive_analyzer.engagement_analyzer.set_api_key(request.youtube_api_key)
            
            # 包括的分析を実行
            comprehensive_result = comprehensive_analyzer.analyze_video_comprehensive(
                request.url, 
                audio_response.audio_file_path, 
                request.youtube_api_key
            )
            
            # 視覚化を生成
            audio_analysis = comprehensive_result.get('audio_analysis', {})
            excitement_points = audio_analysis.get('excitement_points', [])
            
            timeline_image = visualizer.create_excitement_timeline(audio_response.audio_file_path, excitement_points)
            summary_image = visualizer.create_summary_chart(audio_analysis)
            
            return {
                "video_info": audio_response.video_info,
                "comprehensive_analysis": comprehensive_result,
                "visualization": {
                    "timeline_image": timeline_image,
                    "summary_image": summary_image
                },
                "audio_file_path": audio_response.audio_file_path
            }
        else:
            # 音声ファイルがダウンロードできない場合、エンゲージメント分析のみを実行
            print("音声ファイルがダウンロードできませんでした。エンゲージメント分析のみを実行します。")
            
            if request.youtube_api_key:
                # APIキーを設定
                engagement_analyzer.set_api_key(request.youtube_api_key)
                # エンゲージメント分析のみを実行
                engagement_result = engagement_analyzer.get_video_engagement_data(
                    engagement_analyzer.extract_video_id(request.url)
                )
                
                return {
                    "video_info": audio_response.video_info,
                    "comprehensive_analysis": {
                        "audio_analysis": {"error": "音声ファイルのダウンロードに失敗しました"},
                        "engagement_analysis": engagement_result,
                        "comprehensive_score": 0,
                        "analysis_timestamp": datetime.now().isoformat()
                    },
                    "visualization": {
                        "timeline_image": "音声分析が利用できません",
                        "summary_image": "音声分析が利用できません"
                    },
                    "audio_file_path": None,
                    "warning": "音声ファイルのダウンロードに失敗しました。エンゲージメント分析のみを表示しています。"
                }
            else:
                raise HTTPException(status_code=400, detail="音声ファイルのダウンロードに失敗し、YouTube API keyも設定されていません")
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"包括的分析に失敗しました: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.1.0-gemini"}

@app.post("/analyze-gemini-enhanced")
async def analyze_gemini_enhanced(request: AudioAnalysisRequest):
    """
    Gemini AIによる質的分析を統合した最先端の動画分析
    """
    # APIキーの取得（リクエスト優先、環境変数フォールバック、デフォルトフォールバック）
    youtube_api_key = request.youtube_api_key or get_youtube_api_key()
    gemini_api_key = request.gemini_api_key or get_gemini_api_key()
    
    if not youtube_api_key:
        raise HTTPException(status_code=400, detail="有効なYouTube API keyが必要です（リクエストまたは環境変数YOUTUBE_API_KEY）")
    if not gemini_api_key:
        raise HTTPException(status_code=400, detail="有効なGemini API Keyが必要です（リクエストまたは環境変数GEMINI_API_KEY）")

    try:
        # 1. 音声、字幕、動画情報をダウンロード
        download_result = await download_audio_enhanced(request)
        
        # 2. 既存の包括的分析を実行
        comprehensive_result = {}
        if download_result.audio_file_path:
            comprehensive_analyzer.engagement_analyzer.set_api_key(youtube_api_key)
            comprehensive_result = comprehensive_analyzer.analyze_video_comprehensive(
                request.url, 
                download_result.audio_file_path, 
                youtube_api_key
            )
        else:
            # 音声がない場合はエンゲージメント分析のみ
            engagement_analyzer.set_api_key(youtube_api_key)
            video_id = engagement_analyzer.extract_video_id(request.url)
            comprehensive_result['engagement_analysis'] = engagement_analyzer.get_video_engagement_data(video_id)
            comprehensive_result['audio_analysis'] = {'error': 'Audio file not available'}

        # 3. Gemini分析のためのデータを準備
        transcript = ""
        if download_result.transcript_file_path:
            transcript = parse_vtt(download_result.transcript_file_path)
        
        if not transcript:
            transcript = download_result.video_info.description or "字幕または説明文がありません。"

        engagement_analysis = comprehensive_result.get("engagement_analysis", {})
        comments_data = engagement_analysis.get("raw_comments", [])
        
        if not comments_data and 'comments' in engagement_analysis:
            # フォールバック: コメント詳細からテキストを抽出
            comment_details = engagement_analysis['comments'].get('comment_details', [])
            comments_data = [comment['text'] for comment in comment_details[:50]]

        # 4. Gemini分析を実行（リアルタイム版→通常版に変更）
        gemini_analyzer = GeminiAnalyzer(api_key=gemini_api_key)
        gemini_result = gemini_analyzer.analyze_content_with_gemini(
            transcript,
            comments_data
        )

        # 5. VVPスコア・Golden Clip・Executive Summary生成フェーズ
        from video_evaluation_framework import calculate_vvp_score, extract_golden_clip
        narrative = gemini_result.get("narrative_score") or gemini_result.get("narrative_structure_score") or 0
        hook = gemini_result.get("hook_score") or gemini_result.get("hook_effectiveness_score") or 0
        engagement = gemini_result.get("engagement_score") or gemini_result.get("emotional_engagement_score") or 0
        tech = gemini_result.get("tech_score") or gemini_result.get("technical_quality_score") or 0
        vvp_score = calculate_vvp_score(float(narrative), float(hook), float(engagement), float(tech))
        golden_clip = gemini_result.get("golden_clip") or extract_golden_clip(gemini_result.get("semantic_hotspots", []))
        executive_summary = gemini_result.get("summary") or gemini_result.get("executive_summary") or "AIによる自動要約は未生成です。"

        # 6. 既存の結果とGeminiの結果をマージして返す
        return {
            "video_info": download_result.video_info,
            "original_analysis": comprehensive_result,
            "gemini_enhanced_analysis": gemini_result,
            "vvp_score": vvp_score,
            "golden_clip": golden_clip,
            "executive_summary": executive_summary,
            "analysis_timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Gemini拡張分析に失敗しました: {str(e)}")

@app.post("/evaluate-video-framework")
async def evaluate_video_framework(request: AudioAnalysisRequest):
    """
    統合縦型動画最適化フレームワークによる動画評価
    """
    try:
        # まず音声をダウンロード
        audio_response = await download_audio_enhanced(request)
        
        if audio_response.audio_file_path:
            # 動画メタデータを取得
            video_metadata = {
                "title": audio_response.video_info.title,
                "description": audio_response.video_info.description or "",
                "duration": audio_response.video_info.duration,
                "resolution": "1080x1920",  # 推定値
                "aspect_ratio": "9:16",     # 推定値
                "bitrate": 8000,            # 推定値
                "framerate": 30             # 推定値
            }
            
            # エンゲージメントデータを取得（APIキーがある場合）
            engagement_data = None
            if request.youtube_api_key:
                # APIキーを設定
                engagement_analyzer.set_api_key(request.youtube_api_key)
                video_id = engagement_analyzer.extract_video_id(request.url)
                if video_id:
                    engagement_result = engagement_analyzer.get_video_engagement_data(video_id)
                    if 'error' not in engagement_result:
                        engagement_data = engagement_result
            
            # フレームワーク評価を実行
            evaluation_result = evaluation_framework.evaluate_video_comprehensive(
                request.url,
                audio_response.audio_file_path,
                video_metadata,
                engagement_data
            )
            
            return {
                "video_info": audio_response.video_info,
                "evaluation_result": evaluation_result,
                "audio_file_path": audio_response.audio_file_path
            }
        else:
            # 音声ファイルがダウンロードできない場合、メタデータのみで評価
            print("音声ファイルがダウンロードできませんでした。メタデータのみで評価を実行します。")
            
            video_metadata = {
                "title": audio_response.video_info.title,
                "description": audio_response.video_info.description or "",
                "duration": audio_response.video_info.duration,
                "resolution": "1080x1920",  # 推定値
                "aspect_ratio": "9:16",     # 推定値
                "bitrate": 8000,            # 推定値
                "framerate": 30             # 推定値
            }
            
            # エンゲージメントデータを取得（APIキーがある場合）
            engagement_data = None
            if request.youtube_api_key:
                # APIキーを設定
                engagement_analyzer.set_api_key(request.youtube_api_key)
                video_id = engagement_analyzer.extract_video_id(request.url)
                if video_id:
                    engagement_result = engagement_analyzer.get_video_engagement_data(video_id)
                    if 'error' not in engagement_result:
                        engagement_data = engagement_result
            
            # メタデータのみでフレームワーク評価を実行
            evaluation_result = evaluation_framework.evaluate_video_comprehensive(
                request.url,
                None,  # 音声ファイルなし
                video_metadata,
                engagement_data
            )
            
            return {
                "video_info": audio_response.video_info,
                "evaluation_result": evaluation_result,
                "audio_file_path": None,
                "warning": "音声ファイルのダウンロードに失敗しました。メタデータとエンゲージメントデータのみで評価を実行しています。"
            }
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"動画評価に失敗しました: {str(e)}")

@app.post("/analyze-user-attributes")
async def analyze_user_attributes(comments: List[str] = Body(..., embed=True)):
    """
    コメントリストからユーザー属性（年齢・地域・所属・性別）を推定して返すAPI
    """
    analyzer = UserAttributeAnalyzer()
    result = analyzer.analyze(comments)
    return {"user_attributes": result}

@app.get("/api-info")
async def api_info():
    return {
        "version": "2.1.0-gemini",
        "features": [
            "正確なdB測定",
            "YouTubeエンゲージメント分析",
            "包括的動画分析",
            "視聴箇所特定",
            "コメント分析",
            "統合縦型動画最適化フレームワーク",
            "Gemini AI質的分析",
            "字幕自動取得",
            "セマンティックホットスポット分析"
        ],
        "endpoints": [
            "/analyze-audio-accurate - 正確な音声分析",
            "/analyze-engagement - エンゲージメント分析",
            "/analyze-comprehensive - 包括的分析",
            "/analyze-gemini-enhanced - Gemini AI拡張分析",
            "/evaluate-video-framework - 動画評価フレームワーク"
        ]
    } 