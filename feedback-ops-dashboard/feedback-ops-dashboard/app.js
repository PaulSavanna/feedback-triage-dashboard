const path = require('path');
const express = require('express');
const { classifyFeedback } = require('./lib/classify');
const {
  addFeedback,
  buildSummary,
  listFeedback,
  updateFeedbackStatus,
  exportMarkdown,
} = require('./lib/store');
const { validateFeedbackInput, validateStatus, parseFilters } = require('./lib/validation');

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json({ limit: '200kb' }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'feedback-ops-dashboard',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/feedback', async (req, res, next) => {
    try {
      const filters = parseFilters(req.query);
      const items = await listFeedback(filters);
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/summary', async (req, res, next) => {
    try {
      const filters = parseFilters(req.query);
      res.json(await buildSummary(filters));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/export.md', async (req, res, next) => {
    try {
      const filters = parseFilters(req.query);
      const markdown = await exportMarkdown(filters);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="feedback-triage-export.md"');
      res.send(markdown);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/feedback', async (req, res, next) => {
    try {
      const validated = validateFeedbackInput(req.body);
      if (!validated.ok) {
        return res.status(400).json({ error: validated.error });
      }

      const { text, source } = validated.value;
      const labels = classifyFeedback(text, source);
      const saved = await addFeedback({
        text,
        source,
        ...labels,
      });

      return res.status(201).json({ item: saved });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/feedback/:id/status', async (req, res, next) => {
    try {
      const status = validateStatus(req.body?.status);
      if (!status.ok) {
        return res.status(400).json({ error: status.error });
      }

      const updated = await updateFeedbackStatus(req.params.id, status.value);
      if (!updated) {
        return res.status(404).json({ error: 'feedback item not found' });
      }

      return res.json({ item: updated });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.parse.failed' || error instanceof SyntaxError) {
      return res.status(400).json({ error: 'request body must be valid JSON' });
    }

    console.error(error);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

module.exports = {
  createApp,
};
