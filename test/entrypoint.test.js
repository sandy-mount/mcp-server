import assert from 'node:assert/strict';
import test from 'node:test';
import { createMcpApp } from '../index.js';

const silentLogger = {
  error() {},
  log() {},
  warn() {}
};

test('root entrypoint exports an app factory', async () => {
  assert.equal(typeof createMcpApp, 'function');
  const app = await createMcpApp({ logger: silentLogger });
  assert.equal(typeof app.listen, 'function');
});

test('created app exposes loaded plugin capabilities', async (t) => {
  const app = await createMcpApp({ logger: silentLogger });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => server.close());

  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize'
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.jsonrpc, '2.0');
  assert.equal(body.id, 1);
  assert.equal(body.result.serverInfo.name, 'Pluggable MCP Server');
  assert.ok(body.result.capabilities.echo);
  assert.ok(body.result.capabilities.helloworld);
});
