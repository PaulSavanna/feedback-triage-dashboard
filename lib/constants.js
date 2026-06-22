const ALLOWED_STATUS = ['new', 'reviewing', 'planned', 'shipped'];
const ALLOWED_PRIORITY = ['high', 'medium', 'low'];
const ALLOWED_CATEGORY = ['bug', 'ux', 'feature', 'support'];
const ALLOWED_SOURCE = ['manual', 'sales', 'support', 'demo', 'churn', 'enterprise', 'vip'];

const SOURCE_WEIGHTS = {
  manual: 0,
  sales: 2,
  support: 1,
  demo: 1,
  churn: 3,
  enterprise: 3,
  vip: 3,
};

module.exports = {
  ALLOWED_STATUS,
  ALLOWED_PRIORITY,
  ALLOWED_CATEGORY,
  ALLOWED_SOURCE,
  SOURCE_WEIGHTS,
};
