import os
from dotenv import load_dotenv # type: ignore

# .envファイルを読み込み
load_dotenv()

# APIキーの設定
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def get_youtube_api_key():
    """YouTube APIキーを取得（環境変数のみ）"""
    return YOUTUBE_API_KEY

def get_gemini_api_key():
    """Gemini APIキーを取得（環境変数のみ）"""
    return GEMINI_API_KEY 