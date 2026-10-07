const test = require('node:test'), assert = require('node:assert/strict');
const http = require('node:http'), crypto = require('node:crypto'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const png = require('../png-image.cjs'), layout = require('../style-image-layout.cjs');
const {roles, prompt} = require('../public/style-image-spec.js');
const {createStyleImageService, prepare, endpoint, downloadURL} = require('../style-image-service.cjs');
const {png: validate, createStylePackStore} = require('../style-packs.cjs');
const {createAssistant} = require('../ladder-server.cjs');
const palette = {dark: '#14191e', mid: '#42484d', accent: '#f5c928', text: '#f1f1ed'};
const makeInput = extra => ({requestId: crypto.randomUUID(), role: 'cover', theme: 'Rhodes Island', palette, provider: {kind: 'images', baseUrl: 'https://images.example/v1', model: 'gpt-image-2', apiKey: 'test-only-private-key'}, ...extra});
function scene() { const image = png.create(384, 256); png.paint(image, 0, 0, 384, 256, [20, 35, 42, 255]); return png.encode(image); }
function decodeResult(result) { return png.decode(Buffer.from(result.dataUrl.slice(22), 'base64')); }
async function server(t, handler) {
  const app = http.createServer(handler); await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => { app.close(); app.closeAllConnections(); }); return 'http://127.0.0.1:' + app.address().port;
}
async function body(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return Buffer.concat(chunks).toString(); }

test('templates specify each real layout and PNG guide uses the exact role dimensions', () => {
  for (const [role, spec] of Object.entries(roles)) {
    const image = png.decode(layout.guide(role)); assert.deepEqual([image.width, image.height], [spec.width, spec.height]);
    assert.match(prompt({role, theme: 'Forest', palette}), new RegExp(String(spec.width)));
  }
  assert.throws(() => layout.guide('../bad'));
  assert.throws(() => prompt({role: 'waiting', theme: '', palette}));
  assert.throws(() => prompt({role: 'waiting', theme: 'Forest', palette: {...palette, dark: 'red'}}));
});

test('backgrounds preserve aspect ratio and frame normalization clears gameplay and panel interiors', () => {
  const original = png.create(1920, 1080); png.paint(original, 0, 0, 1920, 1080, [0, 0, 0, 0]);
  png.paint(original, 0, 740, 1920, 340, [230, 195, 40, 255]);
  const frame = layout.normalize(png.encode(original), 'frame'), result = decodeResult(frame);
  validate(Buffer.from(frame.dataUrl.slice(22), 'base64'), 'frame');
  for (const [x, y] of [[0, 0], [1919, 749], [100, 900], [800, 950], [1450, 950], [1750, 950]]) assert.equal(result.pixels[(y * 1920 + x) * 4 + 3], 0);
  assert.equal(result.pixels[(791 * 1920 + 5) * 4 + 3], 255);
  const background = layout.normalize(scene(), 'waiting'); assert.deepEqual([background.width, background.height], [1920, 1080]);
  const fitted = png.fit({width: 4, height: 2, pixels: Buffer.alloc(4 * 2 * 4, 255)}, 4, 4, 'contain');
  assert.equal(fitted.pixels[3], 0); assert.equal(fitted.pixels[(1 * 4) * 4 + 3], 255);
  assert.throws(() => layout.normalize(scene(), 'frame'), /透明/);
  assert.throws(() => layout.normalize(png.encode(png.create(1536, 512)), 'assistantFront'), /全透明/);
});

test('sprite states are fitted separately with a shared scale and baseline instead of stretching the sheet', () => {
  const source = png.create(768, 512);
  for (let i = 0; i < 3; i++) png.paint(source, i * 256 + 90, 50 + i * 20, 70, 200, [200, 150, 80, 255]);
  const result = layout.normalize(png.encode(source), 'assistantFront'), decoded = decodeResult(result);
  assert.deepEqual([decoded.width, decoded.height], [1536, 512]);
  for (let i = 0; i < 3; i++) {
    assert.equal(decoded.pixels[(470 * 1536 + i * 512 + 256) * 4 + 3], 255);
    assert.equal(decoded.pixels[(500 * 1536 + i * 512 + 256) * 4 + 3], 0);
    assert.equal(decoded.pixels[(100 * 1536 + i * 512 + 5) * 4 + 3], 0);
  }
  png.paint(source, 512, 0, 256, 512, [0, 0, 0, 0]);
  assert.throws(() => layout.normalize(png.encode(source), 'assistantRear'), /缺少/);
  const damaged = scene(); damaged[damaged.length - 6] ^= 1; assert.throws(() => png.decode(damaged), /校验/);
});

