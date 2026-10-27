// Kütüphane Popülerlik Karşılaştırıcı
// Veri: aynı sitedeki data/npm.json ve data/pypi.json (GitHub Actions her gün günceller).
// Harici kütüphane, API anahtarı veya inline script yoktur (CSP: script-src 'self').
"use strict";

/* ---------- Ayarlar ---------- */
const SOURCES = {
  npm: { file: "data/npm.json", label: "npm", api: "npm downloads API" },
  pypi: { file: "data/pypi.json", label: "PyPI", api: "pypistats.org API" },
};
const MAX_PKGS = 5;
const DEFAULT_PKGS = ["npm:react", "npm:vue", "npm:svelte"];
const SCALES = { ham: "Ham", log: "Log", endeks: "Endeks (=100)" };
const PERIODS = [30, 90, 180, 365];
const DASHES = ["", "12 7", "3 6", "16 6 3 6", "1 7"]; // renk tek başına anlam taşımasın
const STORE_KEY = "kpk-son-basarili-veri";
const STALE_HOURS = 48;

const params = new URLSearchParams(location.search);
const TEST = params.get("test"); // ?test=hata  → veri adresi bozulur (demo); ?test=yavas → yükleniyor durumu

/* ---------- Biçimlendirme ---------- */
const fmt = new Intl.NumberFormat("tr-TR");
const fmtShort = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });
const fmt1 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" });
const fmtDateShort = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" });
const fmtDateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const pct = (v) => (v >= 0 ? "▲ +%" : "▼ −%") + fmt1.format(Math.abs(v));
const toDate = (s) => new Date(s + "T00:00:00");
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/* ---------- DOM yardımcıları ---------- */
const $ = (sel) => document.querySelector(sel);
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "text") n.textContent = v; else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids) if (k != null) n.append(k);
  return n;
}
function svg(tag, attrs = {}) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== "") n.setAttribute(k, v);
  return n;
}

/* ---------- Durum (URL'de saklanır) ---------- */
const state = { pkgs: [], scale: "ham", period: 180, sort: { key: "total", dir: "desc" } };
let DATA = null;          // { npm: {...}, pypi: {...} }
let usedFallback = false; // son başarılı veri mi gösteriliyor?

function readUrl() {
  const p = params.get("p");
  state.pkgs = p === null ? DEFAULT_PKGS.slice() : p.split(",").filter(Boolean).slice(0, MAX_PKGS);
  const s = params.get("olcek");
  if (s in SCALES) state.scale = s;
  const d = Number(params.get("donem"));
  if (PERIODS.includes(d)) state.period = d;
}
function writeUrl() {
  const q = new URLSearchParams();
  q.set("p", state.pkgs.join(","));
  q.set("olcek", state.scale);
  q.set("donem", String(state.period));
  if (TEST) q.set("test", TEST);
  history.replaceState(null, "", location.pathname + "?" + q.toString());
}

