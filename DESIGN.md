# DESIGN.md — 戰鬥陀螺排名卡片產生器 設計系統

本檔是專案的設計基準。所有 UI/視覺調整都應對照本檔；偏離此系統的改動屬較高嚴重度。
分兩層：**卡片（產品輸出）** 走「金色典雅 × 戰鬥陀螺」風；**工具介面（編輯器）** 走「深鋼藍 × Bootstrap」風。

---

## 1. 色彩系統（CSS 變數，定義於 `styles.css :root`）

| 變數 | 值 | 用途 |
|------|-----|------|
| `--bg` | `#0c111d` | 工具介面底色（深鋼藍黑） |
| `--panel-bg` | `#131b2b` | 面板/抽屜底 |
| `--line` | `#283449` | 邊框/分隔線 |
| `--text` | `#e9eef7` | 主文字 |
| `--muted` | `#8b96ad` | 次要文字 |
| `--accent` | `#2f8fe6` | 電光藍：主要互動色（Bootstrap primary 對齊此值） |
| `--accent-2` | `#ff6a2c` | 能量橘：主要 CTA（Bootstrap warning 對齊此值） |
| `--gold` | `#E7C56B` | 卡片金色主色（標題、面板裝飾、得獎人名稱） |
| `--gold-deep` | `#B0801F` | 金色描邊/陰影 |

**名次配色（金屬感，非運動四色）** — 定義於 `app.js` 的 `RANKS[].color`，只套用在名次文字：
1st `#E7C56B`(金) · 2nd `#C7CCD4`(銀) · 3rd `#C8843C`(銅) · 4th `#B388E0`(紫)。

規則：卡片背景用深鋼藍漸層＋電光藍/能量橘能量光（非純黑、非紫色系）。介面以藍為互動色、橘為唯一強 CTA。

---

## 2. 字體

| 角色 | 字體堆疊 | 場景 |
|------|----------|------|
| 介面 UI | `Noto Sans TC, Microsoft JhengHei, system-ui` | 控制面板（Bootstrap 繼承） |
| 卡片標題/名次/得獎人 | `Noto Serif TC, Songti TC, PMingLiU, serif` | 金色襯線，典雅 |
| 卡片名次(英) | `Noto Serif TC, Georgia, serif` | 斜體 |
| 卡片零件標籤 | `Arial Black, Noto Sans TC` | 卡片內部 |

最多 3 個家族同時出現。比賽名稱用襯線大字＋金色＋裝飾分隔線（`◈`）。

---

## 3. 排版與響應式

- **桌機（>1024px）**：雙欄 `grid-template-columns: 380px 1fr`，左控制面板 / 右即時預覽。
- **手機・平板（≤1024px）**：控制面板改為**左側滑入抽屜**（含遮罩、背景捲動鎖定）；底部固定**行動工具列**（藍「編輯設定」＋橘「輸出 PNG」）；預覽在可視區**垂直置中**。
- 卡片固定 1080×1080，由 `fitStage()` 依容器縮放；`.stage` 用 `transform-origin: top left`，確保縮放後置中不溢出。
- 觸控目標：手機抽屜內互動元件 `min-height: 44px`（零件名稱格 40px）。

---

## 4. 元件規範

- **輸入/下拉**：Bootstrap `form-control` / `form-select`（dark theme，聚焦藍光）。
- **按鈕層級**：
  - 主要 CTA（輸出）= `btn btn-warning`（能量橘）。
  - 一般動作 = `btn btn-outline-secondary`。
  - 強調動作（複製 Prompt、套用）= `btn btn-outline-primary` / `btn btn-primary`。
- **卡片**：人物照置左（寬 50%、`object-fit: cover`、疊在面板之上）；右側 3×3 零件面板；標題置中於上；名次＋得獎人名稱置左下。
- 卡片整體背景與右側面板背景皆可上傳（未上傳則用預設漸層）。
- **版型**：目前兩種 —— **A版（classic）** 與 **B版（champion）**，皆為「底層裝飾＋自由圖層」。（C版已移除。）左側面板都精簡為【版型＋圖片＋陀螺】；`#textGroup`、`.tpl-b/.tpl-bc` 一律隱藏。
- **自由圖層（A/B 版皆可）**：`#layerHost`（`z-index:50`，`pointer-events:none`，子項 `.layer` 為 `auto`）疊在卡片最上層。可新增文字/圖片圖層，直接拖曳、縮放、旋轉；選取後顯示 `.layer-ui`（虛線外框＋旋轉/縮放/刪除控制點，`--accent`／`--accent-2` 配色）。文字圖層支援顏色/字型/字級/白色描邊（`-webkit-text-stroke`）。座標以卡片 1080×H px 儲存（與人像拖曳同一套），匯出時 `.layer-ui` 由 `filter` 濾除。**圖層依版型各自記錄**：存於 `card.layersByTemplate[template]`，`card.layers` 為作用中版型的鏡射；`switchTemplate()` 切換時互換各自的圖層（A版排版不會帶到 B版）。`blankCard()` 預設在 classic 槽帶入 A版預設排版。
- **各版型的底層裝飾**：A版隱藏固定文字（`.title/.rank`），保留左下柔光 `.rank-scrim` 與零件面板；B版隱藏 `.champ-title/.champ-date/.champ-venue`（冠軍徽章已移除），文字全部改由自由圖層編輯。
- **預設排版**：「✨ 套用預設排版」（`applyPreset()` → `presetFor()` → `classicPreset()`／`champPreset()`）依目前版型灌入預設文字圖層並對齊該版型裝飾；A版預設＝經典賽／1st Place／陀螺毀滅者。

---

## 5. 動態

- 抽屜滑入 `transition: transform .26s ease`。
- 切換卡片分頁：`.stage` 淡入 `@keyframes cardFade .22s`。
- **無障礙**：`@media (prefers-reduced-motion: reduce)` 關閉抽屜滑動與卡片淡入。

---

## 6. AI Slop 守則（避免）

不用紫色漸層、不用三欄圖示卡 slop、不用 emoji 當裝飾、不用通用無個性字體。卡片以真實襯線字與有意圖的構圖為主。

---

## 7. 依賴

- Bootstrap 5.3.3（`vendor/bootstrap.min.css`，離線優先，`<html data-bs-theme="dark">`）。
- `html-to-image`（`vendor/html-to-image.js`）— PNG 匯出。
- 無建置步驟、無框架；純靜態。
