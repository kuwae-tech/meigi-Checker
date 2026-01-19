# Excel Status Summarizer（Mac）

Excel ファイルをドラッグ＆ドロップし、制作状況が「未制作」「確認中」の行だけを抽出して指定フォーマットで出力する macOS 向けアプリです。

## できること

- Excel（.xlsx / .xls）を D&D で読み込み
- 「製作状況」シート（なければ先頭シート）を使用
- 制作状況が「未制作」「確認中」の行のみ抽出
- 申込社の「株式会社」を除去して整形
- 結果をコピー可能なテキストとして出力

## 仕様（出力フォーマット）

```
＜未制作＞
6/6,7：SAKAE SP-RING 2026（ZIP-FM）
…
＜確認中＞
…
```

## 必要な列

- 制作状況
- アーティスト名
- 申込社
- 公演日

## セットアップ

```bash
npm install
```

## 開発起動

```bash
npm run start
```

## macOS 用ビルド（dmg）

```bash
npm run dist:mac
```

`dist/` に dmg が生成されます。

## GitHub Actions

- `main` ブランチへの push と `workflow_dispatch` で macOS ビルドを実行します。
- `dist/*.dmg` を `mac-dmg` という Artifact として保存します。
