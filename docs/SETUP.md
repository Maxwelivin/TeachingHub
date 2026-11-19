# 操作手冊

## 0. 一次性準備

1. **OneDrive 帳號**：使用**個人** Microsoft 帳號（outlook.com／hotmail.com 等）的 OneDrive。學校帳號的 OneDrive 多半會要求觀看者登入，無法在教室電腦免登入播放（見 [PHASE0.md](PHASE0.md)）。
2. 在 OneDrive 建一個專用資料夾，例如 `TeachingHub簡報`，只放要上課用的簡報。**不要分享這個資料夾，也不要分享 OneDrive 根目錄**，只分享單一檔案。
3. 在你的電腦／Mac 安裝 OneDrive 同步程式（只裝在你自己的裝置，教室電腦不需要）。iPhone 用 PowerPoint App 直接開 OneDrive 上的檔案即可。

## 1. 新增一份簡報

1. 把 PPTX 存進 OneDrive 的 `TeachingHub簡報` 資料夾。
2. **取得內嵌程式碼**（必須用 PowerPoint 網頁版，桌面版沒有這個功能）：
   1. 用瀏覽器登入 <https://onedrive.live.com>（在**你自己的**電腦上），點這份簡報，會用 PowerPoint 網頁版開啟。
   2. 選「**檔案**」→「**共用**」→「**內嵌**」（英文介面：File → Share → Embed this Presentation）。
   3. 若出現「產生」（Generate）按鈕就按它；尺寸選任一個都可以（本站會自動填滿畫面）。
   4. 在「內嵌程式碼」按「**複製**」。內容類似 `<iframe src="https://onedrive.live.com/embed?...&authkey=...&em=2" ...></iframe>` 或 `https://1drv.ms/p/c/...?em=2`。
   - 另一個入口：在 OneDrive 網頁對檔案按右鍵（或「…」）→「內嵌」→「產生」。
3. **（選填）取得檢視連結**，作為播放頁「網頁版開啟」的備援：在 OneDrive 對檔案按「共用」→ 連結設定選「**任何人**」、權限選「**可以檢視**」（不能選可以編輯）→「複製連結」。若不填，備援按鈕會直接用內嵌網址開新分頁，一樣能播放。
4. 打開本站的 **新增簡報小幫手**：`https://<你的帳號>.github.io/<repo>/helper.html`（或在本機開 `helper.html`）。
   - 貼上內嵌程式碼，填科目、年級、冊別、章節、名稱、描述、id。
   - 按「試播內嵌連結」確認能播。
   - 按「複製」，把產生的一段 JSON 貼進 `data/presentations.json` 的 `"presentations": [ ... ]` 清單（前一筆的 `}` 後面要加逗號）。
5. 部署（見第 6 節）。約 1–2 分鐘後網站出現新簡報。

## 2. 修改既有簡報（不需要動網站）

1. 在 iPhone／Mac／Windows 用 PowerPoint 開 OneDrive 上的同一個檔案，修改後存檔（OneDrive 自動同步）。
2. **不要**另存新檔或改檔名搬位置，否則內嵌連結會指向舊檔案。改檔名本身沒關係（連結跟著檔案走），但「另存新檔」會變成另一個檔案。
3. 播放頁按「**重新載入**」就會取得最新版。若剛存檔就看不到更新，等 1–2 分鐘讓 OneDrive 同步完成再重新載入。

## 3. 新增科目

編輯 `data/presentations.json` 的 `subjects`：

```json
"subjects": [
  { "id": "jh-physchem", "name": "國中理化" },
  { "id": "jh-math", "name": "國中數學" },
  { "id": "sh-physics", "name": "高中物理" },
  { "id": "jh-bio", "name": "國中生物" }
]
```

- `id` 只能用小寫英文、數字、`-`，建好後不要改（簡報用它對應科目）。
- 首頁的科目按鈕依這裡的順序排列。

## 4. 新增年級、冊別、章節

不需要另外設定。簡報資料裡的 `grade`、`volume`、`chapter` 寫什麼，首頁的下拉選單就出現什麼，並依資料出現的順序排列（所以建議依課本順序新增簡報）。同一章的簡報要寫**完全相同**的章節文字，才會歸在一起。

## 5. 簡報資料欄位說明

```json
{
  "id": "jhpc-g8a-1-1",
  "subject": "jh-physchem",
  "grade": "八年級",
  "volume": "第三冊（八上）",
  "chapter": "第 1 章 基本測量",
  "title": "1-1 長度與體積的測量",
  "description": "一句話說明內容",
  "embedUrl": "https://onedrive.live.com/embed?...&em=2",
  "openUrl": "https://1drv.ms/p/c/...",
  "updated": "2026-11-19",
  "tags": ["實驗", "複習"]
}
```

| 欄位 | 必填 | 說明 |
|---|---|---|
| id | ✓ | 唯一代號，小寫英數與 `-`；播放網址會用到（`player.html?id=...`），建好後不要改 |
| subject | ✓ | 對應 `subjects` 裡的 id |
| title | ✓ | 簡報名稱 |
| grade / volume / chapter |  | 年級／冊別／章節，用於篩選 |
| description |  | 卡片上的描述 |
| embedUrl | 播放需要 | 內嵌程式碼裡的 `src` 網址；空白時卡片顯示「無法播放」 |
| openUrl |  | 檢視連結，給「網頁版開啟」用 |
| updated |  | 你**手動填寫**的索引更新日期（YYYY-MM-DD）或 `null`。本站無法取得 OneDrive 檔案的真實修改時間，所以不填就不顯示，不會自己編日期 |
| tags |  | 搜尋用關鍵字 |

