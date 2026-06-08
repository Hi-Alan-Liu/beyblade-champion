/* 陀螺配置卡片產生器 — 純前端、無後端；圖庫資料走本機 bundle（BeyDB） */

// ===== 名次設定 =====
const RANKS = {
  "1": { accent: "#E10600", color: "#E7C56B", line1: "1ST", line2: "PLACE", place: "1st Place" },
  "2": { accent: "#1455C0", color: "#C7CCD4", line1: "2ND", line2: "PLACE", place: "2nd Place" },
  "3": { accent: "#1A9E3E", color: "#C8843C", line1: "3RD", line2: "PLACE", place: "3rd Place" },
  "4": { accent: "#7A3FD4", color: "#B388E0", line1: "4TH", line2: "PLACE", place: "4th Place" },
};

// ===== 零件定義（每顆陀螺）=====
const PART_DEFS = [
  { key: "blade",   label: "上蓋", placeholder: "例：隕星龍騎士" },
  { key: "ratchet", label: "固鎖", placeholder: "例：8-70" },
  { key: "bit",     label: "軸心", placeholder: "例：L" },
];

const BEY_COUNT = 3;

// ===== 人物去背 AI Prompt（供「複製 AI 去背 Prompt」按鈕使用）=====
const AI_PERSON_PROMPT =
`請幫我將這張人物照片「只做去背」，處理成可放進「戰鬥陀螺排名卡片」的人物素材：
1. 只移除背景、保留人物主體，輸出為背景全透明的 PNG。
2. ⚠ 人物本身必須保持原樣：不要美顏、磨皮、瘦臉、調色、補光、銳化、重繪或任何 AI 優化；五官、膚色、體型、服裝、光影與細節都要與原圖完全一致，只能更改背景。
3. 保留完整人物，頭頂、手部與腳部都不要被裁切。
4. 邊緣乾淨自然、髮絲俐落，不留任何原背景殘影或陰影。
5. 不要替換成其他背景，背景必須是全透明。
6. 人物會放在卡片左側的人物區、疊在深色卡片背景上，請以直立站姿、置中、底部對齊輸出。
7. 輸出尺寸建議為直式人像，比例約 2:3 ～ 9:16（例如 1080×1620 px 或 1080×1920 px），人物置中、底部對齊並保留少許上方留白。`;

// 複製文字到剪貼簿：先試 Clipboard API，失敗則退回 execCommand（兼容無焦點/權限受限環境）
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return; } catch (e) { /* 退回 execCommand */ }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed"; ta.style.top = "-9999px"; ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  if (!ok) throw new Error("copy failed");
}

// ===== 匯出尺寸（寬固定 1080）=====
const SIZES = {
  ig:     { h: 1350, label: "IG 4:5" },
  story:  { h: 1920, label: "限動 9:16" },
  square: { h: 1080, label: "方形 1:1" },
};

