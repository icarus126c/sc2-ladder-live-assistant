const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {createAssistant} = require('../ladder-server.cjs');
const {defaults, sanitize} = require('../ladder-replays.cjs');
const outfits = require('../public/outfit-presets.js'), scenes = require('../public/scene-themes.js');
const {createStylePackStore} = require('../style-packs.cjs');
const frame = require('../public/gameframe-template.js'), keyboard = require('../public/cat-keyboard-template.js');
const png = require('../png-image.cjs');

test('Arknights applies all six modules while preserving identity, results, custom text and tool positions', () => {
  const before = {...defaults, names: ['Player'], toonHandle: '5-S2-1-123', mmr: 4800, catX: 80, catView: 'rear', waitingTitle: 'Custom title', waitingKicker: 'Personal label'};
  const patch = outfits.buildPatch(before, {preset: 'arknights'}), applied = sanitize(patch, before);
  for (const field of ['names', 'toonHandle', 'mmr', 'catX', 'catView', 'waitingTitle', 'waitingKicker']) assert.deepEqual(applied[field], before[field]);
  assert.equal(applied.gameFrameStyle, 'arknights'); assert.equal(applied.catCharacter, 'arknights');
  for (const prefix of ['waiting', 'loading', 'break']) assert.equal(applied[prefix + 'Theme'], 'arknights');
  for (const phase of ['intermission', 'loading', 'break']) {
    const c = scenes.resolve(applied, phase);
    assert.match(scenes.background(c), /arknights-background-v1.png/);
    assert.match(scenes.decoration(c), /arknights-logo-v1.png/);
    assert.match(scenes.decoration(c), /arknights-chen-v1.png/);
  }
  const custom = {...before, waitingBackground: 'video', waitingBackgroundVideo: '/scene-media/' + 'a'.repeat(64) + '.mp4'};
  assert.equal(outfits.buildPatch(custom, {preset: 'arknights', preserveMedia: true}).waitingBackground, undefined);
  assert.match(frame.build(applied), /data-frame-theme="arknights"/);
  assert.match(frame.build(applied), /arknights-logo-v1.png/);
  for (const view of ['rear', 'split', 'classic', 'flat']) assert.match(keyboard.build({...applied, catView: view}), /cat-character-arknights/);
});

test('Arknights assets, SVG export and scoped apply/undo work through local HTTP and survive restart', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arknights-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const app = createAssistant({port: 0, dataDir: dir, sc2Reader: async () => { throw Error('offline'); }});
  t.after(() => app.close());
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const {token} = await (await fetch(base + '/api/control-session', {headers: {'X-Control-Client': 'assistant'}})).json();
  const act = async body => { const r = await fetch(base + '/api/action', {method: 'POST', headers: {'X-Control-Token': token}, body: JSON.stringify(body)}); assert.equal(r.status, 200); return r.json(); };
  const before = app.ladder.getConfig();
  await act({action: 'outfitApply', choice: {preset: 'arknights'}});
  for (const [name, size] of Object.entries({background: [1920, 1080], chen: [1024, 1024], logo: [220, 196], cover: [960, 540]})) {
    const r = await fetch(base + '/assets/arknights-' + name + '-v1.png'); assert.equal(r.status, 200);
    const image = png.decode(Buffer.from(await r.arrayBuffer())); assert.deepEqual([image.width, image.height], size);
  }
  assert.match(await (await fetch(base + '/gameframe.svg')).text(), /data:image\/png;base64,/);
  const restarted = createAssistant({dataDir: dir, sc2Reader: async () => { throw Error('offline'); }});
  assert.equal(restarted.ladder.getConfig().waitingTheme, 'arknights'); restarted.close();
  await act({action: 'outfitUndo'}); assert.deepEqual(app.ladder.getConfig(), before);
});

test('external packs can inherit the Arknights theme without copying character art into exports', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arknights-pack-')); t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const store = createStylePackStore(dir);
  const pack = {format: 'sc2-style-pack', version: 1, id: 'rhodes-test', name: 'Rhodes test', base: 'arknights', palette: {dark: '#14191e', mid: '#42484d', accent: '#f5c928', text: '#f1f1ed'}, assets: {}};
  const installed = await store.install((async function*() { yield Buffer.from(JSON.stringify(pack)); })());
  assert.equal(installed.scene, 'arknights'); assert.equal(installed.frame, 'arknights'); assert.equal(installed.cat, 'arknights');
  assert.deepEqual(store.exportPack(installed.id).assets, {});
});
