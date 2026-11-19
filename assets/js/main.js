// 首頁：科目／年級／冊別／章節篩選、搜尋、簡報卡片。
import { loadCatalog, checkMsUrl, openTarget, REASON_TEXT } from './catalog.js';

const $ = (id) => document.getElementById(id);
const ALL = '';

const state = { subject: ALL, grade: ALL, volume: ALL, chapter: ALL, q: '' };
let catalog = { subjects: [], presentations: [] };

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

// 全形轉半形、忽略大小寫與空白，讓「1－1」「１-１」都找得到。
function norm(s) {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

function readUrl() {
  const p = new URLSearchParams(location.search);
  state.subject = p.get('s') || ALL;
  state.grade = p.get('g') || ALL;
  state.volume = p.get('v') || ALL;
  state.chapter = p.get('c') || ALL;
  state.q = p.get('q') || '';
}

function writeUrl() {
  const p = new URLSearchParams();
  if (state.subject) p.set('s', state.subject);
  if (state.grade) p.set('g', state.grade);
  if (state.volume) p.set('v', state.volume);
  if (state.chapter) p.set('c', state.chapter);
  if (state.q) p.set('q', state.q);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function uniq(list) {
  return [...new Set(list.filter(Boolean))];
}

// 依前面的選擇逐層縮小下一層的選項；不存在的選擇自動清掉。
function fillSelect(select, values, current, allLabel) {
  select.replaceChildren(el('option', { value: ALL, text: allLabel }), ...values.map((v) => el('option', { value: v, text: v })));
  const keep = values.includes(current) ? current : ALL;
  select.value = keep;
  select.disabled = values.length === 0;
  return keep;
}

function renderSubjects() {
  const list = $('subjects');
  const items = [{ id: ALL, name: '全部' }, ...catalog.subjects];
  if (state.subject && !catalog.subjects.some((s) => s.id === state.subject)) state.subject = ALL;
  list.replaceChildren(
    ...items.map((s) => {
      const b = el('button', { type: 'button', 'data-subject': s.id, 'aria-pressed': String(s.id === state.subject), text: s.name });
      b.addEventListener('click', () => {
        state.subject = s.id;
        state.grade = state.volume = state.chapter = ALL;
        update();
      });
      return el('li', {}, [b]);
    }),
  );
}

function renderFilters() {
  const bySubject = catalog.presentations.filter((p) => !state.subject || p.subject === state.subject);
  state.grade = fillSelect($('f-grade'), uniq(bySubject.map((p) => p.grade)), state.grade, '全部年級');
  const byGrade = bySubject.filter((p) => !state.grade || p.grade === state.grade);
  state.volume = fillSelect($('f-volume'), uniq(byGrade.map((p) => p.volume)), state.volume, '全部冊別');
  const byVolume = byGrade.filter((p) => !state.volume || p.volume === state.volume);
  state.chapter = fillSelect($('f-chapter'), uniq(byVolume.map((p) => p.chapter)), state.chapter, '全部章節');
  return byVolume.filter((p) => !state.chapter || p.chapter === state.chapter);
}

function matches(p, terms, subjectName) {
  const hay = norm([p.title, p.description, p.chapter, p.volume, p.grade, subjectName, ...p.tags].join(' '));
  return terms.every((t) => hay.includes(t));
}

function card(p, subjectName) {
  const embed = checkMsUrl(p.embedUrl);
  const openUrl = openTarget(p);

  const crumbs = el('div', { class: 'crumbs' }, [
    el('span', { class: 'chip', text: subjectName }),
    p.grade && el('span', { class: 'chip plain', text: p.grade }),
    p.volume && el('span', { class: 'chip plain', text: p.volume }),
  ]);

  const play = embed.ok
    ? el('a', { class: 'btn btn-primary', href: `player.html?id=${encodeURIComponent(p.id)}` }, [icon('play'), document.createTextNode('播放')])
    : el('span', { class: 'btn btn-primary', 'aria-disabled': 'true' }, [icon('play'), document.createTextNode('無法播放')]);

  const actions = el('div', { class: 'actions' }, [
    play,
    openUrl &&
      el('a', { class: 'btn', href: openUrl, target: '_blank', rel: 'noopener noreferrer', title: '在新分頁用 PowerPoint 網頁版開啟' }, [
        icon('external'),
        document.createTextNode('網頁版'),
      ]),
  ]);

  return el('li', {}, [
    el('article', { class: 'card', 'data-id': p.id }, [
      crumbs,
      el('h2', { text: p.title }),
      p.chapter && el('p', { class: 'chapter', text: p.chapter }),
      el('p', { class: 'desc', text: p.description }),
      !embed.ok && el('p', { class: 'notice', text: REASON_TEXT[embed.reason] }),
      p.updated && el('p', { class: 'updated', text: `索引更新：${p.updated}` }),
      actions,
    ]),
  ]);
}

function update() {
  renderSubjects();
  const pool = renderFilters();
  if ($('f-q').value !== state.q) $('f-q').value = state.q;
  const names = new Map(catalog.subjects.map((s) => [s.id, s.name]));
  const terms = norm(state.q) ? state.q.normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean) : [];
  const shown = pool.filter((p) => matches(p, terms, names.get(p.subject)));

  const grid = $('grid');
  if (shown.length) {
    grid.replaceChildren(...shown.map((p) => card(p, names.get(p.subject))));
  } else {
    grid.replaceChildren(el('li', { class: 'empty', text: catalog.presentations.length ? '沒有符合條件的簡報。試試清除條件或換個關鍵字。' : '目前還沒有任何簡報。' }));
  }
  $('result-meta').textContent = `共 ${shown.length} 份簡報`;
  writeUrl();
}

function bind() {
  $('filters').addEventListener('submit', (e) => e.preventDefault());
  $('f-grade').addEventListener('change', (e) => {
    state.grade = e.target.value;
    state.volume = state.chapter = ALL;
    update();
  });
  $('f-volume').addEventListener('change', (e) => {
    state.volume = e.target.value;
    state.chapter = ALL;
    update();
  });
  $('f-chapter').addEventListener('change', (e) => {
    state.chapter = e.target.value;
    update();
  });
  $('f-q').addEventListener('input', (e) => {
    state.q = e.target.value;
    update();
  });
  $('f-clear').addEventListener('click', () => {
    Object.assign(state, { subject: ALL, grade: ALL, volume: ALL, chapter: ALL, q: '' });
    update();
    $('f-q').focus();
  });
}

async function start() {
  readUrl();
  bind();
  try {
    catalog = await loadCatalog();
  } catch (err) {
    console.error(err);
    $('result-meta').textContent = '';
    $('grid').replaceChildren(el('li', { class: 'load-error', text: '簡報清單載入失敗。請確認網路連線後重新整理；若持續發生，請檢查 data/presentations.json 格式。' }));
    return;
  }
  update();
}

start();