test('request builders support Images generation, multipart edits and Responses image tools without persisting secrets', async () => {
  const input = makeInput(), first = prepare(input), value = JSON.parse(first.body);
  assert.equal(first.url.href, 'https://images.example/v1/images/generations');
  assert.equal(value.model, 'gpt-image-2'); assert.equal(value.n, 1); assert.equal(value.output_format, 'png');
  assert.ok(!first.body.includes(input.provider.apiKey));
  const edits = prepare({...input, reference: 'data:image/png;base64,' + scene().toString('base64'), useGuide: true});
  assert.equal(edits.url.pathname, '/v1/images/edits'); assert.equal(edits.body.getAll('image[]').length, 2);
  assert.equal(edits.headers['Content-Type'], undefined);
  const responses = prepare({...input, useGuide: true, provider: {...input.provider, kind: 'responses', baseUrl: 'https://images.example/v1/responses', model: 'tool-capable-model', imageModel: 'gpt-image-2'}});
  const request = JSON.parse(responses.body); assert.equal(request.store, false); assert.equal(request.model, 'tool-capable-model');
  assert.equal(request.tools[0].model, 'gpt-image-2'); assert.equal(request.tool_choice.type, 'image_generation');
  assert.equal(request.input[0].content[1].type, 'input_image');
  for (const address of ['file:///secret', 'http://remote.example/v1', 'https://user:secret@remote.example/v1', 'https://remote.example?key=secret']) assert.throws(() => endpoint(address));
  assert.equal(endpoint('http://127.0.0.1:9999/v1/images/generations').pathname, '/v1/');
  assert.throws(() => downloadURL('http://127.0.0.1:1000/private', new URL('https://images.example/v1')));
  assert.throws(() => downloadURL('https://169.254.169.254/private', new URL('https://images.example/v1')));
});

test('real HTTP Images and Responses adapters share completed requests and download image URLs without authorization headers', async t => {
  const image = scene(); let calls = 0, downloads = 0;
  const base = await server(t, async (req, res) => {
    if (req.url === '/result.png') {
      downloads++; assert.equal(req.headers.authorization, undefined); assert.equal(req.headers['x-control-token'], undefined);
      res.writeHead(200, {'Content-Type': 'image/png'}); return res.end(image);
    }
    calls++; assert.equal(req.headers.authorization, 'Bearer test-only-private-key');
    const raw = await body(req); res.setHeader('Content-Type', 'application/json');
    if (req.url.endsWith('/edits')) { assert.match(raw, /layout-guide.png/); return res.end(JSON.stringify({data: [{b64_json: image.toString('base64')}]})); }
    const input = JSON.parse(raw);
    if (req.url.endsWith('/responses')) { assert.equal(input.store, false); return res.end(JSON.stringify({output: [{type: 'image_generation_call', result: image.toString('base64')}]})); }
    res.end(JSON.stringify({data: [{url: base + '/result.png'}]}));
  });
  const service = createStyleImageService(); t.after(() => service.close());
  const input = makeInput(); input.provider.baseUrl = base + '/v1';
  const [a, b] = await Promise.all([service.generate(input), service.generate(input)]);
  assert.deepEqual(a, b); assert.equal(calls, 1); assert.equal(downloads, 1);
  assert.deepEqual(await service.generate(input), a); assert.equal(calls, 1);
  assert.throws(() => service.generate({...input, theme: 'Different theme'}), /标识已使用/);
  await service.generate({...input, requestId: crypto.randomUUID(), useGuide: true});
  await service.generate({...input, requestId: crypto.randomUUID(), provider: {...input.provider, kind: 'responses'}});
  assert.equal(calls, 3); assert.equal(a.width, 960); assert.equal(a.height, 540);
});

test('provider rejection and uncertain network failures never retry or reveal echoed credentials', async t => {
  for (const status of [401, 403, 429, 500]) {
    let calls = 0;
    const service = createStyleImageService({fetchImpl: async () => { calls++; return new Response('test-only-private-key echoed', {status}); }});
    const input = makeInput();
    for (let i = 0; i < 2; i++) await assert.rejects(service.generate(input), error => error.message.includes(String(status)) && !error.message.includes(input.provider.apiKey));
    assert.equal(calls, 1); service.close();
  }
  let calls = 0;
  const service = createStyleImageService({fetchImpl: async () => { calls++; throw Error('lost connection with test-only-private-key'); }});
  t.after(() => service.close()); await assert.rejects(service.generate(makeInput()), /未自动重试/); assert.equal(calls, 1);
});

test('malformed provider responses fail clearly and do not produce installable assets', async () => {
  for (const payload of [null, {output: 'invalid'}, {data: []}, {error: {message: 'test-only-private-key'}}]) {
    let calls = 0;
    const service = createStyleImageService({fetchImpl: async () => { calls++; return Response.json(payload); }});
    const input = makeInput(); input.provider.kind = 'responses';
    await assert.rejects(service.generate(input), error => /没有返回图片/.test(error.message) && !error.message.includes(input.provider.apiKey));
    assert.equal(calls, 1); service.close();
  }
});

