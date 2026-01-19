const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const XLSX = require("xlsx");

function normalizeText(v) {
  return String(v ?? "")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripKabushiki(company) {
  const s = normalizeText(company);
  return normalizeText(s.replace(/株式会社/g, ""));
}

function monthDayKey(m, d) {
  return m * 100 + d;
}

function extractYmdList(text) {
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
  // returns { ranges: [{m1,d1,m2,d2}], dates: [{m,d}] }
  if (raw instanceof Date && !isNaN(raw.valueOf())) {
    return { ranges: [], dates: [{ m: raw.getMonth() + 1, d: raw.getDate() }] };
  }

  const text = String(raw ?? "").trim();
  if (!text) return { ranges: [], dates: [] };

  // Range detection: 〜 or ～ present
  if (text.includes("〜") || text.includes("～")) {
    const list = extractYmdList(text);
    if (list.length >= 2) {
      const a = list[0];
      const b = list[1];
      return { ranges: [{ m1: a.m, d1: a.d, m2: b.m, d2: b.d }], dates: [] };
    }
  }

  // Multi-line / multi-date
  const list = extractYmdList(text);
  const dates = list.map((x) => ({ m: x.m, d: x.d }));
  return { ranges: [], dates };
}

function tokensFromDates(pairs) {
  // pairs: [{m,d}] unique/sorted by (m,d); output tokens like "3/7,8"
  const byMonth = new Map();
  for (const p of pairs) {
    const key = p.m;
    if (!byMonth.has(key)) byMonth.set(key, new Set());
    byMonth.get(key).add(p.d);
  }
  const months = Array.from(byMonth.keys()).sort((a, b) => a - b);
  const tokens = [];
  for (const m of months) {
    const days = Array.from(byMonth.get(m)).sort((a, b) => a - b);
    if (days.length === 0) continue;
    const first = `${m}/${days[0]}`;
    const rest = days.slice(1).map(String).join(",");
    const text = rest ? `${first},${rest}` : first;
    tokens.push({ text, sortKey: monthDayKey(m, days[0]) });
  }
  return tokens;
}

function tokensFromRanges(ranges) {
  return ranges.map((r) => ({
    text: `${r.m1}/${r.d1}〜${r.m2}/${r.d2}`,
    sortKey: monthDayKey(r.m1, r.d1),
  }));
}

function buildOutput(groups) {
  // groups: [{status, artist, company, tokens:[{text,sortKey}]}]
  const order = ["未制作", "確認中"];
  const sections = [];
  for (const st of order) {
    const items = groups
      .filter((g) => g.status === st)
      .sort((a, b) => a.sortKey - b.sortKey || a.artist.localeCompare(b.artist, "ja"));
    const lines = items.map((g) => `${g.dateText}：${g.artist}（${g.company}）`);
    sections.push(`＜${st}＞\n${lines.join("\n")}`);
  }
  return sections.join("\n\n");
}

function parseExcelToSummary(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const targetSheetName = wb.SheetNames.includes("製作状況") ? "製作状況" : wb.SheetNames[0];
  const ws = wb.Sheets[targetSheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

  const required = ["制作状況", "アーティスト名", "申込社", "公演日"];
  if (rows.length === 0) throw new Error("シートにデータがありません。");
  const headers = Object.keys(rows[0] || {});
  for (const r of required) {
    if (!headers.includes(r)) {
      throw new Error(`必要列「${r}」が見つかりません。見つかった列: ${headers.join(", ")}`);
    }
  }

  const targets = new Set(["未制作", "確認中"]);
  const map = new Map();

  for (const row of rows) {
    const status = normalizeText(row["制作状況"]);
    if (!targets.has(status)) continue;

    const artist = normalizeText(row["アーティスト名"]);
    const company = stripKabushiki(row["申込社"]);
    const kouenRaw = row["公演日"];

    if (!artist || !company) continue;

    const key = `${status}__${artist}__${company}`;
    if (!map.has(key)) {
      map.set(key, {
        status,
        artist,
        company,
        datePairs: new Set(), // "m/d"
        ranges: new Set(), // "m1/d1〜m2/d2"
        sortKey: 999999,
      });
    }
    const g = map.get(key);

    const parsed = parseKouenbiCell(kouenRaw);

    for (const r of parsed.ranges) {
      const t = `${r.m1}/${r.d1}〜${r.m2}/${r.d2}`;
      g.ranges.add(t);
      g.sortKey = Math.min(g.sortKey, monthDayKey(r.m1, r.d1));
    }
    for (const p of parsed.dates) {
      const t = `${p.m}/${p.d}`;
      g.datePairs.add(t);
      g.sortKey = Math.min(g.sortKey, monthDayKey(p.m, p.d));
    }
  }

  const groups = [];
  for (const g of map.values()) {
    const pairs = Array.from(g.datePairs).map((s) => {
      const [m, d] = s.split("/").map(Number);
      return { m, d };
    });
    pairs.sort((a, b) => monthDayKey(a.m, a.d) - monthDayKey(b.m, b.d));

    const rangeObjs = Array.from(g.ranges)
      .map((s) => {
        const m = s.match(/^(\d+)\/(\d+)〜(\d+)\/(\d+)$/);
        if (!m) return null;
        return { m1: Number(m[1]), d1: Number(m[2]), m2: Number(m[3]), d2: Number(m[4]) };
      })
      .filter(Boolean);

    const tokens = [...tokensFromDates(pairs), ...tokensFromRanges(rangeObjs)].sort(
      (a, b) => a.sortKey - b.sortKey
    );

    const dateText = tokens.map((t) => t.text).join(",");
    groups.push({
      status: g.status,
      artist: g.artist,
      company: g.company,
      dateText,
      sortKey: g.sortKey === 999999 ? 999999 : g.sortKey,
    });
  }

  const output = buildOutput(groups);
  const warning =
    targetSheetName !== "製作状況"
      ? `※注意: 「製作状況」シートが無かったため「${targetSheetName}」を読み取りました。\n\n`
      : "";

  return warning + output;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle("select-file", async () => {
    const res = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  });

  ipcMain.handle("process-file", async (_evt, filePath) => {
    try {
      const text = parseExcelToSummary(filePath);
      return { ok: true, text };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
