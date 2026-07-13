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

// ===== 字型（每段文字可各自選字型）=====
// id "" = 預設（沿用該文字原本的字型堆疊）；其餘為可選字型家族。
const FONTS = [
  { id: "",      label: "預設（依版型）",      stack: "" },
  { id: "sans",  label: "黑體 Noto Sans TC",   stack: "'Noto Sans TC','Microsoft JhengHei',sans-serif" },
  { id: "serif", label: "明體 Noto Serif TC",  stack: "'Noto Serif TC','Songti TC','PMingLiU',serif" },
  { id: "kai",   label: "楷體 LXGW WenKai TC", stack: "'LXGW WenKai TC','DFKai-SB','標楷體',cursive" },
  { id: "anton", label: "英數粗體 Anton",       stack: "'Anton','Noto Sans TC','Arial Black',sans-serif" },
];
// 每個文字欄位 → 對應 CSS 變數（見 styles.css 各文字元素的 font-family: var(...)）
const FONT_FIELDS = [
  { key: "fontTitle",   cssVar: "--font-title" },   // 比賽名稱 / 冠軍榜標題
  { key: "fontRank",    cssVar: "--font-rank" },     // 名次文字
  { key: "fontNick",    cssVar: "--font-nick" },     // 得獎人名稱
  { key: "fontDate",    cssVar: "--font-date" },     // 冠軍榜日期
  { key: "fontBadge",   cssVar: "--font-badge" },    // 冠軍頭銜
  { key: "fontVenue",   cssVar: "--font-venue" },    // 會場名稱
  { key: "fontBeyName", cssVar: "--font-beyname" },  // 陀螺名稱
];
function fontStack(id) { const f = FONTS.find((x) => x.id === id); return f ? f.stack : ""; }
function fontDefaults() { const o = {}; FONT_FIELDS.forEach((f) => (o[f.key] = "")); return o; }

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
  // 版型：classic（原經典單人得獎）| champion（冠軍榜 G3 比賽風）
  template: "classic",
  date: "", venue: "", badge: "冠軍",         // 冠軍榜專屬文字
  titleColor: "#E7C56B", titleSize: 1,        // 比賽標題（冠軍榜）大小/顏色
  dateColor: "#FFFFFF", dateSize: 1,          // 日期（冠軍榜）大小/顏色
  fontTitle: "", fontRank: "", fontNick: "", fontDate: "",   // 各段文字字型（"" = 預設）
  fontBadge: "", fontVenue: "", fontBeyName: "",
  personX: 0, personY: 0, personScale: 1,   // 人像在卡片座標的位移+縮放，由拖曳/縮放調整
  personOpacity: 1, panelBgOpacity: 0.35,   // 人像 / 面板背景圖透明度（滑桿調整）
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
        (p) => `<div class="part part-${p.key}" id="part-${i}-${p.key}" data-bey="${i}" data-part="${p.key}" title="點擊選擇${p.label}">
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
  m.className = "modal fade gallery-modal";
  m.tabIndex = -1;
  m.setAttribute("aria-hidden", "true");
  m.setAttribute("aria-labelledby", "galTitle");
  // Bootstrap 官方 modal 結構：背景/ESC/關閉/置中/鎖捲動皆由 Bootstrap 處理
  m.innerHTML = `
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title" id="galTitle">選擇零件</h3>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="關閉"></button>
        </div>
        <div class="modal-body">
          <div class="modal-tabs" id="galTabs"></div>
          <input type="text" class="modal-search form-control" id="galSearch" placeholder="搜尋名稱 / 代碼…" />
          <select class="modal-select form-select" id="galSelect" hidden></select>
          <div class="modal-hint" id="galHint"></div>
          <div class="modal-grid" id="galGrid"></div>
        </div>
        <div class="modal-footer">
          <label class="modal-upload btn btn-sm btn-outline-primary">⬆ 自訂上傳
            <input type="file" accept="image/*" id="galUpload" hidden />
          </label>
          <div class="modal-foot-right">
            <button type="button" class="modal-clear btn btn-sm btn-outline-secondary" id="galClear">清除此格</button>
            <button type="button" class="modal-apply btn btn-sm btn-primary" id="galApply" hidden>套用至卡片</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(m);
  // 顯示後自動聚焦搜尋框（Bootstrap 顯示動畫結束才聚焦才有效）
  m.addEventListener("shown.bs.modal", () => $("galSearch").focus());
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
  bootstrap.Modal.getOrCreateInstance($("galleryModal")).show();   // 顯示/背景/置中/鎖捲動由 Bootstrap 處理
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

function closeGallery() {
  const inst = bootstrap.Modal.getInstance($("galleryModal"));
  if (inst) inst.hide();
}

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
  layoutRow(i);                  // 合體型留空時收合分欄，避免中間空洞
  saveState();
}

// 清除此格 = 刻意把該部件設為空 → 收合時隱藏該欄（emptied 旗標）
function clearSlot(i, part) { setPartData(i, part, { ...blankPart(), emptied: true }); }

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

// ===== 人像位移（拖曳定位）=====
// 位移以「卡片座標 px」儲存：套在 #personWrap 的 translate 上，
// 預覽(被 stage 縮放)與匯出(原生 1080×cardH)都一致，無需各自換算。
function applyPerson() {
  const wrap = $("personWrap");
  if (!wrap) return;
  wrap.style.transform =
    `translate(${state.personX || 0}px, ${state.personY || 0}px) scale(${state.personScale || 1})`;
  wrap.style.opacity = state.personOpacity == null ? 1 : state.personOpacity;
  // 大小可能由滾輪/雙指改變 → 同步左側滑桿與數值（不覆蓋使用者正在拖的滑桿）
  const sc = $("personScale"), scv = $("personScaleVal");
  if (sc && document.activeElement !== sc) sc.value = state.personScale || 1;
  if (scv) scv.textContent = Math.round((state.personScale || 1) * 100) + "%";
  const opv = $("personOpacityVal");
  if (opv) opv.textContent = Math.round((state.personOpacity == null ? 1 : state.personOpacity) * 100) + "%";
}

// 右側面板背景圖透明度（覆蓋 CSS 預設 .35）
function applyPanelBgOpacity() {
  const v = state.panelBgOpacity == null ? 0.35 : state.panelBgOpacity;
  const el = $("panelBg"); if (el) el.style.opacity = v;
  const lbl = $("panelBgOpacityVal"); if (lbl) lbl.textContent = Math.round(v * 100) + "%";
}

const PERSON_SCALE_MIN = 0.3, PERSON_SCALE_MAX = 3;
function clampScale(s) { return Math.min(PERSON_SCALE_MAX, Math.max(PERSON_SCALE_MIN, s || 1)); }

// stage 目前的視覺縮放倍率（getBoundingClientRect 反映 transform:scale 後的實際寬）
function stageScale() {
  const r = stage.getBoundingClientRect();
  return (r.width / 1080) || 1;
}

// 夾住位移，讓人像至少有一段留在卡片內，不會被拖到完全看不見
function clampPerson(x, y) {
  const ch = (SIZES[state.size] || SIZES.square).h;
  const pw = 540, edge = 80;                // personWrap 寬 50%=540，保留 80px 露出
  const minX = edge - pw, maxX = 1080 - edge;
  const minY = edge - ch, maxY = 0.94 * ch - edge;
  return [Math.min(maxX, Math.max(minX, x)), Math.min(maxY, Math.max(minY, y))];
}