test('redirects are rejected before credentials can reach another endpoint', async t => {
  let leaked = 0;
  const destination = await server(t, (_req, res) => { leaked++; res.end('{}'); });
  const base = await server(t, (_req, res) => { res.writeHead(307, {Location: destination + '/sink'}); res.end(); });
  const service = createStyleImageService(); t.after(() => service.close()); const input = makeInput(); input.provider.baseUrl = base;
  await assert.rejects(service.generate(input), /未自动重试/); assert.equal(leaked, 0);
});

test('cancellation and timeouts release the single generation slot without resending the request', async t => {
  let calls = 0;
  const service = createStyleImageService({timeoutMs: 20, fetchImpl: (_url, {signal}) => new Promise((_, reject) => {
    calls++; const fail = () => reject(Error('aborted')); if (signal.aborted) fail(); else signal.addEventListener('abort', fail, {once: true});
  })});
  t.after(() => service.close());
  const abort = new AbortController(), input = makeInput();
  const pending = service.generate(input, {signal: abort.signal});
  assert.throws(() => service.generate(makeInput()), /已有图片/);
  abort.abort(); await assert.rejects(pending, /取消或超时/);
  // Keep an event-loop handle alive while AbortSignal.timeout (unref'ed by Node) expires.
  const keepAlive = setTimeout(() => {}, 1000);
  try { await assert.rejects(service.generate(makeInput()), /取消或超时/); } finally { clearTimeout(keepAlive); }
  assert.equal(calls, 2);
});

test('control HTTP generation requires local authorization, leaves output untouched and exports only adopted assets', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'style-image-')); t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  let calls = 0, upstreamStatus = 200;
  const app = createAssistant({port: 0, dataDir: dir, sc2Reader: async () => { throw Error('offline'); }, imageOptions: {fetchImpl: async () => {
    calls++; return new Response(JSON.stringify({data: [{b64_json: scene().toString('base64')}]}), {status: upstreamStatus});
  }}});
  t.after(() => app.close()); await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const {token} = await (await fetch(base + '/api/control-session', {headers: {'X-Control-Client': 'assistant'}})).json();
  const before = app.ladder.getConfig(), input = makeInput();
  const send = (headers, payload = input) => fetch(base + '/api/style-image/generate', {method: 'POST', headers, body: JSON.stringify(payload)});
  assert.equal((await send({})).status, 403); assert.equal((await send({'X-Control-Token': token, Origin: 'https://evil.example'})).status, 403); assert.equal(calls, 0);
  const response = await send({'X-Control-Token': token}), result = await response.json(); assert.equal(response.status, 200);
  assert.deepEqual(app.ladder.getConfig(), before); assert.deepEqual(app.snapshot().stylePacks, []);
  assert.ok(!JSON.stringify(app.snapshot()).includes(input.provider.apiKey)); assert.ok(!JSON.stringify(result).includes(input.provider.apiKey));
  assert.equal((await fetch(base + '/api/style-image/template?role=frame')).status, 200);
  for (const route of ['/style-image-spec.js', '/style-image-workspace.js']) assert.equal((await fetch(base + route)).status, 200);
  const store = createStylePackStore(dir), pack = {format: 'sc2-style-pack', version: 1, id: 'ai-rhodes', name: 'AI Rhodes', base: 'arknights', palette, assets: {cover: result.dataUrl}};
  const installed = await store.install((async function*() { yield Buffer.from(JSON.stringify(pack)); })());
  assert.deepEqual(store.exportPack(installed.id).assets, pack.assets);
  assert.ok(!fs.readFileSync(path.join(dir, 'style-packs/index.json'), 'utf8').includes(input.provider.apiKey));
  upstreamStatus = 403;
  const denied = await send({'X-Control-Token': token}, {...input, requestId: crypto.randomUUID()});
  assert.equal(denied.status, 400); assert.match((await denied.json()).error, /403/); assert.equal(calls, 2);
});

test('state monitoring stays responsive during generation and closing the HTTP request aborts the provider call', {timeout: 5000}, async t => {
  let started, cancelled, calls = 0;
  const start = new Promise(resolve => { started = resolve; }), cancel = new Promise(resolve => { cancelled = resolve; });
  const app = createAssistant({port: 0, dataDir: null, sc2Reader: async () => { throw Error('offline'); }, imageOptions: {fetchImpl: (_url, {signal}) => new Promise((_, reject) => {
    calls++; started(); signal.addEventListener('abort', () => { cancelled(); reject(Error('aborted')); }, {once: true});
  })}});
  t.after(() => app.close()); await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const {token} = await (await fetch(base + '/api/control-session', {headers: {'X-Control-Client': 'assistant'}})).json();
  const abort = new AbortController();
  const pending = fetch(base + '/api/style-image/generate', {method: 'POST', signal: abort.signal, headers: {'X-Control-Token': token}, body: JSON.stringify(makeInput())});
  await start;
  const state = await fetch(base + '/api/state'); assert.equal(state.status, 200); assert.ok((await state.json()).replays);
  abort.abort(); await assert.rejects(pending, /abort/i); await cancel; assert.equal(calls, 1);
});
