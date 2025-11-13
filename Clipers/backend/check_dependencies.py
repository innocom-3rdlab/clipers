#!/usr/bin/env python3
"""
依存関係の確認スクリプト
"""

def check_dependencies():
    """必要なライブラリがインストールされているか確認"""
    required_packages = [
        'fastapi',
        'uvicorn', 
        'pydantic',
        'yt_dlp',
        'requests',
        'librosa',
        'numpy',
        'scipy',
        'matplotlib',
        'soundfile',
        'pydub'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package} - インストール済み")
        except ImportError:
            print(f"❌ {package} - 未インストール")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n⚠️  不足しているパッケージ: {', '.join(missing_packages)}")
        print("以下のコマンドでインストールしてください:")
        print(f"pip install {' '.join(missing_packages)}")
    else:
        print("\n🎉 すべての依存関係が正しくインストールされています！")

if __name__ == "__main__":
    check_dependencies() 