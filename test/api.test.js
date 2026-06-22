const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs/promises');
const { createServer } = require('http');

const tempRoot = path.join(process.cwd(), '.tmp-tests');
process.env.FEEDBACK_STORAGE_PATH = path.join(tempRoot, 'feedback-store.json');
process.env.FEEDBACK_SEED_MODE = 'empty';

const { createApp } = require('../app');

async function withServer(run) {
  const app = createApp();
  const server = createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('API creates feedback, updates status, and returns a summary', async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });

  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Mobile import is broken for customers and blocks them from finishing setup.',
        source: 'sales',
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();

    const updateResponse = await fetch(`${baseUrl}/api/feedback/${created.item.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'planned' }),
    });
    assert.equal(updateResponse.status, 200);

    const summaryResponse = await fetch(`${baseUrl}/api/summary`);
    assert.equal(summaryResponse.status, 200);
    const summary = await summaryResponse.json();
    assert.equal(summary.counters.total, 1);
    assert.equal(summary.counters.planned, 1);
    assert.equal(summary.topIssues[0].priority, 'high');
  });
});

test('API rejects invalid feedback payloads', async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'too short', source: 'sales' }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(payload.error, /at least 12 characters/);
  });
});

test('API rejects malformed JSON with 400', async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"text":"broken json"',
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.error, 'request body must be valid JSON');
  });
});

test('summary follows active filters', async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });

  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Mobile import is broken for customers and blocks setup.',
        source: 'sales',
      }),
    });

    await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Support needs a simpler export for weekly notes.',
        source: 'support',
      }),
    });

    const summaryResponse = await fetch(`${baseUrl}/api/summary?source=sales`);
    assert.equal(summaryResponse.status, 200);
    const summary = await summaryResponse.json();
    assert.equal(summary.counters.total, 1);
    assert.equal(summary.counters.high, 1);
  });
});

test('export follows active filters', async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });

  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Mobile import is broken for customers and blocks setup.',
        source: 'sales',
      }),
    });

    await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Support needs a simpler export for weekly notes.',
        source: 'support',
      }),
    });

    const exportResponse = await fetch(`${baseUrl}/api/export.md?source=sales`);
    assert.equal(exportResponse.status, 200);
    const markdown = await exportResponse.text();
    assert.match(markdown, /Filters: source=sales/);
    assert.match(markdown, /Source: sales/);
    assert.doesNotMatch(markdown, /Source: support/);
  });
});