// 人像互動：單指/滑鼠拖曳定位 + 雙指 pinch 縮放 + 桌機滾輪縮放（皆走 pointer/wheel）
function enablePersonDrag() {
  const wrap = $("personWrap");
  const img = $("personImg");
  if (!wrap) return;
  const hasPerson = () => img && img.style.display !== "none" && !!img.getAttribute("src");
  const pts = new Map();                 // 進行中的指標：pointerId -> {x,y}
  let mode = null;                       // 'drag' | 'pinch'
  let sc = 1, moved = false;
  let sx = 0, sy = 0, ox = 0, oy = 0;    // drag 基準
  let startDist = 0, startScale = 1;     // pinch 基準
  let saveT = null;
  const scheduleSave = () => { clearTimeout(saveT); saveT = setTimeout(saveState, 300); };
  // 從目前指標重設 drag 基準（單指起拖、或從雙指退回單指時用，避免跳動）
  const resetDrag = (x, y) => { sx = x; sy = y; ox = state.personX || 0; oy = state.personY || 0; sc = stageScale(); };

  wrap.addEventListener("pointerdown", (e) => {
    if (!hasPerson()) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { wrap.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
    if (pts.size === 1) {
      mode = "drag"; moved = false;
      resetDrag(e.clientX, e.clientY);
      wrap.classList.add("dragging");
    } else if (pts.size === 2) {
      mode = "pinch";
      const [a, b] = [...pts.values()];
      startDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      startScale = state.personScale || 1;
    }
  });

  wrap.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === "drag" && pts.size === 1) {
      const dx = (e.clientX - sx) / sc;    // 螢幕位移 → 卡片座標 px
      const dy = (e.clientY - sy) / sc;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      const [nx, ny] = clampPerson(ox + dx, oy + dy);
      state.personX = nx; state.personY = ny;
      applyPerson();
    } else if (mode === "pinch" && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      state.personScale = clampScale(startScale * (dist / startDist));
      moved = true;
      applyPerson();
    }
  });

  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    try { wrap.releasePointerCapture(e.pointerId); } catch {}
    if (pts.size === 1) {                  // 雙指退回單指：重設基準續拖
      const [only] = [...pts.values()];
      mode = "drag"; resetDrag(only.x, only.y);
    } else if (pts.size === 0) {
      mode = null;
      wrap.classList.remove("dragging");
      if (moved) saveState();              // 真的有動作才存檔
    }
  };
  wrap.addEventListener("pointerup", end);
  wrap.addEventListener("pointercancel", end);

  // 桌機：滾輪縮放（向上放大、向下縮小）
  wrap.addEventListener("wheel", (e) => {
    if (!hasPerson()) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.06 : 1 / 1.06;
    state.personScale = clampScale((state.personScale || 1) * factor);
    applyPerson();
    scheduleSave();
  }, { passive: false });
}

// 設定人像圖：含 has-person 類別切換（控制游標/touch-action）與操作提示
function setPersonImage(url) {
  setImg($("personImg"), null, url || "");
  const wrap = $("personWrap");
  if (wrap) {
    wrap.classList.toggle("has-person", !!url);
    wrap.title = url ? "拖曳移動位置 · 滾輪/雙指縮放" : "";
  }
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

// ===== 版型（classic / champion）=====
// 切換 card 與 body 的 data-template：CSS 以此顯示/隱藏兩套版型元素，
// 並讓左側各版型專屬控制項（.tpl-b / .tpl-bc）依目前版型顯示。
const TEMPLATES = ["classic", "champion"];
function applyTemplate() {
  const t = TEMPLATES.includes(state.template) ? state.template : "classic";
  card.dataset.template = t;
  document.body.dataset.template = t;
  updateLayerToolbar();   // 圖層工具列只在 B/C 版顯示
}
// 冠軍榜文字/大小/顏色（標題沿用「比賽名稱」logo，額外套用大小與顏色）
function applyChampText() {
  const logo = $("logoInput") ? $("logoInput").value : "";
  const ct = $("champTitle"); if (ct) ct.textContent = logo;
  const cd = $("champDate"); if (cd) cd.textContent = state.date || "";
  const cv = $("champVenue"); if (cv) cv.textContent = state.venue || "";
  const cb = $("champBadgeText"); if (cb) cb.textContent = state.badge || "";
  card.style.setProperty("--title-scale", state.titleSize || 1);
  card.style.setProperty("--title-color", state.titleColor || "#E7C56B");
  card.style.setProperty("--date-scale", state.dateSize || 1);
  card.style.setProperty("--date-color", state.dateColor || "#FFFFFF");
  const tsv = $("titleSizeVal"); if (tsv) tsv.textContent = Math.round((state.titleSize || 1) * 100) + "%";
  const dsv = $("dateSizeVal"); if (dsv) dsv.textContent = Math.round((state.dateSize || 1) * 100) + "%";
}

// 把 FONTS 選項灌進所有 select[data-font]（初始化時呼叫一次）
function populateFontSelects() {
  const opts = FONTS.map((f) => `<option value="${f.id}">${f.label}</option>`).join("");
  document.querySelectorAll("select[data-font]").forEach((sel) => { sel.innerHTML = opts; });
}
// 依 state 把每段文字的字型套成 CSS 變數（"" → 移除變數，讓元素用自己的預設堆疊）
function applyFonts() {
  FONT_FIELDS.forEach((f) => {
    const stack = fontStack(state[f.key] || "");
    if (stack) card.style.setProperty(f.cssVar, stack);
    else card.style.removeProperty(f.cssVar);
  });
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

// 排卡片列：只隱藏「刻意清空(emptied)或合體型」的空欄，讓版面收合靠攏；
// 尚未填的空格維持顯示為佔位框、可繼續點擊新增（不會因填了一個就把其他收掉）。
// 收合成兩件時標記 cl-first/cl-last 控制靠攏；名稱以 grid-column:1/-1 跨滿整列、靠右對齊。
function layoutRow(i) {
  const blade = $(`part-${i}-blade`);
  const row = blade && blade.parentElement;          // .bey-row
  if (!row) return;
  const b = (state.beys && state.beys[i]) || {};
  const has = (part) => {
    const d = b[part];
    if (!d) return false;
    return part === "blade" ? !!(d.cx || d.img) : !!d.img;
  };
  const fused = !!(b.blade && b.blade.fused);
  // 隱藏(收合)條件：該欄無內容，且(合體型 或 被使用者清除此格)。未填的空格不隱藏。
  const hidden = (part) => !has(part) && (fused || !!(b[part] && b[part].emptied));
  const order = ["blade", "ratchet", "bit"];
  const visible = order.filter((p) => !hidden(p));
  const collapse = visible.length > 0 && visible.length < order.length;
  order.forEach((p) => {
    const cell = $(`part-${i}-${p}`);
    if (!cell) return;
    cell.style.display = hidden(p) ? "none" : "";
    cell.classList.remove("cl-first", "cl-last");
  });
  // 收合成兩欄時，標記首/尾可見欄 → CSS 讓兩者靠攏（左件靠右、右件靠左）
  if (collapse && visible.length === 2) {
    const first = $(`part-${i}-${visible[0]}`);
    const last = $(`part-${i}-${visible[1]}`);
    if (first) first.classList.add("cl-first");
    if (last) last.classList.add("cl-last");
  }
  // 冠軍榜版型用 grid-template-areas 排版，不套用經典版的收合欄寬（避免破版）
  row.style.gridTemplateColumns = (state.template === "champion") ? "" : (collapse ? `repeat(${visible.length}, 1fr)` : "");
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
  return { source: "", key: "", group: "", name: "", img: "", emptied: false };
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
    // 使用者用「清除此格」刻意清空 → 收合時隱藏；有內容(img/cx)則不算清空
    emptied: !!p.emptied && !p.img && !p.cx,
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
    template: "classic",
    date: "", venue: "", badge: "冠軍",
    titleColor: "#E7C56B", titleSize: 1, dateColor: "#FFFFFF", dateSize: 1,
    ...fontDefaults(),
    logo: "經典賽", nick: "",
    person: "", personX: 0, personY: 0, personScale: 1, personOpacity: 1,
    bg: "", panelBgOpacity: 0.35, cardBg: "",
    // 自由圖層「依版型各自記錄」：A版預設帶入預設排版，B版預設空白（可按「套用預設排版」）
    layersByTemplate: {
      classic: classicPreset(1080).map((s, i) => ({ ...s, z: i + 1 })),
      champion: [],
    },
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
    template: $("templateSelect").value,
    date: $("dateInput").value,
    venue: $("venueInput").value,
    badge: $("badgeInput").value,
    titleColor: $("titleColor").value,
    titleSize: state.titleSize || 1,
    dateColor: $("dateColor").value,
    dateSize: state.dateSize || 1,
    ...FONT_FIELDS.reduce((o, f) => { o[f.key] = $(f.key) ? $(f.key).value : (state[f.key] || ""); return o; }, {}),
    logo: $("logoInput").value,
    nick: $("nickInput").value,
    person: ($("personImg").style.display !== "none" && $("personImg").getAttribute("src")) || "",
    personX: state.personX || 0, personY: state.personY || 0, personScale: state.personScale || 1,
    personOpacity: state.personOpacity == null ? 1 : state.personOpacity,
    bg: $("panelBg").style.backgroundImage || "",
    panelBgOpacity: state.panelBgOpacity == null ? 0.35 : state.panelBgOpacity,
    cardBg: $("cardBg").style.backgroundImage || "",
    // 自由圖層依版型各自記錄；沿用「同一個」陣列參考（不可在此 clone/normalize，否則會替換掉
    // 正在被編輯的圖層物件而丟失變更），並把作用中版型的圖層同步回 layersByTemplate。
    layers: prev.layers || [],
    layersByTemplate: (function () {
      const t = $("templateSelect").value;
      const m = Object.assign({}, prev.layersByTemplate || {});
      m[t] = prev.layers || [];
      return m;
    })(),
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
  // 版型 + 冠軍榜專屬欄位
  state.template = TEMPLATES.includes(c.template) ? c.template : "classic";
  $("templateSelect").value = state.template;
  state.date = c.date || ""; $("dateInput").value = state.date;
  state.venue = c.venue || ""; $("venueInput").value = state.venue;
  state.badge = c.badge == null ? "冠軍" : c.badge; $("badgeInput").value = state.badge;
  state.titleColor = c.titleColor || "#E7C56B"; $("titleColor").value = state.titleColor; markSwatch("titleSwatches", state.titleColor);
  state.titleSize = c.titleSize || 1; $("titleSize").value = state.titleSize;
  state.dateColor = c.dateColor || "#FFFFFF"; $("dateColor").value = state.dateColor; markSwatch("dateSwatches", state.dateColor);
  state.dateSize = c.dateSize || 1; $("dateSize").value = state.dateSize;
  FONT_FIELDS.forEach((f) => { state[f.key] = c[f.key] || ""; const el = $(f.key); if (el) el.value = state[f.key]; });
  $("logoInput").value = c.logo ?? ""; $("logoText").textContent = c.logo ?? "";
  $("nickInput").value = c.nick || ""; $("rankNick").textContent = c.nick || "";
  setPersonImage(c.person || "");
  state.personX = c.personX || 0; state.personY = c.personY || 0; state.personScale = c.personScale || 1;
  state.personOpacity = c.personOpacity == null ? 1 : c.personOpacity;
  $("personScale").value = state.personScale; $("personOpacity").value = state.personOpacity;
  applyPerson();
  $("panelBg").style.backgroundImage = c.bg || "";
  state.panelBgOpacity = c.panelBgOpacity == null ? 0.35 : c.panelBgOpacity;
  $("panelBgOpacity").value = state.panelBgOpacity; applyPanelBgOpacity();
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
    layoutRow(i);                // 合體型留空時收合分欄，避免中間空洞
  });
  // 自由圖層（依版型各自記錄）：正規化每個版型槽，取目前版型的圖層為作用中陣列
  {
    const src = (c.layersByTemplate && typeof c.layersByTemplate === "object") ? c.layersByTemplate : {};
    if (!c.layersByTemplate && Array.isArray(c.layers)) src[state.template] = c.layers;   // 舊單層遷移
    const lbt = {};
    TEMPLATES.forEach((t) => { lbt[t] = (Array.isArray(src[t]) ? src[t] : []).map(normalizeLayer); });
    c.layersByTemplate = lbt;
    c.layers = lbt[state.template] || [];
    if (cards[active]) { cards[active].layersByTemplate = lbt; cards[active].layers = c.layers; }
  }
  selLayerId = null;
  renderLayers();
  applyRank(); applyNickColor(); applySize(); applyShape(); applyTemplate(); applyChampText(); applyFonts();
}

