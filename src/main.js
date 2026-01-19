const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const XLSX = require("xlsx");

function normalizeText(v) {
  // 強めの正規化：全角空白、連続空白、置換文字(U+FFFD)、制御文字を除去
  let s = String(v ?? "");
  s = s.replace(/\u3000/g, " ");
  s = s.replace(/\uFFFD/g, ""); // �
  s = s.replace(/[\u0000-\u001F\u007F]/g, ""); // control chars
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function stripKabushiki(company) {
  const s = normalizeText(company);
  // 先頭に紛れ込む「?」「・」などのノイズも軽く除去（本来の文字は残す）
  const cleaned = s.replace(/株式会社/g, "").replace(/^[?・]+/g, "").trim();
  return normalizeText(cleaned);
}

function ymdKey(y, m, d) {
  return y * 10000 + m * 100 + d;
}

function mdKey(m, d) {
  return m * 100 + d;
}

function excelSerialToYMD(n) {
  // Excel serial date (days since 1899-12-30) → y/m/d
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

  const parts = [];
  for (const k of keys) {
    const [, mStr] = k.split("-");
    const m = Number(mStr);
    const days = Array.from(byMonth.get(k)).sort((a, b) => a - b);
    if (days.length === 0) continue;
    const head = `${m}/${days[0]}`;
    const rest = days.slice(1).join(",");
    parts.push(rest ? `${head},${rest}` : head);
  }
  return parts.join(",");
}

function formatRangesToText(ranges) {
  // ranges: [{y1,m1,d1,y2,m2,d2}] (keep as-is; usually 1)
  // 複数あれば開始日順で "M/D〜M/D" をカンマ連結
  const sorted = [...ranges].sort(
    (a, b) => ymdKey(a.y1, a.m1, a.d1) - ymdKey(b.y1, b.m1, b.d1)
  );
  return sorted.map((r) => `${r.m1}/${r.d1}〜${r.m2}/${r.d2}`).join(",");
}

function parseExcelToSummary(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const targetSheetName = wb.SheetNames.includes("製作状況") ? "製作状況" : wb.SheetNames[0];
  const ws = wb.Sheets[targetSheetName];

  // defval: "" で空欄も拾う（ffillするため）
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

  if (!rows.length) throw new Error("シートにデータがありません。");

  const required = ["制作状況", "アーティスト名", "申込社", "公演日"];
  const headers = Object.keys(rows[0] || {});
  for (const r of required) {
    if (!headers.includes(r)) {
      throw new Error(`必要列「${r}」が見つかりません。見つかった列: ${headers.join(", ")}`);
    }
  }

  // --- 重要：forward-fill（結合セル/空欄対策） ---
  // ルール：空欄なら直前の値を継承。ただし、公演日が空の行は基本スキップされやすいので、
  // 公演日がある行に対して適用されるだけでも効果があるが、ここでは列単位で素直に ffill。
  let lastStatus = "";
  let lastArtist = "";
  let lastCompany = "";

  const normalizedRows = rows.map((row) => {
    const statusRaw = normalizeText(row["制作状況"]);
    const artistRaw = normalizeText(row["アーティスト名"]);
    const companyRaw = stripKabushiki(row["申込社"]);
    const dateRaw = row["公演日"]; // raw value keep

    const status = statusRaw || lastStatus;
    const artist = artistRaw || lastArtist;
    const company = companyRaw || lastCompany;

    if (statusRaw) lastStatus = statusRaw;
    if (artistRaw) lastArtist = artistRaw;
    if (companyRaw) lastCompany = companyRaw;

    return { status, artist, company, kouenRaw: dateRaw };
  });

  const targets = new Set(["未制作", "確認中"]);

  // key: status__artist__company
  const map = new Map();

  for (const r of normalizedRows) {
    const status = normalizeText(r.status);
    if (!targets.has(status)) continue;

    const artist = normalizeText(r.artist);
    const company = stripKabushiki(r.company);

    // 公演日が無い行は無視
    const parsed = parseKouenbiCell(r.kouenRaw);
    if ((!parsed.dates || parsed.dates.length === 0) && (!parsed.ranges || parsed.ranges.length === 0)) {
      continue;
    }

    // まだ artist/company が空なら、その行は意味がないのでスキップ（「日付だけ」行を出さない）
    if (!artist || !company) continue;

    const key = `${status}__${artist}__${company}`;
    if (!map.has(key)) {
      map.set(key, {
        status,
        artist,
        company,
        dates: new Map(), // ymdKey -> {y,m,d}
        ranges: new Map(), // startKey -> rangeObj
        sortKey: 99999999,
      });
    }
    const g = map.get(key);

    for (const d of parsed.dates) {
      const k = ymdKey(d.y, d.m, d.d);
      g.dates.set(k, d);
      g.sortKey = Math.min(g.sortKey, k);
    }

    for (const rg of parsed.ranges) {
      const k = ymdKey(rg.y1, rg.m1, rg.d1);
      g.ranges.set(k, rg);
      g.sortKey = Math.min(g.sortKey, k);
    }
  }

  // build group outputs
  const groups = [];
  for (const g of map.values()) {
    const dateList = Array.from(g.dates.keys())
      .sort((a, b) => a - b)
      .map((k) => g.dates.get(k));

    const rangeList = Array.from(g.ranges.keys())
      .sort((a, b) => a - b)
      .map((k) => g.ranges.get(k));

    // 表示テキストは「開始日順」で並べる：rangeもdatesも混在する可能性があるため、token化して統合
    const tokens = [];
    for (const d of dateList) {
      tokens.push({
        sortKey: ymdKey(d.y, d.m, d.d),
        text: null, // あとで月まとめに回すので一旦保持しない
        type: "date",
        value: d,
      });
    }
    for (const rg of rangeList) {
      tokens.push({
        sortKey: ymdKey(rg.y1, rg.m1, rg.d1),
        text: `${rg.m1}/${rg.d1}〜${rg.m2}/${rg.d2}`,
        type: "range",
        value: rg,
      });
    }
    tokens.sort((a, b) => a.sortKey - b.sortKey);

    // dateは月ごとにまとめたいので、rangeは独立、dateは全体でまとめつつ、rangeとの並びを保持するため
    // “rangeの区切り”を尊重する簡易ロジック：rangeが存在する場合、rangeの前後でdateを分割してまとめる
    const chunks = [];
    let curDates = [];
    for (const t of tokens) {
      if (t.type === "range") {
        if (curDates.length) {
          chunks.push({ type: "date", dates: curDates });
          curDates = [];
        }
        chunks.push({ type: "range", text: t.text });
      } else {
        curDates.push(t.value);
      }
    }
    if (curDates.length) chunks.push({ type: "date", dates: curDates });

    const parts = [];
    for (const c of chunks) {
      if (c.type === "range") parts.push(c.text);
      else parts.push(formatDatesToText(c.dates));
    }
    const dateText = parts.filter(Boolean).join(",");

    groups.push({
      status: g.status,
      artist: g.artist,
      company: g.company,
      dateText,
      sortKey: g.sortKey === 99999999 ? 99999999 : g.sortKey,
    });
  }

  const order = ["未制作", "確認中"];
  const sections = [];

  for (const st of order) {
    const items = groups
      .filter((x) => x.status === st)
      .sort((a, b) => a.sortKey - b.sortKey || a.artist.localeCompare(b.artist, "ja"));

    const lines = items.map((g) => `${g.dateText}：${g.artist}（${g.company}）`);
    sections.push(`＜${st}＞\n${lines.join("\n")}`);
  }

  const warning =
    targetSheetName !== "製作状況"
      ? `※注意: 「製作状況」シートが無かったため「${targetSheetName}」を読み取りました。\n\n`
      : "";

  return warning + sections.join("\n\n");
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
