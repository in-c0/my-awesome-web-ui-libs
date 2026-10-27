import { ACTIVITY_TYPES, activityWindow, reconcileMonthlySnapshots } from './timeline-math.js';

// The showcase is deliberately separate from the reusable Web Components.
// It presents one person's curated work without forcing visitors to learn a card interaction.
const $ = selector => document.querySelector(selector);
const make = (tag, className = '', text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const safeUrl = input => {
  if (typeof input !== 'string' || !input.trim()) return '';
  try { const u = new URL(input, location.href); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; }
  catch { return ''; }
};
const amount = item => Number.isFinite(Number(item.activityCount)) ? Math.max(0, Number(item.activityCount)) : 1;
const monthOf = value => String(value || '').slice(0, 7);
const readableDate = date => new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
const categoryNames = { star: 'Starred', fork: 'Forked', project: 'Created', commit: 'Pushed' };
const categoryIcons = { star: '☆', fork: '⑂', project: '+', commit: '↑' };
const categoryLabels = { star: 'Stars', fork: 'Forks', project: 'New repos', commit: 'Pushes' };
const categories = {
  vibo: 'Visual thinking', sumzup: 'Knowledge', consilium: 'AI engineering',
  ssmt: 'Discovery', 'paper-ui': 'Developer tools',
  'shorts-remover': 'Browser extension', 'youtube-to-text': 'Developer tools'
};
const typeFilters = { all: 'All work', product: 'Products', tools: 'Tools & utilities', research: 'Research & discovery' };
const projectKinds = {
  vibo: 'product', sumzup: 'product', consilium: 'research', ssmt: 'research',
  'paper-ui': 'tools', 'shorts-remover': 'tools', 'youtube-to-text': 'tools'
};
const state = {
  manifest: null, projects: [], inspirations: [], stories: [], activities: [],
  stars: [], forks: [], range: 'year', activityType: null, selectedBin: null,
  workFilter: 'all', workQuery: '', collection: 'star', collectionLimit: 6, dataStatus: 'loading'
};

function externalLink(label, href, className = '') {
  const anchor = make('a', className, label);
  anchor.href = safeUrl(href) || '#'; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
  return anchor;
}
function setLinks(container, project) {
  const demo = safeUrl(project.demoUrl || project.url), repo = safeUrl(project.repo && 'https://github.com/' + project.repo);
  if (demo) container.append(externalLink('Open project ↗', demo, 'plain-link'));
  if (repo) container.append(externalLink('Source ↗', repo, 'plain-link subdued'));
}
function projectMedia(project, large = false) {
  const frame = make('div', 'project-media' + (large ? ' large' : ''));
  if (project.image) {
    const image = make('img');
    image.src = safeUrl(new URL(project.image, state.manifestUrl).href);
    image.alt = 'Captured public page of ' + project.title;
    image.loading = 'lazy'; image.decoding = 'async';
    image.addEventListener('error', () => {
      frame.classList.add('unavailable');
      image.remove();
      frame.append(make('span', 'media-fallback', project.summary));
    });
    frame.append(image);
  } else {
    frame.classList.add('editorial');
    frame.append(make('span', 'editorial-category', categories[project.id] || 'Project'));
    frame.append(make('span', 'editorial-message', project.summary));
    frame.append(make('span', 'editorial-address', (safeUrl(project.demoUrl || project.url).split('/')[2] || 'Explore online')));
  }
  return frame;
}
function projectCard(project, index) {
  const card = make('article', 'project-card' + (index === 0 ? ' feature-card' : '') + (!project.image ? ' text-project' : ''));
  const button = make('button', 'project-cover'); button.type = 'button';
  button.setAttribute('aria-label', 'Read about ' + project.title);
  if (project.image) button.append(projectMedia(project, index === 0));
  else button.classList.add('cover-no-image');
  const copy = make('div', 'project-copy');
  const meta = make('div', 'project-meta');
  meta.append(make('span', '', categories[project.id] || 'Project'), make('span', '', String(index + 1).padStart(2, '0')));
  copy.append(meta, make('h3', '', project.title), make('p', '', project.summary));
  if (!project.image) copy.append(make('span', 'inline-domain', (safeUrl(project.demoUrl || project.url).split('/')[2] || 'Read more')));
  button.append(copy); button.addEventListener('click', () => openProject(project));
  const actions = make('div', 'project-actions'); setLinks(actions, project);
  card.append(button, actions); return card;
}
function renderProjects() {
  const filters = $('#project-filters'); filters.replaceChildren();
  for (const [key, label] of Object.entries(typeFilters)) {
    const button = make('button', 'pill' + (state.workFilter === key ? ' selected' : ''), label);
    button.type = 'button'; button.setAttribute('aria-pressed', String(state.workFilter === key));
    button.addEventListener('click', () => { state.workFilter = key; renderProjects(); }); filters.append(button);
  }
  const items = state.projects.filter(project =>
    (state.workFilter === 'all' || projectKinds[project.id] === state.workFilter) &&
    (project.title + ' ' + project.summary).toLowerCase().includes(state.workQuery.toLowerCase())
  );
  const grid = $('#projects-grid'); grid.replaceChildren(...items.map((item, i) => projectCard(item, i)));
  $('#project-count').textContent = `${items.length} of ${state.projects.length} selected projects`;
  if (!items.length) grid.append(make('p', 'empty-state', 'No projects match your search. Try another word or category.'));
}
function openProject(project) {
  const dialog = $('#detail-dialog'), inner = $('#dialog-content'); inner.replaceChildren();
  const head = make('div', 'dialog-topline');
  head.append(make('span', 'kicker', categories[project.id] || 'Project'));
  inner.append(head, make('h2', '', project.title), make('p', 'dialog-description', project.body || project.summary));
  if (project.image) inner.append(projectMedia(project, true));
  const actions = make('div', 'dialog-actions'); setLinks(actions, project); inner.append(actions);
  dialog.showModal();
}
function renderStories() {
  const stories = state.stories, list = $('#story-list'); list.replaceChildren();
  stories.forEach((story, index) => {
    const detail = make('details', 'story-note'); if (index === 0) detail.open = true;
    const summary = make('summary');
    summary.append(make('span', 'story-index', String(index + 1).padStart(2, '0')),
      make('span', 'story-title', story.title), make('span', 'story-marker', '+'));
    const content = make('div', 'story-body'); content.append(make('p', '', story.body || story.summary));
    detail.append(summary, content); list.append(detail);
  });
}
function renderInspirations() {
  const root = $('#inspiration-grid'); root.replaceChildren();
  state.inspirations.forEach((item, index) => {
    const button = make('button', 'inspiration-item'); button.type = 'button';
    button.setAttribute('aria-label', 'Explore inspiration: ' + item.title);
    const thumb = make('div', 'inspiration-photo');
    const source = item.poster || item.image;
    const img = make('img'); img.src = safeUrl(new URL(source, state.manifestUrl).href);
    img.alt = item.title; img.loading = 'lazy'; img.decoding = 'async';
    img.addEventListener('error', () => { img.remove(); thumb.append(make('span', 'media-fallback', item.summary)); });
    thumb.append(img);
    if (item.mediaType === 'video') thumb.append(make('span', 'video-label', 'PLAY ◁'));
    button.append(thumb, make('span', 'inspiration-name', item.title));
    button.addEventListener('click', () => openInspiration(item)); root.append(button);
  });
  $('#inspiration-count').textContent = `${state.inspirations.length} visual references`;
}
function openInspiration(item) {
  const dialog = $('#detail-dialog'), inner = $('#dialog-content'); inner.replaceChildren();
  inner.append(make('span', 'kicker', item.mediaType === 'video' ? 'Motion reference' : 'Visual reference'));
  inner.append(make('h2', '', item.title), make('p', 'dialog-description', item.summary));
  const holder = make('div', 'inspiration-expanded');
  if (item.mediaType === 'video') {
    const video = make('video'); video.src = safeUrl(new URL(item.image, state.manifestUrl).href);
    video.poster = safeUrl(new URL(item.poster, state.manifestUrl).href);
    video.controls = true; video.playsInline = true; video.preload = 'metadata';
    video.setAttribute('aria-label', item.title); holder.append(video);
  } else {
    const img = make('img'); img.src = safeUrl(new URL(item.image, state.manifestUrl).href); img.alt = item.title; holder.append(img);
  }
  inner.append(holder); dialog.showModal();
}
function projectEntries(repos) {
  return repos.map(repo => ({
    id: 'repo:' + repo.full_name, type: repo.fork ? 'fork' : 'project',
    title: repo.fork ? repo.full_name : 'Repository created',
    summary: repo.fork ? (repo.description || 'Forked public repository') : 'Public repository creation. Unfeatured titles are not shown.',
    date: repo.created_at, url: repo.fork ? safeUrl(repo.html_url) : '',
    aggregate: false, source: 'github'
  }));
}
function starEntries(stars) {
  return stars.map(entry => {
    const repo = entry.repo || entry;
    return {id: 'star:' + repo.full_name, type: 'star', title: repo.full_name,
      summary: repo.description || 'Starred repository', date: entry.starred_at || '',
      url: safeUrl(repo.html_url), source: 'github'};
  }).filter(item => item.date);
}
function pushEntries(events) {
  return events.filter(event => event.type === 'PushEvent').map(event => ({
    id: 'push:' + event.id, type: 'commit', title: 'Public code push',
    summary: 'A push event; it can contain more than one commit.',
    date: event.created_at, source: 'github-recent-events'
  }));
}
function compactMonthTotals(repos) {
  const named = new Set(state.projects.map(item => (item.repo || '').toLowerCase()).filter(Boolean));
  const map = new Map();
  for (const repo of repos) {
    if (repo.fork || named.has(String(repo.full_name || '').toLowerCase())) continue;
    const key = monthOf(repo.created_at); if (!/^\d{4}-\d{2}$/.test(key)) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map].map(([month, count]) => ({ id: 'hidden:' + month, type: 'project',
    title: 'Other repositories created', summary: `${count} public repositories were created in this month.`,
    date: month + '-01T12:00:00Z', activityCount: count, aggregate: true, source: 'github' }));
}
async function fetchPages(url, headers, pages = 2) {
  const items = [];
  for (let index = 1; index <= pages; index++) {
    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${index}`, {headers});
    if (!response.ok) throw Error('GitHub API ' + response.status);
    const page = await response.json(); if (!Array.isArray(page)) throw Error('Unexpected API response');
    items.push(...page); if (page.length < 100) break;
  }
  return items;
}
async function fetchPublicActivity() {
  const key = 'profile-atlas-showcase:activity:v1'; let cached;
  try { cached = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
  let data;
  if (cached && Date.now() - cached.time < 21600000) data = cached.data;
  else {
    const base = 'https://api.github.com/users/in-c0';
    const values = await Promise.allSettled([
      fetchPages(base + '/repos?type=owner&sort=created', {}, 3),
      fetchPages(base + '/starred', {'Accept': 'application/vnd.github.star+json'}, 3),
      fetchPages(base + '/events/public', {}, 2)
    ]);
    const failed = values.some(value => value.status !== 'fulfilled');
    data = { repos: values[0].status === 'fulfilled' ? values[0].value : [],
      stars: values[1].status === 'fulfilled' ? values[1].value : [],
      events: values[2].status === 'fulfilled' ? values[2].value : [], failed };
    if (!failed) { try { localStorage.setItem(key, JSON.stringify({time: Date.now(), data})); } catch {} }
  }
  const repoRecords = projectEntries(data.repos), stars = starEntries(data.stars), pushes = pushEntries(data.events);
  const known = [...repoRecords, ...stars];
  const snapshot = reconcileMonthlySnapshots(state.manifest.activitySnapshot,
    state.manifest.activitySnapshotRecordedAt, known);
  state.activities = [...stars, ...repoRecords, ...pushes, ...snapshot];
  state.stars = stars;
  state.forks = repoRecords.filter(item => item.type === 'fork');
  state.dataStatus = data.failed ? 'partial' : 'live';
  renderActivity(); renderCollection();
}
function visibleActivity() {
  const window = activityWindow(state.range, state.activities, new Date());
  return { window, bins: window.bins };
}
function renderActivity() {
  const {window, bins} = visibleActivity();
  $('#period-label').textContent = window.label;
  const periods = $('#period-controls'); periods.replaceChildren();
  for (const [range, label] of [['week', 'This week'], ['month', 'This month'], ['year', 'This year'], ['five', 'Past 5 years'], ['all', 'All']]) {
    const button = make('button', 'range-button' + (state.range === range ? ' selected' : ''), label);
    button.type = 'button'; button.setAttribute('aria-pressed', String(state.range === range));
    button.addEventListener('click', () => {state.range = range; state.selectedBin = null; renderActivity();});
    periods.append(button);
  }
  const filters = $('#activity-type-filters'); filters.replaceChildren();
  for (const type of ACTIVITY_TYPES) {
    const button = make('button', 'activity-filter filter-' + type + (state.activityType === type ? ' selected' : ''),
      `${categoryIcons[type]} ${categoryLabels[type]}`);
    button.type = 'button'; button.setAttribute('aria-pressed', String(state.activityType === type));
    button.addEventListener('click', () => { state.activityType = state.activityType === type ? null : type; state.selectedBin = null; renderActivity(); });
    filters.append(button);
  }
  const plot = $('#activity-chart'); plot.replaceChildren();
  const selectedTypes = state.activityType ? [state.activityType] : ACTIVITY_TYPES;
  const peak = Math.max(1, ...bins.map(bin => selectedTypes.reduce((sum, type) => sum + bin.counts[type], 0)));
  const minimum = bins.length > 32 ? 26 : bins.length > 14 ? 39 : bins.length > 8 ? 57 : 79;
  plot.style.setProperty('--bin-width', minimum + 'px');
  const lastWithData = [...bins].reverse().find(bin => selectedTypes.some(type => bin.counts[type]));
  const activeKey = state.selectedBin && bins.some(bin => bin.key === state.selectedBin)
    ? state.selectedBin : lastWithData?.key || null;
  for (const [index, bin] of bins.entries()) {
    const column = make('button', 'chart-column' + (bin.key === activeKey ? ' active' : '') + (bin.future ? ' future' : ''));
    column.type = 'button';
    const total = selectedTypes.reduce((sum, type) => sum + bin.counts[type], 0);
    const stack = make('span', 'chart-stack');
    const normalized = Math.round((total / peak) * 100);
    for (const type of selectedTypes) {
      const count = bin.counts[type]; if (!count) continue;
      const segment = make('span', 'chart-segment segment-' + type);
      segment.style.height = `${Math.max(2, count / Math.max(1, total) * normalized)}%`;
      stack.append(segment);
    }
    column.append(stack);
    const label = window.grain === 'day' ? String(bin.start.getDate())
      : window.grain === 'year' ? String(bin.start.getFullYear())
      : bins.length <= 12 || index === 0 || bin.start.getMonth() === 0 || index % 3 === 0
        ? bin.start.toLocaleDateString('en', {month: 'short', ...(bin.start.getMonth() === 0 ? {year: '2-digit'} : {})}) : '';
    column.append(make('span', 'chart-axis-label', label));
    column.title = `${bin.label}: ${total} recorded ${total === 1 ? 'activity' : 'activities'}`;
    column.setAttribute('aria-label', column.title + '. View details.');
    column.addEventListener('click', () => {state.selectedBin = bin.key; renderActivity();});
    plot.append(column);
  }
  const totalForRange = selectedTypes.reduce((sum, type) => sum + window.totals[type], 0);
  $('#activity-total').textContent = `${totalForRange.toLocaleString()} recorded in range`;
  $('#activity-density-note').textContent = window.grain === 'day' ? 'Each column is a day.' : window.grain === 'year' ? 'Each column is a year.' : 'Each column is a month.';
  const active = bins.find(bin => bin.key === activeKey);
  renderActivityDetails(active, selectedTypes, window);
  renderMonthlyAnalysis();
  const warning = $('#coverage-message');
  const message = [];
  if (window.monthOnlyOmitted) message.push(`${window.monthOnlyOmitted} month-only records cannot be placed on individual days.`);
  if (state.dataStatus === 'partial') message.push('One or more live GitHub feeds were unavailable.');
  message.push('GitHub provides recent public push events only; this is not a complete commit history.');
  warning.textContent = message.join(' ');
}
function renderActivityDetails(bin, types, window) {
  const heading = $('#activity-details-heading'), container = $('#activity-details'); container.replaceChildren();
  if (!bin) {
    heading.textContent = 'No activity captured';
    container.append(make('p', 'empty-state', 'There are no recorded public events in this period. That does not mean no work happened.'));
    return;
  }
  heading.textContent = bin.label + ' · ' + types.map(type => bin.counts[type] ? `${bin.counts[type]} ${categoryLabels[type].toLowerCase()}` : '').filter(Boolean).join(' / ');
  // Repeated PushEvents tell visitors almost nothing. Keep exact counts in the chart,
  // but collapse indistinguishable same-day records into one honest readable entry.
  const sourceEvents = bin.items.filter(item => types.includes(item.type));
  const dayGroups = new Map(), events = [];
  for (const item of sourceEvents) {
    if (item.type === 'commit' || (item.type === 'project' && !item.url && !item.aggregate)) {
      const key = item.type + ':' + String(item.date).slice(0, 10);
      if (!dayGroups.has(key)) {
        const grouped = {...item, activityCount: 0};
        dayGroups.set(key, grouped); events.push(grouped);
      }
      dayGroups.get(key).activityCount += amount(item);
    } else events.push(item);
  }
  for (const grouped of dayGroups.values()) {
    if (grouped.type === 'commit') {
      grouped.title = 'Public code pushes';
      grouped.summary = `${grouped.activityCount} recorded push events on this day. This is not a commit count.`;
    } else {
      grouped.title = 'Repository creations';
      grouped.summary = `${grouped.activityCount} repository creations on this day. Unfeatured titles are not shown.`;
    }
  }
  events.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  if (!events.length) {container.append(make('p', 'empty-state', 'No item-level records available for this period.')); return;}
  const list = make('div', 'activity-list');
  for (const item of events.slice(0, 8)) {
    const row = make('div', 'activity-item');
    const date = make('span', 'activity-item-date', item.aggregate ? monthOf(item.date) : readableDate(item.date));
    const type = make('span', 'activity-item-type ' + item.type, `${categoryIcons[item.type]} ${categoryNames[item.type]}`);
    const copy = make('div', 'activity-item-copy');
    const count = item.aggregate && item.source !== 'github-recent-events' && !dayGroups.has(item.type + ':' + String(item.date).slice(0, 10)) ? `${amount(item)} × ` : '';
    if (item.url) copy.append(externalLink(count + item.title + ' ↗', item.url, 'activity-item-title'));
    else copy.append(make('strong', 'activity-item-title', count + item.title));
    copy.append(make('p', '', item.summary || 'Public GitHub activity'));
    row.append(date, type, copy); list.append(row);
  }
  container.append(list);
  if (events.length > 8) {
    const more = make('button', 'text-button', `Show ${events.length - 8} more records`);
    more.addEventListener('click', () => {
      for (const item of events.slice(8)) {
        const row = make('div', 'activity-item'), date = make('span', 'activity-item-date', item.aggregate ? monthOf(item.date) : readableDate(item.date));
        const type = make('span', 'activity-item-type ' + item.type, `${categoryIcons[item.type]} ${categoryNames[item.type]}`);
        const copy = make('div', 'activity-item-copy');
        const label = (item.aggregate && !dayGroups.has(item.type + ':' + String(item.date).slice(0, 10)) ? `${amount(item)} × ` : '') + item.title;
        copy.append(item.url ? externalLink(label + ' ↗', item.url, 'activity-item-title') : make('strong', 'activity-item-title', label));
        copy.append(make('p', '', item.summary || 'Public GitHub activity'));
        row.append(date, type, copy); list.append(row);
      }
      more.remove();
    }); container.append(more);
  }
}
function renderMonthlyAnalysis() {
  const months = [...new Set(state.activities.map(item => monthOf(item.date)))].filter(month => /^\d{4}-\d{2}$/.test(month)).sort().reverse();
  const selector = $('#month-selector');
  const current = selector.value && months.includes(selector.value) ? selector.value : months[0];
  selector.replaceChildren(...months.map(month => {
    const option = make('option', '', new Date(month + '-01T12:00:00Z').toLocaleDateString('en', {month: 'long', year: 'numeric'}));
    option.value = month; return option;
  }));
  if (current) selector.value = current;
  const update = () => {
    const results = $('#month-metrics'); results.replaceChildren();
    for (const type of ACTIVITY_TYPES) {
      const entries = state.activities.filter(item => item.type === type && monthOf(item.date) === selector.value);
      const total = entries.reduce((sum, item) => sum + amount(item), 0);
      const button = make('button', 'month-metric'); button.type = 'button';
      button.append(make('span', 'month-metric-label ' + type, categoryLabels[type]), make('strong', '', total.toLocaleString()));
      button.title = `Explore ${categoryLabels[type]} in ${selector.value}`;
      button.addEventListener('click', () => {
        state.range = 'year'; state.activityType = type; state.selectedBin = selector.value; renderActivity();
        $('#activity-details-heading').scrollIntoView({behavior: 'smooth', block: 'center'});
      }); results.append(button);
    }
  };
  selector.onchange = update; update();
}
function renderCollection() {
  const tabs = $('#collection-tabs'); tabs.replaceChildren();
  for (const [key, label] of [['star', 'Starred'], ['fork', 'Forked']]) {
    const button = make('button', 'pill' + (state.collection === key ? ' selected' : ''), label);
    button.type = 'button'; button.setAttribute('aria-pressed', String(state.collection === key));
    button.addEventListener('click', () => {state.collection = key; state.collectionLimit = 6; renderCollection();}); tabs.append(button);
  }
  const items = state.collection === 'star' ? state.stars : state.forks;
  $('#collection-count').textContent = items.length ? `${items.length} captured from GitHub` : state.dataStatus === 'loading' ? 'Loading…' : 'No records available';
  const root = $('#collection-list'); root.replaceChildren();
  for (const item of items.slice(0, state.collectionLimit)) {
    const row = make('article', 'collection-row');
    row.append(make('span', 'collection-icon', categoryIcons[item.type]));
    const copy = make('div', 'collection-copy');
    copy.append(item.url ? externalLink(item.title + ' ↗', item.url) : make('strong', '', item.title));
    copy.append(make('p', '', item.summary)); row.append(copy);
    row.append(make('span', 'collection-date', readableDate(item.date))); root.append(row);
  }
  const more = $('#collection-more'); more.hidden = items.length <= state.collectionLimit;
  more.textContent = `Show more (${Math.min(12, items.length - state.collectionLimit)})`;
}
async function init() {
  const manifestUrl = new URL('../data/in-c0.json', location.href);
  state.manifestUrl = manifestUrl.href;
  state.manifest = await fetch(manifestUrl).then(response => {if (!response.ok) throw Error('Manifest not available'); return response.json();});
  state.projects = state.manifest.projects || [];
  state.inspirations = state.manifest.inspirations || [];
  state.stories = state.manifest.stories || [];
  $('#work-search').addEventListener('input', event => {state.workQuery = event.target.value.trim(); renderProjects();});
  $('#collection-more').addEventListener('click', () => {state.collectionLimit += 12; renderCollection();});
  $('#detail-dialog').addEventListener('close', () => {
    for (const video of $('#detail-dialog').querySelectorAll('video')) { video.pause(); video.removeAttribute('src'); }
  });
  $('#dialog-close').addEventListener('click', () => $('#detail-dialog').close());
  $('#detail-dialog').addEventListener('click', event => {if (event.target.id === 'detail-dialog') event.target.close();});
  renderProjects(); renderStories(); renderInspirations(); renderActivity();
  fetchPublicActivity().catch(() => {state.dataStatus = 'partial'; renderActivity(); renderCollection();});
}
init().catch(error => {
  console.error('Unable to initialise showcase', error);
  $('#projects-grid').replaceChildren(make('p', 'empty-state', 'The project collection could not load. Try refreshing the page.'));
});