/* ---------- Veri yükleme ---------- */
async function fetchJson(url) {
  if (TEST === "yavas") await new Promise((r) => setTimeout(r, 2500));
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}
function saveLastGood(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data })); } catch (e) { /* depolama kapalı olabilir */ }
}
function readLastGood() {
  try { const raw = localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
async function loadAll() {
  const suffix = TEST === "hata" ? ".bozuk" : "";
  try {
    const [npm, pypi] = await Promise.all([fetchJson(SOURCES.npm.file + suffix), fetchJson(SOURCES.pypi.file + suffix)]);
    const data = { npm, pypi };
    saveLastGood(data);
    usedFallback = false;
    return data;
  } catch (err) {
    const last = readLastGood();
    if (last) { usedFallback = last.savedAt; return last.data; }
    throw err;
  }
}

/* ---------- Hesaplamalar ---------- */
function movingAverage(series, win = 7) {
  const out = []; let acc = 0;
  for (let i = 0; i < series.length; i++) {
    acc += series[i].downloads;
    if (i >= win) acc -= series[i - win].downloads;
    if (i >= win - 1) out.push({ date: series[i].date, value: acc / win });
  }
  return out;
}
const sum = (arr) => arr.reduce((a, r) => a + r.downloads, 0);
function lastN(series, n, offset = 0) { const end = series.length - offset; return series.slice(Math.max(0, end - n), end); }

function allPackages() {
  const list = [];
  for (const src of Object.keys(SOURCES)) {
    const pk = DATA[src] && DATA[src].packages ? DATA[src].packages : {};
    for (const name of Object.keys(pk).sort()) list.push({ id: src + ":" + name, src, name, series: pk[name] });
  }
  return list;
}

function buildRows() {
  const byId = Object.fromEntries(allPackages().map((p) => [p.id, p]));
  const chosen = state.pkgs.map((id) => byId[id]).filter((p) => p && p.series.length);
  if (!chosen.length) return { rows: [], start: null, end: null };
  const end = chosen.map((p) => p.series[p.series.length - 1].date).sort().pop();
  const start = addDays(end, -(state.period - 1));
  const rows = chosen.map((p, i) => {
    const inWin = p.series.filter((r) => r.date >= start && r.date <= end);
    const ma = movingAverage(p.series).filter((r) => r.date >= start && r.date <= end);
    const base = (ma.find((r) => r.value > 0) || { value: 1 }).value;
    const last30 = sum(lastN(p.series, 30));
    const prev30 = sum(lastN(p.series, 30, 30));
    return {
      ...p, color: i, total: sum(inWin), days: inWin.length,
      daily: inWin.length ? sum(inWin) / inWin.length : 0,
      last30, change: prev30 ? ((last30 - prev30) / prev30) * 100 : 0,
      ma, index: ma.map((r) => ({ date: r.date, value: (r.value / base) * 100 })),
      lastDate: p.series[p.series.length - 1].date,
    };
  });
  const totalAll = rows.reduce((a, r) => a + r.total, 0) || 1;
  rows.forEach((r) => (r.share = (r.total / totalAll) * 100));
  return { rows, start, end };
}

/* ---------- Kontroller ---------- */
function renderPicker() {
  const box = $("#pick-groups");
  box.replaceChildren();
  const pk = allPackages();
  for (const src of Object.keys(SOURCES)) {
    const items = pk.filter((p) => p.src === src);
    if (!items.length) continue;
    const g = el("div", { class: "pick-group", role: "group", "aria-labelledby": "g-" + src });
    g.append(el("h3", { id: "g-" + src, text: src === "npm" ? "npm (JavaScript)" : "PyPI (Python)" }));
    const chips = el("div", { class: "chips" });
    for (const p of items) {
      const input = el("input", { type: "checkbox", value: p.id, checked: state.pkgs.includes(p.id) });
      input.addEventListener("change", () => {
        if (input.checked && state.pkgs.length >= MAX_PKGS) { input.checked = false; return; }
        state.pkgs = input.checked ? [...state.pkgs, p.id] : state.pkgs.filter((x) => x !== p.id);
        update();
      });
      chips.append(el("label", { class: "chip" }, input, el("span", { text: p.name })));
    }
    g.append(chips);
    box.append(g);
  }
}
function syncControls() {
  const full = state.pkgs.length >= MAX_PKGS;
  document.querySelectorAll(".chip input").forEach((i) => {
    i.checked = state.pkgs.includes(i.value);
    i.disabled = full && !i.checked;
  });
  $("#pick-count").textContent = state.pkgs.length + " / " + MAX_PKGS + " seçili" + (full ? " · sınıra ulaşıldı" : "");
  document.querySelectorAll('input[name="olcek"]').forEach((r) => (r.checked = r.value === state.scale));
  $("#donem").value = String(state.period);
}

/* ---------- KPI ---------- */
function renderKpis(rows) {
  const box = $("#kpis");
  box.replaceChildren();
  const top = rows.slice().sort((a, b) => b.total - a.total)[0];
  const fast = rows.slice().sort((a, b) => b.change - a.change)[0];
  const total = rows.reduce((a, r) => a + r.total, 0);
  const card = (label, value, note, noteClass) =>
    el("div", { class: "kpi" }, el("div", { class: "kpi-label", text: label }), el("div", { class: "kpi-value", text: value }),
      el("div", { class: "kpi-note " + (noteClass || ""), text: note }));
  box.append(
    card("En çok indirilen", top.name, fmtShort.format(top.total) + " indirme · son " + state.period + " gün"),
    card("En hızlı büyüyen (30 gün)", fast.name, pct(fast.change) + " önceki 30 güne göre", fast.change >= 0 ? "up" : "down"),
    card("Seçili paketlerin toplamı", fmtShort.format(total), "son " + state.period + " gün · " + rows.length + " paket"),
  );
}

/* ---------- Ana grafik (çizgi) ---------- */
function niceTicks(max, count = 4) {
  const raw = max / count; const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const ticks = [0]; while (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
function renderLegend(rows) {
  const ul = $("#legend");
  ul.replaceChildren();
  for (const r of rows) {
    const s = svg("svg", { viewBox: "0 0 40 14", "aria-hidden": "true" });
    s.append(svg("line", { x1: 2, y1: 7, x2: 38, y2: 7, class: "series s" + r.color, "stroke-dasharray": DASHES[r.color] }));
    ul.append(el("li", {}, s, el("span", { text: r.name + " (" + SOURCES[r.src].label + ")" })));
  }
}
function lineValues(r) { return state.scale === "endeks" ? r.index : r.ma; }

function renderChart(rows, start, end) {
  const box = $("#chart");
  box.replaceChildren();
  const inFull = document.fullscreenElement === $("#ana-grafik");
  const W = Math.max(300, Math.round(box.clientWidth || 800));
  const H = inFull ? Math.max(360, window.innerHeight - 360) : Math.round(Math.min(560, Math.max(300, W * 0.48)));
  const wide = W >= 720;
  const L = 88, R = wide ? 170 : 16, T = 16, B = 44;
  const log = state.scale === "log";
  const vals = rows.flatMap((r) => lineValues(r).map((p) => p.value)).filter((v) => v > 0);
  if (!vals.length) { box.append(emptyBox("Bu dönemde gösterilecek veri yok.")); return; }
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const t0 = toDate(start).getTime(), t1 = toDate(end).getTime();
  const x = (d) => L + ((toDate(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  let y, ticks;
  if (log) {
    const a = Math.floor(Math.log10(lo)), b = Math.ceil(Math.log10(hi));
    ticks = []; for (let e = a; e <= b; e++) ticks.push(Math.pow(10, e));
    y = (v) => T + (1 - (Math.log10(Math.max(v, 1e-9)) - a) / Math.max(1, b - a)) * (H - T - B);
  } else if (state.scale === "endeks") {
    lo = Math.min(lo, 100); hi = Math.max(hi, 100);
    const pad = (hi - lo) * 0.08 || 10; lo = Math.max(0, lo - pad); hi = hi + pad;
    const step = niceTicks(hi - lo)[1] || 10; const first = Math.ceil(lo / step) * step;
    ticks = []; for (let v = first; v <= hi; v += step) ticks.push(v);
    y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  } else {
    ticks = niceTicks(hi); hi = ticks[ticks.length - 1];
    y = (v) => T + (1 - v / hi) * (H - T - B);
  }

  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, "aria-hidden": "true", focusable: "false" });
  for (const v of ticks) {
    s.append(svg("line", { class: "grid", x1: L, x2: W - R, y1: y(v), y2: y(v) }));
    const t = svg("text", { x: L - 10, y: y(v) + 7, "text-anchor": "end" });
    t.textContent = state.scale === "endeks" ? fmt.format(Math.round(v)) : fmtShort.format(v);
    s.append(t);
  }
  if (state.scale === "endeks") s.append(svg("line", { class: "axis", x1: L, x2: W - R, y1: y(100), y2: y(100), "stroke-dasharray": "4 4" }));
  const nTicks = W < 420 ? 1 : W < 600 ? 2 : W < 900 ? 3 : 5;
  for (let i = 0; i <= nTicks; i++) {
    const d = new Date(t0 + ((t1 - t0) * i) / nTicks).toISOString().slice(0, 10);
    const t = svg("text", { x: x(d), y: H - 10, "text-anchor": i === 0 ? "start" : i === nTicks ? "end" : "middle" });
    t.textContent = fmtDateShort.format(toDate(d));
    s.append(t);
  }
  const labels = [];
  for (const r of rows) {
    const pts = lineValues(r).filter((p) => p.value > 0 || !log);
    if (!pts.length) continue;
    const d = pts.map((p, i) => (i ? "L" : "M") + x(p.date).toFixed(1) + " " + y(p.value).toFixed(1)).join(" ");
    s.append(svg("path", { class: "series s" + r.color, d, "stroke-dasharray": DASHES[r.color] }));
    const lp = pts[pts.length - 1];
    labels.push({ r, x: x(lp.date), y: y(lp.value) });
  }
  if (wide) { // doğrudan etiketleme: çizgi sonunda paket adı
    labels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 24) labels[i].y = labels[i - 1].y + 24;
    for (const l of labels) {
      const t = svg("text", { x: l.x + 10, y: l.y + 7, class: "end-label s" + l.r.color });
      t.textContent = l.r.name;
      s.append(t);
    }
  }
  box.append(s);
}

function chartSummary(rows) {
  const n = state.period;
  if (state.scale === "endeks") {
    const g = rows.map((r) => ({ r, v: r.index.length ? r.index[r.index.length - 1].value : 100 })).sort((a, b) => b.v - a.v);
    const best = g[0], worst = g[g.length - 1];
    if (g.length === 1) return `Son ${n} günde ${best.r.name} endeksi 100'den ${fmt.format(Math.round(best.v))}'e geldi.`;
    return `Son ${n} günde en hızlı büyüyen ${best.r.name} (100 → ${fmt.format(Math.round(best.v))}), en yavaş ${worst.r.name} (100 → ${fmt.format(Math.round(worst.v))}).`;
  }
  const s = rows.slice().sort((a, b) => b.daily - a.daily);
  const top = s[0], low = s[s.length - 1];
  if (s.length === 1) return `Son ${n} günde ${top.name} günde ortalama ${fmtShort.format(top.daily)} kez indirildi.`;
  return `Son ${n} günde günlük indirmesi en yüksek paket ${top.name} (ort. ${fmtShort.format(top.daily)}/gün), en düşük ${low.name} (ort. ${fmtShort.format(low.daily)}/gün).` +
    (state.scale === "log" ? " Log ölçekte küçük paketlerin değişimi de okunabilir." : "");
}

function renderChartTable(rows) {
  const tbl = $("#chart-table");
  tbl.replaceChildren();
  const unit = state.scale === "endeks" ? "endeks" : "7 günlük ort.";
  const head = el("tr", {}, el("th", { scope: "col", text: "Tarih" }), ...rows.map((r) => el("th", { scope: "col", class: "num", text: r.name + " (" + unit + ")" })));
  tbl.append(el("caption", { class: "visually-hidden", text: "Ana grafik verisi, haftalık" }), el("thead", {}, head));
  const tb = el("tbody");
  const ref = rows.reduce((a, r) => (lineValues(r).length > lineValues(a).length ? r : a), rows[0]);
  const dates = lineValues(ref).map((p) => p.date);
  for (let i = dates.length - 1; i >= 0; i -= 7) {
    const d = dates[i];
    const tr = el("tr", {}, el("th", { scope: "row", text: fmtDate.format(toDate(d)) }));
    for (const r of rows) {
      const p = lineValues(r).find((q) => q.date === d);
      tr.append(el("td", { class: "num", text: p ? (state.scale === "endeks" ? fmt1.format(p.value) : fmt.format(Math.round(p.value))) : "–" }));
    }
    tb.append(tr);
  }
  tbl.append(tb);
}

/* ---------- İkincil grafik (çubuk) ---------- */
function renderBars(rows) {
  const box = $("#bars");
  box.replaceChildren();
  const s2 = rows.slice().sort((a, b) => b.total - a.total);
  const W = Math.max(300, Math.round(box.clientWidth || 800));
  const narrow = W < 640;
  const max = s2[0].total || 1;
  const valTxt = (r) => fmtShort.format(r.total) + " · %" + fmt1.format(r.share);
  // Geniş ekran: [isim | çubuk | değer]   Dar ekran: [isim ... değer] üstte, çubuk altta
  const L = narrow ? 0 : Math.min(220, Math.round(W * 0.25)), VAL = narrow ? 0 : 190, R = 8;
  const rowH = narrow ? 78 : 50;
  const H = s2.length * rowH + 4;
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, "aria-hidden": "true", focusable: "false" });
  s2.forEach((r, i) => {
    const y0 = i * rowH;
    const barY = narrow ? y0 + 34 : y0 + 8, barH = narrow ? 30 : 34;
    const bw = Math.max(4, (r.total / max) * (W - L - VAL - R));
    const name = svg("text", { x: narrow ? 0 : L - 12, y: narrow ? y0 + 24 : y0 + 32, "text-anchor": narrow ? "start" : "end", class: "bar-label" });
    name.textContent = r.name;
    const val = svg("text", narrow ? { x: W - R, y: y0 + 24, "text-anchor": "end", class: "bar-label" } : { x: L + bw + 12, y: y0 + 32, class: "bar-label" });
    val.textContent = valTxt(r);
    s.append(name, svg("rect", { x: L, y: barY, width: bw, height: barH, rx: 4, class: "s" + r.color }), val);
  });
  box.append(s);
  const top = s2[0], second = s2[1];
  let txt = `Son ${state.period} günde toplam indirmede ${top.name} önde (seçili paketler içinde %${fmt1.format(top.share)} pay).`;
  if (second && second.total > 0) txt += ` ${top.name}, ikinci sıradaki ${second.name} paketinin yaklaşık ${fmt1.format(top.total / second.total)} katı indirildi.`;
  $("#bar-summary").textContent = txt;
  box.setAttribute("aria-label", "Çubuk grafik. " + txt);

  const tbl = $("#bar-table");
  tbl.replaceChildren(
    el("caption", { class: "visually-hidden", text: "Dönem toplamı verisi" }),
    el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "Paket" }), el("th", { scope: "col", class: "num", text: "Toplam indirme" }), el("th", { scope: "col", class: "num", text: "Pay" }))),
    el("tbody", {}, ...s2.map((r) => el("tr", {}, el("th", { scope: "row", text: r.name }), el("td", { class: "num", text: fmt.format(r.total) }), el("td", { class: "num", text: "%" + fmt1.format(r.share) })))),
  );
}

