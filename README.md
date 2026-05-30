# 戰鬥陀螺排名卡片產生器（Beyblade Ranking Card Generator）

純前端工具，快速產生比賽名次卡並下載成 PNG。走「金色典雅 × 戰鬥陀螺」視覺：金色襯線標題、深鋼藍能量背景、左側人物照、右側 3×3 零件面板。上蓋 / 固鎖 / 軸心**從內建圖庫直接點選**（圖庫與資料由同層 `x` 專案搬移而來），也可自訂上傳。

---

## 功能總覽

- **圖庫選取**：上蓋 / 固鎖 / 軸心點一下從圖庫挑（含中/日/英名稱搜尋）；名稱自動帶入，仍可手動覆寫
  - 上蓋分 **BX / UX / CX** 系統分頁；固鎖 / 軸心跨系統共用
  - **CX 拆解上蓋**：3 件或 4 件子部件各自挑選後組裝（組合上蓋整體放大 40% 更顯眼）
  - **合體型(fused)**：固鎖/軸心可留空，自動提示
  - 圖庫沒有的可**自訂上傳**（自動縮放壓縮，長邊 ≤1400px）
- **卡片版面**：頂部置中**比賽名稱**（金色襯線＋裝飾分隔線）、左側**人物照**（可疊在面板上）、左下**名次＋得獎人名稱**、右側 **3×3 零件面板**
- **名次配色**：1ST(金) / 2ND(銀) / 3RD(銅) / 4TH(紫)，僅名次文字依名次變色，其餘維持金色
- **背景**：可上傳**整體卡片背景**與**右側面板背景**；未上傳則用預設戰鬥風漸層
- **人物去背**：內建「複製 AI 去背 Prompt」按鈕，指示 AI 只去背、保持人物原樣、輸出透明 PNG
- **匯出尺寸**：方形 1:1（1080×1080），輸出 2x 高解析
- **多卡批次**：分頁可新增 / 切換（含淡入過場）/ 改名 / 刪除 / 拖曳排序 / 複製
- **響應式**：桌機雙欄；手機・平板把設定收進左側**滑入抽屜**，底部固定「編輯設定 / 輸出 PNG」工具列
- **自動暫存**：所有內容存瀏覽器 localStorage，重整不流失

---

## 快速開始

> ⚠ **匯出 PNG 需透過本機伺服器（http）開啟。** 圖庫圖片在 `file://` 下無法被擷取
> （瀏覽器擋 fetch / canvas tainted），直接雙開 `index.html` 可編輯預覽但**無法下載**。

```bash
# 在專案資料夾執行（零依賴，只需 Node）
node serve.js              # → http://localhost:8080
node serve.js 8088         # 換 port
```

開瀏覽器到 `http://localhost:8080` 即可使用與下載。線上版部署於 GitHub Pages。

---

## 操作流程

1. 填**比賽名稱**、選**名次**，填**得獎人名稱**
2. 上傳**人物照**（可先按「複製 AI 去背 Prompt」請 AI 去背成透明 PNG 再上傳）；選填**整體卡片背景 / 面板背景**
3. 逐顆陀螺：點**上蓋 / 固鎖 / 軸心**格 → 開圖庫選圖（CX 走子部件組裝；合體型可留空）
4. 需要多張就按 **＋新增卡片**
5. 按 **輸出 PNG** 下載目前卡片（手機在底部工具列）

---

## 圖庫與資料同步（來源：x 專案）

圖庫圖片與 DB 從同層的 `x` 專案搬移到 `assets/`。**維護只動本專案，不碰 x。**

```bash
node sync-from-x.js --dry-run   # 預覽差異（不動檔案）
node sync-from-x.js             # 實際同步（複製 x 的新增/變更檔）
node sync-from-x.js --prune     # 連同 x 已刪除的檔一起清掉（預設不刪）
node sync-from-x.js --src=../x  # 指定 x 來源路徑（預設 ../x）
```

