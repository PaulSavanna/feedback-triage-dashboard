const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { buildDemoStore } = require('./demo-data');

const DEFAULT_DATA = {
  feedback: [],
};

let mutationQueue = Promise.resolve();

function getStoragePath() {
  return process.env.FEEDBACK_STORAGE_PATH || path.join(process.cwd(), 'data', 'feedback-store.json');
}

function shouldSeedDemoData() {
  return (process.env.FEEDBACK_SEED_MODE || 'demo').toLowerCase() === 'demo';
}

function initialData() {
  return shouldSeedDemoData() ? buildDemoStore() : DEFAULT_DATA;
}

function queueMutation(task) {
  const run = mutationQueue.then(task, task);
  mutationQueue = run.catch(() => {});
  return run;
}

async function ensureStorage() {
  const storagePath = getStoragePath();

  try {
    await fs.access(storagePath);
  } catch {
    await writeStore(initialData());
  }
}

async function readStore() {
  const storagePath = getStoragePath();
  await ensureStorage();
  const raw = await fs.readFile(storagePath, 'utf8');

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.feedback)) {
      throw new Error('invalid-root');
    }
    return parsed;
  } catch {
    const backupPath = `${storagePath}.corrupted.${Date.now()}.json`;
    await fs.mkdir(path.dirname(storagePath), { recursive: true });
    await fs.rename(storagePath, backupPath);
    await writeStore(initialData());
    return initialData();
  }
}

async function writeStore(data) {
  const storagePath = getStoragePath();
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  const tempPath = `${storagePath}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
  await fs.rename(tempPath, storagePath);
}

function normalizeItem(item) {
  return {
    id: item.id,
    text: item.text,
    summary: item.summary,
    source: item.source,
    category: item.category,
    priority: item.priority,
    status: item.status || 'new',
    statusUpdatedAt: item.statusUpdatedAt || item.createdAt,
    signals: item.signals || {},
    createdAt: item.createdAt,
  };
}

function describeFilters(filters = {}) {
  const active = [];
  if (filters.source) active.push(`source=${filters.source}`);
  if (filters.category) active.push(`category=${filters.category}`);
  if (filters.priority) active.push(`priority=${filters.priority}`);
  if (filters.status) active.push(`status=${filters.status}`);
  if (filters.q) active.push(`q=${filters.q}`);
  return active;
}

async function listFeedback(filters = {}) {
  const items = (await readStore()).feedback
    .map(normalizeItem)
    .sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));

  return items.filter((item) => {
    if (filters.category && item.category !== filters.category) return false;
    if (filters.priority && item.priority !== filters.priority) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.source && item.source !== filters.source) return false;
    if (filters.q) {
      const query = filters.q.toLowerCase();
      const haystack = `${item.text} ${item.summary} ${item.source}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

async function addFeedback(item) {
  return queueMutation(async () => {
    const store = await readStore();
    const timestamp = new Date().toISOString();
    const next = normalizeItem({
      id: crypto.randomUUID(),
      ...item,
      createdAt: timestamp,
      status: item.status || 'new',
      statusUpdatedAt: timestamp,
    });

    store.feedback.unshift(next);
    await writeStore(store);
    return next;
  });
}

async function updateFeedbackStatus(id, status) {
  return queueMutation(async () => {
    const store = await readStore();
    const existing = store.feedback.find((item) => item.id === id);
    if (!existing) return null;
    existing.status = status;
    existing.statusUpdatedAt = new Date().toISOString();
    await writeStore(store);
    return normalizeItem(existing);
  });
}

async function buildSummary(filters = {}) {
  const items = await listFeedback(filters);
  const counters = {
    total: items.length,
    bug: 0,
    ux: 0,
    feature: 0,
    support: 0,
    high: 0,
    medium: 0,
    low: 0,
    new: 0,
    reviewing: 0,
    planned: 0,
    shipped: 0,
  };

  const priorityWeight = { high: 3, medium: 2, low: 1 };
  const topIssues = items
    .map((item) => ({
      ...item,
      score:
        (priorityWeight[item.priority] || 1) +
        (item.category === 'bug' ? 2 : 0) +
        (item.signals?.mentionsBlocking ? 2 : 0) +
        (item.signals?.mentionsBilling ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)))
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      title: item.summary,
      category: item.category,
      priority: item.priority,
      status: item.status,
      score: item.score,
    }));

  for (const item of items) {
    counters[item.category] = (counters[item.category] || 0) + 1;
    counters[item.priority] = (counters[item.priority] || 0) + 1;
    counters[item.status] = (counters[item.status] || 0) + 1;
  }

  return {
    counters,
    topIssues,
    highlights: {
      blocking: items.filter((item) => item.signals?.mentionsBlocking).length,
      mobile: items.filter((item) => item.signals?.mentionsMobile).length,
      billing: items.filter((item) => item.signals?.mentionsBilling).length,
      importExport: items.filter((item) => item.signals?.mentionsImportExport).length,
    },
  };
}

async function exportMarkdown(filters = {}) {
  const items = await listFeedback(filters);
  const summary = await buildSummary(filters);
  const activeFilters = describeFilters(filters);
  const lines = [];

  lines.push('# Feedback triage export');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  if (activeFilters.length) {
    lines.push(`Filters: ${activeFilters.join(', ')}`);
  } else {
    lines.push('Filters: none (full backlog)');
  }
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Total items: ${summary.counters.total}`);
  lines.push(`- High priority: ${summary.counters.high}`);
  lines.push(`- Planned: ${summary.counters.planned}`);
  lines.push('');
  lines.push('## Top issues');
  if (summary.topIssues.length === 0) {
    lines.push('- No issues yet.');
  } else {
    for (const issue of summary.topIssues) {
      lines.push(`- [${issue.priority.toUpperCase()}][${issue.category}] ${issue.title}`);
    }
  }
  lines.push('');
  lines.push('## Backlog');
  if (items.length === 0) {
    lines.push('- No entries captured.');
  } else {
    for (const item of items) {
      lines.push(`### ${item.summary}`);
      lines.push(`- Category: ${item.category}`);
      lines.push(`- Priority: ${item.priority}`);
      lines.push(`- Status: ${item.status}`);
      lines.push(`- Status updated: ${item.statusUpdatedAt}`);
      lines.push(`- Source: ${item.source}`);
      lines.push(`- Created: ${item.createdAt}`);
      lines.push(`- Notes: ${item.text}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

module.exports = {
  listFeedback,
  addFeedback,
  updateFeedbackStatus,
  buildSummary,
  exportMarkdown,
};
