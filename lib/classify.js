const { SOURCE_WEIGHTS } = require('./constants');

const CATEGORY_RULES = {
  bug: ['bug', 'broken', 'error', 'fail', 'issue', 'crash', 'freeze', 'does not work'],
  ux: ['confusing', 'unclear', 'hard', 'difficult', 'ux', 'onboarding', 'discoverable', 'friction'],
  feature: ['feature', 'would like', 'need', 'add', 'missing', 'export', 'integration', 'support for'],
  support: ['help', 'question', 'how do i', 'pricing', 'invoice', 'support', 'billing'],
};

function detectCategory(text) {
  const value = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
    if (keywords.some((keyword) => value.includes(keyword))) {
      return category;
    }
  }
  return 'feature';
}

function detectPriority(text, category, source = 'manual') {
  const value = text.toLowerCase();
  let score = 0;

  if (category === 'bug') score += 3;
  if (category === 'ux') score += 1;

  if (/(urgent|asap|immediately|critical|blocked|cannot|can't|lost)/.test(value)) score += 3;
  if (/(important|painful|slow|confusing|frustrating)/.test(value)) score += 1;
  if (/(mobile|checkout|payment|billing|import|export|login|sso)/.test(value)) score += 1;

  const normalizedSource = String(source || '').toLowerCase();
  score += SOURCE_WEIGHTS[normalizedSource] || 0;

  if (score >= 5) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function buildSummary(text) {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > 100 ? `${compact.slice(0, 97)}...` : compact;
}

function buildSignals(text) {
  const value = text.toLowerCase();
  return {
    mentionsMobile: value.includes('mobile'),
    mentionsBilling: /billing|invoice|payment|charge/.test(value),
    mentionsImportExport: /import|export|csv/.test(value),
    mentionsBlocking: /blocked|cannot|can't|stuck/.test(value),
  };
}

function classifyFeedback(text, source = 'manual') {
  const category = detectCategory(text);
  const priority = detectPriority(text, category, source);
  return {
    category,
    priority,
    summary: buildSummary(text),
    signals: buildSignals(text),
  };
}

module.exports = {
  classifyFeedback,
  detectCategory,
  detectPriority,
  buildSummary,
};
