#!/usr/bin/env python3
import os
import sys
import subprocess

# 現在のディレクトリをPythonパスに追加
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# uvicornを起動
if __name__ == "__main__":
    subprocess.run([
        sys.executable, "-m", "uvicorn", 
        "main_enhanced:app", 
        "--reload", 
        "--host", "127.0.0.1", 
        "--port", "8000"
    ]) 