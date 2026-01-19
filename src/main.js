【コピーボックス（Codexへの指示のみ）】

目的
- Excel出力の不具合（「日付だけ行」「日付順にならない」「M/D整形されない」「結合セル/空欄で崩れる」）を直す。
- 競合回避のため、変更は src/main.js の“全文貼り替え”のみ。package-lock.json は絶対に触らない。

対象
- repo: kuwae-tech/meigi-Checker
- branch: main

変更ファイル（1つだけ）
- src/main.js（全文置換）

作業手順
1) main を最新化してチェックアウト
2) src/main.js を下記の内容で“完全置換”
3) package-lock.json / package.json / workflow 等、他ファイルは一切変更しない（git diffで確認）
4) main にコミットしてpush
5) Actions(build-mac-dmg) が走り、Artifacts に dmg が出ることを確認

src/main.js（全文）
---ここから---
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const XLSX = require("xlsx");

function normalizeText(v) {
  let s = String(v ?? "");
  s = s.replace(/\u3000/g, " ");
  s = s.replace(/\uFFFD/g, ""); // �
  s = s.replace(/[\u0000-\u001F\u007F]/g, ""); // control chars
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function stripKabushiki(company) {
  const s = normalizeText(company);
  const cleaned = s.replace(/株式会社/g, "").replace(/^[?・]+/g, "").trim();
  return normalizeText(cleaned);
}

function ymdKey(y, m, d) {
  return y * 10000 + m * 100 + d;
}

function excelSerialToYMD(n) {
  const dc = XLSX.SSF.parse_date_code(n);
  if (!dc || !dc.y || !dc.m || !dc.d) return null;
  return { y: dc.y, m: dc.m, d: dc.d };
}

function extractYmdListFromString(text) {
  const s = String(text ?? "");
  const re = /(\d{4})\/(\d{1,2})\/(\d{1,2})/g;
  const out = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    out.push({ y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) });
  }
  return out;
}

function parseKouenbiCell(raw) {
  // returns: { ranges:[{y1,m1,d1,y2,m2,d2}], dates:[{y,m,d}] }
  if (raw instanceof Date && !isNaN(raw.valueOf())) {
    return {
      ranges: [],
      dates: [{ y: raw.getFullYear(), m: raw.getMonth() + 1, d: raw.getDate() }],
    };
  }

  if (typeof raw === "number" && isFinite(raw)) {
    const ymd = excelSerialToYMD(raw);
    if (ymd) return { ranges: [], dates: [ymd] };
  }

  const text = normalizeText(raw);
  if (!text) return { ranges: [], dates: [] };

  const hasRange = text.includes("〜") || text.includes("～");
  const list = extractYmdListFromString(text);

  if (hasRange && list.length >= 2) {
    const a = list[0];
    const b = list[1];
    return { ranges: [{ y1: a.y, m1: a.m, d1: a.d, y2: b.y, m2: b.m, d2: b.d }], dates: [] };
  }

  return { ranges: [], dates: list.map((x) => ({ y: x.y, m: x.m, d: x.d })) };
}

function formatDatesToText(dates) {
  // dates: [{y,m,d}] unique/sorted by ymdKey
  const byMonth = new Map(); // key: `${y}-${m}` -> Set(days)
  for (const p of dates) {
    const k = `${p.y}-${p.m}`;
    if (!byMonth.has(k)) byMonth.set(k, new Set());
    byMonth.get(k).add(p.d);
  }

  const keys = Array.from(byMonth.keys()).sort((a, b) => {
    const [ya, ma] = a.split("-").map(Number);
    const [yb, mb] = b.split("-").map(Number);
    return ymdKey(ya, ma, 1) - ymdKey(yb, mb, 1);
  });
