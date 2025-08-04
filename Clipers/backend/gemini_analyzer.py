# backend/gemini_analyzer.py

import google.generativeai as genai
from typing import Dict, List, Optional
import os
import json
import re

class GeminiAnalyzer:
    """
    Gemini AIを使用して動画の字幕とコメントから質的分析を行うクラス。
    """
    def __init__(self, api_key: Optional[str] = None):
        """
        GeminiAnalyzerを初期化します。

        Args:
            api_key (Optional[str]): Gemini APIキー。提供されない場合は環境変数 'GEMINI_API_KEY' を使用します。
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("Gemini API Key is not provided in args or environment variable 'GEMINI_API_KEY'.")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    def analyze_content_with_gemini(self, transcript, comments):
        prompt = f"""
        あなたはYouTube動画のAI分析官です。
        字幕とコメントをもとに、下記の4項目を10点満点で数値化し、理由も日本語で簡潔に述べてください。
        1. ナラティブ維持率
        2. フックの効力
        3. エンゲージメントシグナル
        4. 技術品質
        さらに、VVP Score = (KPI_NR × 0.40) + (KPI_HE × 0.30) + (KPI_ES × 0.25) + (KPI_TQ × 0.05) で100点満点に換算し、Golden Clip（最重要区間）も抽出してください。
        JSON形式で出力してください。
        # 字幕
        {transcript[:8000]}
        # コメント
        {', '.join(comments)[:8000]}
        """
        try:
            response = self.model.generate_content(prompt)
            cleaned = response.text.strip().replace("```json", "").replace("```", "")
            return json.loads(cleaned)
        except Exception as e:
            return {"error": f"Gemini analysis failed: {str(e)}"} 