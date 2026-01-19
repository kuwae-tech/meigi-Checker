# Excel Status Summarizer（Mac）

Excel（.xlsx）をドラッグ＆ドロップすると、
制作状況が「未制作」「確認中」の行だけを抽出し、下記形式で出力します。

例:
6/6,7：SAKAE SP-RING 2026（ZIP-FM）

## 使い方
- ローカル環境が無くてもOKです。
- GitHub Actions が自動で Mac用dmg をビルドし、Artifactsに添付します。
- 利用者は Actions の Artifacts から dmg をダウンロードして使います。

## 開発（任意）
```bash
npm install
npm start
```

## ビルド（ローカル）
```bash
npm run dist:mac
```
