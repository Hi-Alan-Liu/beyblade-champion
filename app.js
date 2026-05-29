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
    // --- 左側控制 block：每個部件一個「圖庫選取格」+ 可編輯名稱 ---
    const block = document.createElement("details");
    block.className = "group bey-block";
    block.open = true;
    block.innerHTML = `
      <summary>陀螺 ${i + 1}</summary>
      <div class="bey-slots">
        ${PART_DEFS.map(
          (p) => `<div class="slot" data-bey="${i}" data-part="${p.key}">
            <button type="button" class="slot-pick" data-bey="${i}" data-part="${p.key}" title="從圖庫選擇${p.label}">
              <img class="slot-thumb" id="slot-img-${i}-${p.key}" alt="" />
              <span class="slot-empty" id="slot-empty-${i}-${p.key}">＋ ${p.label}</span>
            </button>
            <input type="text" class="slot-name" data-bey="${i}" data-part="${p.key}" data-kind="name" placeholder="${p.label}名稱" />
          </div>`
        ).join("")}
      </div>
      <div class="preview-name" id="cn-${i}">合併名稱：（待輸入）</div>
    `;
    wrap.appendChild(block);

    // --- 卡片預覽列：左組裝合成圖 + 右分開零件 + 名稱 ---
    const row = document.createElement("div");
    row.className = "bey-row";
    row.innerHTML = `
      <div class="bey-assembly" id="asm-${i}">
        <img class="asm-layer asm-blade"   id="comp-${i}-blade"   alt="" />
        <img class="asm-layer asm-ratchet" id="comp-${i}-ratchet" alt="" />
        <img class="asm-layer asm-bit"     id="comp-${i}-bit"     alt="" />
      </div>
      <div class="bey-parts">
        ${PART_DEFS.map(
          (p) => `<div class="part part-${p.key}">
            <img id="img-${i}-${p.key}" alt="" />
            <span class="ph" id="ph-${i}-${p.key}">${p.label}</span>
          </div>`
        ).join("")}
      </div>
      <div class="bey-name" id="name-${i}"></div>
    `;
    rows.appendChild(row);
  }
}

// ===== 選圖庫 Modal =====
// 目標格：目前正在選的 (bey, part)，及 blade 時的系統別分頁。
let galTarget = { bey: 0, part: "blade", system: null };

function createGalleryModal() {
  if ($("galleryModal")) return;
  const m = document.createElement("div");
  m.id = "galleryModal";
  m.className = "modal-overlay hidden";
  m.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h3 id="galTitle">選擇零件</h3>
        <button type="button" class="modal-close" id="galClose" title="關閉">✕</button>
      </div>
      <div class="modal-tabs" id="galTabs"></div>
      <input type="text" class="modal-search" id="galSearch" placeholder="搜尋名稱 / 代碼…" />
      <div class="modal-hint" id="galHint"></div>
      <div class="modal-grid" id="galGrid"></div>
      <div class="modal-foot">
        <label class="modal-upload">⬆ 自訂上傳
          <input type="file" accept="image/*" id="galUpload" hidden />
        </label>
        <button type="button" class="modal-clear" id="galClear">清除此格</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  $("galClose").addEventListener("click", closeGallery);
  m.addEventListener("click", (e) => { if (e.target === m) closeGallery(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("galleryModal").classList.contains("hidden")) closeGallery();
  });
  $("galSearch").addEventListener("input", renderGalleryGrid);
  $("galUpload").addEventListener("change", onGalleryUpload);
  $("galClear").addEventListener("click", () => { clearSlot(galTarget.bey, galTarget.part); closeGallery(); });
}

function partLabel(part) {
  const p = PART_DEFS.find((d) => d.key === part);
  return p ? p.label : part;
}

