# Phase 0 技術可行性驗證報告

驗證日期：2026-11-19。方法：查 Microsoft 官方文件與 Microsoft Q&A／Tech Community 近期討論，並在本機用 Playwright（Chromium，全新未登入狀態，等同無痕視窗）實際載入 OneDrive 個人版的公開內嵌簡報。

## 結論摘要

| 問題 | 結果 | 依據 |
|---|---|---|
| OneDrive 個人版能否用 iframe 內嵌 PowerPoint | **可以** | 官方文件；本機實測 |
| 不登入 Microsoft 帳號能否播放 | **可以（個人版）** | 本機實測：未登入的瀏覽器從 `127.0.0.1` 網頁內嵌，顯示「SLIDE 1 OF 24」並可翻頁 |
| 學校／公司帳號（OneDrive for Business） | **通常不行**，會要求登入；取決於學校 IT 是否開放匿名分享 | Microsoft Q&A（2025-08、2026-01） |
| 修改原始簡報後是否反映到同一個內嵌連結 | **會**（官方文件明載） | 官方：「Updates to the presentation on OneDrive are automatically reflected on the page where the presentation is embedded.」 |
| 滑鼠點擊、鍵盤翻頁、簡報筆 | **可以**，但要先在投影片上點一下 | 本機實測：點投影片→前進；→、PageDown 前進；←、PageUp 後退（簡報筆送的就是 PageDown／PageUp） |
| PowerPoint 動畫、逐步顯示、轉場 | **有播放跡象，但要用你的簡報人工確認** | 本機實測：範例簡報第 2 張的圖塊是逐一飛入的（截到中間畫面），且按鍵時頁碼停在同一張、畫面改變，表示按鍵先播完動畫才換頁。官方文件沒寫支援範圍；見 [TESTING.md](TESTING.md) |
| 全螢幕 | **可以**：本站把「自己的外框」切成全螢幕（Fullscreen API），iframe 另加 `allow="fullscreen"` 讓播放器內建的全螢幕鈕也能用 | 本機實測 |
| GitHub Pages 有沒有 iframe 限制 | 沒有。但 GitHub Pages **不能自訂 HTTP 標頭**，所以 CSP 用 `<meta>` 設定（`frame-ancestors` 無法用 meta 設定） | GitHub Pages 文件 |
| 單檔唯讀分享會不會暴露其他 OneDrive 資料 | 不會。內嵌／分享連結只對應單一檔案；網址裡的 `authkey` 是**這一個檔案**的存取鑰匙 | 本機觀察：載入過程只出現該檔案的 resid |
| 費用 | 免費 Microsoft 帳號即可；GitHub Pages 公開 repo 免費 | — |

## 實測細節

1. **內嵌流程（2026-11 實際網址轉址鏈）**
   `onedrive.live.com/embed?...&authkey=...&em=2` → 302 → `onedrive.live.com/edit.aspx?...&embed=1` → 內層 `powerpoint.officeapps.live.com/p/PowerPointFrame.aspx?PowerPointView=ChromelessView&Embed=1`。
   新版 OneDrive 的內嵌網址也可能是 `https://1drv.ms/p/c/…?em=2` 形式（實測 1drv.ms 的 Excel 內嵌同樣可在未登入狀態顯示）。
2. **沙箱（sandbox）實測**：最低可用組合是 `allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox`。少了 `allow-forms` 時，OneDrive 無法用內部表單把檔案交給內層的 PowerPoint 播放器，畫面一直黑。本站**不給**頂層導覽（`allow-top-navigation`）與下載（`allow-downloads`）權限。
3. **CSP 實測**：`frame-src` 只開 `onedrive.live.com`、`1drv.ms`、`*.officeapps.live.com`、`*.sharepoint.com`，播放正常、沒有 CSP 錯誤（內層 officeapps 的子框架由 Microsoft 自己的 CSP 管，不受本站限制）。
4. **穩定性觀察**：當天連續載入數十次的過程中，OneDrive 有一次回傳「Something went wrong. This is a temporary issue」，之後恢復正常（其他幾次黑畫面後來查明是測試程式本身的問題，不算在內）。Tech Community 也有 2026-08 Microsoft 服務端故障、內嵌全部空白數天的紀錄（已由 Microsoft 修復）。**結論：這是依賴 Microsoft 服務的架構，必須保留「重新載入」與「網頁版開啟」兩個備援，上課前最好先開一次確認。**

