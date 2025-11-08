const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

const clientPath = path.join(__dirname, 'client');

// 'client' ディレクトリから静的ファイルを配信します
app.use(express.static(clientPath));

// 上記の静的ファイルで見つからなかったリクエストは、すべてindex.htmlに転送します。
// これがシングルページアプリケーションを正しく動作させるための鍵となります。
app.use((req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Frontend server is running on http://localhost:${port}`);
  console.log(`Please open your browser and navigate to http://localhost:${port}`);
});
