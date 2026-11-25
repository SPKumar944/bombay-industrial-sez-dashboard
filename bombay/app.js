/* AGT Intelligence · Bombay Industrial and Special Economic Zones
 * Same layout and design language as the AGT site-intelligence dashboard, driven by the Bombay (MMR) industrial land data:
 * IILB plots & parks, SEZ India notified SEZs (locality level), OpenStreetMap connectivity & utilities. */
"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (n, d = 0) => (n == null || Number.isNaN(+n) ? "—" : (+n).toLocaleString("en-IN", { maximumFractionDigits: d }));
const ha = (sqm) => sqm / 10000;
const ico = (name, size = 16, stroke = 1.3) => `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICONS[name] || ICONS.pin)}</svg>`;
const ST = { allotted: ["Allotted", "#CF7C48"], vacant: ["Vacant", "#58A854"], reserved: ["Reserved / utilities", "#7C6CD6"] };
const DARK = () => document.documentElement.dataset.theme === "dark";
const BASE = {
  map: () => (DARK() ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"),
  sat: () => ({ version: 8, sources: { esri: { type: "raster", tileSize: 256, maxzoom: 19, attribution: "Esri World Imagery",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"] } }, layers: [{ id: "esri", type: "raster", source: "esri" }] }),
};

/* ---- layer catalogue (icons from the IconMCP outline set) ---- */
const LAYERS = [
  { g: "Industrial land", key: "plots", name: "Plots Demarcated", desc: "Plot polygons coloured by allotment status (IILB)", icon: "apartment-complex", swatch: "#CF7C48", on: true, core: true },
  { g: "Industrial land", key: "parks", name: "Park & SEZ perimeters", desc: "Industrial areas, estates and SEZ outlines (IILB)", icon: "office-block", swatch: "#8d8d93", on: true, core: true },
  { g: "Industrial land", key: "sez", name: "Notified SEZs", desc: "SEZ India register, 31.07.2026 · locality-level position", icon: "flag", swatch: "#06b6d4", on: true, core: true },
  { g: "Industrial land", key: "industrial", name: "Industrial land use", desc: "Industrial zones mapped in OpenStreetMap", icon: "wrench", swatch: "#94a3b8", osm: true },
  { g: "Connectivity", key: "roads", name: "Highways & arterial roads", desc: "Motorway, trunk and primary roads", icon: "road", swatch: "#f59e0b", osm: true },
  { g: "Connectivity", key: "rail", name: "Railway & metro lines", desc: "Suburban rail, metro and monorail", icon: "train-station", swatch: "#6b7280", osm: true },
  { g: "Connectivity", key: "stations", name: "Stations", desc: "Railway and metro stations", icon: "metro", swatch: "#38bdf8", osm: true },
  { g: "Connectivity", key: "airports", name: "Airports", desc: "Aerodromes", icon: "signpost", swatch: "#db2777", osm: true },
  { g: "Utilities", key: "power_lines", name: "Power lines", desc: "Transmission and distribution lines", icon: "cpu", swatch: "#ca8a04", osm: true },
  { g: "Utilities", key: "substations", name: "Substations", desc: "Electrical substations", icon: "database", swatch: "#e11d48", osm: true },
  { g: "Utilities", key: "water", name: "Water pipelines & canals", desc: "Water mains and canals", icon: "link", swatch: "#0891b2", osm: true },
];
const S = { area: "all", status: "all", on: {}, sel: null, base: "map" };
LAYERS.forEach((l) => (S.on[l.key] = !!l.on));
let map, DATA = {};
const loaded = {};   // OSM layers whose source has been added

/* ---------------- area helpers ---------------- */
const parksIn = (area) => !area || area === "all" ? DATA.summary
  : area.startsWith("d:") ? DATA.summary.filter((p) => p.district === area.slice(2)) : DATA.summary.filter((p) => p.key === area);
const areaTitle = (area) => area === "all" ? "Bombay · Mumbai Metropolitan Region" : area.startsWith("d:") ? area.slice(2) + " district" : (DATA.summary.find((p) => p.key === area) || {}).name;
function agg(ps) {
  const a = { plots: 0, allotted: 0, vacant: 0, reserved: 0, area_sqm: 0, parks: ps.length, outline_only: 0, owners: {} };
  ps.forEach((p) => { ["plots", "allotted", "vacant", "reserved", "area_sqm"].forEach((k) => (a[k] += p[k])); if (!p.has_plots) a.outline_only++;
    p.top_owners.forEach(([o, n]) => (a.owners[o] = (a.owners[o] || 0) + n)); });
  return a;
}
const parkOf = (key) => DATA.summary.find((p) => p.key === key) || {};
function plotFilter() {
  const keys = parksIn(S.area).map((p) => p.key), f = ["all"];
  if (S.area !== "all") f.push(["in", ["get", "park"], ["literal", keys]]);
  if (S.status !== "all") f.push(["==", ["get", "st"], S.status]);
  return f;
}

/* ---------------- map ---------------- */
function addCore() {
  const dark = DARK();
  map.addSource("parks", { type: "geojson", data: DATA.parks });
  map.addSource("plots", { type: "geojson", data: DATA.plots });
  map.addSource("sez", { type: "geojson", data: { type: "FeatureCollection", features: DATA.sez.filter((z) => z.lat != null).map((z, i) => ({ type: "Feature", id: i, geometry: { type: "Point", coordinates: [z.lon, z.lat] }, properties: { i, developer: z.developer } })) } });
  map.addLayer({ id: "parks-fill", type: "fill", source: "parks", paint: { "fill-color": dark ? "#8d8d93" : "#6e6e73", "fill-opacity": 0.07 } });
  map.addLayer({ id: "parks-line", type: "line", source: "parks", paint: { "line-color": dark ? "#d2d2d7" : "#3a3a3c", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 14, 2], "line-dasharray": [3, 2], "line-opacity": 0.85 } });
  map.addLayer({ id: "plots-fill", type: "fill", source: "plots", filter: plotFilter(),
    paint: { "fill-color": ["match", ["get", "st"], "allotted", ST.allotted[1], "vacant", ST.vacant[1], ST.reserved[1]], "fill-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.95, 15, 0.72] } });
  map.addLayer({ id: "plots-line", type: "line", source: "plots", filter: plotFilter(), paint: { "line-color": dark ? "#000" : "#fff", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0, 14, 0.7, 18, 1.4], "line-opacity": 0.9 } });
  map.addLayer({ id: "plots-sel", type: "line", source: "plots", filter: ["==", ["id"], -1], paint: { "line-color": dark ? "#fff" : "#111", "line-width": 3 } });
  map.addLayer({ id: "sez-dot", type: "circle", source: "sez", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 14, 9], "circle-color": "#06b6d4", "circle-stroke-color": "#fff", "circle-stroke-width": 1.6, "circle-opacity": 0.95 } });
  LAYERS.filter((l) => l.osm && S.on[l.key]).forEach((l) => addOsm(l.key));
  applyVisibility();
}
const OSM_STYLE = {
  industrial: [["fill", { "fill-color": "#94a3b8", "fill-opacity": 0.22 }], ["line", { "line-color": "#64748b", "line-width": 0.8 }]],
  roads: [["line", { "line-color": "#f59e0b", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 14, 3] }]],
  rail: [["line", { "line-color": "#6b7280", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 14, 2.4], "line-dasharray": [3, 2] }]],
  stations: [["circle", { "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 15, 6], "circle-color": "#38bdf8", "circle-stroke-color": "#fff", "circle-stroke-width": 1 }]],
  airports: [["fill", { "fill-color": "#db2777", "fill-opacity": 0.25 }], ["line", { "line-color": "#db2777", "line-width": 1.5 }]],
  power_lines: [["line", { "line-color": "#ca8a04", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 14, 2] }]],
  substations: [["fill", { "fill-color": "#e11d48", "fill-opacity": 0.35 }], ["circle", { "circle-radius": 4, "circle-color": "#e11d48", "circle-stroke-color": "#fff", "circle-stroke-width": 1 }]],
  water: [["line", { "line-color": "#0891b2", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 14, 2.2] }]],
};
function addOsm(key) {
  if (map.getSource("osm-" + key)) return;
  map.addSource("osm-" + key, { type: "geojson", data: `bombay/data/osm_${key}.geojson` });
  (OSM_STYLE[key] || []).forEach(([type, paint], i) => {
    const f = type === "fill" ? ["==", ["geometry-type"], "Polygon"] : type === "circle" ? ["==", ["geometry-type"], "Point"] : null;
    map.addLayer(Object.assign({ id: `osm-${key}-${i}`, type, source: "osm-" + key, paint, layout: { visibility: S.on[key] ? "visible" : "none" } }, f ? { filter: f } : {}), "plots-fill");
  });
}
function applyVisibility() {
  const vis = (id, on) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  ["plots-fill", "plots-line", "plots-sel"].forEach((id) => vis(id, S.on.plots));
  ["parks-fill", "parks-line"].forEach((id) => vis(id, S.on.parks));
  vis("sez-dot", S.on.sez);
  LAYERS.filter((l) => l.osm).forEach((l) => { for (let i = 0; i < 3; i++) vis(`osm-${l.key}-${i}`, S.on[l.key]); });
  $("activeCount").textContent = Object.values(S.on).filter(Boolean).length;
}
function refreshPlots() {
  const f = plotFilter();
  ["plots-fill", "plots-line"].forEach((id) => map.getLayer(id) && map.setFilter(id, f));
}
function fitArea(animate = true) {
  const ps = parksIn(S.area).filter((p) => p.has_plots || S.area !== "all"); if (!ps.length) return;
  const b = ps.reduce((a, p) => [Math.min(a[0], p.bbox[0]), Math.min(a[1], p.bbox[1]), Math.max(a[2], p.bbox[2]), Math.max(a[3], p.bbox[3])], [180, 90, -180, -90]);
  const wide = window.innerWidth > 860;
  map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: wide ? { top: 70, bottom: 60, left: 400, right: 420 } : 40, duration: animate ? 900 : 0, maxZoom: 16.5 });
}

/* ---------------- left panel ---------------- */
function stackBar(a) {
  const t = a.plots || 1;
  return `<div class="stack">${["allotted", "vacant", "reserved"].map((k) => `<div style="width:${(a[k] / t) * 100}%;background:${ST[k][1]}"></div>`).join("")}</div>
    <div class="stack-legend">${["allotted", "vacant", "reserved"].map((k) => `<span><i style="background:${ST[k][1]}"></i>${ST[k][0]} ${fmt(a[k])} (${fmt((a[k] / t) * 100, 0)}%)</span>`).join("")}</div>`;
}
function renderOverview() {
  const ps = parksIn(S.area), a = agg(ps), single = ps.length === 1 ? ps[0] : null;
  $("areaName").textContent = S.area === "all" ? "Mumbai Metropolitan Region" : areaTitle(S.area);
  const dists = [...new Set(ps.map((p) => p.district))].join(", ");
  const sezs = DATA.sez.filter((z) => S.area === "all" || (single ? z.park === single.key : S.area.startsWith("d:") ? (z.location + " " + z.developer).toLowerCase().includes(S.area.slice(2).split(" ")[0].toLowerCase()) || ps.some((p) => p.key === z.park) : false));
  const owners = Object.entries(a.owners).sort((x, y) => y[1] - x[1]).slice(0, 8), omax = owners.length ? owners[0][1] : 1;
  const rows = ps.slice().sort((x, y) => y.plots - x.plots).slice(0, S.area === "all" ? 12 : 8);
  $("areaPanel").innerHTML = `
    <div class="store-card"><div class="eyebrow">${single ? "INDUSTRIAL PARK" : "COVERAGE"}</div>
      <div class="store-meta">
        <div>District<b>${esc(dists)}</b></div><div>Parks &amp; SEZ perimeters<b>${fmt(a.parks)}</b></div>
        <div>Demarcated plot area<b>${fmt(ha(a.area_sqm), 0)} ha</b></div><div>Outline only (no plots on IILB)<b>${fmt(a.outline_only)}</b></div>
      </div></div>
    <div class="kpi-grid">
      <div class="kpi"><div class="eyebrow">PLOTS DEMARCATED</div><div class="v">${fmt(a.plots)}</div><div class="s">IILB cadastral plots</div></div>
      <div class="kpi"><div class="eyebrow">ALLOTTED</div><div class="v">${fmt(a.allotted)}</div><div class="s">${fmt((a.allotted / (a.plots || 1)) * 100, 0)}% of plots</div></div>
      <div class="kpi"><div class="eyebrow">VACANT</div><div class="v">${fmt(a.vacant)}</div><div class="s">${fmt((a.vacant / (a.plots || 1)) * 100, 1)}% available</div></div>
      <div class="kpi"><div class="eyebrow">RESERVED / UTILITIES</div><div class="v">${fmt(a.reserved)}</div><div class="s">common areas &amp; buffers</div></div>
    </div>
    <div class="section"><div class="section-title"><h4>${ico("layers")}Allotment mix</h4><span>${fmt(a.plots)} plots</span></div>${stackBar(a)}</div>
    ${owners.length ? `<div class="section"><div class="section-title"><h4>${ico("briefcase")}Most plots held (named allottees)</h4><span>top ${owners.length}</span></div>
      ${owners.map(([o, n]) => `<div class="hbar"><span class="lbl" title="${esc(o)}">${esc(o)}</span><span class="track"><span class="fill" style="width:${(n / omax) * 100}%;display:block"></span></span><span class="num">${n}</span></div>`).join("")}
      <div class="note">Owners with the same name in several parks are summed. Top 8 per park are counted.</div></div>` : ""}
    <div class="section"><div class="section-title"><h4>${ico("office-block")}${single ? "This park" : "Largest parks"}</h4><span>${ps.length} shown of ${a.parks}</span></div>
      <div class="list">${rows.map((p) => parkRow(p)).join("")}</div></div>
    ${sezs.length ? `<div class="section"><div class="section-title"><h4>${ico("flag")}Notified SEZs</h4><span>${sezs.length}</span></div>
      <div class="list">${sezs.slice(0, 8).map((z) => sezRow(z)).join("")}</div>
      <div class="note">SEZ positions are locality centres from the SEZ India register, not boundaries.</div></div>` : ""}
    <div class="note" style="margin-top:14px">Sources: India Industrial Land Bank (DPIIT) for plots and parks · SEZ India (as on 31.07.2026) · © OpenStreetMap contributors. See Data &amp; method.</div>`;
  bindRows($("areaPanel"));
  renderLegend(a);
}
function parkRow(p) {
  const rate = p.plots ? Math.round((p.allotted / p.plots) * 100) : null;
  return `<div class="list-row" data-park="${p.key}"><div><div class="t">${ico("office-block")}${esc(p.name)}</div><div class="st">${esc(p.district)}${p.has_plots ? "" : " · outline only"}</div></div>
    <div class="r">${p.has_plots ? fmt(p.plots) : "—"}<small>${rate == null ? "no plot data" : rate + "% allotted"}</small></div></div>`;
}
function sezRow(z) {
  return `<div class="list-row" data-sez="${DATA.sez.indexOf(z)}"><div><div class="t">${ico("flag")}${esc(z.developer.replace(/\s*\(.*?\)\s*/g, " ").trim())}</div><div class="st">${esc(z.location)}</div></div>
    <div class="r">${z.area_ha ? esc(String(z.area_ha).split(" ")[0]) + " ha" : "—"}<small>${esc((z.listed_as || []).includes("operational") ? "operational" : (z.listed_as || [])[0] || "")}</small></div></div>`;
}
function bindRows(root) {
  root.querySelectorAll("[data-park]").forEach((el) => (el.onclick = () => setArea(el.dataset.park)));
  root.querySelectorAll("[data-sez]").forEach((el) => (el.onclick = () => { const z = DATA.sez[+el.dataset.sez]; if (z && z.lat != null) { map.flyTo({ center: [z.lon, z.lat], zoom: 13.5 }); inspectSez(+el.dataset.sez); } }));
}

/* ---------------- legend / footer ---------------- */
function renderLegend(a) {
  $("legendCount").textContent = fmt(a.plots) + " plots";
  $("statusLabel").textContent = S.status === "all" ? "all plots" : ST[S.status][0].toLowerCase();
  $("statusRow").innerHTML = ["allotted", "vacant", "reserved"].map((k) => `<button data-st="${k}" class="${S.status !== "all" && S.status !== k ? "off" : ""} ${S.status === k ? "sel" : ""}" style="background:${ST[k][1]}">${ST[k][0].split(" ")[0]}<b>${fmt(a[k])}</b></button>`).join("")
    + `<button data-st="all" style="background:var(--text);color:var(--bg)">All<b>${fmt(a.plots)}</b></button>`;
  $("statusRow").querySelectorAll("button").forEach((b) => (b.onclick = () => setStatus(S.status === b.dataset.st ? "all" : b.dataset.st)));
  $("legendExtra").innerHTML = `<span><i style="background:#06b6d4;border-radius:50%"></i>Notified SEZ</span><span><i style="border:1.5px dashed var(--text-2);background:none"></i>Park perimeter</span>`;
}
/* ---------------- right panel ---------------- */
function renderLayers() {
  const groups = {};
  LAYERS.forEach((l) => (groups[l.g] = groups[l.g] || []).push(l));
  $("layersTab").innerHTML = Object.entries(groups).map(([g, ls]) => `<div class="group-title">${g.toUpperCase()}</div>` + ls.map((l) => `
    <div class="layer ${S.on[l.key] ? "on" : ""}" data-layer="${l.key}">
      <div class="layer-head"><input type="checkbox" ${S.on[l.key] ? "checked" : ""} />
        <div><div class="layer-name">${ico(l.icon)}${l.name}</div><div class="layer-desc">${l.desc}</div></div>
        <div class="layer-swatch" style="background:${l.swatch}"></div></div>
      ${l.key === "plots" ? `<div class="layer-sub"><div class="sub-label">Show</div><div class="seg">${["all", "allotted", "vacant", "reserved"].map((s) => `<button data-st="${s}" class="${S.status === s ? "active" : ""}">${s === "all" ? "All" : ST[s][0].split(" ")[0]}</button>`).join("")}</div></div>` : ""}
    </div>`).join("")).join("");
  $("layersTab").querySelectorAll(".layer").forEach((el) => {
    const key = el.dataset.layer, l = LAYERS.find((x) => x.key === key);
    el.querySelector(".layer-head").onclick = (e) => {
      if (e.target.tagName !== "INPUT") el.querySelector("input").checked = !el.querySelector("input").checked;
      S.on[key] = el.querySelector("input").checked; el.classList.toggle("on", S.on[key]);
      if (l.osm && S.on[key]) addOsm(key);
      applyVisibility();
    };
    el.querySelectorAll(".seg button").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); setStatus(b.dataset.st); }));
  });
  $("activeCount").textContent = Object.values(S.on).filter(Boolean).length;
}
function renderParksTab(q = "") {
  const byD = {};
  DATA.summary.filter((p) => !q || (p.name + " " + p.district).toLowerCase().includes(q.toLowerCase())).forEach((p) => (byD[p.district] = byD[p.district] || []).push(p));
  $("parksTab").innerHTML = `<input class="search" id="parkSearch" placeholder="Search parks or districts…" value="${esc(q)}" />` +
    (Object.entries(byD).map(([d, ps]) => `<div class="dist-title">${esc(d)} · ${ps.length}</div><div class="list">${ps.map(parkRow).join("")}</div>`).join("") || `<div class="note">No park matches.</div>`);
  const s = $("parkSearch"); s.oninput = () => { const p = s.selectionStart; renderParksTab(s.value); const n = $("parkSearch"); n.focus(); n.setSelectionRange(p, p); };
  bindRows($("parksTab"));
}
function renderSezTab() {
  const placed = DATA.sez.filter((z) => z.lat != null).length;
  $("sezTab").innerHTML = `<div class="sez-note note">Notified SEZs in the region from the SEZ India register (as on 31.07.2026). ${placed} of ${DATA.sez.length} are placed on the map at locality level; the rest have no usable address.</div>
    <div class="list">${DATA.sez.map(sezRow).join("")}</div>`;
  bindRows($("sezTab"));
}