function openGallery(bey, part) {
  if (!BeyDB || !BeyDB.ready) { alert("圖庫尚未載入（assets/db.bundle.js）"); return; }
  galTarget = { bey: Number(bey), part, system: null };
  $("galTitle").textContent = "選擇" + partLabel(part);
  $("galSearch").value = "";
  $("galHint").textContent = "";

  // 系統別分頁：只有上蓋需要（固鎖/軸心跨系統共用，平鋪即可）
  const tabsEl = $("galTabs");
  if (part === "blade") {
    const systems = BeyDB.systems("blade"); // 例：BX, UX, other（CX 於後續步驟加入）
    galTarget.system = systems[0] || null;
    const label = (s) => (s === "other" ? "其他" : s);
    tabsEl.innerHTML = systems.map((s) => `<button type="button" class="gtab" data-sys="${s}">${label(s)}</button>`).join("");
    tabsEl.hidden = false;
    tabsEl.querySelectorAll(".gtab").forEach((b) =>
      b.addEventListener("click", () => { galTarget.system = b.dataset.sys; markActiveTab(); renderGalleryGrid(); })
    );
    markActiveTab();
  } else {
    tabsEl.innerHTML = "";
    tabsEl.hidden = true;
  }
  renderGalleryGrid();
  $("galleryModal").classList.remove("hidden");
  $("galSearch").focus();
}

function markActiveTab() {
  document.querySelectorAll("#galTabs .gtab").forEach((b) =>
    b.classList.toggle("active", b.dataset.sys === galTarget.system)
  );
}

function closeGallery() { $("galleryModal").classList.add("hidden"); }

function renderGalleryGrid() {
  const grid = $("galGrid");
  const q = $("galSearch").value;
  let items = BeyDB.search(galTarget.part, q);
  if (galTarget.part === "blade" && galTarget.system) {
    items = items.filter((e) => e.system === galTarget.system);
  }
  grid.innerHTML =
    items
      .map(
        (e) => `<button type="button" class="gitem${e.fused ? " fused" : ""}" data-key="${e.key}" title="${(e.desc || "").replace(/"/g, "&quot;")}">
          <img src="${e.img}" loading="lazy" alt="${e.name}" />
          <span class="gitem-name">${e.name}</span>
          <span class="gitem-key">${e.key}${e.fused ? " · 合體" : ""}</span>
        </button>`
      )
      .join("") || `<p class="modal-empty">查無結果</p>`;
  grid.querySelectorAll(".gitem").forEach((b) =>
    b.addEventListener("click", () => pickGalleryEntry(BeyDB.get(galTarget.part, b.dataset.key)))
  );
}

function pickGalleryEntry(entry) {
  if (!entry) return;
  const { bey, part } = galTarget;
  // 上蓋用中文顯示名；固鎖/軸心用代碼（與合併名稱「隕星龍騎士8-70L」格式一致）
  const name = part === "blade" ? entry.name : entry.key;
  setPartData(bey, part, { source: "gallery", key: entry.key, group: entry.system, name, img: entry.img });
  // fused 上蓋提示：合體型固鎖含軸心，軸心可留空
  if (part === "blade" && entry.fused) {
    $("galHint") && ($("galHint").textContent = "此為合體型上蓋（固鎖/軸心可留空）");
  }
  closeGallery();
}

function onGalleryUpload(e) {
  const f = e.target.files[0];
  if (!f) return;
  const { bey, part } = galTarget;
  const prevName = (cards[active] && cards[active].beys[bey] && cards[active].beys[bey][part] && cards[active].beys[bey][part].name) || "";
  readImage(f, (url) => {
    setPartData(bey, part, { source: "upload", key: "", group: "", name: prevName, img: url });
    closeGallery();
  });
  e.target.value = "";
}

// ===== 部件資料的單一更新入口（模型 + 畫面同步）=====
function setPartData(i, part, data) {
  const d = normalizePart(data);
  if (cards[active]) cards[active].beys[i][part] = d;
  if (state.beys[i]) state.beys[i][part] = d;
  const inp = nameInput(i, part);
  if (inp) inp.value = d.name;
  setPartImage(i, part, d.img);  // 右側分開零件 + 左側組裝合成層
  renderSlot(i, part);           // 左側控制格縮圖
  renderBeyName(i);
  saveState();
}

function clearSlot(i, part) { setPartData(i, part, blankPart()); }

