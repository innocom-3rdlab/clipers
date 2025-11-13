# YouTube Data API v3 設定ガイド

## 🎯 概要
YouTube Data API v3を使用して、動画のエンゲージメント分析（いいね、コメント、視聴回数）を行うための設定手順です。

## 📋 必要な手順

### 1. Google Cloud Consoleでプロジェクト作成

#### 1-1. Google Cloud Consoleにアクセス
- [Google Cloud Console](https://console.cloud.google.com/) にアクセス
- Googleアカウントでログイン

#### 1-2. 新しいプロジェクトを作成
1. 画面上部のプロジェクト選択ドロップダウンをクリック
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を入力（例：`clipers-youtube-analysis`）
4. 「作成」をクリック

#### 1-3. プロジェクトを選択
- 作成したプロジェクトを選択してアクティブにする

### 2. YouTube Data API v3を有効化

#### 2-1. APIライブラリにアクセス
1. 左側のメニューから「APIとサービス」→「ライブラリ」をクリック
2. 検索ボックスに「YouTube Data API v3」と入力
3. 「YouTube Data API v3」をクリック

#### 2-2. APIを有効化
1. 「有効にする」ボタンをクリック
2. 有効化が完了するまで待機

### 3. APIキーを取得

#### 3-1. 認証情報にアクセス
1. 左側のメニューから「APIとサービス」→「認証情報」をクリック
2. 「認証情報を作成」→「APIキー」をクリック

#### 3-2. APIキーをコピー
1. 生成されたAPIキーをコピー
2. **重要**: このキーは機密情報なので、安全に保管してください

#### 3-3. APIキーの制限設定（推奨）
1. 作成したAPIキーをクリック
2. 「アプリケーションの制限」で「HTTPリファラー」を選択
3. 「APIの制限」で「YouTube Data API v3」のみを選択
4. 「保存」をクリック

### 4. フロントエンドでAPIキーを設定

#### 4-1. フロントエンドを起動
```bash
cd frontend
python test_frontend.py
```

#### 4-2. ブラウザでアクセス
- `http://localhost:8000` にアクセス
- `enhanced_index.html` を開く

#### 4-3. APIキーを入力
1. 「YouTube API Key」フィールドに取得したAPIキーを入力
2. YouTube動画URLを入力
3. 「包括的分析」または「エンゲージメント分析」を選択
4. 「分析開始」をクリック

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. APIキーが無効
**エラー**: `API key not valid`
**解決方法**:
- APIキーが正しくコピーされているか確認
- YouTube Data API v3が有効化されているか確認

#### 2. クォータ制限
**エラー**: `quota exceeded`
**解決方法**:
- Google Cloud Consoleでクォータ使用量を確認
- 必要に応じてクォータを増加申請

#### 3. プロジェクトが選択されていない
**エラー**: `project not found`
**解決方法**:
- Google Cloud Consoleで正しいプロジェクトが選択されているか確認

## 📊 API使用量と制限

### 無料枠
- 1日あたり10,000ユニット
- 1リクエストあたり1-5ユニット消費

### 主なAPI呼び出し
- 動画情報取得: 1ユニット
- コメント取得: 1ユニット
- チャンネル情報取得: 1ユニット

## 🔒 セキュリティ注意事項

### APIキーの保護
1. **絶対に公開しない**: GitHubなどにコミットしない
2. **環境変数で管理**: 本番環境では環境変数として設定
3. **制限を設定**: HTTPリファラーとAPI制限を必ず設定

### 推奨設定
```bash
# 環境変数として設定（推奨）
export YOUTUBE_API_KEY="your_api_key_here"
```

## 🚀 次のステップ

### 1. テスト実行
```bash
cd backend
python test_enhanced_analysis.py
```

### 2. 実際の動画でテスト
- 短い動画（5分以下）でテスト
- 長い動画（10分以上）でテスト
- 人気動画とマイナー動画でテスト

### 3. 結果の確認
- エンゲージメント率の計算
- ホットタイムスタンプの抽出
- 音声分析との統合結果

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. **Google Cloud Console**の設定
2. **APIキー**の有効性
3. **ネットワーク接続**
4. **サーバー**の起動状態

## 🔗 参考リンク

- [YouTube Data API v3 ドキュメント](https://developers.google.com/youtube/v3)
- [Google Cloud Console](https://console.cloud.google.com/)
- [APIキー管理](https://console.cloud.google.com/apis/credentials) 