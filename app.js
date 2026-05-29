/* 陀螺配置卡片產生器 — 純前端、無後端；圖庫資料走本機 bundle（BeyDB） */

// ===== 名次設定 =====
const RANKS = {
  "1": { accent: "#E10600", line1: "1ST", line2: "PLACE" },
  "2": { accent: "#1455C0", line1: "2ND", line2: "PLACE" },
  "3": { accent: "#1A9E3E", line1: "3RD", line2: "PLACE" },
  "4": { accent: "#7A3FD4", line1: "4TH", line2: "PLACE" },
};

// ===== 零件定義（每顆陀螺）=====
const PART_DEFS = [
  { key: "blade",   label: "上蓋", placeholder: "例：隕星龍騎士" },
  { key: "ratchet", label: "固鎖", placeholder: "例：8-70" },
  { key: "bit",     label: "軸心", placeholder: "例：L" },
];

const BEY_COUNT = 3;

// ===== 匯出尺寸（寬固定 1080）=====
const SIZES = {
  ig:     { h: 1350, label: "IG 4:5" },
  story:  { h: 1920, label: "限動 9:16" },
  square: { h: 1080, label: "方形 1:1" },
};

// ===== 常用零件字典（自動補全；非 DB，可自行增補）=====
const DICT = {
  blade:   ["隕星龍騎士", "蒼穹龍騎士", "時鐘幻象", "帝王爆擊", "霜輝銀狼", "鳳凰飛翼", "蒼龍爆刃"],
  ratchet: ["1-50", "3-60", "5-60", "7-55", "7-70", "8-70", "9-60", "H7-60"],
  bit:     ["L", "LO", "LR", "E", "H", "K", "R", "FB", "UN", "O", "N"],
};

// ===== 狀態 =====
const state = {
  rank: "1",
  size: "ig",
  shape: "full",
  beys: Array.from({ length: BEY_COUNT }, () => ({
    blade: { name: "", img: null },
    ratchet: { name: "", img: null },
    bit: { name: "", img: null },
  })),
};

// ===== DOM 參考 =====
const $ = (id) => document.getElementById(id);
const card = $("card");
const stage = $("stage");

// ===== 動態建立陀螺控制項與預覽列 =====
function buildBeyControls() {
  const wrap = $("beyControls");
  const rows = $("rows");
  wrap.innerHTML = "";
  rows.innerHTML = "";

  for (let i = 0; i < BEY_COUNT; i++) {
    // --- 左側控制 block ---
    const block = document.createElement("details");
    block.className = "group bey-block";
    block.open = true;
    block.innerHTML = `
      <summary>陀螺 ${i + 1}</summary>
      <div class="bey-row-fields">
        ${PART_DEFS.map(
          (p) => `<label>${p.label}
            <input type="text" list="dl-${p.key}" data-bey="${i}" data-part="${p.key}" data-kind="name" placeholder="${p.placeholder}" />
          </label>`
        ).join("")}
      </div>
      <div class="bey-row-files">
        ${PART_DEFS.map(
          (p) => `<label>${p.label}圖
            <input type="file" accept="image/*" data-bey="${i}" data-part="${p.key}" data-kind="img" />
          </label>`
        ).join("")}
      </div>
      <div class="preview-name" id="cn-${i}">合併名稱：（待輸入）</div>
    `;
    wrap.appendChild(block);

    // --- 卡片預覽列 ---
    const row = document.createElement("div");
    row.className = "bey-row";
    row.innerHTML = `
      ${PART_DEFS.map(
        (p) => `<div class="part part-${p.key}">
          <img id="img-${i}-${p.key}" alt="" />
          <span class="ph" id="ph-${i}-${p.key}">${p.label}</span>
        </div>`
      ).join("")}
      <div class="bey-name" id="name-${i}"></div>
    `;
    rows.appendChild(row);
  }
}

// ===== 使用者自訂字典（存 localStorage，與內建合併）=====
const DICT_KEY = "beyblade-dict-v1";
let customDict = { blade: [], ratchet: [], bit: [] };