// 更新左側控制格的縮圖 / 空狀態 / 名稱
function renderSlot(i, part) {
  const d = (cards[active] && cards[active].beys[i] && cards[active].beys[i][part]) ||
            (state.beys[i] && state.beys[i][part]) || blankPart();
  const thumb = $(`slot-img-${i}-${part}`);
  const empty = $(`slot-empty-${i}-${part}`);
  if (thumb) {
    if (d.img) { thumb.src = d.img; thumb.style.display = "block"; if (empty) empty.style.display = "none"; }
    else { thumb.removeAttribute("src"); thumb.style.display = "none"; if (empty) empty.style.display = "flex"; }
  }
  const inp = nameInput(i, part);
  if (inp && document.activeElement !== inp) inp.value = d.name || "";
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
  if (!imgEl) return;
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

// 同步更新某部件在卡片上的兩處呈現：右側分開零件 + 左側組裝合成層
function setPartImage(i, part, dataUrl) {
  setImg($(`img-${i}-${part}`), $(`ph-${i}-${part}`), dataUrl); // 右側分開（空時顯示提示框）
  const comp = $(`comp-${i}-${part}`);                          // 左側組裝層（空時整層隱藏，不留洞）
  if (comp) {
    if (dataUrl) { comp.src = dataUrl; comp.style.display = "block"; }
    else { comp.removeAttribute("src"); comp.style.display = "none"; }
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
      const cell = normalizePart(b && b[p]);
      state.beys[i][p] = cell;
      const inp = nameInput(i, p); if (inp) inp.value = cell.name || "";
      setPartImage(i, p, cell.img || "");
      renderSlot(i, p);
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

  // 名稱輸入（事件委派）：圖庫選取會自動帶入，使用者仍可手動覆寫
  $("beyControls").addEventListener("input", (e) => {
    const t = e.target;
    const i = t.dataset.bey, part = t.dataset.part, kind = t.dataset.kind;
    if (i == null || kind !== "name") return;
    if (state.beys[i] && state.beys[i][part]) state.beys[i][part].name = t.value;
    if (cards[active] && cards[active].beys[i] && cards[active].beys[i][part]) cards[active].beys[i][part].name = t.value;
    renderBeyName(i);
  });
  // 點圖庫格 → 開選圖庫 Modal
  $("beyControls").addEventListener("click", (e) => {
    const btn = e.target.closest(".slot-pick");
    if (!btn) return;
    openGallery(btn.dataset.bey, btn.dataset.part);
  });

  $("btnDownload").addEventListener("click", downloadCard);
  $("btnDownloadAll").addEventListener("click", downloadAll);
  $("btnDuplicate").addEventListener("click", duplicateCard);
  $("btnReset").addEventListener("click", () => {
    if (confirm("確定清空全部卡片並清除暫存？")) { clearState(); location.reload(); }
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

// 圖庫圖片需 http 才能匯出（file:// 會被瀏覽器擋讀像素）。攔下並給清楚指示。
function exportNeedsHttp() {
  if (location.protocol === "file:") {
    alert(
      "匯出 PNG 需要透過本機伺服器開啟（圖庫圖片在 file:// 下無法被擷取）。\n\n" +
      "請在專案資料夾執行：\n    node serve.js\n\n" +
      "然後改用瀏覽器開啟： http://localhost:8080"
    );
    return true;
  }
  return false;
}

async function downloadCard() {
  if (exportNeedsHttp()) return;
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
  if (exportNeedsHttp()) return;
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
  createGalleryModal();
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
  showFileProtocolBanner();
}

// file:// 開啟時提示：可編輯預覽，但匯出需改用 http
function showFileProtocolBanner() {
  if (location.protocol !== "file:") return;
  if ($("fileBanner")) return;
  const bar = document.createElement("div");
  bar.id = "fileBanner";
  bar.className = "file-banner";
  bar.innerHTML = "⚠ 目前以 file:// 開啟：可編輯與預覽，但<strong>下載 PNG 需改用本機伺服器</strong>　" +
    "（在專案資料夾執行 <code>node serve.js</code> → 開 <code>http://localhost:8080</code>）";
  document.body.insertBefore(bar, document.body.firstChild);
}
document.addEventListener("DOMContentLoaded", init);
