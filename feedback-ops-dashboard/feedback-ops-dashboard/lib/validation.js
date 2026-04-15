const {
  ALLOWED_STATUS,
  ALLOWED_PRIORITY,
  ALLOWED_CATEGORY,
  ALLOWED_SOURCE,
} = require('./constants');

const ALLOWED_STATUS_SET = new Set(ALLOWED_STATUS);
const ALLOWED_PRIORITY_SET = new Set(ALLOWED_PRIORITY);
const ALLOWED_CATEGORY_SET = new Set(ALLOWED_CATEGORY);
const ALLOWED_SOURCE_SET = new Set(ALLOWED_SOURCE);

function normalizeString(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function validateFeedbackInput(payload) {
  const text = normalizeString(payload?.text);
  const source = normalizeString(payload?.source, 'manual').toLowerCase() || 'manual';

  if (text.length < 12) {
    return { ok: false, error: 'text must be at least 12 characters' };
  }

  if (text.length > 1000) {
    return { ok: false, error: 'text must be under 1000 characters' };
  }

  if (!ALLOWED_SOURCE_SET.has(source)) {
    return { ok: false, error: `source must be one of: ${ALLOWED_SOURCE.join(', ')}` };
  }

  return {
    ok: true,
    value: { text, source },
  };
}

function validateStatus(value) {
  const status = normalizeString(value).toLowerCase();
  if (!ALLOWED_STATUS_SET.has(status)) {
    return { ok: false, error: `status must be one of: ${ALLOWED_STATUS.join(', ')}` };
  }
  return { ok: true, value: status };
}

function parseFilters(query) {
  const filters = {};
  if (ALLOWED_CATEGORY_SET.has(normalizeString(query.category).toLowerCase())) {
    filters.category = normalizeString(query.category).toLowerCase();
  }
  if (ALLOWED_PRIORITY_SET.has(normalizeString(query.priority).toLowerCase())) {
    filters.priority = normalizeString(query.priority).toLowerCase();
  }
  if (ALLOWED_STATUS_SET.has(normalizeString(query.status).toLowerCase())) {
    filters.status = normalizeString(query.status).toLowerCase();
  }
  if (ALLOWED_SOURCE_SET.has(normalizeString(query.source).toLowerCase())) {
    filters.source = normalizeString(query.source).toLowerCase();
  }
  const q = normalizeString(query.q);
  if (q) filters.q = q.slice(0, 120);
  return filters;
}

module.exports = {
  validateFeedbackInput,
  validateStatus,
  parseFilters,
};