本機檢查格式：`node scripts/validate.mjs`（GitHub 部署前也會自動跑，格式錯誤就不會部署）。

## 6. 部署到 GitHub Pages

網站網址：<https://maxwelivin.github.io/TeachingHub/>

目前的部署方式是「**從 main 分支直接發布**」：push 到 `main` 後約 1 分鐘網站就會更新。**這個模式不會自動檢查 JSON**，所以 push 前請先在本機跑 `node scripts/validate.mjs`（或用小幫手產生資料，比較不會出錯）。

**（建議）改成「自動檢查通過才部署」**：`docs/pages-workflow.yml` 是已寫好的 GitHub Actions 設定，JSON 格式錯誤或含憑證時會擋下部署。目前電腦上的 GitHub 登入缺少 `workflow` 權限，所以還沒啟用。要啟用時，在自己的電腦執行：

```powershell
C:\Users\S5\bin\ghcli\bin\gh.exe auth refresh -h github.com -s workflow   # 依畫面指示在瀏覽器授權
cd C:\Claude\Web\TeachingHub
mkdir .github\workflows
git mv docs/pages-workflow.yml .github/workflows/pages.yml
git commit -m "啟用部署前自動檢查"
git push
```

然後到 repo 的 Settings → Pages → Build and deployment → Source 改成「**GitHub Actions**」。之後部署進度在「Actions」分頁看，綠勾代表完成。

**改 JSON 的三種方式（擇一）：**

- **GitHub 網頁（任何裝置，最簡單）**：到 repo 打開 `data/presentations.json` → 右上角鉛筆圖示 → 修改 → 「Commit changes」。在 iPhone 的 Safari 也能做。
- **本機 Git**：
  ```powershell
  cd C:\Claude\Web\TeachingHub
  git add data/presentations.json
  git commit -m "新增簡報：1-1 長度與體積的測量"
  git push
  ```
- **GitHub Desktop**：開啟本資料夾 → Commit → Push。


> 注意：GitHub Pages 免費版需要**公開** repo。本站所有內容（含簡報連結）本來就視為公開資訊，請勿在 repo 放任何私人資料。

## 7. 本機預覽

```powershell
cd C:\Claude\Web\TeachingHub
python -m http.server 8000
```

瀏覽器開 <http://localhost:8000>。（直接雙擊 `index.html` 會因瀏覽器禁止讀取本機 JSON 而載入失敗。）

## 8. 常見問題與排除

| 狀況 | 原因與解法 |
|---|---|
| 播放頁一直黑畫面或轉圈 | Microsoft 服務偶爾不穩。按「重新載入」；仍不行就按「網頁版開啟」。上課前先開一次確認。 |
| 出現 Microsoft 登入畫面 | 這份簡報在學校／公司帳號的 OneDrive，或連結沒設成「任何人」。改用個人 OneDrive 並重新產生內嵌程式碼。**不要在教室電腦登入。** |
| 播放頁顯示「播放連結不是 OneDrive／PowerPoint 網頁版的網址」 | `embedUrl` 貼錯（例如貼成 Google 雲端或其他網站）。只接受 `onedrive.live.com`、`1drv.ms`、`*.officeapps.live.com`、`*.sharepoint.com`。 |
| 首頁卡片顯示「這份簡報還沒有設定播放連結」 | `embedUrl` 是空的，填入內嵌網址。 |
| 首頁顯示「簡報清單載入失敗」 | `presentations.json` 格式錯誤（常見：少逗號、多逗號、引號是全形）。跑 `node scripts/validate.mjs` 看錯在哪；啟用 Actions 後也會自動擋下錯誤的版本。 |
| 新增的簡報沒出現 | 確認 push 成功（啟用 Actions 後則看 Actions 是否綠勾）；GitHub Pages 有快取，等 1–10 分鐘或按 Ctrl+F5。 |
| 改了 PPT 但播放的是舊版 | 確認檔案已同步到 OneDrive（工作列 OneDrive 圖示沒有轉圈）；按「重新載入」。若你是「另存新檔」，要重新產生內嵌程式碼。 |
| 簡報筆／方向鍵沒反應 | 焦點不在播放器上。用滑鼠點一下投影片，或按本站「全螢幕」（會自動把焦點移進播放器）。 |
| iPhone 上沒有「全螢幕」按鈕 | iPhone 的 Safari 不支援網頁元素全螢幕，本站因此不顯示這個按鈕。把手機橫放，或用播放器右下角自己的放大按鈕，或按「網頁版開啟」。 |
| 某個 PowerPoint 動畫在網頁上不一樣 | PowerPoint 網頁版不支援所有桌面版效果（例如部分 3D、嵌入字型、某些觸發器）。用 [TESTING.md](TESTING.md) 的清單測一次，必要時改用網頁版支援的效果。 |
| 想停止分享某份簡報 | 到 OneDrive 對該檔案按「共用」→「管理存取權」，刪除對應的連結（含內嵌連結），再把它從 JSON 移除。只從 JSON 移除**不會**讓已知道連結的人失去存取權。 |
