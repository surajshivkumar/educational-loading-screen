let lastHoveredKey = null, hoverTimer = null, activeBoroCode = "ALL";
let isLocked = false, lockedAttrs = null, lockedBoroCode = null, highlightHandle = null;
const layerViewsByBoro = new Map();
const nonResLayerViews = []; // cached at startup to avoid calling whenLayerView on every hover
const boroAvgCache = {};
let compareMode = false;
let compareNta1 = null;
let compareNta2 = null;
let compareGraphics = new Map(); // slot # → { ring, badge }
let compareDrawSeq = 0;
const BORO_NAMES = { "1":"Manhattan","2":"Bronx","3":"Brooklyn","4":"Queens","5":"Staten Island" };
const ICON_UP        = '<svg class="ic ic-d" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 1.2 7.3 6.6 0.7 6.6Z" fill="currentColor"/></svg>';
const ICON_DOWN      = '<svg class="ic ic-d" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 6.8 0.7 1.4 7.3 1.4Z" fill="currentColor"/></svg>';
const ICON_X         = '<svg class="ic ic-x" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.2 2.2 7.8 7.8M7.8 2.2 2.2 7.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/></svg>';
const ICON_SORT_DOWN = '<svg class="ic ic-a" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.5V8.5M2.2 5.7 5 8.5 7.8 5.7" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_SORT_UP   = '<svg class="ic ic-a" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 8.5V1.5M2.2 4.3 5 1.5 7.8 4.3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_TRI_LEFT  = '<svg class="ic ic-t" viewBox="0 0 8 8" aria-hidden="true"><path d="M5.5 1 1.5 4 5.5 7Z" fill="currentColor"/></svg>';
const ICON_TRI_RIGHT = '<svg class="ic ic-t" viewBox="0 0 8 8" aria-hidden="true"><path d="M2.5 1 6.5 4 2.5 7Z" fill="currentColor"/></svg>';
let activeChoroMetric = "incarceration";
const CHORO_COLORS_WB = [
    [232,240,244,0.90],  // bin 1 — lightest Soft grey
    [181,200,210],    // bin 2 — medium teal (#0891b2)
    [63,110,130]    // bin 3 — deep teal
];
let top10HighlightHandles  = [];    // ArcGIS highlight handles for all-10 map highlight
let top10HighlightActive   = false; // is Highlight button currently ON
let top10HighlightBoroCode = null;  // boroCode when highlight was turned on
let top10NTACodes          = [];    // NTA2020 codes of current top 10
let top10SelectedHandle    = null;  // highlight handle for single-clicked list item
let top10AllFeatures       = [];    // cached feature objects for the current top 10
const _wbRankCache = {};
const TOP10_METRICS = {
    "incarcerations_per10k": { label:"Incarceration Rate",  higherIsBetter:false, decimals:1 },
    "WBS_city":              { label:"Well-Being Score",     higherIsBetter:true,  decimals:1, boroField:"WBS_borough" },
};
Object.entries(BORO_NAMES).forEach(([code, name]) => {
    const pill = document.querySelector(`.boro-pill[data-boro="${code}"]`);
    const opt  = document.querySelector(`#boroughFilter option[value="${code}"]`);
    if (pill) pill.textContent = name;
    if (opt)  opt.textContent  = name;
});
const METRIC_DEFS = [
    { id:"incarceration_count",       keys:["incarcerations_count"],     decimals:0, decimalsAvg:1, suffix:"", useThousands:true,  higherIsBad:true,
        cityAvgCol:"incarcerations_count_cityAvg",     boroAvgCol:"incarcerations_count_boroAvg",     showAvg:true },
    { id:"incarcerations_normalized", keys:["incarcerations_per10k"],    decimals:1, decimalsAvg:1, suffix:"", useThousands:false, higherIsBad:true,
        cityAvgCol:"incarcerations_per10k_cityAvg",    boroAvgCol:"incarcerations_per10k_boroAvg",    showAvg:true },
    { id:"health_index",              keys:["health_index"],              decimals:2, decimalsAvg:2, suffix:"", useThousands:false, higherIsBad:false,
        cityAvgCol:"health_index_cityAvg",             boroAvgCol:"health_index_boroAvg",             showAvg:true },
    { id:"education_index",           keys:["education_index"],           decimals:2, decimalsAvg:2, suffix:"", useThousands:false, higherIsBad:false,
        cityAvgCol:"education_index_cityAvg",          boroAvgCol:"education_index_boroAvg",          showAvg:true },
    { id:"poverty_pct",               keys:["poverty_pct"],               decimals:1, decimalsAvg:1, suffix:"%", useThousands:false, higherIsBad:true,
        cityAvgCol:"poverty_pct_cityAvg",              boroAvgCol:"poverty_pct_boroAvg",              showAvg:true },
    { id:"housing_per10k",            keys:["housing_per10k"],            decimals:1, decimalsAvg:1, suffix:"", useThousands:true, higherIsBad:true,
        cityAvgCol:"housing_per10k_cityAvg",           boroAvgCol:"housing_per10k_boroAvg",           showAvg:true },
    { id:"sanitation_noise_per10k",   keys:["Sanitation_Noise_per10k"],  decimals:1, decimalsAvg:1, suffix:"", useThousands:true, higherIsBad:true,
        cityAvgCol:"Sanitation_Noise_per10k_cityAvg",  boroAvgCol:"Sanitation_Noise_per10k_boroAvg",  showAvg:true },
];
function getFirstAttr(attrs, keys) {
    for (const k of keys) if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== "") return attrs[k];
    return null;
}
function fmt(value, decimals, suffix, useThousands) {
    if (value === null || value === undefined || value === "") return "--";
    const n = Number(value);
    if (isNaN(n)) return "--";
    let f;
    if (useThousands) {
        f = n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    } else {
        f = decimals === 0 ? String(Math.round(n)) : n.toFixed(decimals);
    }
    return f + suffix;
}
function setCardHas(id, active) {
    const c = document.getElementById(`card-${id}`);
    if (c) c.classList.toggle("has-data", active);
}
function clearAvgDelta() {
    METRIC_DEFS.forEach(d => {
        const a = document.getElementById(`avg-${d.id}`);
        const dl = document.getElementById(`delta-${d.id}`);
        if (a)  { a.textContent = "-"; a.className = "ind-sub-val loading"; }
        if (dl) { dl.textContent = "-"; dl.className = "ind-sub-val"; }
    });
}
function fillAvgSubsections(boroCode, attrs) {
    const isCitywide = (boroCode === "ALL");
    document.querySelectorAll(".ind-sub-label").forEach(el => {
        if (el.textContent === "Boro Avg" || el.textContent === "City Avg" || el.textContent === "Avg")
            el.textContent = isCitywide ? "City Avg" : "Boro Avg";
    });
    document.querySelectorAll(".ind-col-mid .ind-sub-label").forEach(el => {
        el.textContent = isCitywide ? "City Avg" : "Boro Avg";
    });
    METRIC_DEFS.forEach(d => {
        const el = document.getElementById(`avg-${d.id}`); if (!el) return;
        if (!d.showAvg || !attrs) { el.textContent = "-"; el.className = "ind-sub-val"; return; }
        const col = isCitywide ? d.cityAvgCol : d.boroAvgCol;
        const v   = attrs[col];
        if (v === null || v === undefined || v === "") {
            el.textContent = "-"; el.className = "ind-sub-val loading"; return;
        }
        el.textContent = fmt(Number(v), d.decimalsAvg ?? d.decimals, d.suffix, d.useThousands);
        el.className = "ind-sub-val";
    });
}
function fillDeltaSubsections(attrs, boroCode) {
    const isCitywide = (boroCode === "ALL");
    METRIC_DEFS.forEach(d => {
        const el = document.getElementById(`delta-${d.id}`); if (!el) return;
        if (!d.showAvg || !attrs) { el.textContent = "-"; el.className = "ind-sub-val"; return; }
        const raw = getFirstAttr(attrs, d.keys);
        const val = Number(raw);
        const col = isCitywide ? d.cityAvgCol : d.boroAvgCol;
        const avg = Number(attrs[col] ?? NaN);
        if (isNaN(val) || isNaN(avg) || avg === 0) {
            el.textContent = "-"; el.className = "ind-sub-val"; return;
        }
        const diffPct = ((val - avg) / avg) * 100;
        const absPct  = Math.abs(diffPct);
        const arrow   = diffPct >= 0 ? ICON_UP : ICON_DOWN;
        const sign    = diffPct >= 0 ? "+" : "-";
        const cls     = diffPct === 0 ? "delta-neutral"
            : d.higherIsBad ? (diffPct > 0 ? "delta-above" : "delta-below")
                : (diffPct > 0 ? "delta-above-good" : "delta-below-good");
        el.innerHTML = `${arrow} ${sign}${absPct.toFixed(1)}%`;
        el.className = `ind-sub-val ${cls}`;
    });
}
function clearDashboard() {
    if (isLocked) return;
    lastHoveredKey = null;
    document.getElementById("ntaName").textContent = "Hover over or select an NTA";
    document.getElementById("ntaCode").textContent = "No selection";
    document.getElementById("ntaCard").classList.remove("has-data", "is-nonres");
    const wbRow = document.getElementById("ntaWbRow");
    if (wbRow) wbRow.classList.remove("visible");
    ["health","edu","econ","housing","civic"].forEach(dom => {
        const ph = document.getElementById(`ph-${dom}`);
        const cards = document.getElementById(`cards-${dom}`);
        if (ph) ph.style.display = "none";
        if (cards) cards.style.display = "";
    });
    METRIC_DEFS.forEach(d => {
        const el = document.getElementById(`value-${d.id}`);
        if (el) el.textContent = "--";
        setCardHas(d.id, false);
    });
    const popEl = document.getElementById("value-population");
    if (popEl) popEl.textContent = "-";
    clearAvgDelta();
}
function showNonResInCard(attrs) {
    clearDashboard();                       // blank indicators + reset header
    const card = document.getElementById("ntaCard");
    const name = getFirstAttr(attrs, ["NTAName", "NTA2020"]) || "Non-Residential Area";
    const boroName = BORO_NAMES[String(getFirstAttr(attrs, ["BoroCode"]) || "").trim()] || "";
    const eb = document.getElementById("ntaEyebrow");
    if (eb) eb.textContent = "Hovered Neighborhood";
    document.getElementById("ntaName").textContent = name;
    document.getElementById("ntaCode").textContent = boroName || "Non-Residential NTA";
    card.classList.add("has-data", "is-nonres");
    lastHoveredKey = "__NONRES__";
}
function updateFromAttrs(attrs, boroCode) {
    const isCitywide = (boroCode === "ALL");
    const ntaName = getFirstAttr(attrs, ["NTAName"]) || "Unnamed NTA";
    const ntaCode = getFirstAttr(attrs, ["NTA2020"]) || "";
    const boroName = getFirstAttr(attrs, ["boroname"]) || BORO_NAMES[boroCode] || "";
    document.getElementById("ntaName").textContent = ntaName;
    document.getElementById("ntaCode").textContent = boroName ? `${ntaCode} · ${boroName}` : ntaCode;
    const _ntaCard = document.getElementById("ntaCard");
    _ntaCard.classList.add("has-data");
    _ntaCard.classList.remove("is-nonres");
    const _ntaEyebrow = document.getElementById("ntaEyebrow");
    if (_ntaEyebrow) _ntaEyebrow.textContent = isLocked
        ? "Well-Being Score for Neighborhood"
        : "Well-Being Score for Hovered Neighborhood";
    const wbScore    = getFirstAttr(attrs, [isCitywide ? "WBS_city"      : "WBS_borough"]);
    const wbTierRaw  = (getFirstAttr(attrs, [isCitywide ? "WBS_city_tier" : "WBS_borough_tier"]) || "").toString().trim();
    let wbStatus = "wb-neu";
    if      (wbTierRaw === "Above Average") wbStatus = "wb-above";
    else if (wbTierRaw === "Below Average") wbStatus = "wb-below";
    else if (wbTierRaw === "Close to Average") wbStatus = "wb-close";
    const wbTagText = wbStatus === "wb-above" ? "Above Avg"
        : wbStatus === "wb-close"  ? "Near the Avg"
            : wbStatus === "wb-below"  ? "Below Avg" : "-";
    const wbRow = document.getElementById("ntaWbRow");
    const wbVal = document.getElementById("ntaWbVal");
    const wbTag = document.getElementById("ntaWbTag");
    if (wbRow) wbRow.classList.add("visible");
    if (wbVal) { wbVal.textContent = wbScore !== null ? Number(wbScore).toFixed(1) : "-"; wbVal.className = `nta-wb-score-val ${wbStatus}`; }
    if (wbTag) { wbTag.textContent = wbTagText; wbTag.className = `nta-wb-group-tag ${wbStatus}`; }
    METRIC_DEFS.forEach(d => {
        const val = getFirstAttr(attrs, d.keys);
        const el = document.getElementById(`value-${d.id}`);
        if (el) el.textContent = fmt(val, d.decimals, d.suffix, d.useThousands);
        setCardHas(d.id, val !== null && val !== undefined);
    });
    const popEl = document.getElementById("value-population");
    if (popEl) {
        const pop = getFirstAttr(attrs, ["total_civilian_noninstitutionalized_population"]);
        popEl.textContent = (pop !== null && pop !== undefined)
            ? Number(pop).toLocaleString("en-US", { maximumFractionDigits:0 })
            : "-";
    }
    ["health","edu","econ","housing","civic"].forEach(dom => {
        const ph = document.getElementById(`ph-${dom}`);
        const cards = document.getElementById(`cards-${dom}`);
        if (ph) ph.style.display = "none";
        if (cards) cards.style.display = "";
    });
    if (boroCode) { fillAvgSubsections(boroCode, attrs); fillDeltaSubsections(attrs, boroCode); }
}
function setLockUI(locked) {
    const c = document.getElementById("ntaCard");
    const b = document.getElementById("lockBadge");
    const e = document.getElementById("ntaEyebrow");
    c.classList.toggle("is-locked", locked);
    b.classList.toggle("visible", locked);
    e.textContent = locked ? "Well-Being Score for Neighborhood" : "Well-Being Score for Neighborhood";
}
function unlockNTA() {
    isLocked = false; lockedAttrs = null; lockedBoroCode = null; lastHoveredKey = null;
    if (highlightHandle) { highlightHandle.remove(); highlightHandle = null; }
    if (top10SelectedHandle) { top10SelectedHandle.remove(); top10SelectedHandle = null; }
    document.querySelectorAll(".top10-item.is-selected").forEach(el => el.classList.remove("is-selected"));
    setLockUI(false);
    clearDashboard();
}
function toggleDomain(domainKey) {
    const body  = document.getElementById(`body-${domainKey}`);
    const arrow = document.getElementById(`arrow-${domainKey}`);
    if (!body) return;
    const isCollapsed = body.classList.toggle("collapsed");
    if (arrow) {
        arrow.classList.toggle("open",   !isCollapsed);
        arrow.classList.toggle("closed",  isCollapsed);
    }
}
function toggleSidebar() {
    const app = document.querySelector(".app");
    const arrow = document.querySelector(".toggle-arrow");
    const isHidden = app.classList.toggle("sidebar-hidden");
    arrow.innerHTML = isHidden ? ICON_TRI_RIGHT : ICON_TRI_LEFT;
}
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("sidebarToggle");
    if (btn) btn.addEventListener("click", toggleSidebar);
});
function toggleTop10(which) {
    const collapseId = which === "all" ? "allTop10Collapsible" : "boroTop10Collapsible";
    const iconId     = which === "all" ? "allTop10Icon"        : "boroTop10Icon";
    const col  = document.getElementById(collapseId);
    const icon = document.getElementById(iconId);
    if (!col) return;
    const isCollapsed = col.classList.toggle("collapsed");
    if (icon) icon.classList.toggle("collapsed", isCollapsed);
}
require(["esri/Map","esri/views/MapView","esri/layers/FeatureLayer","esri/layers/GeoJSONLayer","esri/Basemap","esri/layers/VectorTileLayer","esri/layers/GraphicsLayer","esri/Graphic","esri/geometry/Point"],
    function(Map, MapView, FeatureLayer, GeoJSONLayer, Basemap, VectorTileLayer, GraphicsLayer, Graphic, Point) {
        (async () => {
            try {
                console.log("REQUIRE CALLBACK STARTED!");
                async function getCachedGeoJSON(url, cacheKey) {
                    return new Promise((resolve, reject) => {
                        const req = indexedDB.open("ArcGISCacheDB", 1);
                        req.onupgradeneeded = e => {
                            const db = e.target.result;
                            if(!db.objectStoreNames.contains("geojson")) {
                                db.createObjectStore("geojson");
                            }
                        };
                        req.onsuccess = e => {
                            const db = e.target.result;
                            const tx = db.transaction("geojson", "readonly");
                            const store = tx.objectStore("geojson");
                            const getReq = store.get(cacheKey);
                            getReq.onsuccess = async () => {
                                if (getReq.result) {
                                    console.log("Loaded " + cacheKey + " from IndexedDB cache.");
                                    resolve(getReq.result);
                                } else {
                                    console.log("Fetching " + url + " from network...");
                                    try {
                                        const resp = await fetch(url);
                                        const data = await resp.json();
                                        const tx2 = db.transaction("geojson", "readwrite");
                                        tx2.objectStore("geojson").put(data, cacheKey);
                                        resolve(data);
                                    } catch(err) { reject(err); }
                                }
                            };
                            getReq.onerror = () => reject(getReq.error);
                        };
                        req.onerror = () => reject(req.error);
                    });
                }
                const geojsonData = await getCachedGeoJSON("data.geojson", "data");
                const boroughsData = await getCachedGeoJSON("boroughs.geojson", "boroughs");
                const dataBlobUrl = URL.createObjectURL(new Blob([JSON.stringify(geojsonData)], { type: "application/geo+json" }));
                const boroughsBlobUrl = URL.createObjectURL(new Blob([JSON.stringify(boroughsData)], { type: "application/geo+json" }));
                let oid = 1;
                const graphics = geojsonData.features.map(f => {
                    f.properties.OBJECTID = oid++;
                    return new Graphic({
                        attributes: f.properties
                    });
                });
                const allAttrs = graphics.map(g => g.attributes);
                const fields = Object.keys(allAttrs[0]).map(k => {
                    if (k === "OBJECTID") return { name: k, type: "oid" };
                    for (const a of allAttrs) {
                        if (a[k] !== null && a[k] !== undefined) {
                            return { name: k, type: typeof a[k] === "number" ? "double" : "string" };
                        }
                    }
                    return { name: k, type: "double" };
                });
                const protectedData = { graphics, fields };
                const CHORO_COLORS = [
                    [222,235,247,0.90],  // bin 1 - lightest
                    [49,130,189,0.94],   // bin 2 - medium
                    [8,48,107,0.97]      // bin 3 - darkest
                ];

                function jenksBreaks(sorted, k) {
                    const n = sorted.length;
                    if (n <= k) return sorted.slice(0,-1);
                    const mat1 = Array.from({length:n+1},()=>new Array(k+1).fill(0));
                    const mat2 = Array.from({length:n+1},()=>new Array(k+1).fill(Infinity));
                    for (let i=1;i<=k;i++) mat2[1][i]=0;
                    for (let l=2;l<=n;l++) {
                        let s1=0,s2=0,w=0;
                        for (let m=1;m<=l;m++) {
                            const i3=l-m+1, val=sorted[i3-1];
                            s2+=val*val; s1+=val; w++;
                            const v=s2-(s1*s1)/w;
                            if (i3!==1) for (let j=2;j<=k;j++) { const c=v+mat2[i3-1][j-1]; if(mat2[l][j]>=c){mat1[l][j]=i3-1;mat2[l][j]=c;} }
                        }
                        mat1[l][1]=1; mat2[l][1]=s2-(s1*s1)/w;
                    }
                    const breaks=new Array(k-1); let kk=n;
                    for (let j=k;j>=2;j--) { breaks[j-2]=sorted[mat1[kk][j]-1]; kk=mat1[kk][j]-1; }
                    return breaks;
                }

                function makeBreaksFromThresholds(thresholds) {
                    const outline = { color:[160,180,210,0.55], width:0.4 };
                    const breaks = [];
                    thresholds.forEach((t,i) => {
                        breaks.push({ minValue: i===0?0:thresholds[i-1]+0.0001, maxValue:t,
                            label:`${(i===0?0:thresholds[i-1]+0.01).toFixed(2)}-${t.toFixed(2)}`,
                            symbol:{ type:"simple-fill", color:CHORO_COLORS[i], outline }});
                    });
                    breaks.push({ minValue:thresholds[thresholds.length-1]+0.0001, maxValue:999999,
                        label:`${(thresholds[thresholds.length-1]+0.01).toFixed(2)}+`,
                        symbol:{ type:"simple-fill", color:CHORO_COLORS[2], outline }});
                    return breaks;
                }

                const LAYER_URL = "https://services6.arcgis.com/fvVAYtGZqN8KYrb6/arcgis/rest/services/indicators_merged_with_citywide_and_borough_averages_updated0627/FeatureServer/0";
                function createLayer() {
                    return new GeoJSONLayer({
                        url: dataBlobUrl,
                        definitionExpression: "ntatype = 0",
                        outFields:["*"], popupEnabled:false, labelsVisible:false, labelingInfo:[],
                        renderer:{
                            type:"class-breaks", field:"incarcerations_per10k",
                            defaultSymbol:{ type:"simple-fill", color:[222,235,247,0.85], outline:{color:[160,180,210,0.5],width:0.4} },
                            classBreakInfos:makeBreaksFromThresholds([50,150])
                        }
                    });
                }
                async function applyDynamicBreaks(layer) {
                    const isCitywide = (activeBoroCode === "ALL");
                    const isWB = (activeChoroMetric === "wellbeing");
                    const field  = isWB ? (isCitywide ? "WBS_city" : "WBS_borough") : "incarcerations_per10k";
                    const colors = isWB ? CHORO_COLORS_WB : CHORO_COLORS;
                    try {
                        const isBoroScope = (activeBoroCode !== "ALL" && layer === boroughLayer);
                        const vals = protectedData.graphics
                            .filter(g => g.attributes.ntatype === 0 && (!isBoroScope || g.attributes.BoroCode === activeBoroCode))
                            .map(g => Number(g.attributes[field]))
                            .filter(v => !isNaN(v) && v > 0)
                            .sort((a,b) => a-b);
                        if (vals.length < 4) return;
                        const raw = jenksBreaks(vals, 3);
                        const thresholds = [...new Set(raw.map(v => parseFloat((v - 0.005).toFixed(3))))].sort((a,b)=>a-b);
                        if (thresholds.length < 2) return;
                        const outline = { color:[160,180,210,0.55], width:0.4 };
                        const breaks = [];
                        thresholds.forEach((t, i) => {
                            breaks.push({
                                minValue: i === 0 ? 0 : thresholds[i-1] + 0.0001,
                                maxValue: t,
                                label: `${(i===0?0:thresholds[i-1]+0.01).toFixed(2)}-${t.toFixed(2)}`,
                                symbol:{ type:"simple-fill", color:colors[i], outline }
                            });
                        });
                        breaks.push({
                            minValue: thresholds[thresholds.length-1] + 0.0001, maxValue: 999999,
                            label: `${(thresholds[thresholds.length-1]+0.01).toFixed(2)}+`,
                            symbol:{ type:"simple-fill", color:colors[2], outline }
                        });
                        layer.renderer = {
                            type:"class-breaks", field,
                            defaultSymbol:{ type:"simple-fill", color:[222,235,247,0.85], outline:{color:[160,180,210,0.5],width:0.4} },
                            classBreakInfos: breaks
                        };
                        console.log(`[applyDynamicBreaks] metric=${field} breaks=[${thresholds.join(", ")}]`);
                        const swatchColors = isWB
                            ? ["#e0f2f8","#0891b2","#0e7490"]
                            : ["#eff3ff","#6099cf","#08306b"];
                        swatchColors.forEach((c, i) => {
                            const sw = document.getElementById(`ls${i}`);
                            if (sw) sw.style.background = c;
                        });
                        const legendTitle = document.querySelector(".map-legend-title-text");
                        if (legendTitle) legendTitle.textContent = isWB ? "Well-Being Score" : "Incarceration Rate";
                        const minVal = vals[0];
                        const maxVal = vals[vals.length - 1];
                        const t0 = Number(thresholds[0].toFixed(1));   // Low / Medium boundary
                        const t1 = Number(thresholds[1].toFixed(1));   // Medium / High boundary
                        const ranges = [
                            `${minVal.toFixed(1)} - ${(t0 - 0.1).toFixed(1)}`,   // lr0 = Low (lightest)
                            `${t0.toFixed(1)} - ${(t1 - 0.1).toFixed(1)}`,       // lr1 = Medium
                            `${t1.toFixed(1)} - ${maxVal.toFixed(1)}`            // lr2 = High (darkest)
                        ];
                        ["lr0","lr1","lr2"].forEach((id, i) => {
                            const el = document.getElementById(id);
                            if (el) el.textContent = ranges[i];
                        });
                    } catch(e) { console.warn("Dynamic breaks failed:", e); }
                }
                const citywideLayer = createLayer();
                citywideLayer.visible = true; // default: citywide active on load
                const boroughLayer = createLayer();
                boroughLayer.visible = false; // hidden by default; shown when a borough is selected
                const metricLayers = [{ layer: boroughLayer, boroCode: "BOROUGH" }];
                const NR_LAYER_URL = "https://services6.arcgis.com/fvVAYtGZqN8KYrb6/arcgis/rest/services/indicators_merged_with_citywide_and_borough_averages_updated0627/FeatureServer/0";
                const makeNRLayer = () => new GeoJSONLayer({
                    url: dataBlobUrl, outFields:["NTA2020","NTAName","ntatype", "BoroCode"],
                    popupEnabled:false, labelsVisible:false, labelingInfo:[],
                    definitionExpression: "ntatype <> 0",
                    visible: false,
                    renderer:{
                        type:"simple",
                        symbol:{
                            type:"simple-fill",
                            color:[245, 240, 180, 0.35],
                            outline:{ color:[190,205,220,0.7], width:0.7 }
                        }
                    }
                });
                const nonResLayers = [
                    makeNRLayer(),
                    makeNRLayer()
                ];
                const wbOutlineLayers = []; // placeholder so visibility code doesn't break
                const layer3 = new GeoJSONLayer({
                    url: boroughsBlobUrl,
                    outFields:["*"], popupEnabled:false, labelsVisible:true,
                    labelingInfo:[{
                        labelExpressionInfo:{ expression:"$feature.BoroName" },
                        symbol:{ type:"text", color:[71,85,105], haloColor:[255,255,255,0.9], haloSize:2, font:{ size:10, family:"Arial", weight:"normal" } },
                        labelPlacement:"always-horizontal", minScale:500000, maxScale:0
                    }],
                    renderer:{
                        type:"unique-value", field:"BoroName",
                        uniqueValueInfos:["Manhattan","Bronx","Brooklyn","Queens","Staten Island"].map(name=>({
                            value:name,
                            symbol:{
                                type:"simple-fill",
                                color:[0,0,0,0],            // transparent fill — only the outline matters
                                outline:{ color:[70,70,70,0.33], width:1.6 }  // deep navy, 2.8px
                            }
                        }))
                    },
                    visible: true  // citywide is default on load; applyVisibility() manages this
                });
                const symbolLayer = new GraphicsLayer({ listMode:"hide" });
                const wbCategoryLayer = new GraphicsLayer({ listMode:"hide" });
                const wbGreyLayer = new GraphicsLayer({ listMode:"hide" });
                const compareLayer = new GraphicsLayer({ listMode:"hide" });
                const map = new Map({
                    layers:[citywideLayer, boroughLayer, ...nonResLayers, /* ...wbOutlineLayers, */ layer3, symbolLayer, wbGreyLayer, wbCategoryLayer, compareLayer]
                });
                const view = new MapView({
                    container:"viewDiv", map,
                    center:[-73.97,40.73], zoom:5,
                    background:{ color:[255,255,255] },
                    highlightOptions: { color:[245,158,11], fillOpacity:0.22, haloOpacity:1.0 },
                    constraints: { minScale: 500000, maxScale: 170000 }
                });
                view.ui.empty("top-left");
                document.getElementById("zoomInBtn").addEventListener("click", () => {
                    view.goTo({ scale: view.scale / 1.5 }, { duration: 300, easing: "ease-in-out" }).catch(()=>{});
                });
                document.getElementById("zoomOutBtn").addEventListener("click", () => {
                    view.goTo({ scale: view.scale * 1.5 }, { duration: 300, easing: "ease-in-out" }).catch(()=>{});
                });
                const tooltip = document.getElementById("mapTooltip");
                function showTooltip(event, attrs, boroCode) {
                    if (!showTooltip._debugged) {
                        console.log("=== NTA attribute keys from ArcGIS ===", Object.keys(attrs));
                        showTooltip._debugged = true;
                    }
                    function getField(attrs, ...candidates) {
                        for (const k of candidates) {
                            if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== "") return attrs[k];
                        }
                        const allKeys = Object.keys(attrs);
                        for (const k of candidates) {
                            const match = allKeys.find(ak => ak.toLowerCase().trim() === k.toLowerCase().trim());
                            if (match && attrs[match] !== undefined && attrs[match] !== null && attrs[match] !== "")
                                return attrs[match];
                        }
                        return null;
                    }
                    const isCitywide = (boroCode === "ALL");
                    const name     = getField(attrs,"NTAName") || "Unknown NTA";
                    const code     = getField(attrs,"NTA2020") || "";
                    const boro     = getField(attrs,"boroname") || BORO_NAMES[boroCode] || "";
                    const wbScore   = getField(attrs, isCitywide ? "WBS_city"           : "WBS_borough");
                    const wbAvg     = getField(attrs, isCitywide ? "WBS_city_cityAvg"   : "WBS_borough_boroAvg");
                    const wbTierRaw = (getField(attrs, isCitywide ? "WBS_city_tier"     : "WBS_borough_tier") || "").toString().trim();
                    const hIdx    = Number(getField(attrs,"health_index")           ?? NaN);
                    const eIdx    = Number(getField(attrs,"education_index")        ?? NaN);
                    const pov     = Number(getField(attrs,"poverty_pct")            ?? NaN);
                    const housing = Number(getField(attrs,"housing_per10k")         ?? NaN);
                    const sanNoise= Number(getField(attrs,"Sanitation_Noise_per10k") ?? NaN);
                    const rate    = Number(getField(attrs,"incarcerations_per10k")  ?? NaN);
                    const hIdxAvg    = Number(getField(attrs, isCitywide ? "health_index_cityAvg"            : "health_index_boroAvg")            ?? NaN);
                    const eIdxAvg    = Number(getField(attrs, isCitywide ? "education_index_cityAvg"          : "education_index_boroAvg")          ?? NaN);
                    const povAvg     = Number(getField(attrs, isCitywide ? "poverty_pct_cityAvg"              : "poverty_pct_boroAvg")              ?? NaN);
                    const housingAvg = Number(getField(attrs, isCitywide ? "housing_per10k_cityAvg"           : "housing_per10k_boroAvg")           ?? NaN);
                    const sanAvg     = Number(getField(attrs, isCitywide ? "Sanitation_Noise_per10k_cityAvg"  : "Sanitation_Noise_per10k_boroAvg")  ?? NaN);
                    const rateAvg    = Number(getField(attrs, isCitywide ? "incarcerations_per10k_cityAvg"    : "incarcerations_per10k_boroAvg")    ?? NaN);
                    let wbStatus = "neu";
                    if      (wbTierRaw === "Above Average")    wbStatus = "wb-above";
                    else if (wbTierRaw === "Below Average")    wbStatus = "wb-below";
                    else if (wbTierRaw === "Close to Average") wbStatus = "wb-close";
                    const wbLabel = wbStatus === "wb-above" ? "Above Average WB"
                        : wbStatus === "wb-below"  ? "Below Average WB"
                            : wbStatus === "wb-close"  ? "Near the Average WB"
                                : (wbTierRaw || "Well-Being");
                    const avgLbl = isCitywide ? "City avg" : "Boro avg";
                    const DOMAIN_COLORS = {
                        health:"#155757", edu:"#92823b", econ:"#4D3548",
                        housing:"#B5694A", civic:"#6B4423", incarceration:"#4f46e5"
                    };
                    function deltaInfo(val, avg, higherIsBad, decimals) {
                        if (isNaN(val) || isNaN(avg) || avg === 0) return { text:"-", cls:"neu" };
                        const diffPct = ((val - avg) / avg) * 100;
                        const arrow   = diffPct >= 0 ? ICON_UP : ICON_DOWN;
                        const sign    = diffPct >= 0 ? "+" : "-";
                        const isGood  = higherIsBad ? diffPct < 0 : diffPct > 0;
                        return {
                            text: `${arrow} ${sign}${Math.abs(diffPct).toFixed(1)}%`,
                            cls:  diffPct === 0 ? "neu" : isGood ? "good" : "bad"
                        };
                    }
                    const hIdxDelta    = deltaInfo(hIdx,    hIdxAvg,    false, 2);
                    const eIdxDelta    = deltaInfo(eIdx,    eIdxAvg,    false, 2);
                    const povDelta     = deltaInfo(pov,     povAvg,     true,  1);
                    const housingDelta = deltaInfo(housing, housingAvg, true,  1);
                    const sanDelta     = deltaInfo(sanNoise,sanAvg,     true,  1);
                    const rateDelta    = deltaInfo(rate,    rateAvg,    true,  1);
                    function metricRow(label, val, avg, delta, decimals, domainKey) {
                        const color = DOMAIN_COLORS[domainKey] || "#64748b";
                        return `
          <div class="tt-metric-box">
            <div class="tt-metric-left">
              <div class="tt-metric-label" style="color:${color};font-weight:600;">${label}</div>
            </div>
            <div class="tt-metric-value">${isNaN(val)?"-":val.toLocaleString("en-US",{minimumFractionDigits:decimals,maximumFractionDigits:decimals})}</div>
            <div class="tt-metric-right">
              <div class="tt-metric-delta ${delta.cls}">${delta.text}</div>
              <div class="tt-metric-avg">${avgLbl}: ${isNaN(avg)?"-":avg.toLocaleString("en-US",{minimumFractionDigits:decimals,maximumFractionDigits:decimals})}</div>
            </div>
          </div>`;
                    }
                    const ntaKey   = String(getField(attrs,"NTA2020") || "").trim();
                    const rankData = _wbRankCache[ntaKey] || {};
                    const cityRank  = rankData.cityRank  || "-";
                    const cityTotal = rankData.cityTotal || "-";
                    const boroRank  = rankData.boroRank  || "-";
                    const boroTotal = rankData.boroTotal || "-";
                    const rankNum   = isCitywide ? cityRank  : boroRank;
                    const rankTotal = isCitywide ? cityTotal : boroTotal;
                    const rankLabel = isCitywide ? "Citywide" : "In Borough";
                    tooltip.innerHTML = `
        <div class="tt-header ${wbStatus}">
          <span class="tt-boro-tag ${wbStatus}">${wbLabel}</span>
          <div class="tt-nta-name ${wbStatus}">${name} <span class="tt-nta-code">${code}${boro?" · "+boro:""}</span></div>
          <div class="tt-wb-row">
            <div class="tt-wb-left">
              <div class="tt-wb-lbl">Well-Being Score</div>
              <div class="tt-wb-val ${wbStatus}">${wbScore!==null?Number(wbScore).toFixed(1):"-"}</div>
            </div>
              <div class="tt-wb-rank">
              <div class="tt-rank-lbl">Rank ${rankLabel}</div>
              <div class="tt-rank-val">${rankNum} <span class="tt-rank-of">/ ${rankTotal}</span></div>
            </div>
            <div class="tt-wb-mid">
              <div class="tt-wb-avg-lbl">${isCitywide?"City Avg WB":"Borough Avg WB"}</div>
              <div class="tt-wb-avg-val">${wbAvg!==null&&!isNaN(Number(wbAvg))?Number(wbAvg).toFixed(1):"-"}</div>
            </div>
          </div>
        </div>
        <div class="tt-body">
          <div class="tt-metric-grid">
            ${metricRow("Incarceration Rate", rate,    rateAvg,    rateDelta,    1,"incarceration")}
            ${metricRow("Health Index",            hIdx,    hIdxAvg,    hIdxDelta,    2,"health")}
            ${metricRow("Education Index",         eIdx,    eIdxAvg,    eIdxDelta,    2,"edu")}
            ${metricRow("Poverty %",               pov,     povAvg,     povDelta,     1,"econ")}
            ${metricRow("Housing & Building Rate", housing, housingAvg, housingDelta, 1,"housing")}
            ${metricRow("Sanitation & Noise Rate", sanNoise,sanAvg,     sanDelta,     1,"civic")}
          </div>
        </div>
        <div class="tt-footer">Click NTA to lock · Scroll sidebar for all indicators</div>
      `;
                    tooltip.className = "";
                    if (wbStatus) tooltip.classList.add("tt-" + wbStatus);
                    tooltip.style.display = "block";
                    requestAnimationFrame(() => {
                        const vw = document.getElementById("viewDiv").clientWidth;
                        const vh = document.getElementById("viewDiv").clientHeight;
                        const ttW = 248;
                        const ttH = tooltip.offsetHeight;
                        let x = event.x + 18;
                        let y = event.y - 20;
                        if (x + ttW > vw - 10) x = event.x - ttW - 18;
                        if (y + ttH > vh - 10) y = vh - ttH - 10;
                        if (y < 10) y = 10;
                        tooltip.style.left = `${x}px`;
                        tooltip.style.top  = `${y}px`;
                        tooltip.style.visibility = "visible";
                    });
                }
                function hideTooltip() {
                    if (tooltip)   { tooltip.style.display = "none";   tooltip.style.visibility = "hidden"; }
                    if (tooltipNR) { tooltipNR.style.display = "none"; tooltipNR.style.visibility = "hidden"; }
                }
                const tooltipNR = document.getElementById("mapTooltipNR");
                function showNRTooltip(event, attrs) {
                    const name = getFirstAttr(attrs,["NTAName","NTA2020"]) || "Non-Residential Area";
                    tooltipNR.innerHTML = `
        <div class="tt-nr-header">
          <div class="tt-nr-name">${name}</div>
          <span class="tt-nr-tag">Non-Residential NTA</span>
        </div>
        <div class="tt-nr-body">
          <div class="tt-nr-disclaimer">
            This is a Non-Residential NTA. Data for this area is excluded from neighborhood averages to prevent statistical skew.
          </div>
        </div>
      `;
                    tooltip.style.display    = "none";
                    tooltip.style.visibility = "hidden";
                    tooltipNR.style.display  = "block";
                    requestAnimationFrame(() => {
                        const vw = document.getElementById("viewDiv").clientWidth;
                        const vh = document.getElementById("viewDiv").clientHeight;
                        const ttW = 260;
                        const ttH = tooltipNR.offsetHeight;
                        let x = event.x + 14;
                        let y = event.y - 10;
                        if (x + ttW > vw - 10) x = event.x - ttW - 14;
                        if (y + ttH > vh - 10) y = vh - ttH - 10;
                        if (y < 10) y = 10;
                        tooltipNR.style.left = `${x}px`;
                        tooltipNR.style.top  = `${y}px`;
                        tooltipNR.style.visibility = "visible";
                    });
                }
                function applyVisibility(boroCode) {
                    if (boroCode === "ALL") {
                        citywideLayer.visible = true;
                        boroughLayer.visible  = false;
                        nonResLayers[0].visible = true;
                        nonResLayers[1].visible = false;
                        layer3.visible = true;
                        symbolLayer.visible = true;
                    } else {
                        citywideLayer.visible = false;
                        boroughLayer.definitionExpression = `ntatype = 0 AND BoroCode = '${boroCode}'`;
                        boroughLayer.visible = true;
                        nonResLayers[0].visible = false;
                        nonResLayers[1].definitionExpression = `ntatype <> 0 AND BoroCode = '${boroCode}'`;
                        nonResLayers[1].visible = true;
                        layer3.visible = false;
                        symbolLayer.visible = (boroCode === "4");
                    }
                    wbOutlineLayers.forEach(layer => { layer.visible = false; });
                }
                let _initialExtent = null; // unused - kept so no reference errors
                const CITY_EXPAND = 1.22;   // ~22% padding so southern Staten Island + south Brooklyn fully fit
                const BORO_EXPAND = 1.45;   // ~45% padding so a single borough isn't over-zoomed
                async function zoomTo(boroCode, goToOpts) {
                    const opts = goToOpts || { duration:600, easing:"ease-in-out" };
                    if (boroCode === "ALL") {
                        try {
                            const q = layer3.createQuery();
                            q.where = "1=1"; q.returnGeometry = true; q.outFields = [];
                            const res = await layer3.queryFeatures(q);
                            if (res.features.length) {
                                const allExtent = res.features.reduce((ext, f) => {
                                    if (!f.geometry) return ext;
                                    return ext ? ext.union(f.geometry.extent) : f.geometry.extent;
                                }, null);
                                if (allExtent) {
                                    await view.goTo(allExtent.expand(CITY_EXPAND), opts);
                                    return;
                                }
                            }
                        } catch(e) { console.warn("zoomTo ALL extent query failed:", e); }
                        await view.goTo({ center:[-73.97,40.73], zoom:5 }, opts);
                        return;
                    }
                    const q = layer3.createQuery();
                    q.where = `BoroCode='${boroCode}'`;
                    q.returnGeometry = true; q.outFields = ["*"];
                    const res = await layer3.queryFeatures(q);
                    if (res.features[0]?.geometry)
                        await view.goTo(res.features[0].geometry.extent.expand(BORO_EXPAND), opts);
                }
                async function preloadAverages() {
                }


// ======================================================================
// 📊 MODULE 2: DATA PROCESSING & RANKS
// ======================================================================
                function buildRankCache() {
                    try {
                        if (!protectedData.graphics || protectedData.graphics.length === 0) return;
                        let allItems = protectedData.graphics
                            .filter(g => g.attributes.ntatype === 0)
                            .map(g => g.attributes);
                        const sortedCity = [...allItems].sort((a,b) => Number(b.WBS_city||0) - Number(a.WBS_city||0));
                        sortedCity.forEach((a, i) => {
                            const key = String(a.NTA2020 || "").trim();
                            if (!_wbRankCache[key]) _wbRankCache[key] = {};
                            _wbRankCache[key].cityRank  = i + 1;
                            _wbRankCache[key].cityTotal = sortedCity.length;
                        });
                        const boroughs = ["1","2","3","4","5"];
                        boroughs.forEach(bc => {
                            const boroNTAs = allItems.filter(a => String(a.BoroCode) === bc);
                            const sortedBoro = [...boroNTAs].sort((a,b) => Number(b.WBS_borough||0) - Number(a.WBS_borough||0));
                            sortedBoro.forEach((a, i) => {
                                const key = String(a.NTA2020 || "").trim();
                                if (!_wbRankCache[key]) _wbRankCache[key] = {};
                                _wbRankCache[key].boroRank  = i + 1;
                                _wbRankCache[key].boroTotal = sortedBoro.length;
                            });
                        });
                        console.log(`[buildRankCache] Cached ${Object.keys(_wbRankCache).length} NTA ranks`);
                    } catch(e) {
                        console.warn("[buildRankCache] failed:", e);
                    }
                }
                const WB_RANGE_TABLE = {
                    "ALL": { above: "70.5 – 86.7", close: "39.9 – 70.4", below: "14.9 – 39.8" }, // Citywide
                    "1":   { above: "77.4 - 86.7", close: "45.4 - 77.3", below: "31.7 - 45.3"  }, // Manhattan
                    "2":   { above: "49.9 - 69.6", close: "23.0 - 49.8", below: "14.9 - 22.9" }, // Bronx
                    "3":   { above: "65.5 - 83.3", close: "43.6 - 65.4", below: "24.6 - 43.5" }, // Brooklyn
                    "4":   { above: "71.3 - 82.1", close: "53.1 - 71.2", below: "42.8 - 53.0" }, // Queens
                    "5":   { above: "75.4 - 77.6", close: "50.0 - 75.3", below: "39.9 - 49.9" }, // Staten Island
                };

                const AIRPORT_CODE   = "QN8381";
                const AIRPORT_CODE_2   = "QN8081";
                const CEMETERY_CODES = [];
                async function addPoiSymbols() {
                    const allCodes = [AIRPORT_CODE, AIRPORT_CODE_2];
                    try {
                        const q = citywideLayer.createQuery();
                        q.where = `NTA2020 IN (${allCodes.map(c => `'${c}'`).join(",")})`;
                        q.outFields = ["NTA2020","NTAName"];
                        q.returnGeometry = true;
                        q.outSpatialReference = view.spatialReference;
                        const res = await citywideLayer.queryFeatures(q);
                        console.log(`[addPoiSymbols] queried ${res.features.length} POI features`);
                        res.features.forEach(f => {
                            const code = f.attributes.NTA2020;
                            const isAirport  = (code === AIRPORT_CODE || code === AIRPORT_CODE_2);
                            if (!isAirport) return;
                            const geom = f.geometry;
                            if (!geom) { console.warn("[addPoiSymbols] no geometry for", code); return; }
                            const ext = geom.extent;
                            const centroid = new Point({
                                x: (ext.xmin + ext.xmax) / 2,
                                y: (ext.ymin + ext.ymax) / 2,
                                spatialReference: view.spatialReference
                            });
                            const planeSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#000" stroke="#fff" stroke-width="0.8" stroke-linejoin="round"/></svg>';
                            const crossSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 20"><path d="M6.6 1h2.8v3.6h3.2v2.8H9.4V19H6.6V7.4H3.4V4.6h3.2z" fill="#3c3c3c" stroke="#fff" stroke-width="0.9" stroke-linejoin="round"/></svg>';
                            const symbol = isAirport ? {
                                type:"picture-marker",
                                url:"data:image/svg+xml;base64," + btoa(planeSvg),
                                width:"22px", height:"22px"
                            } : {
                                type:"picture-marker",
                                url:"data:image/svg+xml;base64," + btoa(crossSvg),
                                width:"12px", height:"15px"
                            };
                            symbolLayer.add(new Graphic({ geometry:centroid, symbol }));
                            console.log(`[addPoiSymbols] placed ${isAirport ? "airplane" : "cross"} for ${code} at x:${centroid.x.toFixed(0)} y:${centroid.y.toFixed(0)}`);
                        });
                    } catch(e) {
                        console.warn("[addPoiSymbols] failed:", e);
                    }
                }
                async function fetchBoroFeatures(boroCode) {
                    return protectedData.graphics.filter(g =>
                        g.attributes.ntatype === 0 && g.attributes.BoroCode === boroCode
                    );
                }
                async function loadBoroSummary() {
                    const tbody=document.getElementById("boroSummaryBody");
                    tbody.innerHTML=`<tr><td colspan="4" class="sb-placeholder">Loading…</td></tr>`;
                    try {
                        const rows=await Promise.all(metricLayers.map(async item=>{
                            const feats=await fetchBoroFeatures(item.boroCode);
                            const counts=feats.map(f=>Number(getFirstAttr(f.attributes,["incarcerations_count_final","incarceration_count","incarcerations_count"])||0)).filter(v=>!isNaN(v)&&v>=0);
                            const total=counts.reduce((a,b)=>a+b,0);
                            return { boroCode:item.boroCode, ntaCount:feats.length, total, avg:feats.length?total/feats.length:0 };
                        }));
                        tbody.innerHTML="";
                        let gN=0,gT=0;
                        rows.forEach(r=>{
                            gN+=r.ntaCount; gT+=r.total;
                            const tr=document.createElement("tr");
                            tr.innerHTML=`<td>${BORO_NAMES[r.boroCode]}</td><td>${r.ntaCount}</td><td>${r.total.toLocaleString()}</td><td>${Math.round(r.avg).toLocaleString()}</td>`;
                            tbody.appendChild(tr);
                        });
                        const gt=document.createElement("tr"); gt.className="grand-row";
                        gt.innerHTML=`<td><strong>Total / NYC</strong></td><td><strong>${gN}</strong></td><td><strong>${gT.toLocaleString()}</strong></td><td><strong>${Math.round(gT/gN).toLocaleString()}</strong></td>`;
                        tbody.appendChild(gt);
                    } catch(e) { tbody.innerHTML=`<tr><td colspan="4" class="sb-placeholder">Error: ${e.message}</td></tr>`; }
                }
                let _ntaSortDesc = { ALL: true, BORO: true };
                let _ntaItemsCache = { ALL: [], BORO: [] };
                async function loadTop10(boroCode, metricKey) {
                    metricKey = metricKey || "incarcerations_per10k";
                    const isCitywide = (boroCode === "ALL");
                    const scopeKey   = isCitywide ? "ALL" : "BORO";
                    const listId     = isCitywide ? "allTop10List" : "boroTop10List";
                    const el         = document.getElementById(listId); if (!el) return;
                    el.innerHTML = `<li class="top10-item"><span class="sb-placeholder">Loading…</span></li>`;
                    clearTop10Highlights();
                    const cfg   = TOP10_METRICS[metricKey] || TOP10_METRICS["incarcerations_per10k"];
                    const field = (!isCitywide && cfg.boroField) ? cfg.boroField : metricKey;
                    try {
                        let allItems = protectedData.graphics.map(g => g.attributes);
                        allItems = allItems.filter(a => Number(a.ntatype ?? 1) === 0);
                        if (!isCitywide) allItems = allItems.filter(a => String(a.BoroCode) === String(boroCode));
                        _ntaItemsCache[scopeKey] = { items: allItems, field, cfg, boroCode, metricKey };
                        _ntaSortDesc[scopeKey] = true;
                        _renderNtaList(scopeKey, isCitywide);
                        const labelEl = document.getElementById(isCitywide ? "allTop10Label" : "boroTop10Label");
                        if (labelEl) {
                            const prefix = isCitywide ? "All NTAs - Citywide" : `All NTAs - ${BORO_NAMES[boroCode] || ""}`;
                            labelEl.textContent = `${prefix} - ${cfg.label}`;
                        }
                    } catch(e) {
                        el.innerHTML = `<li class="top10-item"><span class="sb-placeholder">Error: ${e.message}</span></li>`;
                        console.error("[loadTop10] fetch failed:", e);
                    }
                }


// ======================================================================
// 🔍 MODULE 6: SEARCH & TOP 10 LISTS
// ======================================================================
                function _renderNtaList(scopeKey, isCitywide) {
                    const cached  = _ntaItemsCache[scopeKey]; if (!cached) return;
                    const { items, field, cfg, boroCode } = cached;
                    const listId  = isCitywide ? "allTop10List" : "boroTop10List";
                    const el      = document.getElementById(listId); if (!el) return;
                    const sortDesc = _ntaSortDesc[scopeKey];
                    const sorted = [...items].sort((a, b) => {
                        const av = Number(a[field] ?? 0), bv = Number(b[field] ?? 0);
                        return sortDesc ? bv - av : av - bv;
                    });
                    top10NTACodes    = sorted.map(a => String(a.NTA2020 || "").trim());
                    top10AllFeatures = sorted;
                    el.innerHTML = "";
                    sorted.forEach((attrs, i) => {
                        const name    = attrs.NTAName || "Unknown NTA";
                        const val     = Number(attrs[field] ?? NaN);
                        const bc      = attrs.BoroCode || "";
                        const boro    = isCitywide ? (BORO_NAMES[bc] || "") : "";
                        const ntaCode = String(attrs.NTA2020 || "").trim();
                        const li = document.createElement("li");
                        li.className = "top10-item";
                        li.dataset.ntaCode = ntaCode;
                        li.innerHTML = `
          <span class="top10-rank">#${i + 1}</span>
          <span class="top10-name">${name}${boro ? ` <span class="top10-boro">${boro}</span>` : ""}</span>
          <span class="top10-val">${isNaN(val) ? "-" : val.toFixed(cfg.decimals)}</span>
        `;
                        li.addEventListener("click", () => onTop10ItemClick(attrs, boroCode, li, ntaCode));
                        el.appendChild(li);
                    });
                }
                function toggleNtaSort(scopeToken) {
                    const boroCode  = (scopeToken === 'BORO') ? activeBoroCode : 'ALL';
                    const isCitywide = (boroCode === "ALL");
                    const scopeKey  = isCitywide ? "ALL" : "BORO";
                    const btnId     = isCitywide ? "allHighlightBtn" : "boroHighlightBtn";
                    const btn       = document.getElementById(btnId);
                    _ntaSortDesc[scopeKey] = !_ntaSortDesc[scopeKey];
                    const sortDesc = _ntaSortDesc[scopeKey];
                    if (btn) {
                        const iconEl = btn.querySelector(".btn-icon");
                        const textEl = btn.querySelector(".btn-text");
                        if (iconEl) iconEl.innerHTML = sortDesc ? ICON_SORT_DOWN : ICON_SORT_UP;
                        if (textEl) textEl.textContent = sortDesc ? "Sort" : "Sort";
                        btn.classList.toggle("active", !sortDesc);
                    }
                    _renderNtaList(scopeKey, isCitywide);
                }
                function onTop10MetricChange(boroCodeToken) {
                    const boroCode = (boroCodeToken === 'BORO') ? activeBoroCode : boroCodeToken;
                    const selectId = (boroCode === "ALL") ? "allTop10Metric" : "boroTop10Metric";
                    const sel = document.getElementById(selectId);
                    if (!sel) return;
                    const scopeKey = (boroCode === "ALL") ? "ALL" : "BORO";
                    const btnId    = (boroCode === "ALL") ? "allHighlightBtn" : "boroHighlightBtn";
                    const btn      = document.getElementById(btnId);
                    if (btn) {
                        const iconEl = btn.querySelector(".btn-icon");
                        if (iconEl) iconEl.innerHTML = ICON_SORT_DOWN;
                        btn.classList.remove("active");
                    }
                    loadTop10(boroCode, sel.value);
                }
                let _top10LastClickedCode = null; // tracks which NTA is currently selected from list
                function clearSelectionHighlights() {
                    if (highlightHandle)     { try { highlightHandle.remove(); }     catch(_){} highlightHandle = null; }
                    if (top10SelectedHandle) { try { top10SelectedHandle.remove(); } catch(_){} top10SelectedHandle = null; }
                    document.querySelectorAll(".top10-item.is-selected").forEach(el => el.classList.remove("is-selected"));
                    _top10LastClickedCode = null;
                }
                async function onTop10ItemClick(attrs, boroCode, liEl, ntaCode) {
                    if (_top10LastClickedCode === ntaCode) {
                        if (top10SelectedHandle) { top10SelectedHandle.remove(); top10SelectedHandle = null; }
                        liEl.classList.remove("is-selected");
                        _top10LastClickedCode = null;
                        unlockNTA();
                        return;
                    }
                    if (top10SelectedHandle) { top10SelectedHandle.remove(); top10SelectedHandle = null; }
                    document.querySelectorAll(".top10-item.is-selected").forEach(el => el.classList.remove("is-selected"));
                    liEl.classList.add("is-selected");
                    _top10LastClickedCode = ntaCode;
                    updateFromAttrs(attrs, boroCode);
                    isLocked = true; lockedAttrs = attrs; lockedBoroCode = boroCode;
                    setLockUI(true);
                    const layer = (boroCode === "ALL") ? citywideLayer : boroughLayer;
                    const lv    = (boroCode === "ALL") ? layerViewsByBoro.get("ALL") : layerViewsByBoro.get("BOROUGH");
                    if (lv) {
                        try {
                            const q = layer.createQuery();
                            q.where = `NTA2020 = '${ntaCode}'`;
                            q.returnGeometry = true;
                            q.outFields = ["NTA2020", "OBJECTID"];
                            const res = await lv.queryFeatures(q);
                            console.log(`[onTop10ItemClick] NTA=${ntaCode} lv features=${res.features.length}`);
                            if (res.features.length) {
                                if (highlightHandle) { highlightHandle.remove(); highlightHandle = null; }
                                const objectIds = res.features.map(f => f.attributes.OBJECTID || f.getObjectId());
                                top10SelectedHandle = lv.highlight(objectIds);
                            }
                        } catch(e) { console.warn("[onTop10ItemClick] highlight failed:", e); }
                    }
                }
                async function toggleTop10Highlight(boroCode) {
                    const btnId = (boroCode === "ALL") ? "allHighlightBtn" : "boroHighlightBtn";
                    const btn   = document.getElementById(btnId);
                    if (top10HighlightActive && top10HighlightBoroCode === boroCode) {
                        clearTop10Highlights();
                        return;
                    }
                    clearTop10Highlights();
                    top10HighlightActive   = true;
                    top10HighlightBoroCode = boroCode;
                    if (btn) {
                        btn.classList.add("active");
                        const iconEl = btn.querySelector(".btn-icon");
                        const textEl = btn.querySelector(".btn-text");
                        if (iconEl) iconEl.innerHTML = ICON_X;
                        if (textEl) textEl.textContent = "Clear";
                    }
                    if (!top10NTACodes.length) {
                        console.warn("[toggleTop10Highlight] top10NTACodes empty");
                        return;
                    }
                    const layer = (boroCode === "ALL") ? citywideLayer : boroughLayer;
                    const lv    = (boroCode === "ALL") ? layerViewsByBoro.get("ALL") : layerViewsByBoro.get("BOROUGH");
                    if (!lv) { console.warn("[toggleTop10Highlight] layerView not ready"); return; }
                    console.log("[toggleTop10Highlight] NTA codes:", top10NTACodes);
                    try {
                        const q = layer.createQuery();
                        q.where = `NTA2020 IN (${top10NTACodes.map(c => `'${c}'`).join(",")})`;
                        q.returnGeometry = true;
                        q.outFields = ["NTA2020", "OBJECTID"];
                        let features = [];
                        try {
                            const lvRes = await lv.queryFeatures(q);
                            features = lvRes.features;
                            console.log("[toggleTop10Highlight] lv.queryFeatures returned:", features.length);
                        } catch(e) {
                            console.warn("[toggleTop10Highlight] lv.queryFeatures failed, falling back to layer:", e);
                        }
                        if (!features.length) {
                            const layerRes = await layer.queryFeatures(q);
                            features = layerRes.features;
                            console.log("[toggleTop10Highlight] layer.queryFeatures returned:", features.length);
                        }
                        if (features.length) {
                            const objectIds = features.map(f => f.attributes.OBJECTID || f.getObjectId());
                            console.log("[toggleTop10Highlight] Highlighting objectIds:", objectIds);
                            const handle = lv.highlight(objectIds);
                            top10HighlightHandles.push(handle);
                            document.querySelectorAll(".top10-item[data-nta-code]")
                                .forEach(li => li.classList.add("is-highlighted"));
                            console.log("[toggleTop10Highlight] Highlight applied successfully");
                        } else {
                            console.warn("[toggleTop10Highlight] 0 features from both lv and layer queries");
                        }
                    } catch(e) {
                        console.error("[toggleTop10Highlight] Error:", e);
                    }
                }
                function clearTop10Highlights() {
                    top10HighlightHandles.forEach(h => h.remove());
                    top10HighlightHandles = [];
                    top10HighlightActive  = false;
                    if (top10SelectedHandle) { top10SelectedHandle.remove(); top10SelectedHandle = null; }
                    _top10LastClickedCode = null;
                    document.querySelectorAll(".top10-item.is-highlighted, .top10-item.is-selected")
                        .forEach(el => { el.classList.remove("is-highlighted", "is-selected"); });
                    ["allHighlightBtn", "boroHighlightBtn"].forEach(id => {
                        const btn = document.getElementById(id); if (!btn) return;
                        btn.classList.remove("active");
                        const iconEl = btn.querySelector(".btn-icon");
                        const textEl = btn.querySelector(".btn-text");
                        if (iconEl) iconEl.innerHTML = ICON_SORT_DOWN;
                        if (textEl) textEl.textContent = "Sort";
                    });
                }
                let _ntaSearchCache = []; // [{ NTAName, NTA2020, BoroCode, boroname, ntatype, ... }]
                let _ntaSearchActiveIdx = -1; // for keyboard nav
                async function refreshNtaSearchCache() {
                    try {
                        let items = protectedData.graphics.map(g => g.attributes);
                        items = items.filter(a => Number(a.ntatype ?? 1) === 0);
                        if (activeBoroCode !== "ALL") items = items.filter(a => String(a.BoroCode) === activeBoroCode);
                        _ntaSearchCache = items;
                        console.log(_ntaSearchCache)
                    } catch(e) {
                        console.warn("[ntaSearch] refresh cache failed:", e);
                        _ntaSearchCache = [];
                    }
                }
                function _highlightMatch(text, query) {
                    if (!query) return text;
                    const lcText = text.toLowerCase(), lcQ = query.toLowerCase();
                    const i = lcText.indexOf(lcQ);
                    if (i < 0) return text;
                    return text.slice(0,i) + `<mark>${text.slice(i, i+query.length)}</mark>` + text.slice(i+query.length);
                }
                function performNtaSearch(query) {
                    const resultsEl = document.getElementById("ntaSearchResults");
                    const clearBtn  = document.getElementById("ntaSearchClear");
                    query = (query || "").trim();
                    clearBtn.classList.toggle("visible", query.length > 0);
                    if (!query) {
                        resultsEl.classList.remove("visible");
                        resultsEl.innerHTML = "";
                        _ntaSearchActiveIdx = -1;
                        return;
                    }
                    const lcQ = query.toLowerCase();
                    const matches = _ntaSearchCache
                        .filter(a => (a.NTAName || "").toLowerCase().includes(lcQ))
                        .slice(0, 12); // cap results to keep UI tidy
                    if (matches.length === 0) {
                        resultsEl.innerHTML = `<div class="nta-search-empty">No NTAs found for "${query}"</div>`;
                        resultsEl.classList.add("visible");
                        _ntaSearchActiveIdx = -1;
                        return;
                    }
                    resultsEl.innerHTML = matches.map((a, i) => {
                        const boroName = BORO_NAMES[a.BoroCode] || a.boroname || "";
                        const showBoro = activeBoroCode === "ALL" && boroName;
                        return `
          <div class="nta-search-result" data-nta="${a.NTA2020}" data-idx="${i}">
            ${_highlightMatch(a.NTAName || "Unknown NTA", query)}
            ${showBoro ? `<span class="nta-search-boro">${boroName}</span>` : ""}
          </div>`;
                    }).join("");
                    resultsEl.classList.add("visible");
                    _ntaSearchActiveIdx = -1;
                    resultsEl.querySelectorAll(".nta-search-result").forEach(el => {
                        el.addEventListener("mousedown", e => {
                            e.preventDefault(); // prevent input blur before click fires
                            selectSearchResult(el.dataset.nta);
                        });
                    });
                }
                async function selectSearchResult(ntaCode) {
                    const lv = activeBoroCode === "ALL"
                        ? layerViewsByBoro.get("ALL")
                        : layerViewsByBoro.get("BOROUGH");
                    let feat = null;
                    let canHighlight = false;
                    if (lv) {
                        try {
                            const q = lv.layer.createQuery();
                            q.where = `NTA2020 = '${ntaCode}'`;
                            q.outFields = ["*"];
                            q.returnGeometry = false;
                            q.num = 1;
                            const r = await lv.queryFeatures(q);
                            if (r.features && r.features[0]) {
                                feat = r.features[0];
                                canHighlight = true;
                                const match = protectedData.graphics.find(g => g.attributes.NTA2020 === ntaCode);
                                if (match) feat.attributes = { ...feat.attributes, ...match.attributes };
                            }
                        } catch(e) { console.warn("[ntaSearch] layerView query failed:", e); }
                    }
                    if (!feat) {
                        try {
                            const match = protectedData.graphics.find(g => g.attributes.NTA2020 === ntaCode);
                            if (match) {
                                feat = { attributes: match.attributes };
                            }
                        } catch(e) { console.warn("[ntaSearch] local data fallback failed:", e); }
                    }
                    if (!feat) return;
                    if (compareMode) {
                        assignToCompareSlot(feat.attributes, activeBoroCode);
                        const input = document.getElementById("ntaSearchInput");
                        const resultsEl = document.getElementById("ntaSearchResults");
                        input.value = "";
                        resultsEl.classList.remove("visible");
                        document.getElementById("ntaSearchClear").classList.remove("visible");
                        input.blur();
                        return;
                    }
                    clearSelectionHighlights();   // Change 2: drop any prior selection (map/search/rankings)
                    if (canHighlight && lv) highlightHandle = lv.highlight(feat);
                    isLocked = true;
                    lockedAttrs = feat.attributes;
                    lockedBoroCode = activeBoroCode;
                    lastHoveredKey = null;
                    setLockUI(true);
                    updateFromAttrs(feat.attributes, activeBoroCode);
                    const indicatorsTabActive = document.getElementById("tabPane-indicators")?.classList.contains("active");
                    if (indicatorsTabActive) {
                        document.getElementById("sidebar").scrollTo({ top: 0, behavior: "smooth" });
                    }
                    const input = document.getElementById("ntaSearchInput");
                    const resultsEl = document.getElementById("ntaSearchResults");
                    input.value = feat.attributes.NTAName || "";
                    resultsEl.classList.remove("visible");
                    document.getElementById("ntaSearchClear").classList.add("visible");
                    input.blur();
                }
                function initNtaSearch() {
                    const input    = document.getElementById("ntaSearchInput");
                    const clearBtn = document.getElementById("ntaSearchClear");
                    const results  = document.getElementById("ntaSearchResults");
                    if (!input || !clearBtn || !results) return;
                    input.addEventListener("input", () => performNtaSearch(input.value));
                    input.addEventListener("focus", () => {
                        if (input.value.trim()) performNtaSearch(input.value);
                    });
                    clearBtn.addEventListener("click", () => {
                        input.value = "";
                        clearBtn.classList.remove("visible");
                        results.classList.remove("visible");
                        results.innerHTML = "";
                        input.focus();
                    });
                    input.addEventListener("keydown", e => {
                        const items = results.querySelectorAll(".nta-search-result");
                        if (!items.length) {
                            if (e.key === "Escape") input.blur();
                            return;
                        }
                        if (e.key === "ArrowDown") {
                            e.preventDefault();
                            _ntaSearchActiveIdx = Math.min(items.length - 1, _ntaSearchActiveIdx + 1);
                        } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            _ntaSearchActiveIdx = Math.max(0, _ntaSearchActiveIdx - 1);
                        } else if (e.key === "Enter") {
                            e.preventDefault();
                            const target = _ntaSearchActiveIdx >= 0 ? items[_ntaSearchActiveIdx] : items[0];
                            if (target) selectSearchResult(target.dataset.nta);
                            return;
                        } else if (e.key === "Escape") {
                            results.classList.remove("visible");
                            input.blur();
                            return;
                        } else {
                            return;
                        }
                        items.forEach(el => el.classList.remove("active"));
                        if (items[_ntaSearchActiveIdx]) {
                            items[_ntaSearchActiveIdx].classList.add("active");
                            items[_ntaSearchActiveIdx].scrollIntoView({ block: "nearest" });
                        }
                    });
                    document.addEventListener("click", e => {
                        if (!document.getElementById("ntaSearchWrap").contains(e.target)) {
                            results.classList.remove("visible");
                        }
                    });
                }

                function _boroNameOf(bc) {
                    const map = { "1":"Manhattan","2":"Bronx","3":"Brooklyn","4":"Queens","5":"Staten Island" };
                    return map[bc] || "";
                }
                function _wbInfoFromAttrs(attrs) {
                    const isCitywide = (activeBoroCode === "ALL");
                    const tier  = isCitywide ? (attrs.WBS_city_tier ?? null) : (attrs.WBS_borough_tier ?? null);
                    const score = isCitywide ? (attrs.WBS_city ?? null)      : (attrs.WBS_borough ?? null);
                    let cls = "", label = "-";
                    if (tier === 1 || tier === "1" || /above/i.test(String(tier))) { cls = "wb-above"; label = "Above Avg"; }
                    else if (tier === 0 || tier === "0" || /close/i.test(String(tier))) { cls = "wb-close"; label = "Near the Avg"; }
                    else if (tier === -1 || tier === "-1" || /below/i.test(String(tier))) { cls = "wb-below"; label = "Below Avg"; }
                    const scoreText = (score !== null && !isNaN(score)) ? Number(score).toFixed(1) : "-";
                    return { cls, label, scoreText };
                }


// ======================================================================
// ⚖️ MODULE 5: COMPARE MODE ENGINE
// ======================================================================
                function toggleCompareMode() {
                    if (compareMode) {
                        exitCompareMode();
                    } else {
                        enterCompareMode();
                    }
                }
                function enterCompareMode() {
                    compareMode = true;
                    document.body.classList.add("compare-active");
                    if (isLocked && lockedAttrs) {
                        compareNta1 = { attrs: lockedAttrs, boroCode: lockedBoroCode || activeBoroCode };
                        if (highlightHandle) { highlightHandle.remove(); highlightHandle = null; }
                        isLocked = false; lockedAttrs = null; lockedBoroCode = null;
                        setLockUI(false);
                    }
                    compareNta2 = null;
                    const btn = document.getElementById("compareToggleBtn");
                    if (btn) {
                        btn.classList.add("active");
                        btn.querySelector(".compare-text").textContent = "Exit Comparison";
                    }
                    ensureCompareRowsExist();
                    updateCompareScopeBanner();
                    renderCompareSlots();
                    renderCompareIndicators();
                    drawCompareGraphics();
                }
                function exitCompareMode() {
                    compareMode = false;
                    compareNta1 = null;
                    compareNta2 = null;
                    forceClearCompareGraphics();   // hard clear + forced repaint (fixes orphan rings)
                    document.body.classList.remove("compare-active");
                    const btn = document.getElementById("compareToggleBtn");
                    if (btn) {
                        btn.classList.remove("active");
                        btn.querySelector(".compare-text").textContent = "Compare NTAs";
                    }
                    renderCompareSlots();
                    clearDashboard();
                }
                function assignToCompareSlot(attrs, boroCode) {
                    if (!attrs || !attrs.NTA2020) return;
                    const code = String(attrs.NTA2020).trim();
                    if (activeBoroCode !== "ALL" && String(attrs.BoroCode) !== String(activeBoroCode)) {
                        flashCompareBanner(`Only NTAs in ${_boroNameOf(activeBoroCode)} can be picked while that borough filter is active.`);
                        return;
                    }
                    if (compareNta1 && String(compareNta1.attrs.NTA2020).trim() === code) {
                        compareNta1 = null;
                    } else if (compareNta2 && String(compareNta2.attrs.NTA2020).trim() === code) {
                        compareNta2 = null;
                    } else if (!compareNta1) {
                        compareNta1 = { attrs, boroCode: boroCode || activeBoroCode };
                    } else if (!compareNta2) {
                        compareNta2 = { attrs, boroCode: boroCode || activeBoroCode };
                    } else {
                        compareNta1 = compareNta2;
                        compareNta2 = { attrs, boroCode: boroCode || activeBoroCode };
                    }
                    renderCompareSlots();
                    renderCompareIndicators();
                    drawCompareGraphics();
                }
                function removeFromCompareSlot(slotNum) {
                    if (slotNum === 1) compareNta1 = null;
                    else if (slotNum === 2) compareNta2 = null;
                    renderCompareSlots();
                    renderCompareIndicators();
                    drawCompareGraphics();
                }
                const COMPARE_DOMAINS = [
                    { label: "Incarceration",        key: "general", ids: ["incarceration_count", "incarcerations_normalized"] },
                    { label: "Health",               key: "health",  ids: ["health_index"] },
                    { label: "Education",            key: "edu",     ids: ["education_index"] },
                    { label: "Economic Security",    key: "econ",    ids: ["poverty_pct"] },
                    { label: "Housing",              key: "housing", ids: ["housing_per10k"] },
                    { label: "Civic Infrastructure", key: "civic",   ids: ["sanitation_noise_per10k"] },
                ];
                const _indLabelCache = {};
                function _getIndLabel(id) {
                    if (_indLabelCache[id]) return _indLabelCache[id];
                    const card = document.getElementById(`card-${id}`);
                    const lbl = card ? card.querySelector(".ind-label") : null;
                    const text = lbl ? lbl.textContent.trim() : id;
                    _indLabelCache[id] = text;
                    return text;
                }
                function ensureCompareRowsExist() { /* table is fully built by renderCompareTable */ }
                const _domainInfoCache = {};
                function _getDomainInfoHTML(key) {
                    if (key in _domainInfoCache) return _domainInfoCache[key];
                    const hdr = document.querySelector(`.domain-header.d-${key}`);
                    const panel = hdr ? hdr.nextElementSibling : null;
                    const html = (panel && panel.classList.contains("domain-info-panel")) ? panel.innerHTML : "";
                    _domainInfoCache[key] = html;
                    return html;
                }
                function _compareDeltaHTML(val, avg, higherIsBad) {
                    const v = Number(val), a = Number(avg);
                    if (isNaN(v) || isNaN(a) || a === 0) return "";
                    const diffPct = ((v - a) / a) * 100;
                    const arrow = diffPct >= 0 ? ICON_UP : ICON_DOWN;
                    const sign  = diffPct >= 0 ? "+" : "-";
                    const cls   = diffPct === 0 ? "delta-neutral"
                        : higherIsBad ? (diffPct > 0 ? "delta-above" : "delta-below")
                            : (diffPct > 0 ? "delta-above-good" : "delta-below-good");
                    return ` <span class="cmp-delta ${cls}">${arrow} ${sign}${Math.abs(diffPct).toFixed(1)}%</span>`;
                }
                function _compareHeaderCell(slotNum, slot) {
                    const colCls = slotNum === 1 ? "col-1" : "col-2";
                    if (!slot || !slot.attrs) {
                        const msg = slotNum === 1
                            ? "Click a map NTA or search to pick NTA #1"
                            : "Pick NTA #2 to compare";
                        return `<div class="cmp-th ${colCls} empty">
          <div class="cmp-th-empty"><span class="empty-icon">📍</span><span>${msg}</span></div>
        </div>`;
                    }
                    const a = slot.attrs;
                    const wb = _wbInfoFromAttrs(a);
                    const boro = _boroNameOf(a.BoroCode);
                    return `<div class="cmp-th ${colCls}">
        <button class="cmp-th-remove" onclick="removeFromCompareSlot(${slotNum})" title="Remove NTA #${slotNum}">${ICON_X}</button>
        <div class="cmp-th-name-row">
          <span class="cmp-th-dot"></span>
          <span class="cmp-th-name">${a.NTAName || "Unknown NTA"}</span>
        </div>
        <div class="cmp-th-meta">${a.NTA2020 || ""}${boro ? " · " + boro : ""}</div>
        <div class="cmp-th-wb">
          <span class="cmp-th-wb-val">${wb.scoreText}</span>
          ${wb.cls ? `<span class="cmp-th-wb-tag ${wb.cls}">${wb.label}</span>` : ""}
        </div>
      </div>`;
                }
                function _compareValueCell(d, slotNum, slot) {
                    const colCls = slotNum === 1 ? "col-1" : "col-2";
                    if (!slot || !slot.attrs) {
                        return `<div class="cmp-ind-col col-empty">
          <div class="cmp-ind-empty">Pick NTA #${slotNum}</div>
        </div>`;
                    }
                    const attrs = slot.attrs;
                    const v = getFirstAttr(attrs, d.keys);
                    const valStr = (v !== null && v !== undefined && !isNaN(v))
                        ? fmt(Number(v), d.decimals, d.suffix, d.useThousands) : "-";
                    if (d.id === "incarceration_count") {
                        const popRaw = getFirstAttr(attrs, ["total_civilian_noninstitutionalized_population"]);
                        const popStr = (popRaw !== null && popRaw !== undefined && !isNaN(popRaw))
                            ? Number(popRaw).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "-";
                        return `<div class="cmp-ind-col ${colCls}">
          <div class="cmp-ind-val">${valStr}</div>
          <div class="cmp-ind-avg">
            <span class="avg-line"><span class="avg-label">Population:</span> ${popStr}</span>
          </div>
        </div>`;
                    }
                    const cityV = d.cityAvgCol ? attrs[d.cityAvgCol] : null;
                    const boroV = d.boroAvgCol ? attrs[d.boroAvgCol] : null;
                    const cityStr = (cityV !== null && cityV !== undefined && !isNaN(cityV))
                        ? fmt(Number(cityV), d.decimalsAvg ?? d.decimals, d.suffix, d.useThousands) : "-";
                    const boroStr = (boroV !== null && boroV !== undefined && !isNaN(boroV))
                        ? fmt(Number(boroV), d.decimalsAvg ?? d.decimals, d.suffix, d.useThousands) : "-";
                    const cityDelta = _compareDeltaHTML(v, cityV, d.higherIsBad) || ' <span class="cmp-delta delta-neutral">-</span>';
                    const boroDelta = _compareDeltaHTML(v, boroV, d.higherIsBad) || ' <span class="cmp-delta delta-neutral">-</span>';
                    return `<div class="cmp-ind-col ${colCls}">
         <div class="cmp-ind-val">${valStr}</div>
        <div class="cmp-ind-avg">
           <span class="avg-line"><span class="avg-label">City Avg:</span> ${cityStr}</span>
           <span class="avg-line"><span class="avg-label">vs City Avg:</span>${cityDelta}</span>
           <span class="avg-line avg-secondary"><span class="avg-label">Boro Avg:</span> ${boroStr}</span>
           <span class="avg-line avg-secondary"><span class="avg-label">vs Boro Avg:</span>${boroDelta}</span>
         </div>
       </div>`;
                }
                function renderCompareTable() {
                    const tbl = document.getElementById("compareTable");
                    if (!tbl) return;
                    const metricById = {};
                    METRIC_DEFS.forEach(d => { metricById[d.id] = d; });
                    let html = "";
                    html += `<div class="cmp-thead">
        ${_compareHeaderCell(1, compareNta1)}
        ${_compareHeaderCell(2, compareNta2)}
      </div>`;
                    COMPARE_DOMAINS.forEach(dom => {
                        const info = _getDomainInfoHTML(dom.key);
                        const infoIcon = info
                            ? `<span class="cmp-domain-info-icon" tabindex="0" aria-label="Indicator description">i<div class="cmp-domain-info-tooltip">${info}</div></span>`
                            : "";
                        html += `<div class="cmp-domain-row"><span class="dlabel">${dom.label}</span>${infoIcon}</div>`;
                        dom.ids.forEach(id => {
                            const d = metricById[id];
                            if (!d) return;
                            html += `<div class="cmp-ind-row">
            <div class="cmp-ind-label">${_getIndLabel(id)}</div>
            <div class="cmp-ind-cols">
              ${_compareValueCell(d, 1, compareNta1)}
              ${_compareValueCell(d, 2, compareNta2)}
            </div>
          </div>`;
                        });
                    });
                    tbl.innerHTML = html;
                    const topbar = document.querySelector("#compareSlotsWrap .compare-table-topbar");
                    const thead  = tbl.querySelector(".cmp-thead");
                    if (topbar && thead) {
                        const h = topbar.offsetHeight;
                        if (h) thead.style.top = h + "px";
                    }
                }
                function renderCompareSlots() { renderCompareTable(); }
                function renderCompareIndicators() { renderCompareTable(); }
                function clearCompareGraphics() {
                    compareDrawSeq++;          // invalidate any in-flight _drawSlotGraphic fetches
                    compareLayer.removeAll();
                    compareGraphics.clear();
                }
                function forceClearCompareGraphics() {
                    clearCompareGraphics();                 // token bump + removeAll (synchronous)
                    try {
                        compareLayer.visible = false;         // instantly drop any lingering paint
                        requestAnimationFrame(() => {
                            if (!compareMode) { compareLayer.removeAll(); compareGraphics.clear(); }
                            compareLayer.visible = true;
                        });
                    } catch (_) { compareLayer.visible = true; }
                }
                async function drawCompareGraphics() {
                    clearCompareGraphics();
                    if (!compareMode) return;
                    const seq = compareDrawSeq;    // this draw "owns" the current generation
                    if (compareNta1) await _drawSlotGraphic(1, compareNta1, seq);
                    if (compareNta2) await _drawSlotGraphic(2, compareNta2, seq);
                }
                async function _drawSlotGraphic(slotNum, slot, seq) {
                    const code = slot.attrs.NTA2020;
                    try {
                        const match = protectedData.graphics.find(g => g.attributes.NTA2020 === code);
                        if (!match || !match.geometry) return;
                        if (seq !== compareDrawSeq || !compareMode) return;
                        const rings = match.geometry.rings;
                        const ringColor = slotNum === 1 ? [37,99,235] : [234,88,12]; // blue / orange
                        const polyGraphic = new Graphic({
                            geometry: {
                                type: "polygon",
                                rings: rings,
                                spatialReference: { wkid: 4326 }
                            },
                            symbol: {
                                type: "simple-fill",
                                color: [0, 0, 0, 0],   // transparent fill — only the outline matters
                                outline: {
                                    color: ringColor,
                                    width: 2.5
                                }
                            }
                        });
                        compareLayer.add(polyGraphic);
                        const centroid = _polygonCentroid(rings);
                        if (centroid) {
                            const pt = new Point({ longitude: centroid[0], latitude: centroid[1], spatialReference: { wkid: 4326 } });
                            const badgeGraphic = new Graphic({
                                geometry: pt,
                                symbol: {
                                    type: "text",
                                    color: "#ffffff",
                                    haloColor: ringColor,
                                    haloSize: 8,
                                    text: String(slotNum),
                                    font: { size: 14, weight: "bold", family: "DM Sans" }
                                }
                            });
                            compareLayer.add(badgeGraphic);
                            compareGraphics.set(slotNum, { poly: polyGraphic, badge: badgeGraphic });
                        }
                    } catch(e) {
                        console.warn("[compare] drawSlotGraphic failed for", code, e);
                    }
                }
                function _polygonCentroid(rings) {
                    if (!rings || !rings.length) return null;
                    let largest = rings[0];
                    rings.forEach(r => { if (r.length > largest.length) largest = r; });
                    let sx = 0, sy = 0, n = 0;
                    largest.forEach(([x, y]) => { sx += x; sy += y; n++; });
                    if (!n) return null;
                    return [sx / n, sy / n];
                }
                function updateCompareScopeBanner() {
                    const banner = document.getElementById("compareScopeBanner");
                    if (!banner) return;
                    if (activeBoroCode !== "ALL") {
                        banner.textContent = `Borough filter active - you can only compare NTAs within ${_boroNameOf(activeBoroCode)}.`;
                        banner.classList.add("visible");
                    } else {
                        banner.textContent = "";
                        banner.classList.remove("visible");
                    }
                }
                function flashCompareBanner(msg) {
                    const banner = document.getElementById("compareScopeBanner");
                    if (!banner) return;
                    const old = banner.textContent;
                    banner.textContent = msg;
                    banner.classList.add("visible");
                    clearTimeout(banner._flashTimer);
                    banner._flashTimer = setTimeout(() => {
                        if (activeBoroCode !== "ALL") {
                            banner.textContent = `Borough filter active - you can only compare NTAs within ${_boroNameOf(activeBoroCode)}.`;
                            banner.classList.add("visible");
                        } else {
                            banner.classList.remove("visible");
                        }
                    }, 2500);
                }
                function pruneCompareSlotsForBorough() {
                    if (!compareMode) return;
                    if (activeBoroCode === "ALL") return; // no restriction
                    if (compareNta1 && String(compareNta1.attrs.BoroCode) !== String(activeBoroCode)) compareNta1 = null;
                    if (compareNta2 && String(compareNta2.attrs.BoroCode) !== String(activeBoroCode)) compareNta2 = null;
                    renderCompareSlots();
                    renderCompareIndicators();
                    drawCompareGraphics();
                }
                window.toggleCompareMode = toggleCompareMode;
                window.removeFromCompareSlot = removeFromCompareSlot;
                document.addEventListener("keydown", e => {
                    if (e.key === "Escape" && compareMode) {
                        exitCompareMode();
                    }
                });
                view.on("click", async event => {
                    const mp=view.toMap({x:event.x,y:event.y}); if(!mp) return;
                    const lv = activeBoroCode === "ALL"
                        ? layerViewsByBoro.get("ALL")
                        : layerViewsByBoro.get("BOROUGH");
                    if (!lv) { if(isLocked) unlockNTA(); hideTooltip(); return; }
                    const q=lv.layer.createQuery(); q.geometry=mp; q.spatialRelationship="intersects"; q.returnGeometry=false; q.outFields=["*"]; q.num=1;
                    const r=await lv.queryFeatures(q);
                    const feat=r.features[0];
                    if (!feat) {
                        if (!compareMode && isLocked) unlockNTA();
                        hideTooltip();
                        return;
                    }
                    const effectiveBC = activeBoroCode;
                    if (compareMode) {
                        assignToCompareSlot(feat.attributes, effectiveBC);
                        return;
                    }
                    clearSelectionHighlights();   // Change 2: drop any prior selection (map/search/rankings)
                    highlightHandle=lv.highlight(feat);
                    isLocked=true; lockedAttrs=feat.attributes; lockedBoroCode=effectiveBC; lastHoveredKey=null;
                    setLockUI(true); updateFromAttrs(feat.attributes, effectiveBC);
                    const indicatorsTabActive = document.getElementById("tabPane-indicators")?.classList.contains("active");
                    if (indicatorsTabActive) {
                        document.getElementById("sidebar").scrollTo({ top: 0, behavior: "smooth" });
                    }
                });
                async function handleHover(event) {
                    const mp = view.toMap({ x: event.x, y: event.y });
                    if (!mp) return;
                    const activeLv = activeBoroCode === "ALL"
                        ? layerViewsByBoro.get("ALL")
                        : layerViewsByBoro.get("BOROUGH");
                    const mainQuery = activeLv ? (async () => {
                        const q = activeLv.layer.createQuery();
                        q.geometry = mp; q.spatialRelationship = "intersects";
                        q.returnGeometry = false; q.outFields = ["*"]; q.num = 1;
                        const r = await activeLv.queryFeatures(q);
                        return r.features[0] ? { feat: r.features[0], boroCode: activeBoroCode, isNR: false } : null;
                    })() : Promise.resolve(null);
                    const nrQueries = nonResLayerViews.map(async lv => {
                        const q = lv.layer.createQuery();
                        q.geometry = mp; q.spatialRelationship = "intersects";
                        q.returnGeometry = false; q.outFields = ["*"]; q.num = 1;
                        const r = await lv.queryFeatures(q);
                        if (!r.features[0]) return null;
                        const feat = r.features[0];
                        if (activeBoroCode !== "ALL") {
                            const featBoroCode = String(feat.attributes.BoroCode || "").trim();
                            if (featBoroCode !== activeBoroCode) return null;
                        }
                        return { feat, boroCode: null, isNR: true };
                    });
                    let results;
                    try {
                        results = await Promise.all([mainQuery, ...nrQueries]);
                    } catch(e) {
                        results = [];
                    }
                    const nrHit   = results.find(r => r && r.isNR);
                    const mainHit = results.find(r => r && !r.isNR);
                    if (nrHit) {
                        showNRTooltip(event, nrHit.feat.attributes);
                        if (!isLocked) showNonResInCard(nrHit.feat.attributes);
                        return;
                    }
                    if (!mainHit) {
                        if (lastHoveredKey !== null) clearDashboard();
                        hideTooltip();
                        return;
                    }
                    const { feat } = mainHit;
                    const localData = protectedData.graphics.find(g => g.attributes.NTA2020 === feat.attributes.NTA2020);
                    if (localData) {
                        feat.attributes = { ...feat.attributes, ...localData.attributes };
                    }
                    const attrs = feat.attributes;
                    const hoverKey = getFirstAttr(attrs, ["NTA2020","NTAName"]);
                    if (!hoverKey) { clearDashboard(); hideTooltip(); return; }
                    const normKey = String(hoverKey).trim().toUpperCase();
                    const effectiveBC = activeBoroCode;
                    tooltipNR.style.display    = "none";
                    tooltipNR.style.visibility = "hidden";
                    showTooltip(event, attrs, effectiveBC);
                    if (isLocked) return;
                    if (compareMode) return; // compare slots drive indicator content, not hover
                    if (normKey === lastHoveredKey) return;
                    lastHoveredKey = normKey;
                    updateFromAttrs(attrs, effectiveBC);
                }
                view.when(async () => {
                    try {
                        const cwlv = await view.whenLayerView(citywideLayer);
                        layerViewsByBoro.set("ALL", cwlv);
                    } catch(e) { console.warn("citywideLayerView failed:", e); }
                    try {
                        const blv = await view.whenLayerView(boroughLayer);
                        layerViewsByBoro.set("BOROUGH", blv);
                    } catch(e) { console.warn("boroughLayerView failed:", e); }
                    for (const nrLayer of nonResLayers) {
                        try {
                            const lv = await view.whenLayerView(nrLayer);
                            nonResLayerViews.push(lv);
                            nrLayer.visible = true;
                        } catch(e) { console.warn("NR layer view failed:", e); }
                    }
                    applyVisibility(activeBoroCode);
                    try { await zoomTo("ALL", { animate:false }); }
                    catch(e) { console.warn("initial city fit failed:", e); }
                    await applyDynamicBreaks(citywideLayer);
                    await applyDynamicBreaks(boroughLayer);
                    await preloadAverages();
                    await buildRankCache();
                    updateWbCategoryRanges("ALL");
                    fillAvgSubsections("ALL", null);
                    await loadTop10("ALL", "incarcerations_per10k");
                    initNtaSearch();
                    await refreshNtaSearchCache();
                });


// ======================================================================
// 🖱️ MODULE 4: CORE INTERACTIVITY (HOVER & CLICK)
// ======================================================================
                view.on("pointer-move", event => {
                    if (hoverTimer) clearTimeout(hoverTimer);
                    hoverTimer=setTimeout(()=>handleHover(event).catch(()=>{}), 12);
                });
                view.on("pointer-leave", () => {
                    if (hoverTimer) clearTimeout(hoverTimer);
                    hideTooltip();
                    if (!isLocked) clearDashboard();
                });
                document.getElementById("boroughFilter").addEventListener("change", e => {
                    setBoroughFilter(e.target.value).catch(console.error);
                });

                document.querySelectorAll(".boro-pill").forEach(btn => {
                    btn.addEventListener("click", () => {
                        document.querySelectorAll(".boro-pill").forEach(b => b.classList.remove("active"));
                        btn.classList.add("active");
                        const sel = document.getElementById("boroughFilter");
                        if (sel) {
                            sel.value = btn.dataset.boro || btn.getAttribute("data-boro");
                            sel.dispatchEvent(new Event("change"));
                        }
                    });
                });

                const activeWbCategories = new Set();
                const WB_CAT_OUTLINE = {
                    above: { color:[22,163,74,1.0],  width:0.8 },  // green
                    close: { color:[245,158,11,1.0], width:0.8 },  // amber
                    below: { color:[220,38,38,1.0],  width:0.8 },  // red
                    nr:    { color:[161,98,7,1.0],   width:0.8 }   // dark yellow/brown
                };
                const WB_CAT_TIER = {
                    above: "Above Average",
                    close: "Close to Average",
                    below: "Below Average"
                };

                async function refreshWbCategoryFilter() {
                    if (!activeWbCategories.size) { forceClearWbCategoryGraphics(); return; }
                    wbCategoryLayer.visible = true;
                    wbGreyLayer.visible = true;
                    wbCategoryLayer.removeAll();
                    wbGreyLayer.removeAll();
                    const isCitywide = (activeBoroCode === "ALL");
                    const tierField = isCitywide ? "WBS_city_tier" : "WBS_borough_tier";
                    const tierCats = [...activeWbCategories].filter(c => c !== "nr");
                    const includeNR = activeWbCategories.has("nr");
                    const boroClause = isCitywide ? "" : ` AND BoroCode = '${activeBoroCode}'`;
                    const queries = [];
                    if (tierCats.length) {
                        const tierValues = tierCats.map(c => `'${WB_CAT_TIER[c]}'`).join(",");
                        const where = `ntatype = 0 AND ${tierField} IN (${tierValues})${boroClause}`;
                        queries.push({ where, catKey: null, perFeatureCat: true, isGreyOut: false });
                    }
                    if (includeNR) {
                        const where = `ntatype <> 0${boroClause}`;
                        queries.push({ where, catKey: "nr", perFeatureCat: false, isGreyOut: false });
                    }
                    if (tierCats.length) {
                        const tierValues = tierCats.map(c => `'${WB_CAT_TIER[c]}'`).join(",");
                        const where = `ntatype = 0 AND ${tierField} NOT IN (${tierValues})${boroClause}`;
                        queries.push({ where, catKey: null, perFeatureCat: false, isGreyOut: true });
                    } else if (includeNR) {
                        const where = `ntatype = 0${boroClause}`;
                        queries.push({ where, catKey: null, perFeatureCat: false, isGreyOut: true });
                    }
                    if (!includeNR) {
                        const where = `ntatype <> 0${boroClause}`;
                        queries.push({ where, catKey: null, perFeatureCat: false, isGreyOut: true });
                    }
                    try {
                        await Promise.all(queries.map(async qDef => {
                            const q = citywideLayer.createQuery();
                            q.where = qDef.where;
                            q.outFields = ["NTA2020", tierField];
                            q.returnGeometry = true;
                            q.outSpatialReference = view.spatialReference;
                            const res = await citywideLayer.queryFeatures(q);
                            res.features.forEach(f => {
                                if (!f.geometry) return;
                                if (qDef.isGreyOut) {
                                    const greyGraphic = new Graphic({
                                        geometry: f.geometry,
                                        symbol: {
                                            type: "simple-fill",
                                            color: [240,240,240,0.95],
                                            outline: { color:[140,140,140,0.4], width:0.3 }
                                        }
                                    });
                                    wbGreyLayer.add(greyGraphic);
                                    return;
                                }
                                let catKey = qDef.catKey;
                                if (qDef.perFeatureCat) {
                                    const tier = (f.attributes[tierField] || "").toString().trim();
                                    if (tier === "Above Average") catKey = "above";
                                    else if (tier === "Close to Average") catKey = "close";
                                    else if (tier === "Below Average") catKey = "below";
                                }
                                if (!catKey) return;
                                const outline = WB_CAT_OUTLINE[catKey];
                                if (!outline) return;
                                const graphic = new Graphic({
                                    geometry: f.geometry,
                                    symbol: {
                                        type: "simple-fill",
                                        color: [0,0,0,0],         // transparent fill
                                        outline: { color: outline.color, width: outline.width }
                                    }
                                });
                                wbCategoryLayer.add(graphic);
                            });
                        }));
                    } catch(e) {
                        console.warn("[refreshWbCategoryFilter] failed:", e);
                    }
                }
                function forceClearWbCategoryGraphics() {
                    wbCategoryLayer.removeAll();
                    wbGreyLayer.removeAll();
                    try {
                        wbCategoryLayer.visible = false;
                        wbGreyLayer.visible = false;
                        requestAnimationFrame(() => {
                            if (!activeWbCategories.size) {
                                wbCategoryLayer.removeAll();
                                wbGreyLayer.removeAll();
                            }
                            wbCategoryLayer.visible = true;
                            wbGreyLayer.visible = true;
                        });
                    } catch (_) {
                        wbCategoryLayer.visible = true;
                        wbGreyLayer.visible = true;
                    }
                }


                async function setChoroMetric(isWB) {
                    activeChoroMetric = isWB ? "wellbeing" : "incarceration";
                    const optInc = document.getElementById("choroOptIncarceration");
                    const optWB  = document.getElementById("choroOptWellbeing");
                    if (optInc) {
                        optInc.classList.toggle("selected-incarceration", !isWB);
                    }
                    if (optWB) {
                        optWB.classList.toggle("selected-wellbeing", isWB);
                    }
                    clearWbCategoryFilter();
                    const layer = (activeBoroCode === "ALL") ? citywideLayer : boroughLayer;
                    await applyDynamicBreaks(layer);
                }

                function clearAllSelections() {
                    const safe = (label, fn) => {
                        try { fn(); } catch (e) { console.warn("[clearAll] step failed:", label, e); }
                    };
                    safe("compare", () => {
                        if (compareMode) exitCompareMode();   // exitCompareMode hard-clears already
                        forceClearCompareGraphics();          // also covers the compare-already-off case
                    });
                    safe("wbCategory", () => clearWbCategoryFilter());
                    safe("top10", () => { if (typeof clearTop10Highlights === "function") clearTop10Highlights(); });
                    safe("unlock", () => { if (isLocked) unlockNTA(); else clearDashboard(); });
                    safe("handles", () => {
                        if (highlightHandle)     { highlightHandle.remove();     highlightHandle = null; }
                        if (top10SelectedHandle) { top10SelectedHandle.remove(); top10SelectedHandle = null; }
                        if (Array.isArray(top10HighlightHandles)) {
                            top10HighlightHandles.forEach(h => { try { h.remove(); } catch(_){} });
                            top10HighlightHandles = [];
                        }
                        isLocked = false; lockedAttrs = null; lockedBoroCode = null; lastHoveredKey = null;
                    });
                    safe("boroUI", () => {
                        document.querySelectorAll(".boro-pill").forEach(b =>
                            b.classList.toggle("active", (b.dataset.boro || b.getAttribute("data-boro")) === "ALL"));
                        const sel = document.getElementById("boroughFilter");
                        if (sel) sel.value = "ALL";
                    });
                    safe("top10Metric", () => {
                        ["allTop10Metric", "boroTop10Metric"].forEach(id => {
                            const s = document.getElementById(id);
                            if (s) s.value = "incarcerations_per10k";
                        });
                    });
                    safe("choroMetric", () => { activeChoroMetric = "incarceration"; });
                    safe("search", () => {
                        const si = document.getElementById("ntaSearchInput");
                        const sc = document.getElementById("ntaSearchClear");
                        const sr = document.getElementById("ntaSearchResults");
                        if (si) si.value = "";
                        if (sc) sc.classList.remove("visible");
                        if (sr) { sr.classList.remove("visible"); sr.innerHTML = ""; }
                    });
                    safe("citywide", () => {
                        Promise.resolve(setBoroughFilter("ALL"))
                            .then(() => { try { fillAvgSubsections("ALL", null); } catch(_){} })
                            .catch(e => console.warn("[clearAll] setBoroughFilter failed:", e));
                    });
                }

                function switchSidebarTab(tabName) {
                    document.querySelectorAll(".sb-tab").forEach(btn => {
                        btn.classList.toggle("active", btn.dataset.tab === tabName);
                    });
                    document.querySelectorAll(".sb-tab-pane").forEach(pane => {
                        pane.classList.toggle("active", pane.id === `tabPane-${tabName}`);
                    });
                }

                function clearWbCategoryFilter() {
                    activeWbCategories.clear();
                    document.querySelectorAll(".map-wb-cat-row.active").forEach(el => el.classList.remove("active"));
                    forceClearWbCategoryGraphics();
                }

                async function toggleWbCategoryFilter(cat) {
                    const row = document.querySelector(`.map-wb-cat-row[data-cat="${cat}"]`);
                    if (activeWbCategories.has(cat)) {
                        activeWbCategories.delete(cat);
                        if (row) row.classList.remove("active");
                    } else {
                        activeWbCategories.add(cat);
                        if (row) row.classList.add("active");
                    }
                    await refreshWbCategoryFilter();
                }

                function updateWbCategoryRanges(boroCode) {
                    const r = WB_RANGE_TABLE[boroCode] || WB_RANGE_TABLE["ALL"];
                    const elAbove = document.getElementById("wbRangeAbove");
                    const elClose = document.getElementById("wbRangeClose");
                    const elBelow = document.getElementById("wbRangeBelow");
                    if (elAbove) elAbove.textContent = r.above;
                    if (elClose) elClose.textContent = r.close;
                    if (elBelow) elBelow.textContent = r.below;
                    const scopeWord = (boroCode === "ALL") ? "NYC" : "Borough";
                    const scAbove = document.getElementById("wbScopeAbove");
                    const scClose = document.getElementById("wbScopeClose");
                    const scBelow = document.getElementById("wbScopeBelow");
                    if (scAbove) scAbove.textContent = scopeWord;
                    if (scClose) scClose.textContent = scopeWord;
                    if (scBelow) scBelow.textContent = scopeWord;
                    const scIntro = document.getElementById("wbScopeIntro");
                    if (scIntro) scIntro.textContent = scopeWord;
                }

                async function setBoroughFilter(boroCode) {
                    activeBoroCode = boroCode;
                    unlockNTA();
                    clearTop10Highlights();
                    applyVisibility(boroCode);
                    const searchInput = document.getElementById("ntaSearchInput");
                    const searchClear = document.getElementById("ntaSearchClear");
                    const searchResults = document.getElementById("ntaSearchResults");
                    if (searchInput) searchInput.value = "";
                    if (searchClear) searchClear.classList.remove("visible");
                    if (searchResults) { searchResults.classList.remove("visible"); searchResults.innerHTML = ""; }
                    await refreshNtaSearchCache();
                    const allSec  = document.getElementById("allBoroSection");
                    const boroSec = document.getElementById("boroTop10Section");
                    const lbl     = document.getElementById("boroTop10Label");
                    ["lr0","lr1","lr2"].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.textContent = "-";
                    });
                    const getMetric = (id) => { const s = document.getElementById(id); return s ? s.value : "incarcerations_per10k"; };
                    if (boroCode === "ALL") {
                        allSec.style.display = "block";
                        boroSec.style.display = "none";
                        await applyDynamicBreaks(citywideLayer);
                        await loadTop10("ALL", getMetric("allTop10Metric"));
                    } else {
                        allSec.style.display = "none";
                        boroSec.style.display = "block";
                        await applyDynamicBreaks(boroughLayer);
                        await loadTop10(boroCode, getMetric("boroTop10Metric"));
                    }
                    await refreshWbCategoryFilter();
                    updateWbCategoryRanges(boroCode);
                    try { await zoomTo(boroCode); } catch(err) { console.warn("zoomTo failed:", err); }
                    if (compareMode) {
                        pruneCompareSlotsForBorough();
                        updateCompareScopeBanner();
                        drawCompareGraphics();
                    }
                }


// ======================================================================
// 🚪 MODULE 7: PUBLIC EXPORTS (WINDOW)
// ======================================================================
                window.onTop10MetricChange  = onTop10MetricChange;
                window.toggleTop10Highlight = toggleTop10Highlight;
                window.toggleDomain         = toggleDomain;
                window.toggleTop10          = toggleTop10;
                window.setBoroughFilter     = setBoroughFilter;
                window.unlockNTA            = unlockNTA;
                window.setChoroMetric       = setChoroMetric;
                window.clearAllSelections   = clearAllSelections;
                window.switchSidebarTab     = switchSidebarTab;
                window.toggleWbCategoryFilter = toggleWbCategoryFilter;
                window.toggleNtaSort        = toggleNtaSort;
                Object.defineProperty(window, 'activeBoroCode', { get: () => activeBoroCode });
                window.__view          = view;
                window.__citywideLayer = citywideLayer;
                window.__boroughLayer  = boroughLayer;
                document.getElementById("unlockBtn").addEventListener("click", e => {
                    e.stopPropagation(); unlockNTA();
                });
            } catch (err) {
                console.error("REQUIRE BLOCK ERROR:", err);
            }
        })();
    });
(function positionInfoPanels() {
    const indSection = document.getElementById("indicatorsSection");
    if (!indSection) return;
    document.querySelectorAll(".domain-header").forEach(header => {
        header.addEventListener("mouseenter", () => {
            const panel = header.nextElementSibling;
            if (!panel || !panel.classList.contains("domain-info-panel")) return;
            const indRect     = indSection.getBoundingClientRect();
            const sectionEl   = header.closest(".domain-section");
            const sectionRect = sectionEl.getBoundingClientRect();
            const offsetLeft = sectionRect.left - indRect.left;
            panel.style.left  = `-${offsetLeft}px`;
            panel.style.right = "auto";
            panel.style.width = `${indRect.width}px`;
        });
    });
})();
