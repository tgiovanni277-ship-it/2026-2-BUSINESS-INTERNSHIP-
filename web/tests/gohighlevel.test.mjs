import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncGhlApplication } from '../src/lib/gohighlevel.js';
import { application, classify } from './helpers.mjs';

test('GHL synchronization after classification', async (t) => {
  const oldFetch = globalThis.fetch;
  const oldEnv = { ...process.env };
  process.env.GHL_MODE = 'live';
  process.env.GHL_PRIVATE_INTEGRATION_TOKEN = 'test-token';
  process.env.GHL_LOCATION_ID = 'test-location';
  const data = application();
  const classification = classify(data);
  try {
    await t.test('persists contact id and creates an application note without technical data', async () => {
      const calls = [];
      let savedContact;
      globalThis.fetch = async (url, options) => {
        calls.push({ url, method: options.method, body: options.body && JSON.parse(options.body) });
        if (url.endsWith('/upsert')) return Response.json({ contact: { id: 'contact/id' } });
        if (options.method === 'GET') return Response.json({ notes: [] });
        if (url.endsWith('/notes')) return Response.json({ note: { id: 'note-id' } });
        return Response.json({ tags: [] });
      };
      const result = await syncGhlApplication(data, classification, { onContactSaved: async (id) => { savedContact = id; } });
      assert.equal(savedContact, 'contact/id');
      assert.equal(result.noteId, 'note-id');
      const note = calls.find((call) => call.url.endsWith('/notes') && call.method === 'POST');
      const record = JSON.parse(note.body.body.split('\n\n')[1]);
      assert.deepEqual(record.respuestas, data.respuestas);
      assert.deepEqual(record.consentimiento, data.consentimiento);
      assert.deepEqual(record.classification, classification);
      assert.equal(record.tecnico, undefined);
      assert.ok(!note.body.body.includes('private-ip'));
      assert.ok(calls[1].url.includes('contact%2Fid'));
    });
    await t.test('reuses saved contact and existing note on retry', async () => {
      const calls = [];
      globalThis.fetch = async (url, options) => {
        calls.push({ url, method: options.method });
        if (options.method === 'GET') return Response.json({ notes: [{ id: 'old-note', body: '[relay-application:' + data.applicationId + ']\n\n{}' }] });
        return Response.json({});
      };
      const result = await syncGhlApplication(data, classification, { contactId: 'known-contact' });
      assert.equal(result.noteId, 'old-note');
      assert.equal(calls.length, 2);
      assert.ok(calls.every((call) => !call.url.endsWith('/upsert')));
    });
    await t.test('reconciles a note saved remotely before the response was lost', async () => {
      let persisted = false;
      globalThis.fetch = async (url, options) => {
        if (options.method === 'GET') return Response.json({ notes: persisted ? [{ id: 'saved-note', body: '[relay-application:' + data.applicationId + ']\n\n{}' }] : [] });
        if (url.endsWith('/notes')) { persisted = true; throw Error('lost response'); }
        return Response.json({});
      };
      await assert.rejects(syncGhlApplication(data, classification, { contactId: 'known' }), { code: 'ghl_unavailable' });
      const recovered = await syncGhlApplication(data, classification, { contactId: 'known' });
      assert.equal(recovered.noteId, 'saved-note');
    });
    await t.test('tag errors are retried instead of falsely marking the job synchronized', async () => {
      globalThis.fetch = async (url, options) => options.method === 'GET'
        ? Response.json({ notes: [{ id: 'note', body: '[relay-application:' + data.applicationId + ']\n' }] })
        : new Response('{}', { status: 403 });
      await assert.rejects(syncGhlApplication(data, classification, { contactId: 'known' }), { code: 'ghl_http_error', status: 403 });
    });
    await t.test('live mode requires credentials; mock mode is explicitly restricted', async () => {
      delete process.env.GHL_PRIVATE_INTEGRATION_TOKEN;
      delete process.env.GHL_LOCATION_ID;
      await assert.rejects(syncGhlApplication(data, classification), { code: 'ghl_configuration_incomplete' });
      process.env.GHL_MODE = 'mock';
      process.env.RELAY_ENV = 'production';
      await assert.rejects(syncGhlApplication(data, classification), { code: 'ghl_mock_forbidden' });
      process.env.RELAY_ENV = 'development';
      const mock = await syncGhlApplication(data, classification);
      assert.equal(mock.mocked, true);
    });
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of ['GHL_MODE', 'GHL_PRIVATE_INTEGRATION_TOKEN', 'GHL_LOCATION_ID', 'RELAY_ENV']) {
      if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key];
    }
  }
});