/* ---------- Detay tablosu (sıralanabilir) ---------- */
const COLS = [
  { key: "name", label: "Paket", num: false },
  { key: "src", label: "Ekosistem", num: false },
  { key: "total", label: "Dönem toplamı", num: true, f: (r) => fmt.format(r.total) },
  { key: "last30", label: "Son 30 gün", num: true, f: (r) => fmt.format(r.last30) },
  { key: "change", label: "Önceki 30 güne göre", num: true, f: (r) => pct(r.change) },
  { key: "daily", label: "Günlük ortalama", num: true, f: (r) => fmt.format(Math.round(r.daily)) },
  { key: "share", label: "Pay", num: true, f: (r) => "%" + fmt1.format(r.share) },
];
function renderDetail(rows) {
  const tbl = $("#detail");
  const { key, dir } = state.sort;
  const sorted = rows.slice().sort((a, b) => {
    const va = a[key], vb = b[key];
    const c = typeof va === "string" ? va.localeCompare(vb, "tr") : va - vb;
    return dir === "asc" ? c : -c;
  });
  const head = el("tr");
  for (const c of COLS) {
    const btn = el("button", { type: "button", class: "sort", text: c.label });
    btn.addEventListener("click", () => {
      state.sort = { key: c.key, dir: state.sort.key === c.key && state.sort.dir === "desc" ? "asc" : "desc" };
      renderDetail(rows);
      tbl.querySelector(`[data-key="${c.key}"] .sort`).focus();
    });
    head.append(el("th", { scope: "col", class: c.num ? "num" : "", "data-key": c.key, "aria-sort": key === c.key ? (dir === "asc" ? "ascending" : "descending") : "none" }, btn));
  }
  const tb = el("tbody");
  for (const r of sorted) {
    const name = el("span", { class: "pkg-cell" }, el("span", { class: "dot s" + r.color, "aria-hidden": "true" }), r.name);
    tb.append(el("tr", {},
      el("th", { scope: "row" }, name),
      el("td", { text: SOURCES[r.src].label }),
      ...COLS.slice(2).map((c) => el("td", { class: "num" + (c.key === "change" ? (r.change >= 0 ? " up" : " down") : ""), text: c.f(r) }))));
  }
  tbl.replaceChildren(el("caption", { class: "visually-hidden", text: "Seçili paketlerin karşılaştırması" }), el("thead", {}, head), tb);
}

