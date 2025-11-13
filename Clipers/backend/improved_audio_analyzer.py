import librosa
import numpy as np
from typing import Dict, List, Tuple, Optional
import json
import requests
from datetime import datetime
import re

class ImprovedAudioAnalyzer:
    def __init__(self, sample_rate: int = 22050):
        self.sample_rate = sample_rate
        # dB測定の基準値を設定（標準的な音声レベル）
        self.reference_level = 1.0  # 1.0 = 0 dBFS
        self.min_db = -60  # 最小dB値
        self.max_db = 0    # 最大dB値
        
    def analyze_audio_accurate(self, audio_file_path: str) -> Dict:
        """
        正確なdB測定による音声分析
        """
        try:
            # 音声ファイルを読み込み
            y, sr = librosa.load(audio_file_path, sr=self.sample_rate)
            duration = librosa.get_duration(y=y, sr=sr)
            
            # 正確なdB測定
            accurate_db = self._calculate_accurate_db(y, sr)
            
            # 音調分析
            pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
            pitch_mean = np.mean(pitches, axis=0)
            
            # 盛り上がりポイントの特定
            excitement_points = self._find_excitement_points_accurate(accurate_db, pitch_mean, duration)
            
            return {
                "duration": duration,
                "sample_rate": sr,
                "volume_analysis": {
                    "mean_volume": float(np.mean(accurate_db)),
                    "max_volume": float(np.max(accurate_db)),
                    "min_volume": float(np.min(accurate_db)),
                    "volume_variance": float(np.var(accurate_db)),
                    "peak_volume": float(np.max(np.abs(y))),
                    "rms_volume": float(np.sqrt(np.mean(y**2)))
                },
                "pitch_analysis": {
                    "mean_pitch": float(np.mean(pitch_mean)),
                    "pitch_variance": float(np.var(pitch_mean)),
                    "pitch_range": float(np.max(pitch_mean) - np.min(pitch_mean))
                },
                "excitement_points": excitement_points,
                "overall_excitement_score": self._calculate_excitement_score_accurate(accurate_db, pitch_mean),
                "analysis_metadata": {
                    "reference_level": self.reference_level,
                    "min_db": self.min_db,
                    "max_db": self.max_db,
                    "analysis_method": "accurate_db_measurement"
                }
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    def _calculate_accurate_db(self, y: np.ndarray, sr: int) -> np.ndarray:
        """
        正確なdB値を計算
        """
        # RMS（二乗平均平方根）を計算
        frame_length = int(0.025 * sr)  # 25msフレーム
        hop_length = int(0.010 * sr)    # 10msホップ
        
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
        
        # 正確なdB変換
        # 基準レベル（1.0）を0dBとして計算
        db = 20 * np.log10(np.maximum(rms, 1e-10))  # ゼロ除算を防ぐ
        
        # dB値を適切な範囲に制限
        db = np.clip(db, self.min_db, self.max_db)
        
        return db
    
    def _find_excitement_points_accurate(self, db: np.ndarray, pitch_mean: np.ndarray, duration: float) -> List[Dict]:
        """
        正確なdB測定による盛り上がりポイント検出
        """
        excitement_points = []
        
        # 時間軸を計算
        times = librosa.times_like(db, sr=self.sample_rate)
        
        # 音量ベースの盛り上がりポイント検出
        volume_threshold = np.mean(db) + 0.8 * np.std(db)
        high_volume_indices = np.where(db > volume_threshold)[0]
        
        if len(high_volume_indices) > 0:
            # 連続したポイントをグループ化
            groups = []
            current_group = [high_volume_indices[0]]
            
            for i in range(1, len(high_volume_indices)):
                if high_volume_indices[i] - high_volume_indices[i-1] <= 5:  # 5フレーム以内
                    current_group.append(high_volume_indices[i])
                else:
                    if len(current_group) >= 3:
                        groups.append(current_group)
                    current_group = [high_volume_indices[i]]
            
            if len(current_group) >= 3:
                groups.append(current_group)
            
            # 各グループから盛り上がりポイントを抽出
            for group in groups:
                center_idx = group[len(group)//2]
                center_time = times[center_idx]
                intensity = min(1.0, len(group) / 10.0)
                
                excitement_points.append({
                    "time": round(center_time, 2),
                    "duration": round(times[group[-1]] - times[group[0]], 2),
                    "intensity": round(intensity, 3),
                    "type": "volume",
                    "db_level": round(float(db[center_idx]), 2)
                })
        
        # 音調ベースの盛り上がりポイント検出
        if len(pitch_mean) > 0:
            pitch_threshold = np.mean(pitch_mean) + 0.6 * np.std(pitch_mean)
            high_pitch_indices = np.where(pitch_mean > pitch_threshold)[0]
            
            if len(high_pitch_indices) > 0:
                pitch_times = high_pitch_indices / len(pitch_mean) * duration
                
                # 音調の変化ポイントをサンプリング
                for i in range(0, len(pitch_times), 30):  # 30フレームごと
                    if i < len(pitch_times):
                        excitement_points.append({
                            "time": round(pitch_times[i], 2),
                            "duration": 1.0,
                            "intensity": 0.4,
                            "type": "pitch",
                            "pitch_value": round(float(pitch_mean[high_pitch_indices[i]]), 2)
                        })
        
        # 時間順にソートして上位15個を返す
        excitement_points.sort(key=lambda x: x["time"])
        return excitement_points[:15]
    
    def _calculate_excitement_score_accurate(self, db: np.ndarray, pitch_mean: np.ndarray) -> float:
        """
        正確なdB測定による盛り上がりスコア計算
        """
        # 音量の動的範囲
        volume_dynamic_range = np.max(db) - np.min(db)
        
        # 音量の変動
        volume_variance = np.var(db)
        
        # 音調の変動
        pitch_variance = np.var(pitch_mean) if len(pitch_mean) > 0 else 0
        
        # スコアを計算（0-100）
        score = (
            (volume_dynamic_range / abs(self.min_db)) * 40 +  # 音量動的範囲: 40点
            (volume_variance / 100) * 35 +                    # 音量変動: 35点
            (pitch_variance / 1000) * 25                      # 音調変動: 25点
        )
        
        return min(100.0, max(0.0, score))

class YouTubeEngagementAnalyzer:
    def __init__(self):
        self.youtube_api_key = None  # YouTube Data API v3キー
        
    def set_api_key(self, api_key: str):
        """YouTube Data API v3キーを設定（改善版）"""
        # APIキーの検証を改善
        if api_key and api_key.strip() and len(api_key) > 20:
            self.youtube_api_key = api_key.strip()
            print(f"YouTube APIキーが設定されました: {api_key[:10]}...")
        else:
            self.youtube_api_key = None
            print(f"無効なAPIキーが提供されました: {api_key[:10] if api_key else 'None'}...")
    
    def extract_video_id(self, url: str) -> str:
        """YouTube URLから動画IDを抽出"""
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)',
            r'youtube\.com\/watch\?.*v=([^&\n?#]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
    
    def get_video_engagement_data(self, video_id: str) -> Dict:
        """
        YouTube動画のエンゲージメントデータを取得（改善版）
        """
        if not self.youtube_api_key:
            return {"error": "YouTube API key not set"}
        
        try:
            print(f"動画ID {video_id} のエンゲージメントデータを取得中...")
            
            # 動画の基本情報を取得
            video_url = f"https://www.googleapis.com/youtube/v3/videos"
            params = {
                'part': 'snippet,statistics,contentDetails',
                'id': video_id,
                'key': self.youtube_api_key
            }
            
            response = requests.get(video_url, params=params)
            print(f"動画情報API応答: {response.status_code}")
            
            if response.status_code != 200:
                return {"error": f"YouTube API error: {response.status_code} - {response.text}"}
            
            video_data = response.json()
            if not video_data.get('items'):
                return {"error": "Video not found"}
            
            video_info = video_data['items'][0]
            print(f"動画タイトル: {video_info['snippet']['title']}")
            
            # コメントを取得（複数ページ対応）
            all_comments = []
            next_page_token = None
            max_pages = 3  # 最大3ページ（300件のコメント）
            
            for page in range(max_pages):
                comments_url = f"https://www.googleapis.com/youtube/v3/commentThreads"
                comment_params = {
                    'part': 'snippet',
                    'videoId': video_id,
                    'maxResults': 100,
                    'order': 'relevance',
                    'key': self.youtube_api_key
                }
                
                if next_page_token:
                    comment_params['pageToken'] = next_page_token
                
                comments_response = requests.get(comments_url, params=comment_params)
                print(f"コメント取得ページ {page + 1}: {comments_response.status_code}")
                
                if comments_response.status_code == 200:
                    comments_data = comments_response.json()
                    page_comments = comments_data.get('items', [])
                    all_comments.extend(page_comments)
                    
                    # 次のページがあるかチェック
                    next_page_token = comments_data.get('nextPageToken')
                    if not next_page_token:
                        break
                else:
                    print(f"コメント取得エラー: {comments_response.status_code}")
                    break
            
            print(f"取得したコメント数: {len(all_comments)}")
            
            # 詳細なコメント分析
            detailed_comments = self._analyze_comments_detailed(all_comments)
            
            return {
                "video_info": {
                    "title": video_info['snippet']['title'],
                    "description": video_info['snippet'].get('description', ''),
                    "duration": self._parse_duration(video_info['contentDetails']['duration']),
                    "view_count": int(video_info['statistics'].get('viewCount', 0)),
                    "like_count": int(video_info['statistics'].get('likeCount', 0)),
                    "comment_count": int(video_info['statistics'].get('commentCount', 0)),
                    "published_at": video_info['snippet'].get('publishedAt', ''),
                    "channel_title": video_info['snippet'].get('channelTitle', '')
                },
                "engagement_analysis": {
                    "engagement_rate": self._calculate_engagement_rate(video_info['statistics']),
                    "comments": detailed_comments,
                    "hot_timestamps": self._find_hot_timestamps(all_comments),
                    "comment_sentiment": self._analyze_comment_sentiment(all_comments),
                    "popular_keywords": self._extract_popular_keywords(all_comments)
                },
                "raw_comments": [comment['snippet']['topLevelComment']['snippet']['textDisplay'] 
                               for comment in all_comments[:50]]  # 上位50件のコメントテキスト
            }
            
        except Exception as e:
            print(f"エンゲージメントデータ取得エラー: {str(e)}")
            return {"error": f"Failed to get engagement data: {str(e)}"}
    
    def _parse_duration(self, duration_str: str) -> int:
        """ISO 8601期間文字列を秒数に変換"""
        import re
        match = re.match(r'PT(\d+H)?(\d+M)?(\d+S)?', duration_str)
        hours = int(match.group(1)[:-1]) if match.group(1) else 0
        minutes = int(match.group(2)[:-1]) if match.group(2) else 0
        seconds = int(match.group(3)[:-1]) if match.group(3) else 0
        return hours * 3600 + minutes * 60 + seconds
    
    def _calculate_engagement_rate(self, statistics: Dict) -> float:
        """エンゲージメント率を計算"""
        view_count = int(statistics.get('viewCount', 1))
        like_count = int(statistics.get('likeCount', 0))
        comment_count = int(statistics.get('commentCount', 0))
        
        engagement_rate = ((like_count + comment_count) / view_count) * 100
        return round(engagement_rate, 3)
    
    def _analyze_comments_detailed(self, comments: List[Dict]) -> Dict:
        """詳細なコメント分析"""
        if not comments:
            return {"total_comments": 0, "average_length": 0, "comment_details": []}
        
        comment_details = []
        total_length = 0
        
        for comment in comments:
            comment_snippet = comment['snippet']['topLevelComment']['snippet']
            text = comment_snippet['textDisplay']
            like_count = comment_snippet.get('likeCount', 0)
            
            total_length += len(text)
            
            comment_details.append({
                "text": text,
                "like_count": like_count,
                "length": len(text),
                "author": comment_snippet.get('authorDisplayName', ''),
                "published_at": comment_snippet.get('publishedAt', '')
            })
        
        return {
            "total_comments": len(comments),
            "average_length": round(total_length / len(comments), 1),
            "comment_details": comment_details,
            "total_likes_on_comments": sum(c['like_count'] for c in comment_details)
        }
    
    def _analyze_comments(self, comments: List[Dict]) -> Dict:
        """コメント分析（後方互換性のため）"""
        return self._analyze_comments_detailed(comments)
    
    def _find_hot_timestamps(self, comments: List[Dict]) -> List[Dict]:
        """コメントからホットなタイムスタンプを抽出"""
        timestamp_pattern = r'(\d{1,2}):(\d{2})(?::(\d{2}))?'
        timestamps = []
        
        for comment in comments:
            text = comment['snippet']['topLevelComment']['snippet']['textDisplay']
            matches = re.findall(timestamp_pattern, text)
            
            for match in matches:
                hours = int(match[0])
                minutes = int(match[1])
                seconds = int(match[2]) if match[2] else 0
                
                total_seconds = hours * 3600 + minutes * 60 + seconds
                timestamps.append(total_seconds)
        
        # タイムスタンプの頻度をカウント
        if timestamps:
            from collections import Counter
            timestamp_counts = Counter(timestamps)
            
            # 上位10個のホットタイムスタンプを返す
            hot_timestamps = []
            for timestamp, count in timestamp_counts.most_common(10):
                hours = timestamp // 3600
                minutes = (timestamp % 3600) // 60
                seconds = timestamp % 60
                
                hot_timestamps.append({
                    "time": timestamp,
                    "formatted_time": f"{hours:02d}:{minutes:02d}:{seconds:02d}",
                    "mention_count": count,
                    "intensity": min(1.0, count / max(timestamp_counts.values()))
                })
            
            return hot_timestamps
        
        return []
    
    def _analyze_comment_sentiment(self, comments: List[Dict]) -> Dict:
        """コメントの感情分析（簡易版）"""
        if not comments:
            return {"positive": 0, "negative": 0, "neutral": 0}
        
        positive_words = ['いい', '良い', '素晴らしい', '最高', '面白い', '感動', '笑', '愛', '好き', '楽しい']
        negative_words = ['悪い', 'つまらない', '嫌い', '最悪', 'ひどい', '退屈', 'つらい', '悲しい']
        
        positive_count = 0
        negative_count = 0
        neutral_count = 0
        
        for comment in comments:
            text = comment['snippet']['topLevelComment']['snippet']['textDisplay'].lower()
            
            positive_matches = sum(1 for word in positive_words if word in text)
            negative_matches = sum(1 for word in negative_words if word in text)
            
            if positive_matches > negative_matches:
                positive_count += 1
            elif negative_matches > positive_matches:
                negative_count += 1
            else:
                neutral_count += 1
        
        total = len(comments)
        return {
            "positive": positive_count,
            "negative": negative_count,
            "neutral": neutral_count,
            "positive_rate": round((positive_count / total) * 100, 1) if total > 0 else 0,
            "negative_rate": round((negative_count / total) * 100, 1) if total > 0 else 0
        }
    
    def _extract_popular_keywords(self, comments: List[Dict]) -> List[Dict]:
        """人気キーワードの抽出"""
        if not comments:
            return []
        
        import re
        all_text = ' '.join([comment['snippet']['topLevelComment']['snippet']['textDisplay'] 
                           for comment in comments])
        
        words = re.findall(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+', all_text)
        word_counts = {}
        
        for word in words:
            if len(word) > 1:  # 1文字の単語は除外
                word_counts[word] = word_counts.get(word, 0) + 1
        
        # 上位10個のキーワードを返す
        popular_keywords = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        
        return [{"word": word, "count": count} for word, count in popular_keywords]

class ComprehensiveAnalyzer:
    def __init__(self):
        self.audio_analyzer = ImprovedAudioAnalyzer()
        self.engagement_analyzer = YouTubeEngagementAnalyzer()
    
    def analyze_video_comprehensive(self, video_url: str, audio_file_path: str, api_key: str = None) -> Dict:
        """
        包括的な動画分析（音声 + エンゲージメント）
        """
        # 音声分析
        audio_analysis = self.audio_analyzer.analyze_audio_accurate(audio_file_path)
        
        # エンゲージメント分析
        if api_key:
            self.engagement_analyzer.set_api_key(api_key)
            video_id = self.engagement_analyzer.extract_video_id(video_url)
            engagement_analysis = self.engagement_analyzer.get_video_engagement_data(video_id)
        else:
            engagement_analysis = {"error": "YouTube API key not provided"}
        
        # 結果を統合
        return {
            "audio_analysis": audio_analysis,
            "engagement_analysis": engagement_analysis,
            "comprehensive_score": self._calculate_comprehensive_score(audio_analysis, engagement_analysis),
            "analysis_timestamp": datetime.now().isoformat()
        }
    
    def _calculate_comprehensive_score(self, audio_analysis: Dict, engagement_analysis: Dict) -> float:
        """包括的スコアを計算"""
        audio_score = audio_analysis.get('overall_excitement_score', 0)
        
        if 'error' not in engagement_analysis:
            engagement_rate = engagement_analysis.get('engagement_analysis', {}).get('engagement_rate', 0)
            # 音声スコア70% + エンゲージメント率30%
            comprehensive_score = (audio_score * 0.7) + (engagement_rate * 0.3)
        else:
            comprehensive_score = audio_score
        
        return round(comprehensive_score, 2) 