/* ---------------- inspector ---------------- */
const grid = (rows) => `<div class="insp-grid">${rows.filter((r) => r[1] != null && r[1] !== "").map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join("")}</div>`;
function openInspector(html) { $("inspectorBody").innerHTML = html; $("inspector").classList.remove("hidden"); }
function inspectPlot(f) {
  const p = f.properties, pk = parkOf(p.park), st = ST[p.st] || ST.reserved;
  map.setFilter("plots-sel", ["==", ["id"], f.id]);
  openInspector(`<div class="insp-type">${ico("apartment-complex")}PLOT DEMARCATED</div><div class="insp-title">Plot ${esc(p.no || "—")} · ${esc(pk.name || "")}</div>
    <div style="margin:-2px 0 10px"><span class="tag-s" style="background:${st[1]};color:#fff">${st[0]}</span></div>
    ${grid([["Allottee", esc(p.owner || (p.st === "vacant" ? "Vacant — available" : p.st === "allotted" ? "Allottee not recorded" : "Reserved / common area"))], ["Category", esc(p.cat || "Industrial plot")],
      ["Plot size", p.size ? `${fmt(p.size)} sq.m (${fmt(p.size * 0.000247105, 2)} ac)` : "—"], ["Tariff rate", p.rate ? "₹" + fmt(p.rate) + "/sq.m" : "—"],
      ["Park", esc(pk.name || "")], ["District", esc(pk.district || "")],
      ["Latitude", p.lat ? (+p.lat).toFixed(5) : ""], ["Longitude", p.lon ? (+p.lon).toFixed(5) : ""]])}
    <div class="note">Source: India Industrial Land Bank (DPIIT).</div>`);
}
function inspectSez(i) {
  const z = DATA.sez[i]; if (!z) return;
  openInspector(`<div class="insp-type">${ico("flag")}NOTIFIED SEZ</div><div class="insp-title">${esc(z.developer.replace(/\s*\(.*?\)\s*/g, " ").trim())}</div>
    ${grid([["Location", esc(z.location)], ["Type", esc(z.type)], ["Area", z.area_ha ? esc(String(z.area_ha)) + " ha" : ""], ["Notified", esc(z.notified_date || "")],
      ["Status", esc((z.listed_as || []).join(", ").replace(/_/g, " "))], ["Map position", z.lat != null ? "Locality centre (approximate)" : "Not located"]])}
    <div class="note">Source: SEZ India register as on 31.07.2026. The marker is the locality centre, not the SEZ boundary.</div>`);
}
function inspectPark(key) {
  const p = parkOf(key); if (!p.key) return;
  openInspector(`<div class="insp-type">${ico("office-block")}INDUSTRIAL PARK</div><div class="insp-title">${esc(p.name)}</div>
    ${grid([["District", esc(p.district)], ["Plots demarcated", p.has_plots ? fmt(p.plots) : "Outline only"], ["Allotted", p.has_plots ? fmt(p.allotted) : ""], ["Vacant", p.has_plots ? fmt(p.vacant) : ""],
      ["Reserved", p.has_plots ? fmt(p.reserved) : ""], ["Plot area", p.has_plots ? fmt(ha(p.area_sqm), 1) + " ha" : ""]])}
    ${p.has_plots ? `<div style="margin-top:10px">${stackBar(p)}</div>` : ""}
    <div style="margin-top:10px"><button class="ghost-btn" id="zoomPark">Zoom to park</button></div>`);
  $("zoomPark").onclick = () => setArea(key);
}
function inspectOsm(f) {
  const t = f.properties || {}, nm = t.name || t.ref || t.operator || t.highway || t.railway || t.power || t.waterway || t.landuse || "Feature";
  openInspector(`<div class="insp-type">${ico("map")}OPENSTREETMAP</div><div class="insp-title">${esc(nm)}</div>${grid(Object.entries(t).filter(([k]) => k !== "name").slice(0, 8).map(([k, v]) => [esc(k), esc(v)]))}
    <div class="note">© OpenStreetMap contributors (ODbL).</div>`);
}

