# 資訊安全說明

## 核心原則

**本站的一切都是公開的。** GitHub Pages 網站、原始碼、`presentations.json` 裡的每個簡報連結，任何人都可能看到。本站因此**不保存任何秘密**：沒有帳號、密碼、Token、API Key，也沒有後端。

即使有人拿到完整原始碼、網址與所有簡報連結，他能做的也只有：**觀看（並可能複製）你已主動分享的那幾份簡報**。他拿不到你的 OneDrive 其他檔案、Microsoft 帳號或 GitHub 帳號。

## 已實作的保護

| 項目 | 做法 |
|---|---|
| 只分享單一檔案 | 每份簡報用自己的內嵌連結（連結內的 `authkey` 只能開這一個檔案）；不分享資料夾或根目錄 |
| 不需登入 | 教室電腦不用登入 Microsoft、GitHub，也不用安裝 OneDrive |
| 前端無憑證 | `scripts/validate.mjs` 在每次部署前掃描 GitHub/Microsoft/Google/AWS token、私鑰、client secret、密碼樣式字串，有就擋下部署 |
| 不持久儲存 | 不使用 localStorage、IndexedDB、Cache Storage、cookie、Service Worker（自動檢查＋瀏覽器測試驗證）。唯一使用的是 sessionStorage 記「淺色／深色」外觀，關閉分頁即消失，不含任何簡報內容 |
| 不下載 PPTX | 本站只嵌入 Microsoft 播放器，不提供、不觸發 PPTX 下載 |
| 連結來源白名單 | 只接受 `https://` 的 `onedrive.live.com`、`1drv.ms`、`*.officeapps.live.com`、`*.sharepoint.com`；其他網址（或 http）一律拒絕載入，按鈕也不顯示 |
| Content Security Policy | 每頁以 `<meta>` 設 CSP：只執行本站腳本、只連本站資料、只允許上述微軟網域的 iframe、禁止 `<base>` 與表單送出 |
| iframe 最低權限 | `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"`（每一項都經實測為播放所必需）、`allow="fullscreen"`。**不給**頂層導覽（播放器不能把整頁導到別處）、**不給** `allow-downloads`（播放器框架內無法直接觸發下載） |
| 無第三方追蹤 | 不載入任何分析、廣告、字型 CDN 或外部 JS／CSS |
| 不被搜尋引擎收錄 | `<meta name="robots" content="noindex, nofollow">`（只是減少曝光，**不是**存取控制） |
| 外部連結 | 一律 `target="_blank" rel="noopener noreferrer"` |
| 不提交私人檔案 | `.gitignore` 排除 `.env`、金鑰、`*token*`、`*secret*` 與 PPT 原檔 |

## 必須誠實說明的限制

1. **唯讀分享 ≠ 禁止複製。** 能看到的人就能截圖、錄影、拍照；透過 Microsoft 播放器或檢視連結，也可能列印或下載該檔案。不想外流的內容（例如考題、學生個資）**不要放進分享的簡報**。
2. **簡報連結等於鑰匙。** 任何拿到 `embedUrl`／`openUrl` 的人都能看這份簡報，而這些連結就放在公開的 JSON 裡。要撤銷，必須到 OneDrive「管理存取權」刪除連結；只從 JSON 刪掉不夠。
3. **無痕模式不是隱形模式。** 無痕視窗關閉後會清除瀏覽紀錄、cookie 與網站資料，但學校電腦可能有：系統層級監控或還原軟體、鍵盤側錄、螢幕錄影、網路代理紀錄、瀏覽器擴充功能（部分擴充在無痕下也會執行）、DNS 紀錄。本站無法防範這些。
4. **前端密碼鎖、隱藏網址、程式碼混淆都不是安全機制**，本站刻意不做，以免造成錯誤的安全感。
5. **GitHub Pages 不能自訂 HTTP 標頭。** 因此無法設定 `frame-ancestors`、`X-Frame-Options`、`Permissions-Policy` 標頭。影響：別人可以把本站嵌進他的網頁。由於本站沒有登入、沒有會改變資料的操作，風險很低。
6. **依賴 Microsoft 服務。** 若 Microsoft 改變內嵌政策或服務故障，播放會失效，本站無法從前端修復。
7. **學校帳號的 OneDrive** 通常禁止匿名連結；若學校允許，播放器可能要求登入。**絕對不要在教室電腦上輸入任何帳號密碼**；看到登入畫面就關閉，改用網頁版備援或換個人 OneDrive。

## 教室公用電腦使用守則

1. 開 Chrome **無痕視窗**（Ctrl+Shift+N），輸入本站網址。
2. **不要登入**任何 Microsoft、Google、GitHub 帳號；本站任何頁面都不需要登入。如果出現登入畫面，代表連結設定錯誤，關掉即可。
3. 不要下載簡報檔，不要讓瀏覽器「記住密碼」。
4. 下課後**關閉所有無痕視窗**（全部關閉後，該次的瀏覽資料才會清除）。
5. 若懷疑某個簡報連結外流到不該看的人手上：到 OneDrive 刪除該檔的分享連結，重新產生內嵌程式碼並更新 JSON。

## 你自己的帳號安全

- GitHub、Microsoft 帳號都開啟兩步驟驗證。
- 只在自己的裝置上編輯 JSON 或登入 OneDrive。
- 不要把任何 Token 或密碼貼進 repo、Issue 或 commit 訊息；若不慎提交，**立即撤銷該憑證**（光刪 commit 不夠，Git 歷史仍保留）。

## 新增允許的網域

若 Microsoft 改了內嵌網址網域，需同時修改三處：

1. `assets/js/catalog.js` 的 `EXACT_HOSTS`／`HOST_SUFFIXES`
2. `player.html`、`helper.html` 的 CSP `frame-src`
3. `scripts/validate.mjs` 外部網址檢查的例外清單

只加入確認屬於 Microsoft 的網域。
