const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const defaults = { enabled:false, autoTrack:true, names:[], name:'', race:'T', mmr:null, mmrUpdatedAt:null,
  template:'compact', x:32, y:120, width:560, scale:100, fontSize:22, opacity:92, accent:'#eeeae0',
  showName:true, showMMR:true, showRecord:true, showWinrate:true, showStreak:true, showDelta:true,
  title:'今日冲分', text:'{name} · {race}\nMMR {mmr} · 今日 {wins}胜 {losses}负\n胜率 {winrate} · {streak}',
  waitingTitle:'下一局，准备出发', waitingNote:'搜索对手 / 局间休息', showHUD:true };
const dayKey = time => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
function sanitize(input,base=defaults) {
  if(!input || typeof input!=='object' || Array.isArray(input)) throw new Error('助手设置格式不正确');
  const c={...base,names:[...base.names]};
  for(const [key,max] of Object.entries({name:40,title:40,text:400,waitingTitle:60,waitingNote:100})) if(key in input) {
    if(typeof input[key]!=='string' || input[key].length>max) throw new Error('文字太长或格式不正确'); c[key]=input[key].trim();
  }
  if('names' in input) {
    if(!Array.isArray(input.names)||input.names.length>20||input.names.some(n=>typeof n!=='string'||!n.trim()||n.length>60))throw new Error('昵称需为最多20个非空名称');
    c.names=[...new Set(input.names.map(n=>n.trim()))];
  }
  for(const key of ['enabled','autoTrack','showName','showMMR','showRecord','showWinrate','showStreak','showDelta','showHUD']) if(key in input) {
    if(typeof input[key]!=='boolean')throw new Error('开关格式不正确');c[key]=input[key];
  }
  for(const [key,min,max] of [['x',0,1900],['y',0,1060],['width',320,1000],['scale',50,150],['fontSize',14,48],['opacity',0,100]]) if(key in input) {
    if(!Number.isInteger(input[key])||input[key]<min||input[key]>max) throw new Error('位置或外观数值超出范围');c[key]=input[key];
  }
  if('race' in input){if(!['T','P','Z','R'].includes(input.race))throw new Error('种族不正确');c.race=input.race;}
  if('template' in input){if(!['compact','bluegold','dual','custom'].includes(input.template))throw new Error('模板不正确');c.template=input.template;}
  if('accent' in input){if(typeof input.accent!=='string'||!/^#[a-f\d]{6}$/i.test(input.accent))throw new Error('颜色不正确');c.accent=input.accent;}
  return c;
}
function createLadderStore(file=null,now=Date.now) {
  let config={...defaults,names:[]},records=[],baselines={},active=null,status='填入游戏昵称，开启助手后可自动记账';
  if(file&&fs.existsSync(file))try {
    const saved=JSON.parse(fs.readFileSync(file,'utf8'));config=sanitize(saved.config||{});
    if(saved.config?.mmr===null || (Number.isInteger(saved.config?.mmr)&&saved.config.mmr>=0&&saved.config.mmr<=20000))config.mmr=saved.config.mmr;
    if(Number.isFinite(saved.config?.mmrUpdatedAt))config.mmrUpdatedAt=saved.config.mmrUpdatedAt;
    if(Array.isArray(saved.records))records=saved.records.filter(r=>typeof r.id==='string'&&['win','loss'].includes(r.result)&&Number.isFinite(r.at)).slice(-10000);
    if(saved.baselines&&typeof saved.baselines==='object')baselines=saved.baselines;
    if(saved.active&&typeof saved.active.id==='string')active=saved.active;
  }catch {status='保存的数据无法读取，请核对战绩';}
  function persist(){if(!file)return;fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify({config,records,baselines,active},null,2));fs.renameSync(temp,file);}
  function baseline(){const day=dayKey(now());if(!(day in baselines)&&config.mmr!==null){baselines[day]=config.mmr;persist();}return day;}
  function snapshot() {
    const day=baseline(),today=records.filter(r=>dayKey(r.at)===day),counted=today.filter(r=>!r.excluded);
    const wins=counted.filter(r=>r.result==='win').length,losses=counted.length-wins;
    let streak=0;const last=counted.at(-1)?.result;for(let i=counted.length-1;i>=0&&counted[i].result===last;i--)streak++;
    const delta=config.mmr!==null&&Number.isInteger(baselines[day])?config.mmr-baselines[day]:null;
    return {config:{...config,names:[...config.names]},date:day,status,stats:{wins,losses,total:wins+losses,winrate:counted.length?Math.round(wins/counted.length*100):null,streak:last?`${streak}连${last==='win'?'胜':'败'}`:'尚未开始',delta},records:today.slice(-100).reverse(),active:active&&!active.recorded?{opponent:active.opponent,startedAt:active.startedAt}:null};
  }
  function configure(input){const next=sanitize(input,config);if(JSON.stringify(next.names)!==JSON.stringify(config.names)||(config.enabled&&!next.enabled)||(config.autoTrack&&!next.autoTrack))active=null;config=next;persist();return snapshot();}
  function updateMMR(value){if(value!==null&&(!Number.isInteger(value)||value<0||value>20000))throw new Error('MMR需要是0～20000整数，或留空');baseline();config={...config,mmr:value,mmrUpdatedAt:value===null?null:now()};baseline();persist();return snapshot();}
  function add(result,extra={}) {
    if(!['win','loss'].includes(result))throw new Error('战绩只能是胜或负');
    if(typeof(extra.opponent??'')!=='string'||(extra.opponent||'').length>60)throw new Error('对手名称不正确');
    const pending=active&&!active.recorded?active:null;
    const r={id:pending?.id||crypto.randomUUID(),at:now(),result,opponent:extra.opponent||pending?.opponent||'手动记录',race:pending?.race||config.race,opponentRace:pending?.opponentRace||'',source:'manual',excluded:false};
    if(pending)pending.recorded=true;
    records.push(r);records=records.slice(-10000);persist();return snapshot();
  }
  function edit(id,patch) {
    const item=records.find(r=>r.id===id);if(!item)throw new Error('记录不存在');
    if('result'in patch&&!['win','loss'].includes(patch.result))throw new Error('战绩不正确');
    if('excluded'in patch&&typeof patch.excluded!=='boolean')throw new Error('排除设置不正确');
    if('result'in patch)item.result=patch.result;if('excluded'in patch)item.excluded=patch.excluded;persist();return snapshot();
  }
  function undo(){const day=dayKey(now()),last=records.findLast(r=>!r.excluded&&dayKey(r.at)===day);if(last){last.excluded=true;persist();}return snapshot();}
  const fingerprint=game=>JSON.stringify(game.players.map(p=>[p.name,p.race]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
  const resultOf=player=>player?.result==='Victory'?'win':player?.result==='Defeat'?'loss':null;
  function observe(sample) {
    if(!config.enabled||!config.autoTrack)return;
    if(!config.names.length){status='请先填写游戏昵称，自动战绩尚未开始';return;}
    const {phase,game}=sample;
    if(!game||game.isReplay!==false||!Array.isArray(game.players)||game.players.length!==2||game.players.some(p=>!p||typeof p.name!=='string'))return;
    if(game.players.some(p=>p.type!=='user')){status='非双人玩家对局，不自动计入';return;}
    if(!['live','menu'].includes(phase))return;
    const key=fingerprint(game),matches=game.players.filter(p=>config.names.includes(p.name));
    if(matches.length!==1){if(phase==='live')status=matches.length>1?'双方昵称相同，无法确认身份；本局请手动记录':'没有匹配到你的昵称，本局不自动计入';return;}
    const me=matches[0],opponent=game.players.find(p=>p!==me),at=now();
    const changed=active&&(active.key!==key||game.displayTime<active.lastTime-3||(active.menuSeen&&phase==='live'&&!resultOf(me)));
    if(phase==='live'&&(!active||changed)&&!resultOf(me)) {
      active={id:crypto.randomUUID(),key,startedAt:at,lastTime:game.displayTime,player:me.name,opponent:opponent.name,race:me.race,opponentRace:opponent.race,recorded:false,menuSeen:false};persist();
    }
    if(!active||active.key!==key||active.player!==me.name)return;
    if(phase==='menu'&&!active.menuSeen){active.menuSeen=true;active.endedAt=at;persist();}
    if(active.menuSeen&&at-active.endedAt>120000&&!active.recorded){status='客户端未及时提供本局胜负，请手动补记';return;}
    active.lastTime=game.displayTime;
    const result=resultOf(me);
    if(result&&!active.recorded) {
      if(!records.some(r=>r.id===active.id))records.push({id:active.id,at,startedAt:active.startedAt,result,opponent:active.opponent,race:active.race,opponentRace:active.opponentRace,source:'auto',excluded:false});
      active.recorded=true;records=records.slice(-10000);persist();status=`已自动记一${result==='win'?'胜':'负'} · 对手 ${active.opponent}`;
    } else if(!active.recorded)status=phase==='live'?`正在记录对局 · 对手 ${opponent.name}`:'已退出对局，等待客户端胜负；未提供时可手动补记';
  }
  return {snapshot,configure,updateMMR,add,edit,undo,observe,getConfig:()=>config};
}
module.exports={createLadderStore,sanitize,defaults,dayKey};
