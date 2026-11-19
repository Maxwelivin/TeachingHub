# 測試

## 一、自動測試

需要 Python 3 與 Playwright（`pip install playwright` 後 `python -m playwright install chromium`）。

```powershell
cd C:\Claude\Web\TeachingHub
node scripts/validate.mjs              # 資料格式、憑證掃描、儲存與 CSP 檢查（GitHub 部署前也會自動跑）
python -X utf8 tests/run_tests.py      # 瀏覽器測試（含連到 Microsoft 的實測，約 3 分鐘）
python -X utf8 tests/run_tests.py --no-live   # 只跑不需連外的測試
python -X utf8 tests/run_tests.py -k 搜尋      # 只跑名稱含「搜尋」的測試
python -X utf8 tests/run_tests.py --base https://maxwelivin.github.io/TeachingHub   # 對正式網站跑
```

- 每項測試都用全新、未登入的瀏覽器狀態（等同無痕視窗）。
- 結果寫到 `tests/last-run.md`，截圖在 `tests/screenshots/`。
- 「實測」項目使用 Microsoft 官方部落格公開的範例簡報（OneDrive 個人版、任何人可檢視），只用於測試，不在正式網站上。

### 自動測試涵蓋範圍

| 類別 | 項目 |
|---|---|
| 首頁 | 載入、科目切換、年級→冊別→章節連動、搜尋（含全形字、多關鍵字）、空結果提示、篩選條件寫入網址、清除條件 |
| 資料 | 格式錯誤或重複的資料被略過、資料檔損壞／404 時顯示錯誤、正式資料檔可載入、不顯示未填或格式錯誤的日期 |
| 播放頁 | 沒有 id／找不到／惡意網域／http／未設定連結都顯示錯誤且**不建立 iframe、不顯示無效按鈕**；返回列表保留篩選條件 |
| 安全 | iframe 的 sandbox、allow、referrerpolicy、CSP；外部連結 noopener noreferrer；不使用 localStorage／IndexedDB／Cache／cookie／Service Worker；原始碼無憑證 |
| 介面 | 淺色／深色／跟隨系統；1920×1080、1366×768、iPad、iPhone 無水平捲軸，按鈕至少 44×44 |
| 實測（連 Microsoft） | 未登入可播放；點擊、→、PageDown 前進，←、PageUp 後退；全螢幕佔滿螢幕且點一下後 PageDown 可翻頁；重新載入回到第 1 張；內嵌網址直接開新分頁可播放；iPhone 尺寸可播放 |

**自動測試做不到的事**：判斷動畫效果是否「正確」、實體簡報筆、真正的投影機、Safari／iOS 實機、學校電腦的網路與管控軟體。這些請用下面的清單人工確認。

## 二、人工驗證清單（請用你自己的簡報）

先做一份「測試用 PPT」放進 OneDrive，內容包含：
1. 一張有「按一下時」逐項出現的條列文字（進入動畫：出現、淡出、飛入各一）
2. 一張有「接續前一項」自動動畫
3. 兩張之間設定轉場（淡出、推入、變形 Morph 各一）
4. 一張有影片或音訊（選測）
5. 一張用了特殊字型（標楷體或你常用的字型）

依 [SETUP.md](SETUP.md) 產生內嵌程式碼，加進 `presentations.json` 並部署，然後逐項勾選：

| # | 項目 | 裝置／瀏覽器 | 結果 | 備註 |
|---|---|---|---|---|
| 1 | 無痕視窗開網站，**不登入**就能播放 | 學校 Windows＋Chrome 無痕 | ☐ 未驗證 | |
| 2 | 「按一下」動畫逐項出現（滑鼠點擊） | 學校電腦 | ☐ 未驗證 | |
| 3 | 「按一下」動畫用 → 或 PageDown 逐項出現 | 學校電腦 | ☐ 未驗證 | |
| 4 | 「接續前一項」自動動畫正常 | 學校電腦 | ☐ 未驗證 | |
| 5 | 轉場效果（淡出、推入、Morph）正常 | 學校電腦 | ☐ 未驗證 | Morph 在網頁版可能不同 |
| 6 | 本站「全螢幕」按鈕：簡報佔滿投影畫面 | 學校電腦＋投影機 | ☐ 未驗證 | |
| 7 | 全螢幕後點一下投影片，簡報筆「下一頁／上一頁」有效 | 學校電腦＋簡報筆 | ☐ 未驗證 | |
| 8 | 播放器內建的全螢幕按鈕（右下角）也能用 | 學校電腦 | ☐ 未驗證 | |
| 9 | Esc 離開全螢幕後，「返回列表」回到原本的篩選條件 | 學校電腦 | ☐ 未驗證 | |
| 10 | 在 iPhone 改一個字並存檔 → 學校電腦按「重新載入」看到新內容 | iPhone＋學校電腦 | ☐ 未驗證 | 記下等了幾分鐘 |
| 11 | 「網頁版開啟」在新分頁可播放，且**不要求登入** | 學校電腦 | ☐ 未驗證 | |
| 12 | 特殊字型顯示正確 | 學校電腦 | ☐ 未驗證 | 網頁版可能以替代字型顯示 |
| 13 | 影片／音訊可播放（選測） | 學校電腦 | ☐ 未驗證 | |
| 14 | 首頁與播放頁在 MacBook Safari 正常 | Mac | ☐ 未驗證 | |
| 15 | 首頁與播放頁在 iPhone Safari 正常（橫放可看） | iPhone | ☐ 未驗證 | iPhone 不提供本站全螢幕按鈕 |
| 16 | 首頁與播放頁在 iPad 正常、全螢幕可用 | iPad | ☐ 未驗證 | |
| 17 | 關閉所有無痕視窗後重開，沒有留下任何登入狀態或紀錄 | 學校電腦 | ☐ 未驗證 | |
| 18 | 學校網路沒有擋 onedrive.live.com / officeapps.live.com | 學校電腦 | ☐ 未驗證 | 若被擋需請資訊組放行 |

發現問題時，記下第幾項、什麼裝置、看到什麼畫面（拍照），再回報修正。