function loadCustomDict() {
  try {
    const d = JSON.parse(localStorage.getItem(DICT_KEY));
    if (d) ["blade", "ratchet", "bit"].forEach((k) => { customDict[k] = Array.isArray(d[k]) ? d[k] : []; });
  } catch {}
}
function saveCustomDict() {
  try { localStorage.setItem(DICT_KEY, JSON.stringify(customDict)); } catch {}
}
function mergedDict(key) {
  const seen = new Set();
  return [...DICT[key], ...customDict[key]].filter((v) => v && !seen.has(v) && seen.add(v));
}
function addDictTerm(key, term) {
  term = (term || "").trim();
  if (!term || customDict[key].includes(term) || DICT[key].includes(term)) return false;
  customDict[key].push(term);
  saveCustomDict();
  return true;
}
function removeDictTerm(key, term) {
  customDict[key] = customDict[key].filter((v) => v !== term);
  saveCustomDict();
}

// ===== 填入自動補全字典（內建 + 自訂）=====
function populateDatalists() {
  Object.keys(DICT).forEach((key) => {
    const dl = $(`dl-${key}`);
    if (!dl) return;
    dl.innerHTML = mergedDict(key).map((v) => `<option value="${v}"></option>`).join("");
  });
}

// ===== 字典管理 UI =====
function renderDictManager() {
  const wrap = $("dictManager");
  if (!wrap) return;
  wrap.innerHTML = PART_DEFS.map((p) => `
    <div class="dict-part" data-key="${p.key}">
      <h4>${p.label}</h4>
      <div class="dict-add">
        <input type="text" placeholder="新增${p.label}名稱" data-dict-input="${p.key}" />
        <button type="button" data-dict-add="${p.key}">加入</button>
      </div>
      <div class="dict-chips">
        ${DICT[p.key].map((v) => `<span class="chip builtin" title="內建">${v}</span>`).join("")}
        ${customDict[p.key].map((v) => `<span class="chip">${v}<button type="button" data-dict-rm="${p.key}" data-term="${v}" title="移除">✕</button></span>`).join("")}
      </div>
    </div>
  `).join("");
}

// ===== 套用零件圖外框 =====
function applyShape() {
  card.dataset.shape = state.shape || "full";
}

// ===== 拖放上傳：把圖拖到任一上傳欄位 =====
function enableDrops() {
  document.querySelectorAll(".controls label").forEach((label) => {
    const fileInput = label.querySelector('input[type="file"]');
    if (!fileInput || label.dataset.dropBound) return;
    label.dataset.dropBound = "1";
    label.classList.add("dropzone");
    label.addEventListener("dragover", (e) => { e.preventDefault(); label.classList.add("dragover"); });
    label.addEventListener("dragleave", () => label.classList.remove("dragover"));
    label.addEventListener("drop", (e) => {
      e.preventDefault();
      label.classList.remove("dragover");
      const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith("image/"));
      if (!f) return;
      try {
        const dt = new DataTransfer();
        dt.items.add(f);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true })); // 沿用既有 change 處理
      } catch (err) {
        console.warn("拖放設定 input 失敗：", err.message);
      }
    });
  });
}

// ===== 套用匯出尺寸 =====
function applySize() {
  const s = SIZES[state.size] || SIZES.ig;
  document.documentElement.style.setProperty("--card-h", s.h + "px");
  fitStage();
}

// ===== 合併名稱 =====
function combinedName(bey) {
  return (bey.blade.name + bey.ratchet.name + bey.bit.name).trim();
}

function renderBeyName(i) {
  const bey = state.beys[i];
  const name = combinedName(bey);
  $(`name-${i}`).textContent = name;
  $(`cn-${i}`).textContent = "合併名稱：" + (name || "（待輸入）");
}

// ===== 套用名次配色與文字 =====
function applyRank() {
  const r = RANKS[state.rank];
  card.style.setProperty("--accent", r.accent);
  document.documentElement.style.setProperty("--accent", r.accent);
  $("rankLine1").textContent = r.line1;
  $("rankLine2").textContent = r.line2;
}

// ===== 圖片上傳：File -> 自動縮放/壓縮 -> dataURL =====
const MAX_EDGE = 1400;   // 長邊上限（卡片 2x 匯出綽綽有餘）

// 把過大的圖縮到合理尺寸；PNG 保留透明（去背零件用），其餘壓成 JPEG 省空間
function downscaleImage(dataUrl, maxEdge, mime, cb) {
  const img = new Image();
  img.onload = () => {
    const longEdge = Math.max(img.width, img.height);
    const scale = maxEdge / longEdge;
    if (scale >= 1) { cb(dataUrl); return; }   // 已夠小，原圖返回（不放大）
    const cw = Math.round(img.width * scale);
    const ch = Math.round(img.height * scale);
    const c = document.createElement("canvas");
    c.width = cw; c.height = ch;
    c.getContext("2d").drawImage(img, 0, 0, cw, ch);
    const isPng = (mime || "").includes("png");
    try {
      cb(isPng ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85));
    } catch { cb(dataUrl); }
  };
  img.onerror = () => cb(dataUrl);
  img.src = dataUrl;
}

