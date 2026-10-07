const test = require('node:test');
const assert = require('node:assert/strict');
const {once} = require('node:events');
const http = require('node:http');
const {createAssistant} = require('../ladder-server.cjs');
const {create} = require('../public/control-connection.js');
const flush = () => new Promise(setImmediate);
const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
const credentials = (id, character = 'a') => ({serverInstanceId: id, token: character.repeat(48)});

function harness(options = {}) {
  let events, whenReady;
  const statuses = [], states = [], tokens = [], timers = new Map();
  let timerId = 0;
  const client = create({
    EventSourceImpl: class {constructor() { events = this; } close() { this.closed = true; }},
    onStatus(ready, message) { statuses.push({ready, message}); if (ready) whenReady?.(); },
    onState: state => states.push(state), onToken: token => tokens.push(token),
    setTimeoutImpl(fn) { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeoutImpl: id => timers.delete(id), ...options
  });
  return {client, statuses, states, tokens, timers, get events() { return events; },
    async open(serverInstanceId) {
      const ready = new Promise(resolve => { whenReady = resolve; });
      events.onopen(); events.onmessage({data: JSON.stringify({serverInstanceId})});
      await ready;
    }
  };
}

async function start(port = 0) {
  const app = createAssistant({port, dataDir: null, sc2Reader: async () => 'offline', intervalMs: 60000});
  app.server.listen(port, '127.0.0.1');
  await once(app.server, 'listening');
  return app;
}
async function stop(app) {
  if (!app.server.listening) return;
  const done = once(app.server, 'close'); app.close(); await done;
}

test('control credentials stay local, are absent from snapshots, and retain existing authorization checks', async t => {
  const app = await start(); t.after(() => stop(app));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  assert.equal((await fetch(base + '/api/control-session')).status, 403);
  for (const headers of [
    {'X-Control-Client': 'assistant', Origin: 'https://untrusted.example'},
    {'X-Control-Client': 'assistant', 'Sec-Fetch-Site': 'cross-site'},
    {'X-Control-Client': 'assistant', Host: 'untrusted.example'}
  ]) {
    const status = await new Promise((resolve, reject) => {
      http.get(base + '/api/control-session', {headers}, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
    });
    assert.equal(status, 403, JSON.stringify(headers));
  }
  const response = await fetch(base + '/api/control-session', {headers: {'X-Control-Client': 'assistant', Origin: base}});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  const session = await response.json();
  assert.match(session.token, /^[a-f\d]{48}$/);
  assert.equal(session.serverInstanceId, app.snapshot().serverInstanceId);
  assert.ok(!JSON.stringify(app.snapshot()).includes(session.token));
  assert.equal((await fetch(base + '/api/action', {method: 'POST', body: JSON.stringify({action: 'transition', scene: 'game'})})).status, 403);
  const html = await (await fetch(base)).text();
  assert.ok(html.indexOf('/control-connection.js') < html.indexOf('/assistant.js'));
  assert.equal((await fetch(base + '/control-connection.js')).status, 200);
});

test('one control client resumes state and actions across repeated real server restarts without reloading', {timeout: 10000}, async t => {
  let app = await start(); t.after(() => stop(app));
  const port = app.server.address().port, base = 'http://127.0.0.1:' + port;
  const fetchFresh = (url, options = {}) => {
    const headers = new Headers(options.headers); headers.set('Connection', 'close');
    return fetch(base + url, {...options, headers});
  };
  const h = harness({fetchImpl: fetchFresh});
  t.after(() => h.client.close());
  for (let attempt = 0; attempt < 3; attempt++) {
    const state = await (await fetchFresh('/api/state')).json();
    await h.open(state.serverInstanceId);
    assert.equal(h.statuses.at(-1).ready, true);
    const recorded = await h.client.request('/api/action', {method: 'POST', body: JSON.stringify({action: 'ladderRecord', result: 'win'})});
    assert.equal(recorded.status, 200);
    assert.equal((await recorded.json()).ladder.stats.wins, 1, 'one click produces one record');
    const exported = await h.client.request('/api/live-export?kind=income');
    assert.equal(exported.status, 200, 'exports use the refreshed credentials too');
    if (attempt === 2) break;
    await stop(app); h.events.onerror();
    assert.equal(h.statuses.at(-1).ready, false);
    await assert.rejects(h.client.request('/api/action', {method: 'POST', body: '{}'}), /自动重连/);
    app = await start(port);
  }
  assert.equal(new Set(h.tokens).size, 3);
  assert.equal(h.states.length, 3);
});

test('a rejected credential refresh is retried automatically even if the event stream remains open', async t => {
  let calls = 0;
  const h = harness({fetchImpl: async () => ++calls === 1 ? json({}, 503) : json(credentials('one'))});
  t.after(() => h.client.close());
  h.events.onopen(); h.events.onmessage({data: JSON.stringify({serverInstanceId: 'one'})});
  await flush();
  assert.equal(h.statuses.at(-1).ready, false);
  assert.equal(h.timers.size, 1);
  const [id, retry] = [...h.timers][0]; h.timers.delete(id); retry();
  await flush();
  assert.equal(h.statuses.at(-1).ready, true);
  assert.equal(calls, 2);
  assert.equal(h.timers.size, 0);
});

test('an old in-flight refresh cannot overwrite credentials after another reconnect', async t => {
  let release, count = 0;
  const h = harness({fetchImpl: async () => {
    if (++count === 1) return new Promise(resolve => { release = resolve; });
    return json(credentials('new', 'b'));
  }});
  t.after(() => h.client.close());
  h.events.onopen(); h.events.onmessage({data: JSON.stringify({serverInstanceId: 'old'})});
  await flush();
  h.events.onerror();
  await h.open('new');
  release(json(credentials('old')));
  await flush();
  assert.deepEqual(h.tokens, ['b'.repeat(48)]);
  assert.equal(h.statuses.at(-1).ready, true);
  assert.equal(h.timers.size, 0);
});

test('explicit 403 responses refresh once for concurrent requests; unknown outcomes and other errors are never replayed', async t => {
  let current = credentials('one'), refreshes = 0, attempts = 0, writes = 0, failure = null;
  const h = harness({fetchImpl: async (url, options) => {
    if (url === '/api/control-session') { refreshes++; return json(current); }
    attempts++;
    if (failure === 'network') throw Error('connection reset after send');
    if (failure === 'server') return json({error: 'failed'}, 500);
    if (new Headers(options.headers).get('X-Control-Token') !== current.token) return json({error: 'expired'}, 403);
    writes++; return json({ok: true});
  }});
  t.after(() => h.client.close());
  await h.open('one');
  current = credentials('one', 'b');
  const responses = await Promise.all([h.client.request('/api/action', {method: 'POST', body: 'one'}), h.client.request('/api/action', {method: 'POST', body: 'two'})]);
  assert.ok(responses.every(response => response.status === 200));
  assert.equal(refreshes, 2, 'initial handshake plus a single shared refresh');
  assert.equal(writes, 2);
  assert.equal(attempts, 4);
  failure = 'network';
  await assert.rejects(h.client.request('/api/action', {method: 'POST', body: 'uncertain'}), /connection reset/);
  assert.equal(attempts, 5);
  failure = 'server';
  assert.equal((await h.client.request('/api/action', {method: 'POST', body: 'failed'})).status, 500);
  assert.equal(attempts, 6);
  assert.equal(refreshes, 2);
});

test('closing or disconnecting cancels refresh retries and prevents later status changes', async () => {
  const h = harness({fetchImpl: async () => { throw Error('offline'); }});
  h.events.onopen(); await flush();
  assert.equal(h.timers.size, 1);
  h.events.onerror();
  assert.equal(h.timers.size, 0);
  h.client.close();
  const count = h.statuses.length;
  h.events.onopen(); h.events.onerror(); h.events.onmessage({data: JSON.stringify({serverInstanceId: 'late'})});
  assert.equal(h.statuses.length, count);
  assert.equal(h.events.closed, true);
});