/* ---------------- state ---------------- */
function setArea(a, fly = true) {
  S.area = a; $("areaSelect").value = a; refreshPlots(); renderOverview(); renderParksTab($("parkSearch") ? $("parkSearch").value : "");
  if (fly && map) fitArea(); try { history.replaceState(null, "", "#bombay/" + a); } catch (e) {}
}
function setStatus(s) { S.status = s; $("statusSelect").value = s; refreshPlots(); renderLayers(); renderOverview(); }

/* ---------------- method modal ---------------- */
function renderMethod() {
  const a = agg(DATA.summary);
  $("methodBody").innerHTML = `<h2>Data &amp; method</h2><div class="note">Bombay industrial and special economic zones · AGT Intelligence</div>
    <h3>What is in this dashboard</h3>
    <table><tr><th>LAYER</th><th>SOURCE</th><th>NOTES</th></tr>
      <tr><td>Plots Demarcated (${fmt(a.plots)})</td><td>India Industrial Land Bank (DPIIT · BISAG-N)</td><td><span class="tag-m obs">OBSERVED</span> Cadastral plot polygons with plot number, allottee, size, tariff and status, across ${a.parks - a.outline_only} parks.</td></tr>
      <tr><td>Park &amp; SEZ perimeters (${a.parks})</td><td>India Industrial Land Bank</td><td><span class="tag-m obs">OBSERVED</span> Mumbai Suburban, Thane / Navi Mumbai and Raigad. ${a.outline_only} private logistics parks have an outline but no plots on IILB.</td></tr>
      <tr><td>Notified SEZs (${DATA.sez.length})</td><td>SEZ India register, as on 31.07.2026</td><td><span class="tag-m mod">APPROXIMATE</span> Names, area and status are official. Map position is the locality centre from address geocoding, not a boundary.</td></tr>
      <tr><td>Connectivity, utilities, land use</td><td>OpenStreetMap via Geofabrik (24.11.2026)</td><td><span class="tag-m mod">COMMUNITY DATA</span> Highways, rail, stations, power lines, substations, water, airports, industrial zones. © OpenStreetMap contributors (ODbL).</td></tr></table>
    <h3>Limits</h3>
    <div class="note">IILB lists only parks that states have uploaded, so this is not every industrial plot in Mumbai. Allotment status is as recorded by the authorities and may lag reality. Gas pipelines and ports are not tagged in OpenStreetMap for this region. MIDC lease records and MMRDA project layers are not included yet.</div>`;
}