/* ---------- Boş / iskelet / hata ---------- */
function emptyBox(msg, withButton) {
  const d = el("div", { class: "empty" }, el("p", { text: msg }));
  if (withButton) {
    const b = el("button", { type: "button", class: "btn", text: "Örnek seçimi yükle" });
    b.addEventListener("click", () => { state.pkgs = DEFAULT_PKGS.slice(); update(); });
    d.append(b);
  }
  return d;
}
function showSkeleton() {
  $("#kpis").replaceChildren(...[0, 1, 2].map(() => el("div", { class: "skeleton sk-kpi", "aria-hidden": "true" })));
  $("#chart").replaceChildren(el("div", { class: "skeleton sk-chart", "aria-hidden": "true" }));
  $("#bars").replaceChildren(el("div", { class: "skeleton sk-bars", "aria-hidden": "true" }));
  $("#detail").replaceChildren();
  $("#chart-summary").textContent = ""; $("#bar-summary").textContent = "";
}
function showEmpty() {
  const msg = "Henüz paket seçilmedi. Yukarıdan en fazla 5 paket seçin.";
  $("#kpis").replaceChildren(emptyBox(msg, true));
  $("#legend").replaceChildren();
  $("#chart").replaceChildren(emptyBox("Grafik için paket seçin."));
  $("#bars").replaceChildren(emptyBox("Grafik için paket seçin."));
  ["#chart-table", "#bar-table", "#detail"].forEach((s) => $(s).replaceChildren());
  $("#chart-summary").textContent = ""; $("#bar-summary").textContent = "";
  $("#grafik-alt").textContent = "";
}
function showFatal() {
  const n = $("#notice");
  n.className = "notice error"; n.hidden = false;
  n.replaceChildren(document.createTextNode("Veri şu anda yüklenemedi ve bu cihazda kayıtlı önceki veri yok. İnternet bağlantınızı kontrol edip tekrar deneyin."));
  const b = el("button", { type: "button", class: "btn", text: "Tekrar dene" });
  b.addEventListener("click", () => location.reload());
  n.append(b);
  $("#meta").textContent = "Veri yüklenemedi.";
  ["#kpis", "#chart", "#bars"].forEach((s) => $(s).replaceChildren(emptyBox("Veri yok.")));
}
function renderMeta() {
  const parts = [];
  const ups = Object.values(DATA).map((d) => d && d.last_updated).filter(Boolean).sort();
  if (ups.length) parts.push("Son güncelleme: " + fmtDateTime.format(new Date(ups[ups.length - 1])));
  const lasts = Object.values(DATA).flatMap((d) => Object.values((d && d.packages) || {}).map((s) => s.length ? s[s.length - 1].date : null)).filter(Boolean).sort();
  if (lasts.length) parts.push("son veri günü: " + fmtDate.format(toDate(lasts[lasts.length - 1])));
  $("#meta").textContent = parts.join(" · ");

  const notes = [];
  if (usedFallback) notes.push("Güncel veri alınamadı. Bu cihazda " + fmtDateTime.format(new Date(usedFallback)) + " tarihinde kaydedilen son başarılı veri gösteriliyor.");
  const errs = Object.values(DATA).flatMap((d) => (d && d.errors) || []);
  if (errs.length) notes.push(errs.length + " paket son çalıştırmada güncellenemedi; bu paketler için son başarılı veri gösteriliyor.");
  if (ups.length && Date.now() - new Date(ups[ups.length - 1]).getTime() > STALE_HOURS * 3600e3) notes.push("Veri " + STALE_HOURS + " saatten eski; otomatik güncelleme gecikmiş olabilir.");
  const n = $("#notice");
  n.className = "notice";
  n.hidden = !notes.length;
  n.textContent = notes.join(" ");
}

