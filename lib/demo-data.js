const crypto = require('crypto');
const { classifyFeedback } = require('./classify');

const DEMO_ITEMS = [
  {
    text: 'Mobile users get stuck on the CSV import step and think the upload is broken, which blocks setup completion.',
    source: 'sales',
    status: 'reviewing',
    hoursAgo: 4,
  },
  {
    text: 'Enterprise prospects keep asking for SSO mapping controls because the current role setup is too manual during security reviews.',
    source: 'enterprise',
    status: 'planned',
    hoursAgo: 9,
  },
  {
    text: 'Billing owners say invoice exports are confusing and they cannot reconcile credits without opening support tickets.',
    source: 'support',
    status: 'new',
    hoursAgo: 14,
  },
  {
    text: 'A churn-risk account reported that the checkout confirmation sometimes freezes on mobile after payment succeeds.',
    source: 'churn',
    status: 'reviewing',
    hoursAgo: 20,
  },
  {
    text: 'VIP pilot users asked for a clean export of feedback status changes so weekly product reviews are easier to run.',
    source: 'vip',
    status: 'planned',
    hoursAgo: 28,
  },
  {
    text: 'Demo sessions reveal that new evaluators do not understand why duplicate feedback gets merged into one backlog item.',
    source: 'demo',
    status: 'shipped',
    hoursAgo: 36,
  },
];

function buildDemoStore(now = Date.now()) {
  return {
    feedback: DEMO_ITEMS.map((item) => {
      const createdAt = new Date(now - item.hoursAgo * 60 * 60 * 1000).toISOString();
      const labels = classifyFeedback(item.text, item.source);

      return {
        id: crypto.randomUUID(),
        text: item.text,
        source: item.source,
        category: labels.category,
        priority: labels.priority,
        summary: labels.summary,
        signals: labels.signals,
        status: item.status,
        createdAt,
        statusUpdatedAt: createdAt,
      };
    }),
  };
}

module.exports = {
  buildDemoStore,
};
