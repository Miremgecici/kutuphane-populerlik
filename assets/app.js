// Kütüphane Popülerlik Karşılaştırıcı — başlangıç arayüzü
// Veri: aynı sitedeki data/npm.json ve data/pypi.json (GitHub Actions her gün günceller).
// Harici kütüphane, API anahtarı veya inline script yoktur (CSP: script-src 'self').
"use strict";

const COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"];
const SOURCES = {
  npm: { file: "data/npm.json", label: "npm downloads API" },
  pypi: { file: "data/pypi.json", label: "pypistats.org API" },
};
const cache = {};
const fmt = new Intl.NumberFormat("tr-TR");
const fmtShort = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });
const fmtPct = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" });

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function sumLast(series, days, offset = 0) {
  const end = series.length - offset;
  return series.slice(Math.max(0, end - days), end).reduce((a, r) => a + r.downloads, 0);
}

function movingAverage(series, win = 7) {
  const out = [];
  let acc = 0;
  for (let i = 0; i < series.length; i++) {
    acc += series[i].downloads;
    if (i >= win) acc -= series[i - win].downloads;
    if (i >= win - 1) out.push({ date: series[i].date, value: acc / win });
  }
  return out;
}

async function load(source) {
  if (cache[source]) return cache[source];
  const res = await fetch(SOURCES[source].file, { cache: "no-cache" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  cache[source] = data;
  return data;
}

function renderKpisAndTable(rows) {
  const kpis = document.getElementById("kpis");
  const tbody = document.querySelector("#table tbody");
  kpis.replaceChildren();
  tbody.replaceChildren();
  const total = rows.reduce((a, r) => a + r.last30, 0) || 1;

  for (const r of rows) {
    const card = el("div", { class: "kpi" });
    const name = el("div", { class: "kpi-name" });
    name.append(el("span", { class: "swatch c" + r.colorIndex, "aria-hidden": "true" }), document.createTextNode(r.name));
    const deltaClass = r.change >= 0 ? "kpi-delta up" : "kpi-delta down";
    card.append(
      name,
      el("div", { class: "kpi-value" }, fmtShort.format(r.last30)),
      el("div", { class: deltaClass }, (r.change >= 0 ? "▲ " : "▼ ") + "%" + fmtPct.format(Math.abs(r.change)) + " önceki 30 güne göre")
    );
    kpis.append(card);

    const tr = el("tr");
    const th = el("th", { scope: "row" });
    th.textContent = r.name;
    tr.append(
      th,
      el("td", { class: "num" }, fmt.format(r.last30)),
      el("td", { class: "num " + (r.change >= 0 ? "up" : "down") }, (r.change >= 0 ? "+%" : "−%") + fmtPct.format(Math.abs(r.change))),
      el("td", { class: "num" }, fmt.format(Math.round(r.last30 / 30))),
      el("td", { class: "num" }, "%" + fmtPct.format((r.last30 / total) * 100))
    );
    tbody.append(tr);
  }
}

function renderChart(rows) {
  const box = document.getElementById("chart");
  const legend = document.getElementById("legend");
  box.replaceChildren();
  legend.replaceChildren();

  const W = 1000, H = 380, L = 64, R = 16, T = 12, B = 34;
  const lines = rows.map((r) => ({ ...r, points: movingAverage(r.series) }));
  const dates = lines[0].points.map((p) => p.date);
  const max = Math.max(...lines.flatMap((l) => l.points.map((p) => p.value)));
  const x = (i) => L + (i / Math.max(1, dates.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - v / max) * (H - T - B);

  const svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMidYMid meet" });

  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4;
    svg.append(svgEl("line", { class: "grid", x1: L, x2: W - R, y1: y(v), y2: y(v) }));
    const t = svgEl("text", { class: "axis-label", x: L - 8, y: y(v) + 4, "text-anchor": "end" });
    t.textContent = fmtShort.format(v);
    svg.append(t);
  }
  const ticks = 6;
  for (let i = 0; i <= ticks; i++) {
    const idx = Math.round((i / ticks) * (dates.length - 1));
    const t = svgEl("text", { class: "axis-label", x: x(idx), y: H - 10, "text-anchor": i === 0 ? "start" : i === ticks ? "end" : "middle" });
    t.textContent = fmtDate.format(new Date(dates[idx] + "T00:00:00"));
    svg.append(t);
  }

  for (const l of lines) {
    const offset = dates.length - l.points.length;
    const d = l.points.map((p, i) => (i ? "L" : "M") + x(i + offset).toFixed(1) + " " + y(p.value).toFixed(1)).join(" ");
    const path = svgEl("path", { class: "series", d, stroke: COLORS[l.colorIndex % COLORS.length] });
    const title = svgEl("title");
    title.textContent = l.name;
    path.append(title);
    svg.append(path);

    const item = el("span");
    item.append(el("span", { class: "swatch c" + l.colorIndex, "aria-hidden": "true" }), document.createTextNode(l.name));
    legend.append(item);
  }
  box.append(svg);
}

async function show(source) {
  const status = document.getElementById("status");
  document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.source === source)));
  status.className = "status";
  status.textContent = "Veri yükleniyor…";
  try {
    const data = await load(source);
    const rows = Object.entries(data.packages)
      .filter(([, s]) => s.length >= 60)
      .map(([name, series]) => {
        const last30 = sumLast(series, 30);
        const prev30 = sumLast(series, 30, 30);
        return { name, series, last30, change: prev30 ? ((last30 - prev30) / prev30) * 100 : 0 };
      })
      .sort((a, b) => b.last30 - a.last30)
      .map((r, i) => ({ ...r, colorIndex: i }));

    if (!rows.length) throw new Error("boş veri");
    renderKpisAndTable(rows);
    renderChart(rows);

    const lastDay = rows[0].series[rows[0].series.length - 1].date;
    const updated = data.last_updated ? new Date(data.last_updated).toLocaleString("tr-TR") : "bilinmiyor";
    status.textContent = "Son veri günü: " + fmtDate.format(new Date(lastDay + "T00:00:00")) + " · Son güncelleme: " + updated;
    if (data.errors && data.errors.length) status.textContent += " · " + data.errors.length + " paket güncellenemedi (son başarılı veri gösteriliyor)";

    const src = document.getElementById("source");
    src.replaceChildren(document.createTextNode("Kaynak: "));
    const a = el("a", { href: data.source || "#", rel: "noopener" }, SOURCES[source].label);
    src.append(a);
  } catch (e) {
    status.className = "status error";
    status.textContent = "Veri şu anda yüklenemedi. Lütfen sayfayı daha sonra yenileyin.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => show(b.dataset.source)));
  show("npm");
});