// 把一張卡的部件補齊 v3 欄位（舊資料相容）
function normalizeCard(c) {
  c = c || blankCard();
  // 名次/顏色相容：舊資料只有 rank(1~4) → 補出 rankText / rankColor / nickColor
  const rDef = RANKS[c.rank] || RANKS["1"];
  if (c.rankText == null) c.rankText = rDef.place;
  if (c.rankColor == null) c.rankColor = rDef.color;
  if (c.nickColor == null) c.nickColor = "#E7C56B";
  // 版型欄位（舊卡沒有或為已移除的 C版 → 補為經典版型）
  c.template = TEMPLATES.includes(c.template) ? c.template : "classic";
  if (c.date == null) c.date = "";
  if (c.venue == null) c.venue = "";
  if (c.badge == null) c.badge = "冠軍";
  if (c.titleColor == null) c.titleColor = "#E7C56B";
  if (c.titleSize == null) c.titleSize = 1;
  if (c.dateColor == null) c.dateColor = "#FFFFFF";
  if (c.dateSize == null) c.dateSize = 1;
  FONT_FIELDS.forEach((f) => { if (c[f.key] == null) c[f.key] = ""; });   // 舊卡無字型欄位 → 預設
  if (c.personX == null) c.personX = 0;   // 舊卡無位移/縮放/透明度欄位 → 補預設
  if (c.personY == null) c.personY = 0;
  if (c.personScale == null) c.personScale = 1;
  if (c.personOpacity == null) c.personOpacity = 1;
  if (c.panelBgOpacity == null) c.panelBgOpacity = 0.35;
  // 自由圖層改為「依版型各自記錄」：正規化每個版型槽；舊卡若只有單一 c.layers 則遷移到當前版型
  {
    const src = (c.layersByTemplate && typeof c.layersByTemplate === "object") ? c.layersByTemplate : {};
    if (!c.layersByTemplate && Array.isArray(c.layers)) src[c.template] = c.layers;
    const lbt = {};
    TEMPLATES.forEach((t) => { lbt[t] = (Array.isArray(src[t]) ? src[t] : []).map(normalizeLayer); });
    c.layersByTemplate = lbt;
    c.layers = lbt[c.template] || [];   // 作用中版型的工作陣列
  }
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
  bindSwatches("titleSwatches", "titleColor", (c) => { state.titleColor = c; card.style.setProperty("--title-color", c); });
  bindSwatches("dateSwatches", "dateColor", (c) => { state.dateColor = c; card.style.setProperty("--date-color", c); });

  $("sizeSelect").addEventListener("change", (e) => {
    state.size = e.target.value;
    applySize();
  });

  $("logoInput").addEventListener("input", (e) => {
    $("logoText").textContent = e.target.value;
    const ct = $("champTitle"); if (ct) ct.textContent = e.target.value;   // 冠軍榜標題沿用比賽名稱
  });
  $("nickInput").addEventListener("input", (e) => {
    $("rankNick").textContent = e.target.value;
  });

  // 版型切換（classic / champion）：各版型的圖層各自記錄，切換時互換
  $("templateSelect").addEventListener("change", (e) => {
    switchTemplate(TEMPLATES.includes(e.target.value) ? e.target.value : "classic");
  });
  // 冠軍榜：日期 / 會場 / 冠軍頭銜文字
  $("dateInput").addEventListener("input", (e) => {
    state.date = e.target.value;
    const cd = $("champDate"); if (cd) cd.textContent = e.target.value;
  });
  $("venueInput").addEventListener("input", (e) => {
    state.venue = e.target.value;
    const cv = $("champVenue"); if (cv) cv.textContent = e.target.value;
  });
  $("badgeInput").addEventListener("input", (e) => {
    state.badge = e.target.value;
    const cb = $("champBadgeText"); if (cb) cb.textContent = e.target.value;
  });
  // 冠軍榜：比賽標題 / 日期 大小
  $("titleSize").addEventListener("input", (e) => {
    state.titleSize = parseFloat(e.target.value) || 1;
    card.style.setProperty("--title-scale", state.titleSize);
    $("titleSizeVal").textContent = Math.round(state.titleSize * 100) + "%";
  });
  $("dateSize").addEventListener("input", (e) => {
    state.dateSize = parseFloat(e.target.value) || 1;
    card.style.setProperty("--date-scale", state.dateSize);
    $("dateSizeVal").textContent = Math.round(state.dateSize * 100) + "%";
  });
  // 冠軍榜：比賽標題 / 日期 顏色（調色盤即時預覽）
  $("titleColor").addEventListener("input", (e) => {
    state.titleColor = e.target.value;
    card.style.setProperty("--title-color", e.target.value);
    markSwatch("titleSwatches", e.target.value);
  });
  $("dateColor").addEventListener("input", (e) => {
    state.dateColor = e.target.value;
    card.style.setProperty("--date-color", e.target.value);
    markSwatch("dateSwatches", e.target.value);
  });
  // 各段文字字型：任一 select[data-font] 變更 → 即時套用（saveState 由 #controls change 委派）
  $("controls").addEventListener("change", (e) => {
    const sel = e.target.closest("select[data-font]");
    if (!sel) return;
    state[sel.dataset.font] = sel.value;
    applyFonts();
  });

  $("personFile").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) readImage(f, (url) => { setPersonImage(url); saveState(); });
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

  // 滑桿：人物大小 / 人物透明度 / 面板背景透明度（saveState 由 #controls input 委派處理）
  $("personScale").addEventListener("input", (e) => {
    state.personScale = clampScale(parseFloat(e.target.value));
    applyPerson();
  });
  $("personOpacity").addEventListener("input", (e) => {
    state.personOpacity = parseFloat(e.target.value);
    applyPerson();
  });
  $("panelBgOpacity").addEventListener("input", (e) => {
    state.panelBgOpacity = parseFloat(e.target.value);
    applyPanelBgOpacity();
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
  // 點左側圖庫格 → 開選圖庫 Modal
  $("beyControls").addEventListener("click", (e) => {
    const btn = e.target.closest(".slot-pick");
    if (!btn) return;
    openGallery(btn.dataset.bey, btn.dataset.part);
  });
  // 點卡片預覽上的零件（含空格）→ 直接開該零件的選圖 Modal
  $("rows").addEventListener("click", (e) => {
    const cell = e.target.closest(".part[data-part]");
    if (!cell) return;
    openGallery(cell.dataset.bey, cell.dataset.part);
  });

  // ===== 自由圖層：新增文字/圖片、屬性列、取消選取、鍵盤刪除 =====
  $("btnAddText").addEventListener("click", addTextLayer);
  $("btnAddImage").addEventListener("click", () => $("layerImgFile").click());
  $("btnApplyPreset").addEventListener("click", applyPreset);
  $("layerImgFile").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) readImage(f, (url) => addImageLayer(url));
    e.target.value = "";
  });
  bindLayerProps();
  // 點卡片空白處（非圖層/非控制點）→ 取消選取
  card.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".layer")) return;   // 點到圖層本身 → 不取消
    deselectLayer();
  });
  // 鍵盤 Delete/Backspace 刪除選取圖層（輸入框/編輯中不攔）
  document.addEventListener("keydown", (e) => {
    if (selLayerId == null) return;
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    const a = document.activeElement;
    if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) return;
    e.preventDefault();
    deleteLayer(selLayerId);
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

  // 頁尾：版本更新紀錄 Modal（Bootstrap 官方 modal 負責背景/ESC/關閉/置中/鎖捲動）
  $("btnChangelog").addEventListener("click", () =>
    bootstrap.Modal.getOrCreateInstance($("changelogModal")).show()
  );
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

// ===== 下載 JPG =====
async function exportCurrentDataURL() {
  const cardH = (SIZES[state.size] || SIZES.square).h;
  // 先等字型下載完再擷取：避免剛載入就按匯出，抓到還沒替換的備援字型
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
  // 卡片是滿版不透明漸層 → 用高品質 JPEG，檔案約為 PNG 的 1/20（5MB→~270KB），畫質肉眼無差
  return window.htmlToImage.toJpeg(card, {
    pixelRatio: 2,               // 2x 高解析度
    quality: 0.92,               // 高品質（漸層背景無明顯色帶）
    width: 1080, height: cardH,
    cacheBust: true,
    backgroundColor: "#0e1422",  // JPEG 無透明通道；給卡片底色當 fallback（實際被滿版漸層蓋住）
    // 匯出時略過：①無來源的空 img（src 會解析成頁面網址→載入失敗→reject）②編輯用的虛線提示框 .ph
    filter: (node) => {
      if (node.nodeType === 1 && node.classList && node.classList.contains("ph")) return false;
      // 圖層選取外框/控制點（.layer-ui）為編輯輔助，不進匯出
      if (node.nodeType === 1 && node.classList && node.classList.contains("layer-ui")) return false;
      if (node.tagName === "IMG") {
        const s = node.getAttribute("src");
        return !!s && s.length > 0;
      }
      return true;
    },
  });
}
// LINE / FB / IG 等 App 內建瀏覽器（WebView）：對 <a download> + data: URL 支援極差，
// 直接下載幾乎無效。用 UA 粗略判斷，改走「系統分享」或「長按存圖」路徑。
function isInAppBrowser() {
  const ua = navigator.userAgent || "";
  return /\bLine\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|Twitter|; ?wv\)/i.test(ua);
}

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const head = dataUrl.slice(0, comma);
  const mime = (head.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
  const bin = atob(dataUrl.slice(comma + 1));
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// 顯示大圖覆蓋層，提示使用者長按存到相簿（in-app 瀏覽器最可靠的存檔方式）
function showLongPressSave(dataUrl) {
  const old = document.getElementById("saveOverlay");
  if (old) old.remove();
  const ov = document.createElement("div");
  ov.id = "saveOverlay";
  ov.className = "save-overlay";
  ov.innerHTML =
    '<div class="save-sheet">' +
    '<p class="save-tip">👇 長按下方圖片 →「儲存到相簿 / 加入照片」</p>' +
    '<img class="save-img" alt="卡片" />' +
    '<p class="save-hint">若仍無法，請點右上角選單，用 Safari / Chrome 開啟本頁再下載。</p>' +
    '<button type="button" class="btn btn-warning save-close">關閉</button>' +
    "</div>";
  ov.querySelector(".save-img").src = dataUrl;
  const close = () => ov.remove();
  ov.querySelector(".save-close").addEventListener("click", close);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  document.body.appendChild(ov);
}

async function triggerDownload(dataUrl, filename) {
  const blob = dataUrlToBlob(dataUrl);
  // 1) 優先用系統分享：in-app 瀏覽器多半可叫出「儲存圖片 / 分享」原生面板
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch (e) {
    // AbortError＝使用者自己取消分享，不用再 fallback；其餘錯誤往下走
    if (e && e.name === "AbortError") return;
  }

  // 2) in-app 瀏覽器且不支援分享：顯示圖片讓使用者長按存檔（<a download> 在此無效）
  if (isInAppBrowser()) { showLongPressSave(dataUrl); return; }

  // 3) 桌機 / 一般行動瀏覽器：正規下載
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = filename; a.href = url;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function cardFilename(c, i) {
  const rawRank = (c.rankText || (RANKS[c.rank] && RANKS[c.rank].line1) || ("card" + (i + 1)));
  const rankName = rawRank.trim().replace(/[^\w一-龥-]/g, "") || ("card" + (i + 1));
  const t = (c.title || "").trim().replace(/[^\w一-龥-]/g, "");
  return `beyblade-${t || rankName}-${c.size}.jpg`;
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// 圖庫圖片需 http 才能匯出（file:// 會被瀏覽器擋讀像素）。攔下並給清楚指示。
function exportNeedsHttp() {
  if (location.protocol === "file:") {
    alert(
      "匯出圖片需要透過本機伺服器開啟（圖庫圖片在 file:// 下無法被擷取）。\n\n" +
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
  deselectLayer();   // 匯出前取消圖層選取，避免外框/控制點入圖
  try {
    if (!window.htmlToImage) throw new Error("html-to-image 未載入");
    cards[active] = { ...cards[active], ...readCardFromDOM() };
    const url = await exportCurrentDataURL();
    await triggerDownload(url, cardFilename(cards[active], active));
  } catch (err) {
    alert("產生圖片失敗：" + err.message + "\n（請確認 vendor/html-to-image.js 存在或網路可載入）");
    console.error(err);
  } finally { btn.disabled = false; btn.textContent = oldText; }
}

// ============================================================================
// ===== 自由圖層（B/C 版：可自訂新增文字/圖片，拖曳／縮放／旋轉，類 IG 限動）=====
// 圖層資料存在 cards[active].layers（非 DOM），座標以「卡片 1080×H px」為準，
// 因此預覽(被 stage 縮放)與匯出(原生尺寸)自動一致，與人像拖曳同一套座標邏輯。
// ============================================================================
const LAYER_TEMPLATES = ["classic", "champion"];   // 顯示圖層工具列的版型（A/B 版皆可自由加圖層）
const LAYER_SCALE_MIN = 0.2, LAYER_SCALE_MAX = 6;
const LAYER_SWATCHES = ["#FFFFFF", "#E7C56B", "#111111", "#E10600", "#37D06A", "#2F8FE6"];
let layerSeq = 0;
let selLayerId = null;                        // 目前選取的圖層 id（null = 未選）

function newLayerId() { layerSeq += 1; return "ly_" + Date.now().toString(36) + "_" + layerSeq; }
function clampLayerScale(s) { return Math.min(LAYER_SCALE_MAX, Math.max(LAYER_SCALE_MIN, s || 1)); }
// 目前「作用中版型」的圖層槽（layersByTemplate[template]）；c.layers 永遠鏡射作用中槽
function curLayers() {
  const c = cards[active];
  if (!c) return [];
  if (!c.layersByTemplate || typeof c.layersByTemplate !== "object") c.layersByTemplate = {};
  const t = c.template || state.template || "classic";
  if (!Array.isArray(c.layersByTemplate[t])) c.layersByTemplate[t] = Array.isArray(c.layers) ? c.layers : [];
  c.layers = c.layersByTemplate[t];
  return c.layers;
}
// 取代整個作用中版型的圖層陣列（供套用預設排版；同步 map 與 c.layers 兩處參考）
function setCurLayers(arr) {
  const c = cards[active];
  if (!c) return;
  if (!c.layersByTemplate || typeof c.layersByTemplate !== "object") c.layersByTemplate = {};
  const t = c.template || state.template || "classic";
  c.layersByTemplate[t] = arr;
  c.layers = arr;
}
function findLayer(id) { return curLayers().find((l) => l.id === id); }
function topZ() { return curLayers().reduce((m, l) => Math.max(m, l.z || 0), 0); }

// 圖層資料形狀正規化（相容舊卡；補齊 text / image 各自欄位）
function normalizeLayer(l) {
  l = l || {};
  const type = l.type === "image" ? "image" : "text";
  const out = {
    id: l.id || newLayerId(),
    type,
    x: Number.isFinite(l.x) ? l.x : 400,
    y: Number.isFinite(l.y) ? l.y : 440,
    scale: l.scale > 0 ? l.scale : 1,
    rotation: Number.isFinite(l.rotation) ? l.rotation : 0,
    z: Number.isFinite(l.z) ? l.z : 1,
  };
  if (type === "text") {
    out.text = l.text != null ? String(l.text) : "輸入文字";
    out.color = l.color || "#FFFFFF";
    out.fontId = l.fontId || "";
    out.fontSize = l.fontSize > 0 ? l.fontSize : 64;
    out.italic = !!l.italic;                                   // 斜體（A版名次風）
    out.stroke = !!l.stroke;                                   // 文字描邊
    out.strokeColor = l.strokeColor || "#FFFFFF";
    out.strokeWidth = l.strokeWidth > 0 ? l.strokeWidth : 4;
  } else {
    out.img = l.img || "";
    out.baseW = l.baseW > 0 ? l.baseW : 320;
    out.opacity = l.opacity == null ? 1 : l.opacity;
  }
  return out;
}

function layerTransform(l) {
  return `translate(${l.x}px, ${l.y}px) rotate(${l.rotation || 0}deg) scale(${l.scale || 1})`;
}

// 若有文字圖層正在就地編輯，先 blur 提交（避免重繪時丟失未存的文字）
function commitActiveEdit() {
  const host = $("layerHost");
  const ed = host && host.querySelector(".layer-text-body.editing");
  if (ed) ed.blur();
}

// 重繪整個圖層層（新增/刪除/選取變更時用；純屬性微調走 updateLayerBody 不整重繪）
function renderLayers() {
  const host = $("layerHost");
  if (!host) return;
  commitActiveEdit();
  const frag = document.createDocumentFragment();
  curLayers().slice().sort((a, b) => (a.z || 0) - (b.z || 0)).forEach((l) => frag.appendChild(buildLayerEl(l)));
  host.innerHTML = "";
  host.appendChild(frag);   // 單次插入，減少重排
  updateLayerProps();
}

function buildLayerEl(l) {
  const el = document.createElement("div");
  el.className = "layer layer-" + l.type + (l.id === selLayerId ? " selected" : "");
  el.dataset.id = l.id;
  el.style.transform = layerTransform(l);
  el.style.zIndex = l.z || 1;
  if (l.type === "text") {
    const t = document.createElement("div");
    t.className = "layer-text-body";
    t.textContent = l.text;
    styleTextBody(t, l);
    el.appendChild(t);
  } else {
    const im = document.createElement("img");
    im.className = "layer-img-body";
    im.src = l.img;
    im.style.width = (l.baseW || 320) + "px";
    im.style.opacity = l.opacity == null ? 1 : l.opacity;
    el.appendChild(im);
  }
  // 選取外框＋控制點（旋轉/縮放/刪除）；控制點反向縮放維持固定視覺大小；匯出時整組 .layer-ui 被過濾掉
  if (l.id === selLayerId) {
    const inv = 1 / (l.scale || 1);
    const ui = document.createElement("div");
    ui.className = "layer-ui";
    ui.innerHTML =
      `<span class="layer-frame"></span>` +
      `<button type="button" class="layer-handle layer-rotate" data-role="rotate" style="transform:scale(${inv})" title="旋轉"></button>` +
      `<button type="button" class="layer-handle layer-scale" data-role="scale" style="transform:scale(${inv})" title="縮放"></button>` +
      `<button type="button" class="layer-handle layer-del" data-role="del" style="transform:scale(${inv})" title="刪除">✕</button>`;
    el.appendChild(ui);
  }
  return el;
}

// 套用文字圖層樣式（顏色/字級/字型/描邊）；build 與微調共用
function styleTextBody(b, l) {
  b.style.color = l.color;
  b.style.fontSize = (l.fontSize || 64) + "px";
  b.style.fontFamily = fontStack(l.fontId) || "";
  b.style.fontStyle = l.italic ? "italic" : "";
  if (l.stroke) {
    b.style.webkitTextStroke = (l.strokeWidth || 4) + "px " + (l.strokeColor || "#FFFFFF");
    b.style.paintOrder = "stroke fill";
  } else {
    b.style.webkitTextStroke = "";
    b.style.paintOrder = "";
  }
}

// 屬性微調時只改選取圖層的 DOM（避免整重繪打斷互動）
function updateLayerBody(l) {
  const el = $("layerHost").querySelector(`.layer[data-id="${l.id}"]`);
  if (!el) return;
  if (l.type === "text") {
    const b = el.querySelector(".layer-text-body");
    if (b) styleTextBody(b, l);
  } else {
    const im = el.querySelector(".layer-img-body");
    if (im) im.style.opacity = l.opacity == null ? 1 : l.opacity;
  }
}
function updateHandleScale(el, scale) {
  const inv = 1 / (scale || 1);
  el.querySelectorAll(".layer-handle").forEach((h) => { h.style.transform = "scale(" + inv + ")"; });
}

function selectLayer(id) { selLayerId = id; renderLayers(); }
function deselectLayer() { if (selLayerId == null) return; selLayerId = null; renderLayers(); }

function addTextLayer() {
  const l = normalizeLayer({ type: "text", x: 360, y: 460, text: "輸入文字", color: "#FFFFFF", z: topZ() + 1 });
  curLayers().push(l);
  selLayerId = l.id;
  renderLayers();
  saveState();
  const body = $("layerHost").querySelector(`.layer[data-id="${l.id}"] .layer-text-body`);
  if (body) startTextEdit(body, l);
}
function addImageLayer(url) {
  const img = new Image();
  const place = (baseW) => {
    const l = normalizeLayer({ type: "image", x: 360, y: 360, img: url, baseW, z: topZ() + 1 });
    curLayers().push(l);
    selLayerId = l.id;
    renderLayers();
    saveState();
  };
  img.onload = () => place(Math.min(360, img.width || 360));
  img.onerror = () => place(320);
  img.src = url;
}
function deleteLayer(id) {
  const layers = curLayers();
  const i = layers.findIndex((l) => l.id === id);
  if (i >= 0) layers.splice(i, 1);
  if (selLayerId === id) selLayerId = null;
  renderLayers();
  saveState();
}
// 上/下移一層：先把 z 重排成連號，再與相鄰圖層對調
function bringLayer(id, dir) {
  const sorted = curLayers().slice().sort((a, b) => (a.z || 0) - (b.z || 0));
  sorted.forEach((x, idx) => (x.z = idx + 1));
  const idx = sorted.findIndex((x) => x.id === id);
  const swap = dir < 0 ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= sorted.length) { renderLayers(); return; }
  const tmp = sorted[idx].z; sorted[idx].z = sorted[swap].z; sorted[swap].z = tmp;
  renderLayers();
  saveState();
}

// 文字圖層雙擊 → 就地編輯（contenteditable）；Enter 送出、Shift+Enter 換行
function startTextEdit(bodyEl, l) {
  bodyEl.setAttribute("contenteditable", "true");
  bodyEl.classList.add("editing");
  bodyEl.focus();
  const range = document.createRange();
  range.selectNodeContents(bodyEl);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  const finish = () => {
    bodyEl.removeAttribute("contenteditable");
    bodyEl.classList.remove("editing");
    l.text = bodyEl.innerText.replace(/\n$/, "");
    if (!l.text.trim()) l.text = "輸入文字";
    bodyEl.textContent = l.text;
    bodyEl.removeEventListener("blur", finish);
    bodyEl.removeEventListener("keydown", onKey);
    saveState();
  };
  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); bodyEl.blur(); }
    e.stopPropagation();   // 不讓 Delete/Backspace 觸發刪圖層等全域鍵
  };
  bodyEl.addEventListener("blur", finish);
  bodyEl.addEventListener("keydown", onKey);
}

// ===== 圖層屬性工具列（依選取圖層型別動態產生）=====
function layerCommonBtns() {
  return `<div class="lt-btns">
    <button type="button" class="btn btn-sm btn-outline-secondary" data-role="back" title="下移一層">⬇ 層</button>
    <button type="button" class="btn btn-sm btn-outline-secondary" data-role="front" title="上移一層">⬆ 層</button>
    <button type="button" class="btn btn-sm btn-outline-danger" data-role="del">🗑 刪除</button>
  </div>`;
}
function updateLayerProps() {
  const bar = $("layerProps");
  if (!bar) return;
  const l = findLayer(selLayerId);
  if (!l) { bar.hidden = true; bar.innerHTML = ""; return; }
  bar.hidden = false;
  if (l.type === "text") {
    const fontOpts = FONTS.map((f) => `<option value="${f.id}"${f.id === l.fontId ? " selected" : ""}>${f.label}</option>`).join("");
    const swatches = LAYER_SWATCHES.map((c) =>
      `<button type="button" class="swatch${c.toLowerCase() === (l.color || "").toLowerCase() ? " active" : ""}" data-color="${c}" style="--sw:${c}"></button>`).join("");
    bar.innerHTML =
      `<div class="lt-row">
        <div class="swatches lt-swatches">${swatches}<input type="color" class="color-pick" data-role="colorpick" value="${l.color}" title="自訂顏色" /></div>
        <select class="form-select form-select-sm lt-font" data-role="font">${fontOpts}</select>
      </div>
      <div class="lt-row">
        <label class="lt-size">大小 <input type="range" class="form-range" data-role="fontsize" min="24" max="240" step="2" value="${l.fontSize || 64}" /></label>
        <label class="lt-check"><input type="checkbox" data-role="italic"${l.italic ? " checked" : ""} /> 斜體</label>
        <label class="lt-check"><input type="checkbox" data-role="stroke"${l.stroke ? " checked" : ""} /> 描邊</label>
        ${layerCommonBtns()}
      </div>`;
  } else {
    bar.innerHTML =
      `<div class="lt-row">
        <label class="lt-size">透明度 <input type="range" class="form-range" data-role="opacity" min="0.1" max="1" step="0.05" value="${l.opacity == null ? 1 : l.opacity}" /></label>
        ${layerCommonBtns()}
      </div>`;
  }
}
function markLayerSwatch(color) {
  const c = (color || "").toLowerCase();
  const bar = $("layerProps");
  bar.querySelectorAll(".swatch").forEach((b) => b.classList.toggle("active", (b.dataset.color || "").toLowerCase() === c));
  const pick = bar.querySelector('input[data-role="colorpick"]');
  if (pick) pick.value = color;
}
function bindLayerProps() {
  const bar = $("layerProps");
  bar.addEventListener("input", (e) => {
    const l = findLayer(selLayerId); if (!l) return;
    const role = e.target.dataset.role;
    if (role === "fontsize") { l.fontSize = parseFloat(e.target.value) || 64; updateLayerBody(l); }
    else if (role === "opacity") { l.opacity = parseFloat(e.target.value); updateLayerBody(l); }
    else if (role === "colorpick") { l.color = e.target.value; updateLayerBody(l); markLayerSwatch(l.color); }
  });
  bar.addEventListener("change", (e) => {
    const l = findLayer(selLayerId); if (!l) return;
    const role = e.target.dataset.role;
    if (role === "font") { l.fontId = e.target.value; updateLayerBody(l); saveState(); }
    else if (role === "stroke") { l.stroke = e.target.checked; updateLayerBody(l); saveState(); }
    else if (role === "italic") { l.italic = e.target.checked; updateLayerBody(l); saveState(); }
    else if (role === "fontsize" || role === "opacity") saveState();
  });
  bar.addEventListener("click", (e) => {
    const l = findLayer(selLayerId); if (!l) return;
    const sw = e.target.closest(".swatch");
    if (sw) { l.color = sw.dataset.color; updateLayerBody(l); markLayerSwatch(l.color); saveState(); return; }
    const btn = e.target.closest("[data-role]");
    if (!btn) return;
    const role = btn.dataset.role;
    if (role === "del") deleteLayer(l.id);
    else if (role === "front") bringLayer(l.id, 1);
    else if (role === "back") bringLayer(l.id, -1);
  });
}

// 顯示/隱藏圖層工具列（A/B 版皆顯示）；不在圖層版型時清除選取
function updateLayerToolbar() {
  const tb = $("layerToolbar");
  if (!tb) return;
  const on = LAYER_TEMPLATES.includes(state.template);
  tb.hidden = !on;   // A/B 版都有預設排版，按鈕隨工具列一起顯示
  if (!on && selLayerId != null) { selLayerId = null; renderLayers(); }
}

// ===== 版型預設排版（套用後生成可自由編輯的文字圖層）=====
// 位置以卡片座標 px（寬 1080、高 chh）給定，對齊各版型固定裝飾（B版徽章）。
// A版：比賽名稱（置中金色襯線）＋名次＋得獎人（左下），對齊原本 A版排版與底部柔光。
function classicPreset(chh) {
  // 對齊原本 A版：金色襯線、金深描邊；名次為斜體（gold-deep 描邊色 #B0801F）
  const gold = "#E7C56B", goldDeep = "#B0801F";
  return [
    { type: "text", text: "經典賽",     x: 410, y: 34,        fontId: "serif", fontSize: 78, color: gold, stroke: true, strokeColor: goldDeep, strokeWidth: 2 },
    { type: "text", text: "1st Place",  x: 52,  y: chh - 280, fontId: "serif", fontSize: 58, color: gold, italic: true, stroke: true, strokeColor: goldDeep, strokeWidth: 2 },
    { type: "text", text: "陀螺毀滅者", x: 52,  y: chh - 200, fontId: "serif", fontSize: 88, color: gold, stroke: true, strokeColor: goldDeep, strokeWidth: 2 },
  ];
}
function champPreset(chh) {
  return [
    { type: "text", text: "經典賽",     x: 52, y: 46,        fontId: "anton", fontSize: 78, color: "#E7C56B" },
    { type: "text", text: "2026/07/05", x: 56, y: 172,       fontId: "anton", fontSize: 34, color: "#FFFFFF" },
    { type: "text", text: "冠軍",       x: 56, y: 236,       fontId: "serif", fontSize: 76, color: "#E7C56B", stroke: true, strokeColor: "#B0801F", strokeWidth: 2 },
    { type: "text", text: "會場名稱",   x: 52, y: chh - 118, fontId: "serif", fontSize: 48, color: "#FFFFFF" },
  ];
}
// 依版型取得預設排版 specs
function presetFor(template, chh) {
  return template === "champion" ? champPreset(chh) : classicPreset(chh);
}
// 套用預設排版：把目前版型的預設文字圖層灌入目前卡片（有圖層先確認是否清掉）
function applyPreset() {
  if (!LAYER_TEMPLATES.includes(state.template)) return;
  if (curLayers().length && !confirm("要清掉目前的圖層並套用預設排版嗎？")) return;
  const chh = (SIZES[state.size] || SIZES.square).h;
  const specs = presetFor(state.template, chh);
  setCurLayers(specs.map((s, i) => normalizeLayer({ ...s, z: i + 1 })));
  selLayerId = null;
  renderLayers();
  saveState();
}

// 切換版型：先存起目前版型的圖層，再載入新版型「上一次」的圖層（各版型各自記錄，互不干擾）
function switchTemplate(newT) {
  const c = cards[active];
  if (!c || !TEMPLATES.includes(newT) || newT === state.template) return;
  if (!c.layersByTemplate || typeof c.layersByTemplate !== "object") c.layersByTemplate = {};
  c.layersByTemplate[state.template] = curLayers();                 // 收好舊版型
  const next = Array.isArray(c.layersByTemplate[newT]) ? c.layersByTemplate[newT] : [];
  c.layersByTemplate[newT] = next;
  c.layers = next;                                                  // 載入新版型
  state.template = newT;
  c.template = newT;
  if ($("templateSelect")) $("templateSelect").value = newT;        // 自成一體：不依賴呼叫端已更新下拉（saveState 會讀它）
  selLayerId = null;
  applyTemplate();
  applyChampText();
  renderLayers();
  fitStage();
  saveState();
}

// 圖層互動：拖曳定位 + 角落控制點縮放 + 頂端控制點旋轉 + 雙指 pinch(縮放/旋轉) + 滾輪縮放
function enableLayerDrag() {
  const host = $("layerHost");
  if (!host) return;
  const pts = new Map();
  let target = null, dragEl = null, mode = null, moved = false;   // dragEl：本次互動的圖層元素（避免每次 move 重查 DOM）
  let sx = 0, sy = 0, ox = 0, oy = 0, scr = 1;              // drag 基準
  let cx = 0, cy = 0, startDist = 0, startScale = 1, startAngle = 0, startRot = 0;   // handle 基準
  let pinchDist = 0, pinchAngle = 0, pinchScale = 1, pinchRot = 0;                    // pinch 基準
  let saveT = null;
  const scheduleSave = () => { clearTimeout(saveT); saveT = setTimeout(saveState, 300); };
  const elOf = (id) => host.querySelector(`.layer[data-id="${id}"]`);
  const centerOf = (id) => { const r = elOf(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

  host.addEventListener("pointerdown", (e) => {
    const layerEl = e.target.closest(".layer");
    if (!layerEl) return;
    e.stopPropagation();   // 交由圖層自己處理，避免冒泡到 card 的「點空白取消選取」
    const id = layerEl.dataset.id;
    const body = layerEl.querySelector(".layer-text-body");
    if (body && body.isContentEditable) return;   // 編輯中 → 交給原生游標
    const l = findLayer(id);
    if (!l) return;
    if (id !== selLayerId) selectLayer(id);        // 先選取（重繪出控制點）
    e.preventDefault();
    const el = elOf(id);
    dragEl = el;                                   // 快取本次互動元素（拖曳期間不會重繪）
    try { el.setPointerCapture(e.pointerId); } catch {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    target = findLayer(id);

    const handle = e.target.closest(".layer-handle");
    if (handle) {
      const role = handle.dataset.role;
      if (role === "del") { deleteLayer(id); target = null; return; }
      const c = centerOf(id); cx = c.x; cy = c.y;
      if (role === "scale") { mode = "scale"; startDist = Math.hypot(e.clientX - cx, e.clientY - cy) || 1; startScale = target.scale || 1; }
      else if (role === "rotate") { mode = "rotate"; startAngle = Math.atan2(e.clientY - cy, e.clientX - cx); startRot = target.rotation || 0; }
      return;
    }
    if (pts.size >= 2) {
      mode = "pinch";
      const [a, b] = [...pts.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      pinchAngle = Math.atan2(b.y - a.y, b.x - a.x);
      pinchScale = target.scale || 1; pinchRot = target.rotation || 0;
    } else {
      mode = "drag"; moved = false;
      sx = e.clientX; sy = e.clientY; ox = target.x || 0; oy = target.y || 0; scr = stageScale();
    }
  });

  host.addEventListener("pointermove", (e) => {
    if (!target || !pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const el = dragEl;
    if (!el) return;
    if (mode === "drag") {
      const dx = (e.clientX - sx) / scr, dy = (e.clientY - sy) / scr;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      // 錨點夾在卡片內（卡片 overflow:hidden，避免圖層被拖出畫面外而找不回）
      const chh = (SIZES[state.size] || SIZES.square).h;
      target.x = Math.min(1080, Math.max(0, ox + dx));
      target.y = Math.min(chh, Math.max(0, oy + dy));
      el.style.transform = layerTransform(target);
    } else if (mode === "scale") {
      const d = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
      target.scale = clampLayerScale(startScale * (d / startDist));
      el.style.transform = layerTransform(target); updateHandleScale(el, target.scale);
    } else if (mode === "rotate") {
      const a = Math.atan2(e.clientY - cy, e.clientX - cx);
      target.rotation = startRot + (a - startAngle) * 180 / Math.PI;
      el.style.transform = layerTransform(target);
    } else if (mode === "pinch" && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      target.scale = clampLayerScale(pinchScale * (d / pinchDist));
      target.rotation = pinchRot + (ang - pinchAngle) * 180 / Math.PI;
      el.style.transform = layerTransform(target); updateHandleScale(el, target.scale);
    }
  });

  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size === 0) { if (mode) saveState(); mode = null; target = null; dragEl = null; }
    else if (pts.size === 1 && mode === "pinch" && target) {   // 雙指退回單指：重設拖曳基準續拖
      const p = [...pts.values()][0];
      mode = "drag"; moved = false;
      sx = p.x; sy = p.y; ox = target.x || 0; oy = target.y || 0; scr = stageScale();
    }
  };
  host.addEventListener("pointerup", end);
  host.addEventListener("pointercancel", end);

  // 桌機滾輪縮放（游標在圖層上）
  host.addEventListener("wheel", (e) => {
    const layerEl = e.target.closest(".layer");
    if (!layerEl) return;
    const l = findLayer(layerEl.dataset.id);
    if (!l) return;
    e.preventDefault();
    l.scale = clampLayerScale((l.scale || 1) * (e.deltaY < 0 ? 1.06 : 1 / 1.06));
    if (l.id !== selLayerId) { selectLayer(l.id); }
    else { const el = elOf(l.id); if (el) { el.style.transform = layerTransform(l); updateHandleScale(el, l.scale); } }
    scheduleSave();
  }, { passive: false });

  // 雙擊文字圖層 → 進入就地編輯
  host.addEventListener("dblclick", (e) => {
    const layerEl = e.target.closest(".layer-text");
    if (!layerEl) return;
    const l = findLayer(layerEl.dataset.id);
    if (!l) return;
    if (l.id !== selLayerId) selectLayer(l.id);
    const body = $("layerHost").querySelector(`.layer[data-id="${l.id}"] .layer-text-body`);
    if (body) startTextEdit(body, l);
  });
}

// ===== 初始化 =====
function init() {
  buildBeyControls();
  populateFontSelects();
  createGalleryModal();
  bindEvents();
  enableDrops();
  enablePersonDrag();
  enableLayerDrag();
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
  bar.innerHTML = "⚠ 目前以 file:// 開啟：可編輯與預覽，但<strong>下載圖片需改用本機伺服器</strong>　" +
    "（在專案資料夾執行 <code>node serve.js</code> → 開 <code>http://localhost:8080</code>）";
  document.body.insertBefore(bar, document.body.firstChild);
}
document.addEventListener("DOMContentLoaded", init);

/* ===== 合作洽詢 / 聯絡我們 Modal（EmailJS）— 兩站共用，僅 site 名稱不同 ===== */
(function () {
  // ⚙️ EmailJS 設定：到 https://dashboard.emailjs.com 申請後，把下面三個值換掉。
  //    收件信箱不用寫在這裡——請在 EmailJS 的 Email Template「To Email」欄位設定你要收信的信箱。
  //    Template 內請用到這些變數：{{from_title}} {{from_name}} {{reply_to}} {{message}} {{site}}
  const CFG = {
    publicKey: "eWdoSraFlshyV0Z7E",
    serviceId: "service_alan",
    templateId: "template_alan",
    site: "陀螺配置產生器",   // 來源網站（會帶進信件，方便分辨來自哪個站）
  };

  function buildModal() {
    if (document.getElementById("contactModal")) return;
    const m = document.createElement("div");
    m.id = "contactModal";
    m.className = "contact-overlay hidden";
    m.setAttribute("role", "dialog");
    m.setAttribute("aria-modal", "true");
    m.setAttribute("aria-labelledby", "contactTitle");
    m.innerHTML = `
      <div class="contact-modal">
        <div class="contact-head">
          <h3 id="contactTitle">合作洽詢 / 聯絡我們</h3>
          <button type="button" class="contact-close" id="contactClose" aria-label="關閉">✕</button>
        </div>
        <form class="contact-body" id="contactForm" novalidate>
          <p class="contact-intro">想合作、回報問題或單純打聲招呼都歡迎，填好我會盡快回覆你 🙌</p>
          <label>
            <span class="contact-label">名字 <span class="req">*</span></span>
            <input type="text" id="cName" class="contact-input" required placeholder="你的名字" />
          </label>
          <label>
            <span class="contact-label">Email <span class="req">*</span></span>
            <input type="email" id="cEmail" class="contact-input" required placeholder="方便我回覆的 Email" />
          </label>
          <label>
            <span class="contact-label">想說的話 <span class="req">*</span></span>
            <textarea id="cMessage" class="contact-input" rows="4" required placeholder="想說的話…"></textarea>
          </label>
          <div class="contact-status" id="contactStatus" role="status"></div>
          <div class="contact-foot">
            <button type="button" class="contact-btn-cancel" id="contactCancel">取消</button>
            <button type="submit" class="contact-btn-send" id="contactSend">送出</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener("click", (e) => { if (e.target === m) closeContact(); });
    document.getElementById("contactClose").addEventListener("click", closeContact);
    document.getElementById("contactCancel").addEventListener("click", closeContact);
    document.getElementById("contactForm").addEventListener("submit", onContactSubmit);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isContactOpen()) closeContact(); });
  }

  function isContactOpen() {
    const m = document.getElementById("contactModal");
    return m && !m.classList.contains("hidden");
  }
  function openContact() {
    buildModal();
    document.getElementById("contactModal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    setTimeout(() => { const el = document.getElementById("cName"); if (el) el.focus(); }, 50);
  }
  function closeContact() {
    const m = document.getElementById("contactModal");
    if (m) m.classList.add("hidden");
    document.body.style.overflow = "";
  }

  async function onContactSubmit(e) {
    e.preventDefault();
    const status = document.getElementById("contactStatus");
    const setStatus = (msg, cls) => { status.textContent = msg; status.className = "contact-status" + (cls ? " " + cls : ""); };
    const name = document.getElementById("cName").value.trim();
    const email = document.getElementById("cEmail").value.trim();
    const message = document.getElementById("cMessage").value.trim();
    if (!name || !email || !message) { setStatus("請填寫名字、Email 與想說的話。", "err"); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setStatus("Email 格式怪怪的，再檢查一下。", "err"); return; }
    if (!window.emailjs || CFG.publicKey === "YOUR_PUBLIC_KEY") {
      setStatus("（尚未設定 EmailJS 金鑰，暫時無法送出）", "err"); return;
    }
    const btn = document.getElementById("contactSend");
    btn.disabled = true; const old = btn.textContent; btn.textContent = "送出中…"; setStatus("");
    try {
      await emailjs.send(CFG.serviceId, CFG.templateId, {
        from_name: name, reply_to: email, from_email: email, message, site: CFG.site,
      });
      document.getElementById("contactForm").reset();
      setStatus("✓ 已送出，感謝你的訊息！我會盡快回覆。", "ok");
    } catch (err) {
      console.error("EmailJS send failed:", err);
      setStatus("✕ 送出失敗，請稍後再試。", "err");
    } finally { btn.disabled = false; btn.textContent = old; }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (window.emailjs && CFG.publicKey !== "YOUR_PUBLIC_KEY") {
      try { emailjs.init({ publicKey: CFG.publicKey }); } catch (e) { /* ignore */ }
    }
    const btn = document.getElementById("btnContact");
    if (btn) btn.addEventListener("click", openContact);
  });
})();