function readImage(file, cb) {
  const reader = new FileReader();
  reader.onload = (e) => downscaleImage(e.target.result, MAX_EDGE, file.type, cb);
  reader.readAsDataURL(file);
}

function setImg(imgEl, phEl, dataUrl) {
  if (dataUrl) {
    imgEl.src = dataUrl;
    imgEl.style.display = "block";
    if (phEl) phEl.style.display = "none";
  } else {
    imgEl.removeAttribute("src");
    imgEl.style.display = "none";
    if (phEl) phEl.style.display = "flex";
  }
}

function imgSrc(i, part) {
  const el = $(`img-${i}-${part}`);
  return el && el.style.display !== "none" ? el.getAttribute("src") || "" : "";
}
function nameInput(i, part) {
  return document.querySelector(`input[data-bey="${i}"][data-part="${part}"][data-kind="name"]`);
}

// ===== 多卡模型 + localStorage 暫存 =====
const STORAGE_KEY = "beyblade-card-v1";
let cards = [];     // 每張卡的完整資料
let active = 0;     // 目前編輯的卡 index

// 部件資料形狀（v3）：在原本 {name,img} 之上，新增圖庫選取的中繼資料。
//   source: "gallery"（從圖庫選）| "upload"（自訂上傳）| ""（未填）
//   key:    圖庫的 DB key（例 "DrSt" / "7-70" / "L"），自訂上傳為 ""
//   group:  系統別 BX/UX/CX（圖庫帶入），自訂上傳為 ""
// 舊卡片只有 {name,img} 也能載入（normalizePart 會補齊欄位），不會壞資料。
function blankPart() {
  return { source: "", key: "", group: "", name: "", img: "" };
}
function normalizePart(p) {
  p = p || {};
  return {
    source: p.source || (p.img ? "upload" : ""), // 舊資料有圖必為自訂上傳
    key: p.key || "",
    group: p.group || "",
    name: p.name || "",
    img: p.img || "",
  };
}

function blankCard(rank) {
  return {
    title: "", rank: rank || "1", size: "ig", shape: "full",
    logo: "HANIK TRACK", nick: "", watermark: "高雄漢諡",
    person: "", bg: "",
    beys: [0, 1, 2].map(() => ({
      blade: blankPart(), ratchet: blankPart(), bit: blankPart(),
    })),
  };
}

// 從畫面讀出目前卡片資料（不含 title）
// 名稱/圖片來自 DOM；圖庫中繼資料(source/key/group)畫面上不存放，
// 故從現有 in-memory 卡片沿用，避免存檔時把圖庫選取資訊抹掉。
function readCardFromDOM() {
  const parts = ["blade", "ratchet", "bit"];
  const prev = cards[active] || blankCard();
  return {
    rank: $("rankSelect").value,
    size: $("sizeSelect").value,
    shape: $("shapeSelect").value,
    logo: $("logoInput").value,
    nick: $("nickInput").value,
    watermark: $("watermarkInput").value,
    person: ($("personImg").style.display !== "none" && $("personImg").getAttribute("src")) || "",
    bg: $("panelBg").style.backgroundImage || "",
    beys: [0, 1, 2].map((i) => {
      const o = {};
      const prevBey = (prev.beys && prev.beys[i]) || {};
      parts.forEach((p) => {
        const meta = normalizePart(prevBey[p]);
        const img = imgSrc(i, p);
        o[p] = {
          source: meta.source || (img ? "upload" : ""),
          key: meta.key,
          group: meta.group,
          name: nameInput(i, p)?.value || "",
          img,
        };
      });
      return o;
    }),
  };
}