/* ---------- Ana çizim ---------- */
let lastRows = null;
function update() {
  syncControls();
  writeUrl();
  const { rows, start, end } = buildRows();
  lastRows = { rows, start, end };
  if (!rows.length) { showEmpty(); return; }
  $("#grafik-alt").textContent = (state.scale === "endeks" ? "Endeks: dönemin ilk günü = 100 · " : state.scale === "log" ? "Logaritmik ölçek · " : "") +
    "7 günlük hareketli ortalama · " + fmtDate.format(toDate(start)) + " – " + fmtDate.format(toDate(end));
  renderKpis(rows);
  renderLegend(rows);
  renderChart(rows, start, end);
  const sumTxt = chartSummary(rows);
  $("#chart-summary").textContent = sumTxt;
  $("#chart").setAttribute("aria-label", "Çizgi grafik, " + SCALES[state.scale] + " ölçek. " + sumTxt);
  renderChartTable(rows);
  renderBars(rows);
  renderDetail(rows);
}
function redrawCharts() {
  if (!lastRows || !lastRows.rows.length) return;
  renderChart(lastRows.rows, lastRows.start, lastRows.end);
  renderBars(lastRows.rows);
}

/* ---------- Tam ekran (sunum modu) ---------- */
function toggleFull() {
  const card = $("#ana-grafik");
  if (document.fullscreenElement) document.exitFullscreen();
  else if (card.requestFullscreen) card.requestFullscreen().catch(() => {});
}