// ===== 狀態 =====
const state = {
  rank: "1",
  rankText: "1st Place",
  rankColor: "#E7C56B",
  nickColor: "#E7C56B",
  size: "square",
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
    block.open = false;
    block.innerHTML = `
      <summary>陀螺 ${i + 1}</summary>
      <div class="bey-slots">
        ${PART_DEFS.map(
          (p) => `<div class="slot" data-bey="${i}" data-part="${p.key}">
            <button type="button" class="slot-pick" data-bey="${i}" data-part="${p.key}" title="從圖庫選擇${p.label}">
              <img class="slot-thumb" id="slot-img-${i}-${p.key}" alt="" />
              <span class="slot-empty" id="slot-empty-${i}-${p.key}">＋ ${p.label}</span>
            </button>
            <input type="text" class="slot-name form-control form-control-sm" data-bey="${i}" data-part="${p.key}" data-kind="name" placeholder="${p.label}名稱" />
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
      ${PART_DEFS.map(
        (p) => `<div class="part part-${p.key}" id="part-${i}-${p.key}">
          <img id="img-${i}-${p.key}" alt="" />
          <span class="ph" id="ph-${i}-${p.key}">${p.label}</span>
        </div>`
      ).join("")}
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
      <input type="text" class="modal-search form-control" id="galSearch" placeholder="搜尋名稱 / 代碼…" />
      <select class="modal-select form-select" id="galSelect" hidden></select>
      <div class="modal-hint" id="galHint"></div>
      <div class="modal-grid" id="galGrid"></div>
      <div class="modal-foot">
        <label class="modal-upload btn btn-sm btn-outline-primary">⬆ 自訂上傳
          <input type="file" accept="image/*" id="galUpload" hidden />
        </label>
        <div class="modal-foot-right">
          <button type="button" class="modal-clear btn btn-sm btn-outline-secondary" id="galClear">清除此格</button>
          <button type="button" class="modal-apply btn btn-sm btn-primary" id="galApply" hidden>套用至卡片</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(m);
  $("galClose").addEventListener("click", closeGallery);
  m.addEventListener("click", (e) => { if (e.target === m) closeGallery(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("galleryModal").classList.contains("hidden")) closeGallery();
  });
  $("galSearch").addEventListener("input", renderGalleryGrid);
  $("galSelect").addEventListener("change", (e) => {
    const key = e.target.value;
    if (key) pickGalleryEntry(BeyDB.get(galTarget.part, key));
  });
  $("galUpload").addEventListener("change", onGalleryUpload);
  $("galClear").addEventListener("click", () => {
    if (confirm("確定清除此格的零件？")) { clearSlot(galTarget.bey, galTarget.part); closeGallery(); }
  });
  $("galApply").addEventListener("click", applyCxDraft);
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
    // 一般系統(BX/UX/其他) + CX 拆解（CX 走子部件組裝流程）
    const systems = [...BeyDB.systems("blade"), "CX"];
    galTarget.system = systems[0] || null;
    const label = (s) => (s === "other" ? "其他" : s);
    tabsEl.innerHTML = systems.map((s) => `<button type="button" class="gtab" data-sys="${s}">${label(s)}</button>`).join("");
    tabsEl.hidden = false;
    tabsEl.querySelectorAll(".gtab").forEach((b) =>
      b.addEventListener("click", () => {
        galTarget.system = b.dataset.sys;
        if (b.dataset.sys === "CX") startCxDraft();
        markActiveTab();
        renderGalleryGrid();
      })
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

// 固鎖/軸心的上拉選單：選項=代碼(+名稱)，預選目前值
function populateGalSelect(items) {
  const sel = $("galSelect");
  const label = partLabel(galTarget.part);
  const cur = (state.beys[galTarget.bey] && state.beys[galTarget.bey][galTarget.part] && state.beys[galTarget.bey][galTarget.part].key) || "";
  sel.innerHTML =
    `<option value="">— 選擇${label} —</option>` +
    items
      .map((e) => `<option value="${e.key}"${e.key === cur ? " selected" : ""}>${e.key}${e.name && e.name !== e.key ? " — " + e.name : ""}</option>`)
      .join("");
}

function markActiveTab() {
  document.querySelectorAll("#galTabs .gtab").forEach((b) =>
    b.classList.toggle("active", b.dataset.sys === galTarget.system)
  );
}

function closeGallery() { $("galleryModal").classList.add("hidden"); }

function renderGalleryGrid() {
  const grid = $("galGrid");
  grid.classList.remove("cx-mode");
  // CX 拆解：走子部件組裝流程（套用按鈕只在 CX 模式顯示，位於清除此格右邊）
  if (galTarget.part === "blade" && galTarget.system === "CX") {
    $("galSearch").style.display = "none";
    $("galSelect").hidden = true;
    $("galApply").hidden = false;
    renderCxBuilder();
    return;
  }
  $("galApply").hidden = true;
  $("galSearch").style.display = "";
  const q = $("galSearch").value;
  let items = BeyDB.search(galTarget.part, q);
  if (galTarget.part === "blade" && galTarget.system) {
    items = items.filter((e) => e.system === galTarget.system);
  }
  // 固鎖/軸心：提供原生上拉選單（與搜尋/縮圖並存）；上蓋走視覺挑選不用下拉
  const useDropdown = galTarget.part === "ratchet" || galTarget.part === "bit";
  $("galSelect").hidden = !useDropdown;
  if (useDropdown) populateGalSelect(items);
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
  setPartData(bey, part, {
    source: "gallery", key: entry.key, group: entry.system, name, img: entry.img,
    fused: part === "blade" ? !!entry.fused : false,
  });
  closeGallery();
}

// ===== CX 拆解上蓋組裝器（Modal 內） =====
let cxDraft = { mode: 3, comps: {} };

function startCxDraft() {
  cxDraft = { mode: 3, comps: {} };
  const existing = state.beys[galTarget.bey] && state.beys[galTarget.bey].blade;
  if (existing && existing.cx) {
    cxDraft.mode = existing.mode || 3;
    Object.keys(existing.comps || {}).forEach((c) => {
      const e = existing.comps[c];
      if (e && e.key) { const full = BeyDB.cxGet(c, e.key); if (full) cxDraft.comps[c] = full; }
    });
  }
}

function renderCxBuilder() {
  const grid = $("galGrid");
  grid.classList.add("cx-mode");
  // CX 子部件中文標籤（對齊 beybladehub 與使用者用語：Main Blade=鋼鐵戰刃）
  const CX_LABEL = { chip: "紋章鎖", main: "主刃／鋼鐵戰刃", assist: "輔助戰刃", metal: "金屬刃", over: "超越刃" };
  const compName = (c) => CX_LABEL[c] || c;
  // 依使用者指定的堆放順序排列子部件選取區：紋章鎖 → 超越刃 → 金屬刃 →（主刃）→ 輔助戰刃
  const comps = BeyDB.cxComponents(cxDraft.mode).slice().sort((a, b) => CX_STACK_ORDER.indexOf(a) - CX_STACK_ORDER.indexOf(b));
  grid.innerHTML = `
    <div class="cx-modebar">
      <span>組合方式：</span>
      <button type="button" class="cx-mode-btn ${cxDraft.mode === 3 ? "active" : ""}" data-mode="3">3 件</button>
      <button type="button" class="cx-mode-btn ${cxDraft.mode === 4 ? "active" : ""}" data-mode="4">4 件</button>
    </div>
    ${comps
      .map((c) => {
        const picked = cxDraft.comps[c];
        const opts = BeyDB.cxList(c);
        return `<div class="cx-section" data-comp="${c}">
          <h4>${compName(c)} <small>${c}</small>${picked ? `<span class="cx-picked">已選：${picked.name}</span>` : ""}</h4>
          <div class="cx-opts">
            ${opts
              .map(
                (o) => `<button type="button" class="cx-opt ${picked && picked.key === o.key ? "active" : ""}" data-comp="${c}" data-key="${o.key}">
                <img src="${o.img}" loading="lazy" alt="${o.name}" />
                <span>${o.name}</span>
              </button>`
              )
              .join("")}
          </div>
        </div>`;
      })
      .join("")}
  `;
  grid.querySelectorAll(".cx-mode-btn").forEach((b) =>
    b.addEventListener("click", () => { cxDraft.mode = Number(b.dataset.mode); renderCxBuilder(); })
  );
  grid.querySelectorAll(".cx-opt").forEach((b) =>
    b.addEventListener("click", () => { cxDraft.comps[b.dataset.comp] = BeyDB.cxGet(b.dataset.comp, b.dataset.key); renderCxBuilder(); })
  );
}

function applyCxDraft() {
  const comps = BeyDB.cxComponents(cxDraft.mode);
  const chosen = {};
  comps.forEach((c) => {
    const e = cxDraft.comps[c];
    if (e) chosen[c] = { key: e.key, img: e.img, name: e.name };
  });
  if (!Object.keys(chosen).length) { alert("請至少選一個 CX 子部件"); return; }
  // 組裝名稱：無分隔符直接串接；超越刃與輔助戰刃只取代碼(單字母，如 Break→B、Heavy→H)
  const name = comps.filter((c) => chosen[c]).map((c) => (c === "assist" || c === "over" ? chosen[c].key : chosen[c].name)).join("");
  setPartData(galTarget.bey, "blade", {
    source: "gallery", cx: true, mode: cxDraft.mode, comps: chosen, name, group: "CX", key: "", img: "",
  });
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
  renderPart(i, part);           // 右側分開 + 左側組裝 + 控制格縮圖（含 CX）
  renderBeyName(i);
  saveState();
}

function clearSlot(i, part) { setPartData(i, part, blankPart()); }

// 更新左側控制格的縮圖 / 空狀態 / 名稱
function renderSlot(i, part) {
  const d = (state.beys[i] && state.beys[i][part]) || blankPart();
  const thumb = $(`slot-img-${i}-${part}`);
  const empty = $(`slot-empty-${i}-${part}`);
  const img = d.cx ? cxThumbImg(d) : d.img;
  if (thumb) {
    if (img) { thumb.src = img; thumb.style.display = "block"; if (empty) empty.style.display = "none"; }
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
  const s = SIZES[state.size] || SIZES.square;
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
  const fused = bey.blade && bey.blade.fused;
  $(`cn-${i}`).textContent = "合併名稱：" + (name || "（待輸入）") + (fused ? "　⚠ 合體型：固鎖/軸心可留空" : "");
}

// ===== 套用名次文字/顏色與得獎人名稱顏色（皆可自訂，見 styles.css） =====
function applyRank() {
  $("rankPlace").textContent = state.rankText;
  card.style.setProperty("--rank-color", state.rankColor);
}
function applyNickColor() {
  card.style.setProperty("--nick-color", state.nickColor);
}
// 同步預設色票的選取高亮（color input 回傳小寫 hex，比對時統一小寫）
function markSwatch(containerId, color) {
  const c = (color || "").toLowerCase();
  $(containerId).querySelectorAll(".swatch").forEach((b) => {
    b.classList.toggle("active", (b.dataset.color || "").toLowerCase() === c);
  });
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

// 固鎖/軸心：單一 <img> 直接放在部件格
function setPartImage(i, part, dataUrl) {
  setImg($(`img-${i}-${part}`), $(`ph-${i}-${part}`), dataUrl);
}

// CX 子部件由上而下的堆疊順序：紋章鎖 → 超越刃 → 金屬刃 →（主刃）→ 輔助戰刃
const CX_STACK_ORDER = ["chip", "over", "metal", "main", "assist"];
function cxOrderedComps(d) {
  return CX_STACK_ORDER
    .filter((c) => d.comps && d.comps[c] && d.comps[c].img)
    .map((c) => ({ component: c, img: d.comps[c].img }));
}
function cxThumbImg(d) {
  if (!d.comps) return "";
  return (d.comps.main && d.comps.main.img) || (d.comps.chip && d.comps.chip.img) ||
         (cxOrderedComps(d)[0] && cxOrderedComps(d)[0].img) || "";
}

// 上蓋渲染：一般 = 單圖；CX = 子部件在上蓋格內多層堆疊組成一個上蓋
function renderBlade(i, d) {
  const cell = $(`part-${i}-blade`);   // 上蓋格(div)
  const cellImg = $(`img-${i}-blade`);
  const cellPh = $(`ph-${i}-blade`);
  if (!cell) return;
  cell.querySelectorAll(".cx-stack").forEach((n) => n.remove()); // 清掉舊 CX 堆疊

  if (d && d.cx) {
    if (cellImg) cellImg.style.display = "none";
    if (cellPh) cellPh.style.display = "none";
    const stack = document.createElement("div");
    stack.className = "cx-stack";
    cxOrderedComps(d).forEach((c) => {
      const im = document.createElement("img");
      im.className = "cx-sub cx-" + c.component;
      im.src = c.img;
      stack.appendChild(im);
    });
    cell.appendChild(stack);
  } else {
    setImg(cellImg, cellPh, (d && d.img) || "");
  }
}

// 統一部件渲染入口（讀 state.beys，與目前畫面一致，downloadAll 載入別張卡也正確）
function renderPart(i, part) {
  const d = (state.beys[i] && state.beys[i][part]) || blankPart();
  if (part === "blade") renderBlade(i, d);
  else setPartImage(i, part, d.img);
  renderSlot(i, part);
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
  const out = {
    source: p.source || (p.img ? "upload" : ""), // 舊資料有圖必為自訂上傳
    key: p.key || "",
    group: p.group || "",
    name: p.name || "",
    img: p.img || "",
    fused: !!p.fused, // 合體型上蓋（固鎖/軸心可留空）
  };
  // CX 拆解上蓋：無單一圖，由子部件 comps 組成（{component:{key,img,name}}）
  if (p.cx) {
    out.cx = true;
    out.mode = p.mode || 3;
    out.comps = {};
    Object.keys(p.comps || {}).forEach((c) => {
      const e = p.comps[c] || {};
      out.comps[c] = { key: e.key || "", img: e.img || "", name: e.name || "" };
    });
    out.group = "CX";
  }
  return out;
}

function blankCard(rank) {
  rank = rank || "1";
  const r = RANKS[rank] || RANKS["1"];
  return {
    title: "", rank, size: "square", shape: "full",
    rankText: r.place, rankColor: r.color, nickColor: "#E7C56B",
    logo: "經典賽", nick: "",
    person: "", bg: "", cardBg: "",
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
    rank: prev.rank || "1",                 // 保留舊欄位（分頁/檔名已改用 rankText）
    rankText: $("rankInput").value,
    rankColor: $("rankColor").value,
    nickColor: $("nickColor").value,
    size: $("sizeSelect").value,
    shape: "full",
    logo: $("logoInput").value,
    nick: $("nickInput").value,
    person: ($("personImg").style.display !== "none" && $("personImg").getAttribute("src")) || "",
    bg: $("panelBg").style.backgroundImage || "",
    cardBg: $("cardBg").style.backgroundImage || "",
    beys: [0, 1, 2].map((i) => {
      const o = {};
      const prevBey = (prev.beys && prev.beys[i]) || {};
      parts.forEach((p) => {
        // 以模型(prev)為底，保留 cx/mode/comps/source/key/group；名稱以輸入框為準
        const base = normalizePart(prevBey[p]);
        const inp = nameInput(i, p);
        if (inp) base.name = inp.value;
        if (!base.cx) {
          // 非 CX：圖片以畫面為準（可能來自圖庫或自訂上傳）
          const img = imgSrc(i, p);
          base.img = img;
          base.source = base.source || (img ? "upload" : "");
        }
        o[p] = base;
      });
      return o;
    }),
  };
}

// 把一張卡的資料寫進畫面
function loadCardToDOM(c) {
  c = c || blankCard();
  const rDef = RANKS[c.rank] || RANKS["1"];
  const rankText = c.rankText ?? rDef.place;
  const rankColor = c.rankColor || rDef.color;
  const nickColor = c.nickColor || "#E7C56B";
  state.rank = c.rank || "1";
  $("rankInput").value = rankText; state.rankText = rankText;
  $("rankColor").value = rankColor; state.rankColor = rankColor; markSwatch("rankSwatches", rankColor);
  $("nickColor").value = nickColor; state.nickColor = nickColor; markSwatch("nickSwatches", nickColor);
  $("sizeSelect").value = c.size || "square"; state.size = c.size || "square";
  state.shape = "full";
  $("logoInput").value = c.logo ?? ""; $("logoText").textContent = c.logo ?? "";
  $("nickInput").value = c.nick || ""; $("rankNick").textContent = c.nick || "";
  setImg($("personImg"), null, c.person || "");
  $("panelBg").style.backgroundImage = c.bg || "";
  $("cardBg").style.backgroundImage = c.cardBg || "";
  const parts = ["blade", "ratchet", "bit"];
  (c.beys || []).forEach((b, i) => {
    if (i >= BEY_COUNT) return;
    parts.forEach((p) => {
      const cell = normalizePart(b && b[p]);
      state.beys[i][p] = cell;
      const inp = nameInput(i, p); if (inp) inp.value = cell.name || "";
      renderPart(i, p);
    });
    renderBeyName(i);
  });
  applyRank(); applyNickColor(); applySize(); applyShape();
}

// 把一張卡的部件補齊 v3 欄位（舊資料相容）
function normalizeCard(c) {
  c = c || blankCard();
  // 名次/顏色相容：舊資料只有 rank(1~4) → 補出 rankText / rankColor / nickColor
  const rDef = RANKS[c.rank] || RANKS["1"];
  if (c.rankText == null) c.rankText = rDef.place;
  if (c.rankColor == null) c.rankColor = rDef.color;
  if (c.nickColor == null) c.nickColor = "#E7C56B";
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
  return (c.title && c.title.trim()) || (c.rankText && c.rankText.trim()) || (RANKS[c.rank] ? RANKS[c.rank].line1 : "卡片" + (i + 1));
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
  // 重新觸發淡入動畫（移除→強制 reflow→加回）
  const st = $("stage");
  st.classList.remove("switching"); void st.offsetWidth; st.classList.add("switching");
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
  // 名次：自訂文字
  $("rankInput").addEventListener("input", (e) => {
    state.rankText = e.target.value;
    $("rankPlace").textContent = e.target.value;
  });
  // 名次顏色：調色盤即時預覽
  $("rankColor").addEventListener("input", (e) => {
    state.rankColor = e.target.value;
    card.style.setProperty("--rank-color", e.target.value);
    markSwatch("rankSwatches", e.target.value);
  });
  // 得獎人名稱顏色：調色盤即時預覽
  $("nickColor").addEventListener("input", (e) => {
    state.nickColor = e.target.value;
    card.style.setProperty("--nick-color", e.target.value);
    markSwatch("nickSwatches", e.target.value);
  });
  // 預設色票（點擊套用，並回填調色盤與高亮）
  const bindSwatches = (containerId, colorInputId, apply) => {
    $(containerId).addEventListener("click", (e) => {
      const b = e.target.closest(".swatch"); if (!b) return;
      const color = b.dataset.color;
      $(colorInputId).value = color;
      apply(color);
      markSwatch(containerId, color);
      saveState();
    });
  };
  bindSwatches("rankSwatches", "rankColor", (c) => { state.rankColor = c; card.style.setProperty("--rank-color", c); });
  bindSwatches("nickSwatches", "nickColor", (c) => { state.nickColor = c; card.style.setProperty("--nick-color", c); });

  $("sizeSelect").addEventListener("change", (e) => {
    state.size = e.target.value;
    applySize();
  });

  $("logoInput").addEventListener("input", (e) => {
    $("logoText").textContent = e.target.value;
  });
  $("nickInput").addEventListener("input", (e) => {
    $("rankNick").textContent = e.target.value;
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
  $("cardBgFile").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) readImage(f, (url) => {
      $("cardBg").style.backgroundImage = `url(${url})`;
      saveState();
    });
  });
  // 清除背景：清空圖片 → 還原為預設漸層
  $("btnClearCardBg").addEventListener("click", () => {
    $("cardBg").style.backgroundImage = "";
    $("cardBgFile").value = "";
    saveState();
  });
  $("btnClearPanelBg").addEventListener("click", () => {
    $("panelBg").style.backgroundImage = "";
    $("bgFile").value = "";
    saveState();
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

  // 手機/平板：設定抽屜開關 + 行動工具列輸出
  const setDrawer = (open) => document.body.classList.toggle("drawer-open", open);
  $("btnDrawer").addEventListener("click", () => setDrawer(true));
  $("btnDrawerClose").addEventListener("click", () => setDrawer(false));
  $("drawerBackdrop").addEventListener("click", () => setDrawer(false));
  $("btnExportMobile").addEventListener("click", () => $("btnDownload").click());

  // 複製人物去背 AI Prompt
  $("btnCopyPrompt").addEventListener("click", async () => {
    const btn = $("btnCopyPrompt");
    const old = btn.textContent;
    try {
      await copyText(AI_PERSON_PROMPT);
      btn.textContent = "✓ 已複製到剪貼簿"; btn.classList.add("copied");
    } catch (e) {
      btn.textContent = "✕ 複製失敗，請手動選取"; console.error(e);
    }
    setTimeout(() => { btn.textContent = old; btn.classList.remove("copied"); }, 1800);
  });
  $("btnDuplicate").addEventListener("click", duplicateCard);
  $("btnReset").addEventListener("click", () => {
    if (confirm("確定清空全部卡片並清除暫存？")) { clearState(); location.reload(); }
  });

  // 任一文字/選單/檔案變動 → 自動暫存（圖片於 FileReader 回呼另存）
  $("controls").addEventListener("input", saveState);
  $("controls").addEventListener("change", saveState);

  // 頁尾：版本更新紀錄 Modal
  const clModal = $("changelogModal");
  const openChangelog = () => clModal.classList.remove("hidden");
  const closeChangelog = () => clModal.classList.add("hidden");
  $("btnChangelog").addEventListener("click", openChangelog);
  $("btnChangelogClose").addEventListener("click", closeChangelog);
  clModal.addEventListener("click", (e) => { if (e.target === clModal) closeChangelog(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !clModal.classList.contains("hidden")) closeChangelog();
  });
}

// ===== 預覽縮放 =====
function fitStage() {
  const area = $("previewArea");
  const cardH = (SIZES[state.size] || SIZES.square).h;
  const availW = area.clientWidth - 4;
  // 以 stage 在視窗中的「實際頂端位置」計算可用高度，
  // 自動扣掉上方頂列/分頁列/間距，避免又矮又寬的視窗把卡片頂出畫面（爆版）
  const top = stage.getBoundingClientRect().top;
  // 頂部固定工具列已反映在 stage 的 top 內，不需再額外扣除其高度
  const availH = Math.max(220, window.innerHeight - top - 20);
  const scale = Math.min(availW / 1080, availH / cardH, 1);
  stage.style.transform = `scale(${scale})`;
  stage.style.width = `${1080 * scale}px`;
  stage.style.height = `${cardH * scale}px`;
}

// ===== 下載 PNG =====
async function exportCurrentDataURL() {
  const cardH = (SIZES[state.size] || SIZES.square).h;
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
  const rawRank = (c.rankText || (RANKS[c.rank] && RANKS[c.rank].line1) || ("card" + (i + 1)));
  const rankName = rawRank.trim().replace(/[^\w一-龥-]/g, "") || ("card" + (i + 1));
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