- 單向同步：只讀 x、只寫 `assets/`，絕不修改 x
- 用 SHA-1 內容雜湊比對；同步 DB 時自動重跑 `build-db-bundle.js` 重新打包

---

## 檔案結構

```
beyblade-champion/
├── index.html               # 介面（左控制面板 / 右即時預覽 / 選圖庫 Modal）
├── styles.css               # 版面、卡片、組裝合成、Modal、抽屜、響應式、主題覆蓋
├── app.js                   # 狀態、多卡、圖庫選取、組裝渲染、CX、匯出、抽屜、AI Prompt
├── db.js                    # BeyDB：圖庫查詢層（消費 db.bundle.js）
├── build-db-bundle.js       # 把 assets/db/*.json 打包成 db.bundle.js（Node）
├── sync-from-x.js           # 從 x 專案同步圖庫/DB 差異（Node）
├── serve.js                 # 零依賴本機靜態伺服器（匯出需要）（Node）
├── assets/
│   ├── img/                 # 圖庫（blade / ratchet / bit / blade/CX/*）
│   ├── db/                  # 原始 DB JSON（同步來源，唯一真實來源）
│   └── db.bundle.js         # DB 打包成 JS 全域（file:// 也可讀；自動產生）
├── vendor/
│   ├── html-to-image.js     # 離線打包的 PNG 匯出函式庫
│   └── bootstrap.min.css    # Bootstrap 5.3.3（離線優先；dark theme）
├── DESIGN.md                # 設計系統基準（配色 / 字體 / 響應式 / 元件）
├── README.md                # 本說明
└── 團隊協作日誌.md           # 開發歷程
```

---

## 如何擴充

- **名次/配色**：`app.js` 的 `RANKS`（含 `color` 名次色與 `place` 文字）
- **匯出尺寸**：`app.js` 的 `SIZES`（目前只開放 `square`，其餘定義保留）
- **AI 去背 Prompt**：`app.js` 的 `AI_PERSON_PROMPT`
- **卡片配色/版面**：`styles.css` 的 `--gold / --accent / --accent-2`，與 `.card .title / .rank / .panel / .person`
- **響應式斷點**：`styles.css` 的 `@media (max-width: 1024px)`（抽屜模式）
- **新增/更新圖庫**：改 x 專案後跑 `node sync-from-x.js`（不要手改 assets/）
- 視覺改動請對照 **DESIGN.md**

---

## 技術說明

- 純靜態、無建置步驟；Node 腳本僅供打包/同步/起伺服器
- UI 套 **Bootstrap 5.3.3**（`<html data-bs-theme="dark">`），以 CSS 變數把 primary/warning 對齊專案配色
- 圖庫資料：`assets/db/*.json` 唯一真實來源 → `build-db-bundle.js` 打包成 `assets/db.bundle.js` → `db.js` 的 `BeyDB` 查詢
- 卡片用 HTML/CSS 排版，組裝合成用絕對定位多層堆疊（含 CX 子部件）；`.stage` 以 `transform-origin: top left` 縮放置中
- 匯出用 `html-to-image.toPng`，`pixelRatio: 2`；`filter` 略過空圖與編輯提示框
- 資料模型 v3：部件 `{source,key,group,name,img,fused}`，CX 另含 `{cx,mode,comps}`；卡片另存 `cardBg`（整體背景）；相容舊卡片
- 狀態存 localStorage `beyblade-card-v1`
- 無障礙：手機觸控目標 ≥44px；`prefers-reduced-motion` 關閉抽屜與卡片過場動畫

---

## 已知限制

- **匯出必須用 http 開啟**（見快速開始）；`file://` 下可編輯預覽但無法下載
- localStorage 容量約 5–10MB；極多卡 + 大量自訂上傳原圖仍可能超量
- CX 子部件圖以 DB 有描述者為準；少數無 DB 描述的圖不顯示
- 選圖庫 Modal 的分頁/格子為自訂樣式（其餘介面已 Bootstrap 化）
- 中文字型靠系統字型，不同系統字體略有差異