/* ---------- Başlangıç ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  readUrl();
  document.querySelectorAll('input[name="olcek"]').forEach((r) => r.addEventListener("change", () => { state.scale = r.value; update(); }));
  $("#donem").addEventListener("change", (e) => { state.period = Number(e.target.value); update(); });
  $("#btn-clear").addEventListener("click", () => { state.pkgs = []; update(); });
  $("#btn-share").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    try { await navigator.clipboard.writeText(location.href); b.textContent = "Kopyalandı ✓"; }
    catch (err) { b.textContent = "Adres çubuğundan kopyalayın"; }
    setTimeout(() => (b.textContent = "Bağlantıyı kopyala"), 2000);
  });
  $("#btn-full").addEventListener("click", toggleFull);
  document.addEventListener("keydown", (e) => {
    if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); toggleFull(); }
  });
  document.addEventListener("fullscreenchange", () => {
    $("#btn-full").textContent = document.fullscreenElement ? "Tam ekrandan çık (F)" : "Tam ekran (F)";
    redrawCharts();
  });
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(redrawCharts, 150); });

  showSkeleton();
  syncControls();
  try {
    DATA = await loadAll();
  } catch (e) {
    showFatal();
    return;
  }
  renderMeta();
  renderPicker();
  // URL'de olmayan paketleri at
  const ids = new Set(allPackages().map((p) => p.id));
  state.pkgs = state.pkgs.filter((id) => ids.has(id));
  update();

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
});
