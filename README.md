# 陀螺配置卡片產生器（Beyblade Ranking Card Generator）

純前端工具，快速產生比賽名次卡並下載成 PNG。上蓋 / 固鎖 / 軸心**從內建圖庫直接點選**（圖庫與資料由 x 專案搬移而來），也可自訂上傳。
靈感來自 HANIK TRACK 的賽事名次卡（1ST~4TH PLACE）。

---

## 功能總覽

- **圖庫選取**：上蓋 / 固鎖 / 軸心點一下從圖庫挑（含中/日/英名稱搜尋）；名稱自動帶入，仍可手動覆寫
  - 上蓋分 **BX / UX / CX** 系統分頁；固鎖 / 軸心跨系統共用，平鋪選取
  - **CX 拆解上蓋**：3 件（chip+main+assist）或 4 件（chip+metal+over+assist），各子部件獨立挑選後組裝
  - **合體型(fused)**：固鎖/軸心可留空，會自動提示
  - 圖庫沒有的也可**自訂上傳**（自動縮放壓縮，長邊 ≤1400px）
- **卡片呈現**：每顆陀螺 = **左組裝合成圖（零件堆疊成一顆）+ 右三分開零件 + 合併名稱**（例 `翔龍突擊7-70L`）；空層自動接合不留洞
- **4 種名次**：1ST(紅) / 2ND(藍) / 3RD(綠) / 4TH(紫)，切換即同步整張卡主色
- **3 種匯出尺寸**：IG 4:5 / 限動 9:16 / 方形 1:1，輸出 2x 高解析
- **多卡批次**：分頁可新增 / 切換 / 改名 / 刪除 / 拖曳排序 / 複製，一鍵「匯出全部」
- **自動暫存**：所有內容存瀏覽器 localStorage，重整不流失

---

## 快速開始

> ⚠ **匯出 PNG 需透過本機伺服器（http）開啟。** 圖庫圖片在 `file://` 下無法被擷取
> （瀏覽器擋 fetch / canvas tainted），直接雙開 `index.html` 可編輯預覽但**無法下載**。

```bash
# 在專案資料夾執行（零依賴，只需 Node）
node serve.js              # → http://localhost:8080
# 或自行用其他靜態伺服器
python -m http.server 8000
```

開瀏覽器到 `http://localhost:8080` 即可使用與下載。

---

## 操作流程

1. 選**名次**與**匯出尺寸**，填 **LOGO / 暱稱 / 浮水印**
2. 上傳**人物照**、（選填）**面板背景**
3. 逐顆陀螺：點**上蓋 / 固鎖 / 軸心**格 → 開圖庫選圖（CX 走子部件組裝；合體型可留空）
4. 需要多張就按 **＋新增卡片**
5. 按 **⬇ 下載目前卡片 PNG** 或 **⬇⬇ 匯出全部卡片**

---

## 圖庫與資料同步（來源：x 專案）

圖庫圖片與 DB 從同層的 `x` 專案搬移到 `assets/`。**維護只動本專案，不碰 x。**
當 x 更新了圖片或 DB，用同步工具把差異帶過來：

```bash
node sync-from-x.js --dry-run   # 先預覽差異（不動檔案）
node sync-from-x.js             # 實際同步（複製 x 的新增/變更檔）
node sync-from-x.js --prune     # 連同 x 已刪除的檔一起清掉（預設不刪）
node sync-from-x.js --src=../x  # 指定 x 來源路徑（預設同層 ../x）
```

- 單向同步：只讀 x、只寫 `assets/`，絕不修改 x
- 用 SHA-1 內容雜湊比對，並顯示 `db/-update.json` 的時間戳變化
- 同步到 DB 時會自動重跑 `build-db-bundle.js` 重新打包

---

## 檔案結構

```
beyblade-champion/
├── index.html              # 介面（左控制面板 / 右即時預覽 / 選圖庫 Modal）
├── styles.css              # 版面、卡片、組裝合成、Modal、CX 樣式
├── app.js                  # 狀態、多卡、圖庫選取、組裝渲染、CX、匯出
├── db.js                   # BeyDB：圖庫查詢層（消費 db.bundle.js）
├── build-db-bundle.js      # 把 assets/db/*.json 打包成 db.bundle.js（Node）
├── sync-from-x.js          # 從 x 專案同步圖庫/DB 差異（Node）
├── serve.js                # 零依賴本機靜態伺服器（匯出需要）（Node）
├── assets/
│   ├── img/                # 圖庫（blade / ratchet / bit / blade/CX/*）
│   ├── db/                 # 原始 DB JSON（同步來源，唯一真實來源）
│   └── db.bundle.js        # DB 打包成 JS 全域（file:// 也可讀；自動產生）
├── vendor/html-to-image.js # 離線打包的 PNG 匯出函式庫
├── README.md               # 本說明
└── 團隊協作日誌.md          # 開發歷程
```

---

## 如何擴充

- **名次/配色**：`app.js` 的 `RANKS`
- **匯出尺寸**：`app.js` 的 `SIZES`
- **組裝堆疊位置**：`app.js` 的 `ASM_H` / `ASM_OVERLAP`（組裝層高度與重疊），CX 子部件位置在 `styles.css` 的 `.cx-chip/.cx-main/...`
- **零件圖外框**：`shapeSelect` 選項 + `styles.css` 的 `.card[data-shape="..."]`
- **新增/更新圖庫**：改 x 專案後跑 `node sync-from-x.js`（不要手改 assets/）

---

## 技術說明

- 純靜態、無建置步驟；Node 腳本僅供打包/同步/起伺服器
- 圖庫資料：`assets/db/*.json` 是唯一真實來源 → `build-db-bundle.js` 打包成 `assets/db.bundle.js`（`window.BEY_DB_BUNDLE`）→ `db.js` 的 `BeyDB` 查詢
- 卡片用 HTML/CSS 排版，組裝合成用絕對定位多層堆疊（含 CX 子部件）
- 匯出用 `html-to-image.toPng`，`pixelRatio: 2`；`filter` 略過空圖與編輯提示框
- 資料模型 v3：部件 `{source,key,group,name,img,fused}`，CX 另含 `{cx,mode,comps}`；相容舊 v1/v2 卡片
- 狀態存 localStorage `beyblade-card-v1`

---

## 已知限制

- **匯出必須用 http 開啟**（見快速開始）；`file://` 下可編輯預覽但無法下載，頁面頂部會顯示提示
- localStorage 容量約 5–10MB；極多卡 + 大量自訂上傳原圖仍可能超量
- CX 子部件圖以 DB 有描述者為準；少數無 DB 描述的圖不顯示
- 中文字型靠系統字型，不同系統字體略有差異