// 把一張卡的資料寫進畫面
function loadCardToDOM(c) {
  c = c || blankCard();
  $("rankSelect").value = c.rank || "1"; state.rank = c.rank || "1";
  $("sizeSelect").value = c.size || "ig"; state.size = c.size || "ig";
  $("shapeSelect").value = c.shape || "full"; state.shape = c.shape || "full";
  $("logoInput").value = c.logo ?? ""; $("logoText").textContent = c.logo ?? "";
  $("nickInput").value = c.nick || ""; $("rankNick").textContent = c.nick || "";
  $("watermarkInput").value = c.watermark ?? "高雄漢諡"; $("watermarkText").textContent = c.watermark ?? "高雄漢諡";
  setImg($("personImg"), null, c.person || "");
  $("panelBg").style.backgroundImage = c.bg || "";
  const parts = ["blade", "ratchet", "bit"];
  (c.beys || []).forEach((b, i) => {
    if (i >= BEY_COUNT) return;
    parts.forEach((p) => {
      const cell = (b && b[p]) || { name: "", img: "" };
      state.beys[i][p].name = cell.name || "";
      const inp = nameInput(i, p); if (inp) inp.value = cell.name || "";
      setImg($(`img-${i}-${p}`), $(`ph-${i}-${p}`), cell.img || "");
    });
    renderBeyName(i);
  });
  applyRank(); applySize(); applyShape();
}

// 把一張卡的部件補齊 v3 欄位（舊資料相容）
function normalizeCard(c) {
  c = c || blankCard();
  const parts = ["blade", "ratchet", "bit"];
  c.beys = (c.beys || []).map((b) => {
    const o = {};
    parts.forEach((p) => { o[p] = normalizePart(b && b[p]); });
    return o;
  });
  while (c.beys.length < BEY_COUNT) c.beys.push({ blade: blankPart(), ratchet: blankPart(), bit: blankPart() });
  return c;
}

function saveState() {
  try {
    if (cards.length) cards[active] = { ...cards[active], ...readCardFromDOM() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 3, active, cards }));
  } catch (e) {
    console.warn("暫存失敗（可能超出容量）：", e.message);
  }
}

function restoreState() {
  let snap;
  try { snap = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return false; }
  if (!snap) return false;
  if ((snap.v === 2 || snap.v === 3) && Array.isArray(snap.cards)) {
    cards = snap.cards.length ? snap.cards : [blankCard()];
    active = Math.min(Math.max(snap.active || 0, 0), cards.length - 1);
  } else {
    cards = [{ ...blankCard(), ...snap }];   // v1 單卡格式 → 包成一張
    active = 0;
  }
  cards = cards.map(normalizeCard);          // 補齊新欄位，舊資料不會壞
  loadCardToDOM(cards[active]);
  renderTabs();
  return true;
}

function clearState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ===== 分頁 UI =====
function tabLabel(c, i) {
  return (c.title && c.title.trim()) || (RANKS[c.rank] ? RANKS[c.rank].line1 : "卡片" + (i + 1));
}
let dragFrom = null;   // 拖曳排序起點

function renderTabs() {
  const wrap = $("cardTabs");
  wrap.innerHTML = "";
  cards.forEach((c, i) => {
    const tab = document.createElement("div");
    tab.className = "tab" + (i === active ? " active" : "");
    tab.draggable = true;
    tab.innerHTML =
      `<span class="tab-label" title="點擊切換／雙擊改名">${tabLabel(c, i)}</span>` +
      (cards.length > 1 ? `<button class="tab-del" title="刪除">✕</button>` : "");
    tab.querySelector(".tab-label").addEventListener("click", () => switchCard(i));
    tab.querySelector(".tab-label").addEventListener("dblclick", () => renameCard(i));
    const del = tab.querySelector(".tab-del");
    if (del) del.addEventListener("click", (e) => { e.stopPropagation(); deleteCard(i); });
    // 拖曳排序
    tab.addEventListener("dragstart", () => { dragFrom = i; tab.classList.add("dragging"); });
    tab.addEventListener("dragend", () => tab.classList.remove("dragging"));
    tab.addEventListener("dragover", (e) => e.preventDefault());
    tab.addEventListener("drop", (e) => { e.preventDefault(); reorderCards(dragFrom, i); });
    wrap.appendChild(tab);
  });
  const add = document.createElement("button");
  add.className = "tab-add";
  add.textContent = "＋ 新增卡片";
  add.addEventListener("click", addCard);
  wrap.appendChild(add);
}

function reorderCards(from, to) {
  if (from == null || from === to || from < 0 || to < 0) return;
  cards[active] = { ...cards[active], ...readCardFromDOM() };
  const activeCard = cards[active];
  const [moved] = cards.splice(from, 1);
  cards.splice(to, 0, moved);
  active = cards.indexOf(activeCard);   // active 跟著它指向的那張卡
  renderTabs();
  saveState();
}

