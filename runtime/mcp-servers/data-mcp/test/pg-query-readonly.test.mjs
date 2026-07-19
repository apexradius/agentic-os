// Verifies the pg_query tool is read-only by DEFAULT, that an explicit
// `readOnly: false` still permits writes, and that a server started with the
// global --read-only lock cannot be relaxed per-call. Runs against the compiled
// dist output. No live database: the client's `sql` handle is stubbed so the
// read-only gate (which runs before any connection) is exercised in isolation.
import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { PgClient } from '../dist/client.js';
import { registerQueryTools } from '../dist/tools/query.js';

function makeFakeServer() {
  const tools = {};
  return {
    tools,
    tool(name, description, shape, handler) {
      tools[name] = { name, description, shape, handler };
    },
  };
}

// A PgClient whose network layer is stubbed. Any query that clears the read-only
// gate reaches `sql.unsafe` and is recorded in `calls`; the gate itself is the
// real code under test.
function makeClient(configReadOnly) {
  const client = new PgClient({
    host: '127.0.0.1',
    port: 1,
    maxRows: 500,
    queryTimeout: 1000,
    readOnly: configReadOnly,
  });
  const calls = [];
  client.sql = {
    unsafe: async (q, p) => {
      calls.push({ q, p });
      const rows = [];
      rows.count = 0;
      rows.columns = [];
      return rows;
    },
    end: async () => {},
  };
  client.calls = calls;
  return client;
}

function getPgQuery(configReadOnly) {
  const server = makeFakeServer();
  const client = makeClient(configReadOnly);
  registerQueryTools(server, client, 500);
  const { shape, handler } = server.tools.pg_query;
  return { shape, handler, client };
}

test('pg_query schema defaults readOnly to true when the arg is omitted', () => {
  const { shape } = getPgQuery(false);
  const parsed = z.object(shape).parse({ sql: 'SELECT 1' });
  assert.equal(parsed.readOnly, true);
});

test('omitted readOnly rejects a write statement', async () => {
  const { shape, handler, client } = getPgQuery(false);
  const args = z.object(shape).parse({ sql: 'DELETE FROM users' });
  const res = await handler(args);
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /Read-only mode/);
  assert.equal(client.calls.length, 0, 'write must not reach the sql layer');
});

test('readOnly:false permits a write statement (reaches the sql layer)', async () => {
  const { shape, handler, client } = getPgQuery(false);
  const args = z.object(shape).parse({ sql: 'DELETE FROM users', readOnly: false });
  const res = await handler(args);
  assert.notEqual(res.isError, true);
  assert.equal(client.calls.length, 1, 'write should reach the sql layer');
  assert.match(client.calls[0].q, /DELETE/);
});

test('default (read-only) still allows a SELECT', async () => {
  const { shape, handler, client } = getPgQuery(false);
  const args = z.object(shape).parse({ sql: 'SELECT 1' });
  const res = await handler(args);
  assert.notEqual(res.isError, true);
  assert.equal(client.calls.length, 1);
});

test('server-wide --read-only cannot be relaxed by readOnly:false', async () => {
  const { shape, handler, client } = getPgQuery(true);
  const args = z.object(shape).parse({ sql: 'DELETE FROM users', readOnly: false });
  const res = await handler(args);
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /Read-only mode/);
  assert.equal(client.calls.length, 0);
});