## 跨來源 iframe 的限制（因此本站「不做」的按鈕）

瀏覽器的同源政策禁止本站 JavaScript 讀取或操作 Microsoft 網域的 iframe 內容，Microsoft 也沒有提供這個播放器的公開控制 API。所以：

- **沒有**「上一張／下一張」按鈕：本站無法把翻頁指令送進播放器。翻頁請直接點投影片、用鍵盤或簡報筆。
- **沒有**投影片頁碼、縮圖、進度條：本站讀不到。
- **沒有**「偵測載入失敗」：iframe 的 load 事件只代表 Microsoft 頁面載入完成，看不到裡面有沒有出錯。本站改成「超過 20 秒還沒載入完成就提示你按重新載入或網頁版開啟」。
- 簡報筆：簡報筆送出的是 PageDown／PageUp（或方向鍵）。實測發現 Microsoft 播放器在**兩層** iframe 裡（onedrive.live.com → powerpoint.officeapps.live.com），本站只能把焦點移到外層，所以**進全螢幕後仍要用滑鼠在投影片上點一下**（這一下也會前進一步），之後簡報筆就有效。全螢幕時畫面上方會短暫提示這件事。
- 自動化測試注意：用 Playwright 同步 API 時不能用 `time.sleep`，否則跨網域 iframe 會被暫停而一直黑畫面（這曾讓測試誤判為 OneDrive 故障）。

## 備選方案（若你的帳號無法匿名內嵌時才需要考慮）

| 方案 | 動畫 | 安全性 | 成本 | 備註 |
|---|---|---|---|---|
| A. 改用免費個人 Microsoft 帳號的 OneDrive（**建議**） | 與現行相同 | 相同（單檔連結） | 免費 | 只放教學簡報，與學校帳號分開 |
| B. 請學校 IT 開放「任何人」連結 | 相同 | 由學校政策控管 | 免費 | 不一定會核准 |
| C. Google 簡報「發布到網路」內嵌 | PowerPoint 動畫會部分遺失或改變 | 單檔連結 | 免費 | 需轉檔，不符合「保留 PowerPoint 動畫」需求 |
| D. 匯出 PDF／影片 | 動畫遺失／無法逐步控制 | 檔案公開 | 免費 | 不符合需求，僅作緊急備援 |

## 參考來源

- Microsoft 支援：[Embed a presentation in a web page or blog](https://support.microsoft.com/en-us/powerpoint/embed-a-presentation-in-a-web-page-or-blog)
- Microsoft Q&A（2026-01）：[Embedded PowerPoint Asking for Sign-in](https://learn.microsoft.com/en-us/answers/questions/5727842/embedded-powerpoint-asking-for-sign-in)
- Microsoft Q&A（2025-08）：[How can I embed a PowerPoint in a website via OneDrive without a sign in screen](https://learn.microsoft.com/en-us/answers/questions/5523719/how-can-i-embed-a-powerpoint-in-a-website-via-oned)
- Microsoft Q&A（2026-08）：[Preview for embeddable powerpoints are not working](https://learn.microsoft.com/en-us/answers/questions/5985187/preview-for-embeddable-powerpoints-are-not-working)
- Tech Community（2026-08，Microsoft 確認服務端問題並修復）：[OneDrive no longer creating functional iframe sharing links](https://techcommunity.microsoft.com/discussions/onedriveforbusiness/onedrive-no-longer-creating-functional-iframe-sharing-links/4549101)
- Microsoft 封存部落格（2014，內嵌網址範例來源）：[Include Office content in your web pages](https://learn.microsoft.com/en-us/archive/blogs/arpans/include-office-content-in-your-web-pages)