function duplicateCard() {
  cards[active] = { ...cards[active], ...readCardFromDOM() };
  const copy = JSON.parse(JSON.stringify(cards[active]));
  copy.title = (cards[active].title ? cards[active].title : tabLabel(cards[active], active)) + " 複製";
  cards.splice(active + 1, 0, copy);
  active = active + 1;
  loadCardToDOM(cards[active]);
  renderTabs();
  saveState();
  fitStage();
}

function switchCard(i) {
  if (i === active) return;
  cards[active] = { ...cards[active], ...readCardFromDOM() };
  active = i;
  loadCardToDOM(cards[active]);
  renderTabs();
  saveState();
  fitStage();
}
function addCard() {
  cards[active] = { ...cards[active], ...readCardFromDOM() };
  const nextRank = String((cards.length % 4) + 1);   // 1→2→3→4 循環
  cards.push(blankCard(nextRank));
  active = cards.length - 1;
  loadCardToDOM(cards[active]);
  renderTabs();
  saveState();
  fitStage();
}
function deleteCard(i) {
  if (cards.length <= 1) return;
  if (!confirm("刪除這張卡片？")) return;
  cards.splice(i, 1);
  if (active >= cards.length) active = cards.length - 1;
  loadCardToDOM(cards[active]);
  renderTabs();
  saveState();
  fitStage();
}
function renameCard(i) {
  const t = prompt("分頁名稱（留空則用名次）", cards[i].title || "");
  if (t === null) return;
  cards[i].title = t.trim();
  renderTabs();
  saveState();
}

// ===== 事件綁定 =====
function bindEvents() {
  $("rankSelect").addEventListener("change", (e) => {
    state.rank = e.target.value;
    applyRank();
  });

  $("sizeSelect").addEventListener("change", (e) => {
    state.size = e.target.value;
    applySize();
  });

  $("shapeSelect").addEventListener("change", (e) => {
    state.shape = e.target.value;
    applyShape();
  });

  $("logoInput").addEventListener("input", (e) => {
    $("logoText").textContent = e.target.value;
  });
  $("nickInput").addEventListener("input", (e) => {
    $("rankNick").textContent = e.target.value;
  });
  $("watermarkInput").addEventListener("input", (e) => {
    $("watermarkText").textContent = e.target.value;
  });

  $("personFile").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) readImage(f, (url) => { setImg($("personImg"), null, url); saveState(); });
  });
  $("bgFile").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) readImage(f, (url) => {
      $("panelBg").style.backgroundImage = `url(${url})`;
      saveState();
    });
  });

  // 動態零件欄位（事件委派）
  $("beyControls").addEventListener("input", (e) => {
    const t = e.target;
    const i = t.dataset.bey, part = t.dataset.part, kind = t.dataset.kind;
    if (i == null || kind !== "name") return;
    state.beys[i][part].name = t.value;
    renderBeyName(i);
  });
  $("beyControls").addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.kind !== "img") return;
    const i = t.dataset.bey, part = t.dataset.part;
    const f = t.files[0];
    if (!f) return;
    readImage(f, (url) => {
      state.beys[i][part].img = url;
      setImg($(`img-${i}-${part}`), $(`ph-${i}-${part}`), url);
      saveState();
    });
  });

  $("btnDownload").addEventListener("click", downloadCard);
  $("btnDownloadAll").addEventListener("click", downloadAll);
  $("btnDuplicate").addEventListener("click", duplicateCard);
  $("btnReset").addEventListener("click", () => {
    if (confirm("確定清空全部卡片並清除暫存？")) { clearState(); location.reload(); }
  });

  // 字典管理（事件委派）
  $("dictManager").addEventListener("click", (e) => {
    const addKey = e.target.dataset.dictAdd;
    const rmKey = e.target.dataset.dictRm;
    if (addKey) {
      const input = document.querySelector(`input[data-dict-input="${addKey}"]`);
      if (addDictTerm(addKey, input.value)) { input.value = ""; renderDictManager(); populateDatalists(); }
    } else if (rmKey) {
      removeDictTerm(rmKey, e.target.dataset.term);
      renderDictManager(); populateDatalists();
    }
  });
  $("dictManager").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const key = e.target.dataset.dictInput;
    if (!key) return;
    e.preventDefault();
    if (addDictTerm(key, e.target.value)) { e.target.value = ""; renderDictManager(); populateDatalists(); }
  });

  // 任一文字/選單/檔案變動 → 自動暫存（圖片於 FileReader 回呼另存）
  $("controls").addEventListener("input", saveState);
  $("controls").addEventListener("change", saveState);
}

