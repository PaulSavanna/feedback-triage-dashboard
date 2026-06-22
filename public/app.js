const feedbackForm = document.getElementById('feedbackForm');
const feedbackText = document.getElementById('feedbackText');
const sourceInput = document.getElementById('sourceInput');
const submitBtn = document.getElementById('submitBtn');
const formMessage = document.getElementById('formMessage');
const appMessage = document.getElementById('appMessage');
const metricsBox = document.getElementById('metrics');
const topIssues = document.getElementById('topIssues');
const highlightsBox = document.getElementById('highlights');
const feedbackList = document.getElementById('feedbackList');
const refreshBtn = document.getElementById('refreshBtn');
const exportLink = document.getElementById('exportLink');

const sourceFilter = document.getElementById('sourceFilter');
const categoryFilter = document.getElementById('categoryFilter');
const priorityFilter = document.getElementById('priorityFilter');
const statusFilter = document.getElementById('statusFilter');
const queryInput = document.getElementById('queryInput');

let loadRequestId = 0;

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (typeof text === 'string') node.textContent = text;
  return node;
}

function setFormMessage(message, tone = 'default') {
  formMessage.textContent = message;
  formMessage.className = `message ${tone === 'error' ? 'message-error' : 'meta'}`;
}

function setAppMessage(message, tone = 'default') {
  appMessage.textContent = message;
  appMessage.className = `message ${tone === 'error' ? 'message-error' : 'meta'}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return response.json();
}

function metricCard(label, value) {
  const box = makeElement('div', 'metric');
  box.append(makeElement('span', 'meta metric-label', label), makeElement('strong', '', String(value)));
  return box;
}

function renderMetrics(summary) {
  metricsBox.innerHTML = '';
  const entries = [
    ['Total', summary.counters.total],
    ['High priority', summary.counters.high],
    ['New', summary.counters.new],
    ['Reviewing', summary.counters.reviewing],
    ['Planned', summary.counters.planned],
    ['Shipped', summary.counters.shipped],
  ];

  entries.forEach(([label, value]) => metricsBox.appendChild(metricCard(label, value)));
}

function renderHighlights(summary) {
  highlightsBox.innerHTML = '';
  const items = [
    `Blocking reports: ${summary.highlights.blocking}`,
    `Mobile issues: ${summary.highlights.mobile}`,
    `Billing mentions: ${summary.highlights.billing}`,
    `Import/export mentions: ${summary.highlights.importExport}`,
  ];

  items.forEach((text) => highlightsBox.appendChild(makeElement('div', 'pill subtle', text)));
}

function renderTopIssues(summary) {
  topIssues.innerHTML = '';
  if (!summary.topIssues.length) {
    topIssues.appendChild(makeElement('li', 'meta', 'No issues match the current filters.'));
    return;
  }

  summary.topIssues.forEach((issue) => {
    const li = makeElement('li', 'issue-item');
    const title = makeElement('strong', '', issue.title);
    const meta = makeElement(
      'div',
      'meta',
      `${issue.category.toUpperCase()} • ${issue.priority.toUpperCase()} • ${issue.status.toUpperCase()} • score ${issue.score}`
    );
    li.append(title, meta);
    topIssues.appendChild(li);
  });
}

function statusSelect(item) {
  const select = document.createElement('select');
  select.setAttribute('aria-label', `Workflow state for ${item.summary}`);

  ['new', 'reviewing', 'planned', 'shipped'].forEach((status) => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status;
    option.selected = item.status === status;
    select.appendChild(option);
  });

  select.addEventListener('change', async () => {
    select.disabled = true;
    setAppMessage('Saving workflow state...');

    try {
      await fetchJson(`/api/feedback/${item.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: select.value }),
      });
      setAppMessage('Workflow state updated.');
      await loadAll();
    } catch (error) {
      setAppMessage(error.message || 'Failed to update workflow state.', 'error');
    } finally {
      select.disabled = false;
    }
  });

  return select;
}

function feedbackCard(item) {
  const card = makeElement('div', 'item');
  const head = makeElement('div', 'item-head');
  const left = makeElement('div');
  left.append(
    makeElement('strong', '', item.summary),
    makeElement('p', 'meta', `Source: ${item.source} • ${new Date(item.createdAt).toLocaleString()}`)
  );

  const badges = makeElement('div', 'badges');
  badges.append(
    makeElement('span', 'badge', item.category),
    makeElement('span', `badge priority-${item.priority}`, item.priority),
    makeElement('span', `badge status-${item.status}`, item.status)
  );

  head.append(left, badges);
  const body = makeElement('p', 'body-copy', item.text);

  const footer = makeElement('div', 'item-footer');
  footer.append(makeElement('span', 'meta', 'Workflow state'), statusSelect(item));

  card.append(head, body, footer);
  return card;
}

function renderFeedback(items) {
  feedbackList.innerHTML = '';
  if (!items.length) {
    feedbackList.appendChild(makeElement('div', 'meta', 'No feedback matches the current filters.'));
    return;
  }

  items.forEach((item) => feedbackList.appendChild(feedbackCard(item)));
}

function buildQueryString() {
  const params = new URLSearchParams();
  if (sourceFilter.value) params.set('source', sourceFilter.value);
  if (categoryFilter.value) params.set('category', categoryFilter.value);
  if (priorityFilter.value) params.set('priority', priorityFilter.value);
  if (statusFilter.value) params.set('status', statusFilter.value);
  if (queryInput.value.trim()) params.set('q', queryInput.value.trim());
  const query = params.toString();
  return query ? `?${query}` : '';
}

function syncExportLink(query) {
  exportLink.href = `/api/export.md${query}`;
  exportLink.textContent = query ? 'Export filtered view' : 'Export full backlog';
}

async function loadAll() {
  const requestId = ++loadRequestId;
  const query = buildQueryString();
  syncExportLink(query);
  setAppMessage('Loading backlog...');

  try {
    const [summary, feedback] = await Promise.all([
      fetchJson(`/api/summary${query}`),
      fetchJson(`/api/feedback${query}`),
    ]);

    if (requestId !== loadRequestId) {
      return;
    }

    renderMetrics(summary);
    renderHighlights(summary);
    renderTopIssues(summary);
    renderFeedback(feedback.items || []);
    setAppMessage('');
  } catch (error) {
    if (requestId !== loadRequestId) {
      return;
    }

    renderMetrics({ counters: { total: 0, high: 0, new: 0, reviewing: 0, planned: 0, shipped: 0 } });
    highlightsBox.innerHTML = '';
    topIssues.innerHTML = '';
    feedbackList.innerHTML = '';
    setAppMessage(error.message || 'Failed to load backlog.', 'error');
  }
}

feedbackForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const text = feedbackText.value.trim();
  const source = sourceInput.value;

  setFormMessage('');
  if (!text) {
    setFormMessage('Feedback text is required.', 'error');
    feedbackText.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    await fetchJson('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source }),
    });
    feedbackText.value = '';
    sourceInput.value = 'manual';
    setFormMessage('Feedback captured.');
    await loadAll();
  } catch (error) {
    setFormMessage(error.message || 'Failed to save feedback.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Capture feedback';
  }
});

refreshBtn.addEventListener('click', loadAll);
[sourceFilter, categoryFilter, priorityFilter, statusFilter].forEach((element) => {
  element.addEventListener('change', loadAll);
});

queryInput.addEventListener('input', () => {
  window.clearTimeout(queryInput._debounce);
  queryInput._debounce = window.setTimeout(loadAll, 180);
});

syncExportLink('');
loadAll();
