#!/usr/bin/env python3
import uvicorn
import os
import sys

# 現在のディレクトリをPythonパスに追加
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

if __name__ == "__main__":
    uvicorn.run(
        "main_enhanced:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    ) 