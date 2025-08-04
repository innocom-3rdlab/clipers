import matplotlib.pyplot as plt
import numpy as np
import librosa
import io
import base64
from typing import Dict, List
import json

class AudioVisualizer:
    def __init__(self):
        self.sample_rate = 22050
        
    def create_excitement_timeline(self, audio_file_path: str, excitement_points: List[Dict]) -> str:
        """
        盛り上がりポイントのタイムラインを生成
        """
        try:
            # 音声ファイルを読み込み
            y, sr = librosa.load(audio_file_path, sr=self.sample_rate)
            duration = librosa.get_duration(y=y, sr=sr)
            
            # 音量の時間変化を取得
            rms = librosa.feature.rms(y=y)[0]
            db = librosa.amplitude_to_db(rms)
            times = librosa.times_like(db, sr=sr)
            
            # グラフを作成
            fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))
            
            # 音量の時間変化
            ax1.plot(times, db, alpha=0.7, color='blue', linewidth=0.5)
            ax1.set_ylabel('音量 (dB)')
            ax1.set_title('音声の音量変化と盛り上がりポイント')
            ax1.grid(True, alpha=0.3)
            
            # 盛り上がりポイントをマーク
            for point in excitement_points:
                time = point['time']
                intensity = point['intensity']
                point_type = point.get('type', 'volume')
                
                color = 'red' if point_type == 'volume' else 'orange'
                ax1.axvline(x=time, color=color, alpha=0.8, linestyle='--', linewidth=2)
                ax1.text(time, ax1.get_ylim()[1] * 0.9, f'{time}s\n({intensity:.2f})', 
                        rotation=90, fontsize=8, ha='right', va='top')
            
            # 盛り上がりポイントの強度グラフ
            excitement_times = [p['time'] for p in excitement_points]
            excitement_intensities = [p['intensity'] for p in excitement_points]
            
            if excitement_times:
                ax2.scatter(excitement_times, excitement_intensities, 
                           c=['red' if p.get('type') == 'volume' else 'orange' for p in excitement_points],
                           s=100, alpha=0.7)
                ax2.set_xlabel('時間 (秒)')
                ax2.set_ylabel('盛り上がり強度')
                ax2.set_title('盛り上がりポイントの強度')
                ax2.grid(True, alpha=0.3)
                ax2.set_ylim(0, 1.1)
            
            plt.tight_layout()
            
            # グラフをBase64エンコードして返す
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            plt.close()
            
            return image_base64
            
        except Exception as e:
            return f"視覚化エラー: {str(e)}"
    
    def create_summary_chart(self, analysis_result: Dict) -> str:
        """
        分析結果のサマリーチャートを生成
        """
        try:
            fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(12, 10))
            
            # 盛り上がりスコア
            excitement_score = analysis_result.get('overall_excitement_score', 0)
            ax1.bar(['盛り上がりスコア'], [excitement_score], color='red', alpha=0.7)
            ax1.set_ylim(0, 100)
            ax1.set_title('全体的な盛り上がりスコア')
            ax1.set_ylabel('スコア (0-100)')
            
            # 音量分析
            volume_analysis = analysis_result.get('volume_analysis', {})
            volume_metrics = ['平均音量', '最大音量', '音量変動']
            volume_values = [
                volume_analysis.get('mean_volume', 0),
                volume_analysis.get('max_volume', 0),
                volume_analysis.get('volume_variance', 0) / 100  # スケール調整
            ]
            ax2.bar(volume_metrics, volume_values, color='blue', alpha=0.7)
            ax2.set_title('音量分析')
            ax2.set_ylabel('値')
            
            # 盛り上がりポイントの分布
            excitement_points = analysis_result.get('excitement_points', [])
            if excitement_points:
                times = [p['time'] for p in excitement_points]
                intensities = [p['intensity'] for p in excitement_points]
                ax3.scatter(times, intensities, alpha=0.7, s=50)
                ax3.set_xlabel('時間 (秒)')
                ax3.set_ylabel('強度')
                ax3.set_title('盛り上がりポイントの分布')
                ax3.grid(True, alpha=0.3)
            
            # ポイントタイプの分布
            point_types = {}
            for point in excitement_points:
                point_type = point.get('type', 'volume')
                point_types[point_type] = point_types.get(point_type, 0) + 1
            
            if point_types:
                ax4.pie(point_types.values(), labels=point_types.keys(), autopct='%1.1f%%')
                ax4.set_title('盛り上がりポイントのタイプ分布')
            
            plt.tight_layout()
            
            # グラフをBase64エンコードして返す
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            plt.close()
            
            return image_base64
            
        except Exception as e:
            return f"サマリーチャートエラー: {str(e)}"
    
    def generate_analysis_report(self, analysis_result: Dict) -> Dict:
        """
        分析結果のレポートを生成
        """
        try:
            excitement_points = analysis_result.get('excitement_points', [])
            volume_analysis = analysis_result.get('volume_analysis', {})
            
            # 主要な盛り上がりポイントを特定
            top_points = sorted(excitement_points, key=lambda x: x['intensity'], reverse=True)[:3]
            
            # レポートを生成
            report = {
                "summary": {
                    "total_duration": analysis_result.get('duration', 0),
                    "excitement_score": analysis_result.get('overall_excitement_score', 0),
                    "total_excitement_points": len(excitement_points),
                    "average_volume": volume_analysis.get('mean_volume', 0),
                    "max_volume": volume_analysis.get('max_volume', 0)
                },
                "top_excitement_points": [
                    {
                        "time": point['time'],
                        "intensity": point['intensity'],
                        "type": point.get('type', 'volume'),
                        "description": f"{point['time']}秒で最も盛り上がるポイント"
                    }
                    for point in top_points
                ],
                "recommendations": []
            }
            
            # 推奨事項を生成
            if analysis_result.get('overall_excitement_score', 0) > 50:
                report["recommendations"].append("この動画は非常に盛り上がる内容です")
            elif analysis_result.get('overall_excitement_score', 0) > 20:
                report["recommendations"].append("この動画は適度に盛り上がる内容です")
            else:
                report["recommendations"].append("この動画は比較的落ち着いた内容です")
            
            if len(excitement_points) > 5:
                report["recommendations"].append("多くの盛り上がりポイントがあり、視聴者の興味を維持しやすい")
            
            return report
            
        except Exception as e:
            return {"error": f"レポート生成エラー: {str(e)}"} 