/* ---------------- boot ---------------- */
function bindUI() {
  document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
    document.querySelectorAll(".tab-pane").forEach((p) => p.classList.toggle("active", p.id === t.dataset.tab));
  }));
  document.querySelectorAll("[data-collapse]").forEach((b) => (b.onclick = () => {
    const id = b.dataset.collapse; $(id).classList.add("collapsed"); $(id === "leftPanel" ? "leftReopen" : "rightReopen").classList.add("show");
    $("legend").classList.toggle("wide", $("rightPanel").classList.contains("collapsed")); $("inspector").classList.toggle("wide", $("leftPanel").classList.contains("collapsed")); $("coords").classList.toggle("wide", $("leftPanel").classList.contains("collapsed"));
  }));
  [["leftReopen", "leftPanel"], ["rightReopen", "rightPanel"]].forEach(([b, p]) => ($(b).onclick = () => { $(p).classList.remove("collapsed"); $(b).classList.remove("show");
    $("legend").classList.toggle("wide", $("rightPanel").classList.contains("collapsed")); $("inspector").classList.toggle("wide", $("leftPanel").classList.contains("collapsed")); $("coords").classList.toggle("wide", $("leftPanel").classList.contains("collapsed")); }));
  $("inspectorClose").onclick = () => { $("inspector").classList.add("hidden"); if (map.getLayer("plots-sel")) map.setFilter("plots-sel", ["==", ["id"], -1]); };
  $("areaSelect").onchange = (e) => setArea(e.target.value);
  $("statusSelect").onchange = (e) => setStatus(e.target.value);
  $("baseSelect").onchange = (e) => { S.base = e.target.value; map.setStyle(BASE[S.base]()); };
  $("methodBtn").onclick = () => $("methodModal").classList.remove("hidden");
  document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => $(b.dataset.close).classList.add("hidden")));
  $("methodModal").onclick = (e) => { if (e.target === $("methodModal")) $("methodModal").classList.add("hidden"); };
  const b = $("themeBtn"), SUN = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="10" cy="10" r="3.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/></svg>',
    MOON = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 11.6A6.6 6.6 0 0 1 8.4 3.5a6.6 6.6 0 1 0 8.1 8.1Z"/></svg>';
  b.innerHTML = DARK() ? SUN : MOON; b.onclick = () => { try { localStorage.setItem("agt.theme", DARK() ? "light" : "dark"); } catch (e) {} location.reload(); };
}
function fillAreaSelect() {
  const ds = [...new Set(DATA.summary.map((p) => p.district))];
  $("areaSelect").innerHTML = `<option value="all">All Bombay · Mumbai Metropolitan Region</option>` +
    `<optgroup label="Districts">${ds.map((d) => `<option value="d:${esc(d)}">${esc(d)} district</option>`).join("")}</optgroup>` +
    ds.map((d) => `<optgroup label="${esc(d)}">${DATA.summary.filter((p) => p.district === d).map((p) => `<option value="${p.key}">${esc(p.name)}${p.has_plots ? " (" + fmt(p.plots) + ")" : " (outline)"}</option>`).join("")}</optgroup>`).join("");
}
async function main() {
  const j = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
  const [summary, parks, plots, sez] = await Promise.all([j("bombay/data/summary.json"), j("bombay/data/parks.geojson"), j("bombay/data/plots.geojson"), j("bombay/data/sez.json")]);
  DATA = { summary, parks, plots, sez };
  bindUI(); fillAreaSelect(); renderLayers(); renderSezTab(); renderMethod();
  const h = decodeURIComponent(location.hash.slice(1)).split("/"); if (h[0] === "bombay" && h[1] && (h[1] === "all" || h[1].startsWith("d:") || parkOf(h[1]).key)) S.area = h.slice(1).join("/");
  map = new maplibregl.Map({ container: "map", style: BASE.map(), center: [73.0, 19.1], zoom: 9.3, attributionControl: { compact: true } });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.on("style.load", () => { addCore(); refreshPlots(); });
  map.on("load", () => {
    setArea(S.area, false); fitArea(false); $("loader").style.display = "none";
    ["plots-fill", "sez-dot", "parks-fill"].forEach((l) => { map.on("mouseenter", l, () => (map.getCanvas().style.cursor = "pointer")); map.on("mouseleave", l, () => (map.getCanvas().style.cursor = "")); });
    map.on("click", (e) => {
      const q = (layers) => map.queryRenderedFeatures(e.point, { layers: layers.filter((l) => map.getLayer(l)) });
      const sez = q(["sez-dot"]); if (sez.length && S.on.sez) return inspectSez(sez[0].properties.i);
      const pl = q(["plots-fill"]); if (pl.length && S.on.plots) return inspectPlot(pl[0]);
      const osm = q(LAYERS.filter((l) => l.osm && S.on[l.key]).flatMap((l) => [0, 1, 2].map((i) => `osm-${l.key}-${i}`))); if (osm.length) return inspectOsm(osm[0]);
      const pk = q(["parks-fill"]); if (pk.length) return inspectPark(pk[0].properties.key);
    });
    window.addEventListener("hashchange", () => { const q = decodeURIComponent(location.hash.slice(1)).split("/"); const v = q.slice(1).join("/");
      if (q[0] === "bombay" && v && v !== S.area && (v === "all" || v.startsWith("d:") || parkOf(v).key)) setArea(v); });
    map.on("mousemove", (e) => ($("coords").textContent = `LAT ${e.lngLat.lat.toFixed(5)}  |  LON ${e.lngLat.lng.toFixed(5)}  |  ZOOM ${map.getZoom().toFixed(1)}`));
  });
}
main().catch((e) => { console.error(e); $("loaderText").innerHTML = `Could not load data: ${esc(e.message)}<br><small>Serve this folder over http (python3 -m http.server) and open bombay.html</small>`; });
