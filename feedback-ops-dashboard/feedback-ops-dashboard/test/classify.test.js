const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const { classifyFeedback, detectPriority } = require('../lib/classify');

const tempRoot = path.join(process.cwd(), '.tmp-tests');
process.env.FEEDBACK_STORAGE_PATH = path.join(tempRoot, 'feedback-store.json');
process.env.FEEDBACK_SEED_MODE = 'empty';

const { addFeedback, buildSummary, updateFeedbackStatus } = require('../lib/store');
const { validateFeedbackInput, parseFilters } = require('../lib/validation');

test('classifyFeedback marks blocking bugs as high priority', () => {
  const result = classifyFeedback('Mobile import is broken and customers are blocked from finishing setup.', 'sales');
  assert.equal(result.category, 'bug');
  assert.equal(result.priority, 'high');
  assert.equal(result.signals.mentionsMobile, true);
});

test('detectPriority keeps mild feature requests low', () => {
  assert.equal(detectPriority('Would like dark mode one day', 'feature', 'manual'), 'low');
});

test('validation trims filters, rejects short feedback, and enforces source taxonomy', () => {
  assert.equal(validateFeedbackInput({ text: 'too short', source: 'sales' }).ok, false);
  assert.equal(validateFeedbackInput({ text: 'Valid enough feedback text.', source: 'random' }).ok, false);
  assert.equal(parseFilters({ category: 'bug', source: 'sales', q: ' mobile ' }).q, 'mobile');
});

test('store keeps status transitions in summary', async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
  const labels = classifyFeedback('Billing page is broken for mobile users and blocks checkout.', 'vip');
  const created = await addFeedback({ text: 'Billing page is broken for mobile users and blocks checkout.', source: 'vip', ...labels });
  await updateFeedbackStatus(created.id, 'planned');
  const summary = await buildSummary();

  assert.equal(summary.counters.total, 1);
  assert.equal(summary.counters.planned, 1);
  assert.equal(summary.topIssues[0].priority, 'high');
});
