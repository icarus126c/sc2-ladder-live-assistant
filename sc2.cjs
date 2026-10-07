const PHASE_LABELS = { offline: '未连接星际2', unknown: '状态待确认', menu: '大厅 / 菜单', loading: '正在载入', live: '比赛 / 观战中', replay: '录像回放中' };

// The retail client API reports no active menu screens during a game.
// Reference: https://github.com/leigholiver/OBS-SC2Switcher/blob/master/SC2State.cpp
function classify(ui, game) {
  if (!ui || !Array.isArray(ui.activeScreens) || ui.activeScreens.length > 100 || !ui.activeScreens.every(x => typeof x === 'string')) throw new Error('星际2界面状态格式无法识别');
  const screens = ui.activeScreens;
  if (screens.some(x => /ScreenLoading/i.test(x))) return 'loading';
  const knownMenu=/^Screen(?:Score|UserProfile|BattleLobby|Home|Single|Collection|CoopCampaign|Custom|Replay|Multiplayer|Battlenet|NavigationSC2)\//;
  if(screens.some(x=>knownMenu.test(x)))return 'menu';
  if(screens.length===1)return 'loading';
  if (screens.length > 1) {
    // Unknown in-game dialogs must not be mistaken for leaving the match.
    const menu = /^Screen(?:Score|UserProfile|BattleLobby|Home|Single|Collection|CoopCampaign|Custom|Replay|Multiplayer|Battlenet|NavigationSC2)\//;
    return screens.some(x => menu.test(x)) ? 'menu' : 'unknown';
  }
  if (!game || typeof game.isReplay !== 'boolean' || !Number.isFinite(game.displayTime) || game.displayTime < 0 || !Array.isArray(game.players) || game.players.length === 0) return 'unknown';
  return game.isReplay ? 'replay' : 'live';
}

async function readClientDetails(port, signal) {
  async function read(endpoint) {
    const response = await fetch(`http://127.0.0.1:${port}/${endpoint}`, { signal, redirect: 'error' });
    if (!response.ok) throw new Error('星际2本地接口尚未就绪');
    let length = 0; const chunks = [];
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > 65536) throw new Error('星际2状态内容异常');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  const ui=await read('ui'),phase=classify(ui,null);
  if(phase==='menu'||phase==='loading')return {phase,ui,game:null};
  const game=await read('game');return {phase:classify(ui,game),ui,game};
}
async function readClient(port, signal) { return (await readClientDetails(port, signal)).phase; }

class AutomationEngine {
  constructor() { this.reset(); }
  reset() { this.candidate = ''; this.since = 0; this.samples = 0; this.seenLive = false; }
  step(phase, config, scene, busy, now) {
    const result = { pending: null, target: null, message: '等待进入下一场比赛' };
    if (!config.sc2AutoEnabled || config.sc2AutoPaused) {
      this.reset(); result.message = config.sc2AutoPaused ? '已暂停，手动切换优先' : '自动切换未开启'; return result;
    }
    const playing = phase === 'live' || (phase === 'replay' && config.sc2IncludeReplays);
    if (!playing && !['menu','loading'].includes(phase)) {
      this.candidate = ''; this.samples = 0;
      result.message = phase === 'replay' ? '录像自动切换未开启，保持当前画面' : phase === 'loading' ? '载入期间保持当前画面' : '状态不确定，保持当前画面';
      return result;
    }
    const candidate = playing ? 'game' : phase === 'loading' ? 'loading' : 'intermission';
    if (candidate !== this.candidate) { this.candidate = candidate; this.since = now; this.samples = 0; }
    this.samples++;
    if (!playing && !this.seenLive && config.sc2AutoMode !== 'ladder') return result;
    const delay = (playing ? config.sc2StartDelay : phase === 'loading' ? 0 : config.sc2EndDelay) * 1000;
    if ((playing && this.samples < 2) || now - this.since < delay) {
      result.pending = { to: candidate, dueAt: this.since + delay };
      result.message = playing ? '正在确认比赛开始' : '已离开比赛，等待局间转场'; return result;
    }
    if (busy) { result.message = '等待当前转场完成'; return result; }
    // Manual scenes are protected by sc2AutoPaused above; resuming must release them.
    if (!['opening', 'game', 'loading', 'intermission', 'break', 'blank', 'custom'].includes(scene)) { result.message = '等待可自动切换的场景'; return result; }
    if (playing) this.seenLive = true;
    if (scene === candidate) { if (phase === 'menu') this.seenLive = false; result.message = playing ? '比赛画面已同步' : '局间画面已同步'; return result; }
    result.target = candidate;
    result.message = playing ? '自动转场进入比赛' : phase === 'loading' ? '自动显示比赛载入画面' : '已返回大厅，立即显示等待画面';
    return result;
  }
}

