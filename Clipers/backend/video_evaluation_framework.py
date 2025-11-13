import librosa
import numpy as np
from typing import Dict, List, Tuple, Optional
import json
import requests
from datetime import datetime
import re
from dataclasses import dataclass
from enum import Enum
import math

class EvaluationPillar(Enum):
    TECHNICAL_QUALITY = "technical_quality"
    HOOK_EFFECTIVENESS = "hook_effectiveness"
    NARRATIVE_RETENTION = "narrative_retention"
    ENGAGEMENT_SIGNALS = "engagement_signals"
    PLATFORM_INTEGRITY = "platform_integrity"

@dataclass
class EvaluationMetrics:
    pillar: EvaluationPillar
    score: float
    max_score: float
    details: Dict
    recommendations: List[str]

class VideoEvaluationFramework:
    def __init__(self):
        self.pillar_weights = {
            EvaluationPillar.TECHNICAL_QUALITY: 0.05,      # 5%
            EvaluationPillar.HOOK_EFFECTIVENESS: 0.25,     # 25%
            EvaluationPillar.NARRATIVE_RETENTION: 0.40,    # 40%
            EvaluationPillar.ENGAGEMENT_SIGNALS: 0.20,     # 20%
            EvaluationPillar.PLATFORM_INTEGRITY: 0.10      # 10%
        }
        
    def evaluate_video_comprehensive(self, video_url: str, audio_file_path: str, 
                                   video_metadata: Dict, engagement_data: Dict = None) -> Dict:
        """
        統合縦型動画最適化フレームワークによる包括的評価
        """
        try:
            # 各柱の評価を実行
            technical_quality = self._evaluate_technical_quality(video_metadata)
            hook_effectiveness = self._evaluate_hook_effectiveness(audio_file_path, video_metadata)
            narrative_retention = self._evaluate_narrative_retention(audio_file_path, video_metadata)
            engagement_signals = self._evaluate_engagement_signals(engagement_data, video_metadata)
            platform_integrity = self._evaluate_platform_integrity(video_metadata, engagement_data)
            
            # 総合スコアを計算
            total_score = self._calculate_total_score([
                technical_quality, hook_effectiveness, narrative_retention,
                engagement_signals, platform_integrity
            ])
            
            # VVPスコアを計算
            vvp_score = calculate_vvp_score(
                narrative_retention.score / narrative_retention.max_score,
                hook_effectiveness.score / hook_effectiveness.max_score,
                engagement_signals.score / engagement_signals.max_score,
                technical_quality.score / technical_quality.max_score
            )

            # Golden Clipを抽出
            golden_clip = extract_golden_clip(engagement_data.get('hotspots', [])) if engagement_data else None
            
            # バイラルポテンシャルを判定
            viral_potential = self._assess_viral_potential(total_score)
            
            return {
                "evaluation_framework": "統合縦型動画最適化フレームワーク v1.0",
                "video_url": video_url,
                "evaluation_timestamp": datetime.now().isoformat(),
                "total_score": total_score,
                "vvp_score": vvp_score,
                "golden_clip": golden_clip,
                "viral_potential": viral_potential,
                "pillar_evaluations": {
                    "technical_quality": technical_quality.__dict__,
                    "hook_effectiveness": hook_effectiveness.__dict__,
                    "narrative_retention": narrative_retention.__dict__,
                    "engagement_signals": engagement_signals.__dict__,
                    "platform_integrity": platform_integrity.__dict__
                },
                "strategic_recommendations": self._generate_strategic_recommendations([
                    technical_quality, hook_effectiveness, narrative_retention,
                    engagement_signals, platform_integrity
                ]),
                "platform_optimization": self._generate_platform_optimization(video_metadata)
            }
            
        except Exception as e:
            return {"error": f"評価フレームワークエラー: {str(e)}"}
    
    def _evaluate_technical_quality(self, video_metadata: Dict) -> EvaluationMetrics:
        """
        柱1: 技術品質の評価 (5点)
        """
        score = 0
        details = {}
        recommendations = []
        
        # 解像度チェック
        resolution = video_metadata.get('resolution', '')
        if '1920x1080' in resolution or '1080x1920' in resolution:
            score += 2
            details['resolution'] = "適切な解像度 (1080p)"
        else:
            details['resolution'] = "解像度が最適化されていません"
            recommendations.append("解像度を1080x1920に設定してください")
        
        # アスペクト比チェック
        aspect_ratio = video_metadata.get('aspect_ratio', '')
        if '9:16' in aspect_ratio or '16:9' in aspect_ratio:
            score += 1
            details['aspect_ratio'] = "適切なアスペクト比"
        else:
            details['aspect_ratio'] = "アスペクト比が最適化されていません"
            recommendations.append("縦型動画の場合は9:16アスペクト比を使用してください")
        
        # ビットレートチェック
        bitrate = video_metadata.get('bitrate', 0)
        if bitrate >= 8000:  # 8 Mbps以上
            score += 1
            details['bitrate'] = f"適切なビットレート ({bitrate} kbps)"
        else:
            details['bitrate'] = f"ビットレートが低い ({bitrate} kbps)"
            recommendations.append("ビットレートを8 Mbps以上に設定してください")
        
        # フレームレートチェック
        framerate = video_metadata.get('framerate', 0)
        if framerate >= 30:
            score += 1
            details['framerate'] = f"適切なフレームレート ({framerate} fps)"
        else:
            details['framerate'] = f"フレームレートが低い ({framerate} fps)"
            recommendations.append("フレームレートを30 fps以上に設定してください")
        
        return EvaluationMetrics(
            pillar=EvaluationPillar.TECHNICAL_QUALITY,
            score=score,
            max_score=5,
            details=details,
            recommendations=recommendations
        )
    
    def _evaluate_hook_effectiveness(self, audio_file_path: str, video_metadata: Dict) -> EvaluationMetrics:
        """
        柱2: フックの効力の評価 (25点)
        """
        score = 0
        details = {}
        recommendations = []
        
        # 音声ファイルがない場合の処理
        if audio_file_path is None:
            details['audio_unavailable'] = "音声ファイルが利用できません"
            recommendations.append("音声ファイルのダウンロードに失敗しました")
            
            # メタデータのみでフック評価
            title = video_metadata.get('title', '')
            description = video_metadata.get('description', '')
            
            # 質問フックの検出
            question_words = ['?', '？', 'なぜ', 'どうして', '何', 'どのように']
            if any(word in title or word in description for word in question_words):
                score += 7
                details['hook_clarity'] = "質問フックを検出"
            else:
                details['hook_clarity'] = "質問フックが見つかりません"
                recommendations.append("フックに質問を組み込んでください")
            
            # 感情的な言葉の検出
            emotional_words = ['衝撃', '感動', '驚き', '涙', '笑い', '興奮', '驚愕']
            if any(word in title or word in description for word in emotional_words):
                score += 5
                details['emotional_hook'] = "感情的なフックを検出"
            else:
                details['emotional_hook'] = "感情的なフックが見つかりません"
                recommendations.append("感情的な言葉をタイトルに含めてください")
            
            return EvaluationMetrics(
                pillar=EvaluationPillar.HOOK_EFFECTIVENESS,
                score=score,
                max_score=25,
                details=details,
                recommendations=recommendations
            )
        
        try:
            # 音声データを読み込み
            y, sr = librosa.load(audio_file_path, sr=22050)
            duration = librosa.get_duration(y=y, sr=sr)
            
            # 最初の3秒の分析
            hook_duration = min(3.0, duration)
            hook_samples = int(hook_duration * sr)
            hook_audio = y[:hook_samples]
            
            # 音量分析（フックの強度）
            rms = librosa.feature.rms(y=hook_audio)[0]
            hook_volume = np.mean(rms)
            
            # 音量の強度評価
            if hook_volume > 0.1:
                score += 10
                details['hook_volume'] = "強い音量のフック"
            elif hook_volume > 0.05:
                score += 5
                details['hook_volume'] = "中程度の音量のフック"
            else:
                details['hook_volume'] = "弱い音量のフック"
                recommendations.append("フック部分の音量を上げてください")
            
            # 音調変化の分析
            pitches, magnitudes = librosa.piptrack(y=hook_audio, sr=sr)
            pitch_mean = np.mean(pitches, axis=0)
            pitch_variance = np.var(pitch_mean)
            
            if pitch_variance > 1000:
                score += 8
                details['pitch_variation'] = "音調変化が豊富"
            elif pitch_variance > 500:
                score += 4
                details['pitch_variation'] = "中程度の音調変化"
            else:
                details['pitch_variation'] = "音調変化が少ない"
                recommendations.append("フック部分で音調変化を増やしてください")
            
            # フックの明快さ（メタデータから推定）
            title = video_metadata.get('title', '')
            description = video_metadata.get('description', '')
            
            # 質問フックの検出
            question_words = ['?', '？', 'なぜ', 'どうして', '何', 'どのように']
            if any(word in title or word in description for word in question_words):
                score += 7
                details['hook_clarity'] = "質問フックを検出"
            else:
                details['hook_clarity'] = "質問フックが見つかりません"
                recommendations.append("フックに質問を組み込んでください")
            
        except Exception as e:
            details['error'] = f"フック分析エラー: {str(e)}"
            recommendations.append("音声ファイルの分析に失敗しました")
        
        return EvaluationMetrics(
            pillar=EvaluationPillar.HOOK_EFFECTIVENESS,
            score=score,
            max_score=25,
            details=details,
            recommendations=recommendations
        )
    
    def _evaluate_narrative_retention(self, audio_file_path: str, video_metadata: Dict) -> EvaluationMetrics:
        """
        柱3: ナラティブ維持率の評価 (40点)
        """
        score = 0
        details = {}
        recommendations = []
        
        # 音声ファイルがない場合の処理
        if audio_file_path is None:
            details['audio_unavailable'] = "音声ファイルが利用できません"
            recommendations.append("音声ファイルのダウンロードに失敗しました")
            
            # メタデータのみでナラティブ評価
            title = video_metadata.get('title', '')
            description = video_metadata.get('description', '')
            duration = video_metadata.get('duration', 0)
            
            # 動画の長さによる評価
            if duration <= 60:  # 1分以下
                score += 20
                details['optimal_length'] = "最適な長さ（1分以下）"
            elif duration <= 180:  # 3分以下
                score += 15
                details['good_length'] = "良い長さ（3分以下）"
            else:
                details['long_duration'] = "長すぎる動画"
                recommendations.append("動画を短くして視聴維持率を向上させてください")
            
            # タイトルの魅力度
            if len(title) >= 10 and len(title) <= 50:
                score += 10
                details['title_length'] = "適切なタイトル長"
            else:
                details['title_length'] = "タイトルが短すぎるか長すぎます"
                recommendations.append("タイトルを10-50文字に調整してください")
            
            # 説明文の充実度
            if len(description) >= 50:
                score += 10
                details['description_richness'] = "充実した説明文"
            else:
                details['description_richness'] = "説明文が不十分"
                recommendations.append("説明文を充実させてください")
            
            return EvaluationMetrics(
                pillar=EvaluationPillar.NARRATIVE_RETENTION,
                score=score,
                max_score=40,
                details=details,
                recommendations=recommendations
            )
        
        try:
            # 音声データを読み込み
            y, sr = librosa.load(audio_file_path, sr=22050)
            duration = librosa.get_duration(y=y, sr=sr)
            
            # 平均視聴率の推定（音声の一貫性から）
            rms = librosa.feature.rms(y=y)[0]
            volume_consistency = 1 - (np.std(rms) / np.mean(rms))
            
            # 音量の一貫性から視聴維持率を推定
            if volume_consistency > 0.8:
                score += 30
                details['viewer_retention'] = "高い視聴維持率が期待される"
            elif volume_consistency > 0.6:
                score += 20
                details['viewer_retention'] = "中程度の視聴維持率"
            else:
                details['viewer_retention'] = "視聴維持率が低い可能性"
                recommendations.append("音声の一貫性を向上させてください")
            
            # 動画の長さによる評価
            if duration <= 60:  # 1分以下
                score += 10
                details['optimal_length'] = "最適な長さ（1分以下）"
            elif duration <= 180:  # 3分以下
                score += 5
                details['good_length'] = "良い長さ（3分以下）"
            else:
                details['long_duration'] = "長すぎる動画"
                recommendations.append("動画を短くして視聴維持率を向上させてください")
            
        except Exception as e:
            details['error'] = f"ナラティブ分析エラー: {str(e)}"
            recommendations.append("音声ファイルの分析に失敗しました")
        
        return EvaluationMetrics(
            pillar=EvaluationPillar.NARRATIVE_RETENTION,
            score=score,
            max_score=40,
            details=details,
            recommendations=recommendations
        )
    
    def _evaluate_engagement_signals(self, engagement_data: Dict, video_metadata: Dict) -> EvaluationMetrics:
        """
        柱4: エンゲージメントシグナルの評価 (20点)
        """
        score = 0
        details = {}
        recommendations = []
        
        if not engagement_data or 'error' in engagement_data:
            details['engagement_data'] = "エンゲージメントデータが利用できません"
            recommendations.append("YouTube API Keyを設定してエンゲージメント分析を有効にしてください")
            return EvaluationMetrics(
                pillar=EvaluationPillar.ENGAGEMENT_SIGNALS,
                score=0,
                max_score=20,
                details=details,
                recommendations=recommendations
            )
        
        # シェア価値の評価
        title = video_metadata.get('title', '')
        description = video_metadata.get('description', '')
        
        # シェアを促す要素の検出
        share_triggers = ['共有', 'シェア', '友達', '家族', 'みんな', '皆さん', 'チェック', '試して']
        if any(trigger in title or trigger in description for trigger in share_triggers):
            score += 10
            details['share_value'] = "シェアを促す要素を検出"
        else:
            details['share_value'] = "シェアを促す要素が見つかりません"
            recommendations.append("タイトルや説明にシェアを促す要素を追加してください")
        
        # コメントプロンプトの評価
        comment_triggers = ['?', '？', 'どう思う', 'あなたは', 'コメント', '意見', '感想']
        if any(trigger in title or trigger in description for trigger in comment_triggers):
            score += 10
            details['comment_prompt'] = "コメントを促す要素を検出"
        else:
            details['comment_prompt'] = "コメントを促す要素が見つかりません"
            recommendations.append("視聴者に質問を投げかけてコメントを促してください")
        
        return EvaluationMetrics(
            pillar=EvaluationPillar.ENGAGEMENT_SIGNALS,
            score=score,
            max_score=20,
            details=details,
            recommendations=recommendations
        )
    
    def _evaluate_platform_integrity(self, video_metadata: Dict, engagement_data: Dict) -> EvaluationMetrics:
        """
        柱5: プラットフォーム整合性の評価 (10点)
        """
        score = 0
        details = {}
        recommendations = []
        
        # ハッシュタグの分析
        description = video_metadata.get('description', '')
        hashtags = re.findall(r'#\w+', description)
        
        if len(hashtags) >= 3:
            score += 5
            details['hashtags'] = f"適切なハッシュタグ数 ({len(hashtags)}個)"
        elif len(hashtags) > 0:
            score += 2
            details['hashtags'] = f"ハッシュタグが少ない ({len(hashtags)}個)"
            recommendations.append("2-3個の関連ハッシュタグを追加してください")
        else:
            details['hashtags'] = "ハッシュタグが見つかりません"
            recommendations.append("関連するハッシュタグを追加してください")
        
        # トレンド音源の使用（推定）
        # 実際の実装では、音源データベースとの照合が必要
        score += 5
        details['trending_audio'] = "音源分析は手動で確認してください"
        recommendations.append("トレンド音源の使用を検討してください")
        
        return EvaluationMetrics(
            pillar=EvaluationPillar.PLATFORM_INTEGRITY,
            score=score,
            max_score=10,
            details=details,
            recommendations=recommendations
        )
    
    def _calculate_total_score(self, evaluations: List[EvaluationMetrics]) -> float:
        """総合スコアを計算"""
        total_score = 0
        for evaluation in evaluations:
            weight = self.pillar_weights[evaluation.pillar]
            normalized_score = (evaluation.score / evaluation.max_score) * 100
            total_score += normalized_score * weight
        
        return round(total_score, 2)
    
    def _assess_viral_potential(self, total_score: float) -> Dict:
        """バイラルポテンシャルを判定"""
        if total_score >= 85:
            level = "非常に高い"
            description = "バイラルポテンシャルが非常に高い動画です"
        elif total_score >= 70:
            level = "高い"
            description = "バイラルポテンシャルが高い動画です"
        elif total_score >= 50:
            level = "中程度"
            description = "中程度のバイラルポテンシャルがあります"
        else:
            level = "低い"
            description = "バイラルポテンシャルが低い動画です"
        
        return {
            "level": level,
            "description": description,
            "score": total_score
        }
    
    def _generate_strategic_recommendations(self, evaluations: List[EvaluationMetrics]) -> List[str]:
        """戦略的推奨事項を生成"""
        recommendations = []
        
        for evaluation in evaluations:
            if evaluation.score / evaluation.max_score < 0.7:  # 70%未満の場合
                recommendations.extend(evaluation.recommendations)
        
        # 優先度の高い推奨事項を上位に配置
        priority_keywords = ['フック', '視聴維持', 'エンゲージメント', 'シェア']
        sorted_recommendations = []
        
        for keyword in priority_keywords:
            for rec in recommendations:
                if keyword in rec and rec not in sorted_recommendations:
                    sorted_recommendations.append(rec)
        
        # 残りの推奨事項を追加
        for rec in recommendations:
            if rec not in sorted_recommendations:
                sorted_recommendations.append(rec)
        
        return sorted_recommendations[:10]  # 最大10個まで
    
    def _generate_platform_optimization(self, video_metadata: Dict) -> Dict:
        """プラットフォーム別最適化提案"""
        return {
            "youtube_shorts": {
                "focus": "視聴維持率（VVSA）の最大化",
                "recommendations": [
                    "最初の1-3秒で強力なフックを作成",
                    "シームレスなループ構造を実装",
                    "視聴完了率を80%以上に維持"
                ]
            },
            "tiktok": {
                "focus": "エンゲージメントシグナルの最大化",
                "recommendations": [
                    "シェアを促すコンテンツ構造",
                    "コメント欄の活性化",
                    "トレンド音源とハッシュタグの活用"
                ]
            }
        } 

def calculate_vvp_score(narrative, hook, engagement, tech):
    """
    VVP Score = (KPI_NR × 0.40) + (KPI_HE × 0.30) + (KPI_ES × 0.25) + (KPI_TQ × 0.05)
    10点満点→100点満点に換算
    """
    vvp = (narrative * 0.40 + hook * 0.30 + engagement * 0.25 + tech * 0.05) * 10
    return round(vvp, 1)


def extract_golden_clip(hotspots):
    """
    セマンティック・ホットスポットから最重要区間（Golden Clip）を抽出
    hotspots: [{"time": "03:12", "reason": "..."}, ...]
    """
    if not hotspots:
        return None
    # 最初のホットスポットをGolden Clipとする（改良可）
    return hotspots[0] 