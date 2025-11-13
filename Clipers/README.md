# 🎵 YouTube盛り上がり分析ツール (Enhanced v2.1.0-gemini)

YouTube動画の音声分析とエンゲージメント分析を統合した包括的な分析ツールです。

## ✨ 新機能 (v2.1.0-gemini)

### 🤖 AI分析機能
- **Gemini AI統合**: Google Gemini AIによる質的分析
- **リアルタイム可視化**: AIの思考プロセスを4段階で表示
- **包括的分析**: 音声、コメント、エンゲージメントの統合分析

### 📊 エンゲージメント分析の拡張
- **感情分析**: ポジティブ/ネガティブ/ニュートラルの感情を分析
- **キーワード抽出**: コメントから頻出キーワードを抽出
- **詳細統計**: コメントのいいね数、投稿者情報、投稿日時
- **ホットタイムスタンプ**: コメントで言及された時間帯の分析

### 🔧 技術的改善
- **YouTubeコメント収集改善**: 最大300件のコメント取得
- **AI分析プロセス可視化**: リアルタイムでの分析ステップ表示
- **Python 3.13対応**: 最新Pythonバージョンでの動作確認
- **エラーハンドリング強化**: より詳細なエラー情報

## 🎵 既存機能

### 🎵 正確なdB測定
- 標準的な音声レベルに基づく正確なdB値
- RMS（二乗平均平方根）による精密計算
- 動的範囲と変動の詳細分析

### 📊 YouTubeエンゲージメント分析
- YouTube Data API v3を使用
- いいね・コメント・視聴回数分析
- エンゲージメント率の計算

### 🔥 視聴箇所特定機能
- コメントからタイムスタンプを抽出
- ホットタイムスタンプの特定
- 言及回数による重要度判定

### 🚀 包括的分析
- 音声分析 + エンゲージメント分析の統合
- 包括的スコアの計算
- 多角的な盛り上がりポイント特定

## 🏗️ システム構成

```
Clipers/
├── backend/
│   ├── main_enhanced.py          # メインAPIサーバー
│   ├── improved_audio_analyzer.py # 音声・エンゲージメント分析
│   ├── gemini_analyzer.py        # Gemini AI分析（新規）
│   ├── video_evaluation_framework.py # 動画評価フレームワーク
│   ├── visualization.py          # 視覚化機能
│   └── requirements.txt          # 依存関係
├── index.html                   # 統合されたフロントエンド
├── docs/
│   └── youtube_api_setup_guide.md # API設定ガイド
└── README.md
```

## 🚀 クイックスタート

### 1. 環境セットアップ
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

### 2. サーバー起動
```bash
# バックエンド（ポート8000）
cd backend
source venv/bin/activate
python3 -m uvicorn main_enhanced:app --reload --host 127.0.0.1 --port 8000

# フロントエンド（ポート8080）
cd ..
python3 -m http.server 8080
```

### 3. ブラウザでアクセス
- **フロントエンド**: http://localhost:8080
- **バックエンドAPI**: http://127.0.0.1:8000

## 🔑 API Key設定

### YouTube API Key設定
1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成
3. YouTube Data API v3を有効化
4. APIキーを取得

### Gemini API Key設定
1. [Google AI Studio](https://makersuite.google.com/app/apikey) にアクセス
2. APIキーを生成
3. フロントエンドで設定

### フロントエンドで設定
- ブラウザで `http://localhost:8080` を開く
- 「API Key設定」セクションでキーを入力
- 「APIキーを保存」をクリック

## 📊 分析機能

### 🎵 音声分析
- 正確なdB測定
- 音調分析
- 盛り上がりポイント検出
- 視覚化機能

### 📊 エンゲージメント分析
- YouTube API統合
- コメント分析
- エンゲージメント率計算
- 感情分析

### 🤖 AI分析
- Gemini AI統合
- 質的分析
- リアルタイム可視化
- 包括的評価

### 🔍 AI分析プロセス表示
- **ステップ1**: データ準備 - 字幕とコメントデータの準備
- **ステップ2**: エンゲージメント分析 - 感情分析とキーワード抽出
- **ステップ3**: AI分析実行 - Gemini AIによる質的分析
- **ステップ4**: 結果解析 - 分析結果の解析と統合

## 🔧 APIエンドポイント

### 基本分析
- `POST /analyze-audio-accurate` - 正確な音声分析
- `POST /analyze-engagement` - エンゲージメント分析
- `POST /analyze-comprehensive` - 包括的分析

### AI分析
- `POST /analyze-gemini-enhanced` - Gemini AI拡張分析
- `POST /evaluate-video-framework` - 動画評価フレームワーク

### ユーティリティ
- `GET /health` - ヘルスチェック
- `GET /api-info` - API情報

## 🧪 テスト

### テストスクリプトの実行
```bash
cd backend
python test_enhanced_analysis.py
```

### 手動テスト
1. 短い動画（5分以下）でテスト
2. 長い動画（10分以上）でテスト
3. 人気動画とマイナー動画でテスト
4. Gemini AI分析機能のテスト

## 🔒 セキュリティ

### APIキーの保護
- 絶対にGitHubにコミットしない
- 環境変数で管理
- APIキーに制限を設定

### 推奨設定
```bash
export YOUTUBE_API_KEY="your_youtube_api_key_here"
export GEMINI_API_KEY="your_gemini_api_key_here"
```

## 📈 パフォーマンス最適化

### 長い動画の処理
- チャンク分割処理
- 並列処理
- サンプルレート最適化
- 時間制限（最大10分）

### メモリ使用量
- 効率的な音声処理
- 一時ファイルの自動削除
- メモリリーク対策

## 🐛 トラブルシューティング

### よくある問題

#### APIキーが無効
- APIキーが正しくコピーされているか確認
- YouTube Data API v3が有効化されているか確認
- Gemini APIキーが有効か確認

#### クォータ制限
- Google Cloud Consoleでクォータ使用量を確認
- 必要に応じてクォータを増加申請

#### サーバーが起動しない
- 仮想環境がアクティブになっているか確認
- ポート8000が使用可能か確認
- Python 3.13がインストールされているか確認

#### AI分析が失敗する
- Gemini APIキーが正しく設定されているか確認
- インターネット接続を確認
- APIキーの権限を確認

## 📚 参考資料

- [YouTube Data API v3 ドキュメント](https://developers.google.com/youtube/v3)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Google AI Studio](https://makersuite.google.com/app/apikey)
- [FastAPI ドキュメント](https://fastapi.tiangolo.com/)
- [Gemini AI ドキュメント](https://ai.google.dev/)

## 🤝 貢献

1. このリポジトリをフォーク
2. 機能ブランチを作成
3. 変更をコミット
4. プルリクエストを作成

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. **Google Cloud Console**の設定
2. **YouTube APIキー**の有効性
3. **Gemini APIキー**の有効性
4. **ネットワーク接続**
5. **サーバー**の起動状態

## 📋 バージョン履歴

### v2.1.0-gemini (最新)
- YouTubeコメント収集改善
- AI分析プロセス可視化
- 詳細なエンゲージメント分析
- Python 3.13対応

### v2.0.0
- Gemini AI統合
- 包括的分析機能
- モダンUI実装

### v1.0.0
- 基本音声分析
- YouTube API統合
- エンゲージメント分析

---

**Version**: 2.1.0-gemini  
**Last Updated**: 2025年7月 