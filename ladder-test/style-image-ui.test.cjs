const test = require('node:test'), assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const spec = require('../public/style-image-spec.js');
const png = require('../png-image.cjs');
const image = png.create(4, 4); png.paint(image, 0, 0, 4, 4, [55, 90, 100, 255]);
const dataUrl = 'data:image/png;base64,' + png.encode(image).toString('base64');
const result = {role: 'waiting', dataUrl, width: 1920, height: 1080, note: 'Ready for preview'};
function element(tag = 'input') {
  return {tag, children: [], events: {}, files: [], value: '', checked: false, hidden: false, disabled: false, dataset: {}, textContent: '',
    classList: {toggle() {}}, append(...items) { this.children.push(...items); },
    addEventListener(event, fn) { (this.events[event] ||= []).push(fn); },
    removeAttribute(key) { delete this[key]; },
    async fire(event = 'click') { for (const fn of this.events[event] || []) await fn({target: this, preventDefault() {}}); }, click() {}
  };
}
function harness(request) {
  const nodes = new Map(), created = [], exported = [], pageEvents = {};
  const html = fs.readFileSync(path.join(__dirname, '../public/ladder.html'), 'utf8');
  for (const match of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const node = element(match[1]); node.id = match[2]; node.value = match[0].match(/\bvalue="([^"]*)"/)?.[1] || '';
    node.type = match[0].match(/\btype="([^"]*)"/)?.[1] || ''; node.hidden = /\shidden(?:\s|>)/.test(match[0]); nodes.set(node.id, node);
  }
  const document = {getElementById: id => { assert.ok(nodes.has(id), id); return nodes.get(id); }, createElement: tag => { const node = element(tag); created.push(node); return node; }, querySelectorAll: () => created.filter(n => n.dataset.styleAsset)};
  for (const [id, value] of Object.entries({stylePackBase: 'arknights', stylePackScore: 'compact', stylePackHUD: 'compact', styleImageKind: 'images', styleImageSize: '1536x1024'})) nodes.get(id).value = value;
  const window = {StyleImageSpec: spec, OutfitWorkspace: {render() {}, select() {}}, AssistantActions: {request, act: async () => {}}};
  const context = vm.createContext({window, document, Blob, AbortController, crypto, setTimeout, clearTimeout,
    URL: {createObjectURL(blob) { exported.push(blob); return 'blob:test'; }, revokeObjectURL() {}},
    FileReader: class { readAsDataURL(file) { this.result = file.dataUrl; queueMicrotask(() => this.onload()); } },
    addEventListener: (key, fn) => { pageEvents[key] = fn; }
  });
  for (const file of ['style-pack-workspace.js', 'style-image-workspace.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../public', file), 'utf8'), context);
  const get = id => nodes.get(id);
  window.StylePackWorkspace.selection('arknights', {installed: false}, true);
  get('styleImageTheme').value = 'Rhodes Island'; get('styleImageKey').value = 'private-ui-test-key';
  return {window, get, created, exported, pageEvents};
}

test('generated candidates require explicit adoption and exports omit API configuration and credentials', async () => {
  let requests = 0;
  const h = harness(async (url, options) => {
    requests++; assert.equal(url, '/api/style-image/generate');
    const input = JSON.parse(options.body); assert.equal(input.theme, 'Rhodes Island'); assert.equal(input.provider.apiKey, 'private-ui-test-key');
    assert.equal(input.role, 'waiting'); return new Response(JSON.stringify(result));
  });
  h.get('stylePackName').value = 'Existing draft'; h.get('stylePackId').value = 'existing-draft';
  await h.get('styleImageGenerate').fire(); assert.equal(requests, 1);
  assert.equal(h.get('styleImageResult').hidden, false);
  await h.get('stylePackBuild').fire(); assert.deepEqual(JSON.parse(await h.exported.at(-1).text()).assets, {});
  await h.get('styleImageAdopt').fire();
  assert.equal(h.get('stylePackName').value, 'Existing draft'); assert.equal(h.get('stylePackId').value, 'existing-draft');
  await h.get('stylePackBuild').fire(); const text = await h.exported.at(-1).text(), pack = JSON.parse(text);
  assert.deepEqual(pack.assets, {waiting: dataUrl}); assert.equal(pack.base, 'arknights');
  for (const secret of ['private-ui-test-key', 'apiKey', 'baseUrl', 'imageModel']) assert.ok(!text.includes(secret));
  h.pageEvents.pagehide(); assert.equal(h.get('styleImageKey').value, '');
});

test('a failed or cancelled generation preserves the previous candidate and adopted assets', async () => {
  let calls = 0, finish;
  const h = harness(async () => {
    calls++;
    if (calls === 1) return new Response(JSON.stringify(result));
    if (calls === 2) return new Response(JSON.stringify({error: 'API unavailable'}), {status: 400});
    return new Promise(resolve => { finish = resolve; });
  });
  await h.get('styleImageGenerate').fire(); await h.get('styleImageAdopt').fire();
  await h.get('styleImageGenerate').fire(); assert.match(h.get('styleImageStatus').textContent, /API unavailable/);
  const waiting = h.get('styleImageGenerate').fire();
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.get('styleImageGenerate').disabled, true); assert.equal(h.get('styleImageInputs').disabled, true);
  await h.get('styleImageCancel').fire(); finish(new Response(JSON.stringify({...result, role: 'away'}))); await waiting;
  assert.equal(h.get('styleImagePreview').src, dataUrl); assert.match(h.get('styleImageStatus').textContent, /取消/);
  await h.get('stylePackBuild').fire(); assert.deepEqual(JSON.parse(await h.exported.at(-1).text()).assets, {waiting: dataUrl});
  assert.equal(calls, 3); assert.equal(h.get('styleImageGenerate').disabled, false);
  h.window.StyleImageWorkspace.connection(false); assert.equal(h.get('styleImageGenerate').disabled, true);
});

test('role templates and Responses settings update locally, and replacing an adopted image removes its generated version', async () => {
  const h = harness(async () => new Response(JSON.stringify(result)));
  h.get('styleImageRole').value = 'frame'; await h.get('styleImageRole').fire('change');
  assert.match(h.get('styleImagePrompt').value, /750/); assert.match(h.get('styleImageTemplateDownload').href, /role=frame$/);
  h.get('styleImageKind').value = 'responses'; await h.get('styleImageKind').fire('change');
  assert.equal(h.get('styleImageToolModelField').hidden, false); assert.equal(h.get('styleImageModel').value, '');
  await h.get('styleImageGenerate').fire(); assert.match(h.get('styleImageStatus').textContent, /API Key/);
  h.window.StylePackWorkspace.adopt(result, 'New theme');
  const input = h.created.find(node => node.dataset.styleAsset === 'waiting'); input.files = [{name: 'replacement.png', size: 100, dataUrl: dataUrl + 'AA'}]; await input.fire('change');
  await h.get('stylePackBuild').fire(); const pack = JSON.parse(await h.exported.at(-1).text());
  assert.equal(pack.assets.waiting, dataUrl + 'AA'); assert.equal(pack.name, 'New theme'); assert.match(pack.id, /^ai-style-/);
});