// ===== 預覽縮放 =====
function fitStage() {
  const area = $("previewArea");
  const cardH = (SIZES[state.size] || SIZES.ig).h;
  const availW = area.clientWidth - 4;
  // 以 stage 在視窗中的「實際頂端位置」計算可用高度，
  // 自動扣掉上方頂列/分頁列/間距，避免又矮又寬的視窗把卡片頂出畫面（爆版）
  const top = stage.getBoundingClientRect().top;
  const availH = Math.max(220, window.innerHeight - top - 20);
  const scale = Math.min(availW / 1080, availH / cardH, 1);
  stage.style.transform = `scale(${scale})`;
  stage.style.width = `${1080 * scale}px`;
  stage.style.height = `${cardH * scale}px`;
}

// ===== 下載 PNG =====
async function exportCurrentDataURL() {
  const cardH = (SIZES[state.size] || SIZES.ig).h;
  return window.htmlToImage.toPng(card, {
    pixelRatio: 2,               // 2x 高解析度
    width: 1080, height: cardH,
    cacheBust: true,
    backgroundColor: getComputedStyle(card).backgroundColor,
    // 匯出時略過：①無來源的空 img（src 會解析成頁面網址→載入失敗→reject）②編輯用的虛線提示框 .ph
    filter: (node) => {
      if (node.nodeType === 1 && node.classList && node.classList.contains("ph")) return false;
      if (node.tagName === "IMG") {
        const s = node.getAttribute("src");
        return !!s && s.length > 0;
      }
      return true;
    },
  });
}
function triggerDownload(dataUrl, filename) {
  const a = document.createElement("a");
  a.download = filename; a.href = dataUrl; a.click();
}
function cardFilename(c, i) {
  const rankName = RANKS[c.rank] ? RANKS[c.rank].line1 : "card" + (i + 1);
  const t = (c.title || "").trim().replace(/[^\w一-龥-]/g, "");
  return `beyblade-${t || rankName}-${c.size}.png`;
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function downloadCard() {
  const btn = $("btnDownload");
  btn.disabled = true; const oldText = btn.textContent; btn.textContent = "產生中…";
  try {
    if (!window.htmlToImage) throw new Error("html-to-image 未載入");
    cards[active] = { ...cards[active], ...readCardFromDOM() };
    const url = await exportCurrentDataURL();
    triggerDownload(url, cardFilename(cards[active], active));
  } catch (err) {
    alert("產生圖片失敗：" + err.message + "\n（請確認 vendor/html-to-image.js 存在或網路可載入）");
    console.error(err);
  } finally { btn.disabled = false; btn.textContent = oldText; }
}

async function downloadAll() {
  const btn = $("btnDownloadAll");
  btn.disabled = true; const oldText = btn.textContent;
  try {
    if (!window.htmlToImage) throw new Error("html-to-image 未載入");
    cards[active] = { ...cards[active], ...readCardFromDOM() };
    for (let i = 0; i < cards.length; i++) {
      btn.textContent = `匯出中 ${i + 1}/${cards.length}…`;
      loadCardToDOM(cards[i]);
      fitStage();
      await delay(80);                       // 等畫面套用
      const url = await exportCurrentDataURL();
      triggerDownload(url, cardFilename(cards[i], i));
      await delay(280);                      // 避免瀏覽器擋連續下載
    }
    loadCardToDOM(cards[active]); fitStage(); // 還原回原本選的卡
  } catch (err) {
    alert("匯出全部失敗：" + err.message);
    console.error(err);
  } finally { btn.disabled = false; btn.textContent = oldText; }
}

// ===== 初始化 =====
function init() {
  buildBeyControls();
  loadCustomDict();
  renderDictManager();
  populateDatalists();
  bindEvents();
  enableDrops();
  if (!restoreState()) {            // 沒有暫存 → 開一張空白卡
    cards = [blankCard()];
    active = 0;
    loadCardToDOM(cards[0]);
    renderTabs();
  }
  fitStage();
  window.addEventListener("resize", fitStage);
}
document.addEventListener("DOMContentLoaded", init);
