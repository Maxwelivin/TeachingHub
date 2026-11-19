// 新增簡報小幫手：只在本分頁內組出 JSON，不送出、不儲存任何資料。
import { loadCatalog, checkMsUrl, extractEmbedSrc, REASON_TEXT } from './catalog.js';

const $ = (id) => document.getElementById(id);
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';
let catalog = { subjects: [], presentations: [] };

function setStatus(node, ok, text) {
  node.textContent = text;
  node.className = `hint ${ok ? 'ok' : 'bad'}`;
}

function fillList(id, values) {
  $(id).replaceChildren(
    ...[...new Set(values.filter(Boolean))].map((v) => {
      const o = document.createElement('option');
      o.value = v;
      return o;
    }),
  );
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function build() {
  const src = extractEmbedSrc($('h-embed').value);
  const embed = checkMsUrl(src);
  if (!$('h-embed').value.trim()) $('h-embed-status').textContent = '';
  else if (embed.ok) setStatus($('h-embed-status'), true, '✓ 已取出內嵌網址');
  else setStatus($('h-embed-status'), false, REASON_TEXT[embed.reason]);

  const openRaw = $('h-open').value.trim();
  const open = checkMsUrl(openRaw);
  if (!openRaw) $('h-open-status').textContent = '';
  else if (open.ok) setStatus($('h-open-status'), true, '✓ 連結可用');
  else setStatus($('h-open-status'), false, REASON_TEXT[open.reason]);

  const id = $('h-id').value.trim();
  if (!id) $('h-id-status').textContent = '';
  else if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) setStatus($('h-id-status'), false, '只能用小寫英文、數字和 -');
  else if (catalog.presentations.some((p) => p.id === id)) setStatus($('h-id-status'), false, '這個 id 已經用過了');
  else setStatus($('h-id-status'), true, '✓ 可以使用');

  const entry = {
    id,
    subject: $('h-subject').value,
    grade: $('h-grade').value.trim(),
    volume: $('h-volume').value.trim(),
    chapter: $('h-chapter').value.trim(),
    title: $('h-title').value.trim(),
    description: $('h-desc').value.trim(),
    embedUrl: embed.ok ? embed.url : '',
    openUrl: open.ok ? open.url : '',
    updated: $('h-updated').value || null,
    tags: $('h-tags')
      .value.split(/[,，、]/)
      .map((t) => t.trim())
      .filter(Boolean),
  };
  $('h-out').textContent = JSON.stringify(entry, null, 2);
  $('h-preview').disabled = !embed.ok;
  return entry;
}

function preview() {
  const entry = build();
  if (!entry.embedUrl) return;
  const wrap = $('h-frame-wrap');
  const frame = document.createElement('iframe');
  frame.title = '內嵌預覽';
  frame.setAttribute('allow', 'fullscreen');
  frame.setAttribute('allowfullscreen', '');
  frame.setAttribute('sandbox', SANDBOX);
  frame.src = entry.embedUrl;
  wrap.replaceChildren(frame);
  wrap.hidden = false;
}

async function copy() {
  try {
    await navigator.clipboard.writeText($('h-out').textContent);
    $('h-copy-status').textContent = '已複製';
  } catch {
    $('h-copy-status').textContent = '無法自動複製，請手動選取上方文字複製';
  }
}

async function start() {
  try {
    catalog = await loadCatalog();
  } catch (err) {
    console.error(err);
  }
  $('h-subject').replaceChildren(
    ...catalog.subjects.map((s) => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.name;
      return o;
    }),
  );
  fillList('dl-grade', catalog.presentations.map((p) => p.grade));
  fillList('dl-volume', catalog.presentations.map((p) => p.volume));
  fillList('dl-chapter', catalog.presentations.map((p) => p.chapter));
  $('h-updated').value = today();
  $('form').addEventListener('submit', (e) => e.preventDefault());
  $('form').addEventListener('input', build);
  $('form').addEventListener('change', build);
  $('h-copy').addEventListener('click', copy);
  $('h-preview').addEventListener('click', preview);
  build();
}

start();