function createSc2Monitor({ getConfig, getScene, transition, onUpdate, onSample = () => {}, shouldPoll = () => false, reader = readClientDetails, intervalMs = 1000, now = Date.now }) {
  const engine = new AutomationEngine();
  let closed = false, active = null, generation = 0;
  let status = { phase: 'offline', label: PHASE_LABELS.offline, checkedAt: null, pending: null, message: '点击检测连接，或开启自动切换' };
  let publishedKey='',publishedAt=-Infinity;
  const publish = () => {const {checkedAt,...meaningful}=status,key=JSON.stringify(meaningful);if(key!==publishedKey||now()-publishedAt>=5000){publishedKey=key;publishedAt=now();onUpdate({ ...status });}};
  async function poll() {
    if (closed || active) return { ...status };
    const epoch = generation, port = getConfig().sc2ClientPort;
    const abort = new AbortController(); active = abort;
    const timeout = setTimeout(() => abort.abort(), 1500);
    let phase = 'offline';
    let sample;
    try { sample = await reader(port, abort.signal); phase = typeof sample === 'string' ? sample : sample.phase; if (!Object.hasOwn(PHASE_LABELS, phase)) phase = 'unknown'; }
    catch { phase = 'offline'; }
    finally { clearTimeout(timeout); active = null; }
    if (closed || epoch !== generation) return { ...status };
    if (sample && typeof sample === 'object') onSample({ ...sample, phase });
    const c = getConfig(), current = getScene();
    const decision = engine.step(phase, c, current.scene, !!current.transition, now());
    status = { phase, label: PHASE_LABELS[phase], checkedAt: now(), pending: decision.pending, message: phase === 'offline' ? '未读到本机星际2状态；请启动游戏或查看连接说明' : decision.message };
    if (decision.target) {
      try { transition(decision.target); }
      catch { status.message = '等待当前转场完成，下次检测重试'; }
    }
    publish(); return { ...status };
  }
  function configure(previous) {
    const c = getConfig();
    if (['sc2AutoEnabled', 'sc2AutoPaused', 'sc2ClientPort', 'sc2StartDelay', 'sc2EndDelay', 'sc2IncludeReplays', 'sc2AutoMode'].some(key => c[key] !== previous[key])) {
      generation++; active?.abort(); engine.reset(); status.pending = null;
      status.message = c.sc2AutoPaused ? '已暂停，点击恢复自动切换' : c.sc2AutoEnabled ? '正在等待星际2状态' : '自动切换未开启'; publish();
      if (c.sc2AutoEnabled) queueMicrotask(poll);
    }
  }
  const timer = setInterval(() => { if (getConfig().sc2AutoEnabled || shouldPoll()) poll(); }, intervalMs); timer.unref();
  return { poll, configure, snapshot: () => ({ ...status }), close() { closed = true; clearInterval(timer); active?.abort(); } };
}
module.exports = { classify, readClient, readClientDetails, AutomationEngine, createSc2Monitor };
