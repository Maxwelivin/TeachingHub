// 播放頁：用 Microsoft 官方內嵌播放器（跨來源 iframe）播放單一簡報。
// 注意：iframe 內容屬於 Microsoft 網域，本頁的 JavaScript 無法也不嘗試控制翻頁、動畫或讀取投影片。
// 本頁只做：選出連結、建立 iframe、重新載入、把「本頁自己的」外框切成全螢幕。
import { loadCatalog, checkMsUrl, openTarget, REASON_TEXT } from './catalog.js';

const $ = (id) => document.getElementById(id);
const SLOW_MS = 20000;

// 內嵌播放器實測需要的最低權限：執行程式、存取自己網域的資料、送出 OneDrive→播放器的內部表單、從播放器開新分頁。
// （實測：少了 allow-forms，OneDrive 無法把檔案交給內層的 PowerPoint 播放器，畫面會一直黑。）
// 刻意不給「頂層導覽」權限：播放器不能把整個頁面導到別的網站。
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';

let frame = null;
let embedUrl = '';
let slowTimer = 0;
let hintTimer = 0;

function showError(title, text) {
  $('loading').hidden = true;
  $('error-title').textContent = title;
  $('error-text').textContent = text;
  $('error').hidden = false;
  $('title').textContent = title;
}

function startLoading() {
  $('loading').hidden = false;
  $('slow').hidden = true;
  clearTimeout(slowTimer);
  slowTimer = setTimeout(() => {
    $('slow').hidden = false;
  }, SLOW_MS);
}

// load 事件只代表 Microsoft 的頁面載入完成；投影片本身可能還要幾秒才畫出來。
function loaded() {
  if (!frame || frame.src === 'about:blank') return;
  clearTimeout(slowTimer);
  $('loading').hidden = true;
}

function mountFrame(title) {
  frame = document.createElement('iframe');
  frame.title = `簡報：${title}`;
  frame.setAttribute('allow', 'fullscreen');
  frame.setAttribute('allowfullscreen', '');
  frame.setAttribute('sandbox', SANDBOX);
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  frame.addEventListener('load', loaded);
  $('stage').append(frame);
  startLoading();
  frame.src = embedUrl;
}

function reload() {
  if (!frame) return;
  startLoading();
  frame.src = 'about:blank';
  setTimeout(() => {
    frame.src = embedUrl;
  }, 60);
}

function fullscreenApi() {
  const stage = $('stage');
  if (document.fullscreenEnabled && stage.requestFullscreen) {
    return { enter: () => stage.requestFullscreen({ navigationUI: 'hide' }) };
  }
  if (document.webkitFullscreenEnabled && stage.webkitRequestFullscreen) {
    return { enter: () => stage.webkitRequestFullscreen() };
  }
  return null; // 例如 iPhone Safari：不提供按鈕，改用播放器內建的放大或橫放手機
}

async function enterFullscreen() {
  const api = fullscreenApi();
  if (!api) return;
  try {
    await api.enter();
  } catch (err) {
    console.warn('全螢幕被瀏覽器拒絕', err);
  }
  // 把焦點移到 iframe。實測：Microsoft 播放器本身在更內層的框架，仍需在投影片上點一下，簡報筆按鍵才會生效。
  if (frame) frame.focus();
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    $('fs-hint').hidden = false;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      $('fs-hint').hidden = true;
    }, 4000);
  }
}

function bindBack() {
  $('back').addEventListener('click', (e) => {
    // 從本站首頁點進來時，用上一頁回去，保留原本的篩選條件
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
}

async function start() {
  bindBack();
  const id = new URLSearchParams(location.search).get('id') || '';
  if (!id) {
    showError('沒有指定簡報', '請從簡報列表選擇要播放的簡報。');
    return;
  }

  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (err) {
    console.error(err);
    showError('簡報清單載入失敗', '請確認網路連線後重新整理頁面。');
    return;
  }

  const p = catalog.presentations.find((x) => x.id === id);
  if (!p) {
    showError('找不到這份簡報', '這份簡報可能已被移除或改名，請回到列表重新選擇。');
    return;
  }

  document.title = `${p.title} · TeachingHub`;
  $('title').textContent = p.title;

  const openUrl = openTarget(p);
  if (openUrl) {
    $('open').href = openUrl;
    $('open').hidden = false;
  }

  const check = checkMsUrl(p.embedUrl);
  if (!check.ok) {
    showError('無法播放', REASON_TEXT[check.reason]);
    $('title').textContent = p.title;
    return;
  }

  embedUrl = check.url;
  $('reload').hidden = false;
  $('reload').addEventListener('click', reload);
  if (fullscreenApi()) {
    $('fullscreen').hidden = false;
    $('fullscreen').addEventListener('click', enterFullscreen);
  }
  mountFrame(p.title);
}

start();
