const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {defaults:appearance,sanitize:style,dayKey}=require('./ladder.cjs');
const {sceneDefaults,sanitizeScenes}=require('./scene-settings.cjs');
const daily=require('./daily-stats.cjs');
const storage=require('./data-storage.cjs');
const defaults={...appearance,...sceneDefaults,...daily.defaults,enabled:true,includeAI:false,replayDirectory:'',toonHandle:'',mmrMode:'replay',mmrSource:'unknown',mmrAt:null,
  scoreboardEnabled:true,scoreboardTemplate:'compact',scoreboardAccent:'',scoreboardX:1328,scoreboardY:120,scoreboardWidth:560,scoreboardScale:100,scoreboardOpacity:100,scoreboardPanelOpacity:96,scoreboardDetails:true,
  waitingBackground:'gradient',waitingBackgroundImage:'',waitingColor:'#08121f',waitingColorSecondary:'#285476',waitingAccent:'#e6bc5c',waitingTextColor:'#f0f5fb',
  waitingLayout:'center',waitingImageFit:'cover',waitingDim:35,waitingPanelOpacity:35,waitingWidth:1320,waitingTitleSize:66,waitingKicker:'TEAM AENEAS / LADDER SESSION',
  waitingShowName:true,waitingShowMMR:true,waitingShowRecord:true,waitingShowMatchups:true,waitingShowPhase:true,waitingShowHUD:true,
  gameFrameEnabled:true,gameFrameStyle:'slim',gameFrameImage:'',gameFrameAccent:'#83c5b6',gameFrameThickness:3,gameFrameOpacity:90,gameFrameScale:100,gameFrameX:0,gameFrameY:0,
  gameFrameMinimap:true,gameFrameSelection:true,gameFramePortrait:true,gameFrameCommands:true,
  gameFrameDecorations:true,gameFrameDecorationScale:100,gameFrameMemeText:'优势在我！',
  catEnabled:false,catView:'rear',catCharacter:'cat',catFrontImage:'',catRearImage:'',catCurve:true,catKeyboardSide:'left',catX:1400,catY:320,catWidth:460,catOpacity:100,catAccent:'#f2a7d5',catHold:300,catHints:true,
  catLetters:true,catNumbers:true,catFunctions:true,catModifiers:true,catNavigation:true,catMouse:true,catChatGuard:true};
const validMMR=n=>Number.isInteger(n)&&n>0&&n<=20000;
const race=r=>({Terran:'T',Protoss:'P',Zerg:'Z',Random:'R',Terr:'T',Prot:'P'})[r]||r;
function sanitize(input,base=defaults){
  const c=daily.sanitize(input,sanitizeScenes(input,style(input,base)));
  for(const key of ['replayDirectory','toonHandle'])if(key in input){if(typeof input[key]!=='string'||input[key].length>1024||input[key].includes('\0'))throw Error('目录或账号格式不正确');c[key]=input[key].trim();}
  if(c.toonHandle&&!/^\d+-S2-\d+-\d+$/.test(c.toonHandle))throw Error('账号请填写完整格式，例如 5-S2-1-9469666');
  if('mmrMode'in input){if(!['replay','estimate','manual'].includes(input.mmrMode))throw Error('MMR模式不正确');c.mmrMode=input.mmrMode;}
  for(const key of ['scoreboardEnabled','scoreboardDetails','includeAI'])if(key in input){if(typeof input[key]!=='boolean')throw Error('计分器开关格式不正确');c[key]=input[key];}
  if('scoreboardAccent'in input){if(typeof input.scoreboardAccent!=='string'||(input.scoreboardAccent!==''&&!/^#[a-f\d]{6}$/i.test(input.scoreboardAccent)))throw Error('计分器颜色不正确');c.scoreboardAccent=input.scoreboardAccent;}
  if('scoreboardTemplate'in input){if(!['compact','bluegold','dual'].includes(input.scoreboardTemplate))throw Error('计分器模板不正确');c.scoreboardTemplate=input.scoreboardTemplate;}
  for(const [key,min,max]of [['scoreboardX',0,1900],['scoreboardY',0,1060],['scoreboardWidth',320,1000],['scoreboardScale',50,150],['scoreboardOpacity',0,100],['scoreboardPanelOpacity',0,100]])if(key in input){if(!Number.isInteger(input[key])||input[key]<min||input[key]>max)throw Error('计分器位置或大小超出范围');c[key]=input[key];}
  for(const key of ['gameFrameEnabled','gameFrameMinimap','gameFrameSelection','gameFramePortrait','gameFrameCommands','gameFrameDecorations'])if(key in input){if(typeof input[key]!=='boolean')throw Error('游戏边框开关格式不正确');c[key]=input[key];}
  if('gameFrameStyle'in input){if(!['slim','corners','nailong','anes','naiwa','nahida','vesna','nicole','custom'].includes(input.gameFrameStyle))throw Error('游戏边框样式不正确');c.gameFrameStyle=input.gameFrameStyle;}
  for(const key of ['gameFrameImage','catFrontImage','catRearImage'])if(key in input){if(typeof input[key]!=='string'||(input[key]!==''&&!/^\/style-assets\/[a-f\d]{64}\.png$/.test(input[key])))throw Error('请选择已安装风格中的素材');c[key]=input[key];}
  if('gameFrameAccent'in input){if(typeof input.gameFrameAccent!=='string'||!/^#[a-f\d]{6}$/i.test(input.gameFrameAccent))throw Error('游戏边框颜色不正确');c.gameFrameAccent=input.gameFrameAccent;}
  for(const [key,min,max]of [['gameFrameThickness',1,6],['gameFrameOpacity',20,100],['gameFrameScale',70,115],['gameFrameX',-120,120],['gameFrameY',-80,60]])if(key in input){if(!Number.isInteger(input[key])||input[key]<min||input[key]>max)throw Error('游戏边框外观数值超出范围');c[key]=input[key];}
  if('gameFrameDecorationScale'in input){if(!Number.isInteger(input.gameFrameDecorationScale)||input.gameFrameDecorationScale<50||input.gameFrameDecorationScale>140)throw Error('装饰大小请填50～140');c.gameFrameDecorationScale=input.gameFrameDecorationScale;}
  if('gameFrameMemeText'in input){if(typeof input.gameFrameMemeText!=='string'||[...input.gameFrameMemeText].length>16||/[\r\n\0]/.test(input.gameFrameMemeText))throw Error('恶搞文字最多16字，不能换行');c.gameFrameMemeText=input.gameFrameMemeText.trim();}
  for(const key of ['catEnabled','catCurve','catHints','catLetters','catNumbers','catFunctions','catModifiers','catNavigation','catMouse','catChatGuard'])if(key in input){if(typeof input[key]!=='boolean')throw Error('按键助手开关格式不正确');c[key]=input[key];}
  if('catCharacter'in input){if(!['cat','vesna','naiwa','nahida','nicole','custom'].includes(input.catCharacter))throw Error('按键助手角色不正确');c.catCharacter=input.catCharacter;}
  for(const [key,min,max]of [['catX',0,1600],['catY',0,820],['catWidth',280,760],['catOpacity',20,100],['catHold',120,1000]])if(key in input){if(!Number.isInteger(input[key])||input[key]<min||input[key]>max)throw Error('猫娘助手外观数值超出范围');c[key]=input[key];}
  if('catAccent'in input){if(typeof input.catAccent!=='string'||!/^#[a-f\d]{6}$/i.test(input.catAccent))throw Error('按键亮起颜色不正确');c.catAccent=input.catAccent;}
  if('catView'in input){if(!['split','classic','rear','flat'].includes(input.catView))throw Error('猫娘助手视角不正确');c.catView=input.catView;}
  if('catKeyboardSide'in input){if(!['left','right'].includes(input.catKeyboardSide))throw Error('请选择键盘左半或右半');c.catKeyboardSide=input.catKeyboardSide;}
  return c;
}
function createReplayStore(file=null,now=Date.now){
  let session={id:crypto.randomUUID(),startedAt:now(),endedAt:null,excludedIds:[]},previousSession=null,lastPersistAt=-Infinity,dirty=false;
  let config={...defaults,names:[]},records=[],seen={},pending={},active=null,baselines={},accounts={},status='录像监听就绪；可扫描今日或最近录像',mmrMessage='尚未获取 MMR';
  const validateSaved=s=>{
    if(!storage.object(s)||!storage.object(s.config||{}))throw Error('战绩数据格式错误');sanitize(s.config||{});
    for(const key of ['seen','pending','baselines','accounts'])if(key in s&&!storage.object(s[key]))throw Error('战绩索引格式错误');
    if('records'in s&&(!Array.isArray(s.records)||s.records.some(r=>!storage.object(r)||typeof r.id!=='string'||typeof r.identity!=='string'||!Number.isFinite(r.at)||!['win','loss'].includes(r.result))))throw Error('战绩列表格式错误');
    for(const value of Object.values(s.pending||{}))if(!storage.object(value)||!storage.object(value.parsed)||!Array.isArray(value.candidates))throw Error('待核对数据格式错误');
    for(const key of ['session','previousSession'])if(s[key]&&(!storage.object(s[key])||!Number.isFinite(s[key].startedAt)||(s[key].endedAt!==null&&!Number.isFinite(s[key].endedAt))||!Array.isArray(s[key].excludedIds)))throw Error('直播场次格式错误');
  };
  const saved=storage.readJSON(file,null,validateSaved);
  if(saved){
    config=sanitize(saved.config||{});
    for(const key of ['mmr','mmrUpdatedAt','mmrSource','mmrAt'])if(key in (saved.config||{}))config[key]=saved.config[key];
    if(config.mmr!==null&&!validMMR(config.mmr))config.mmr=null;
    records=saved.records||[];seen=saved.seen||{};pending=saved.pending||{};baselines=saved.baselines||{};accounts=saved.accounts||{};active=saved.active||null;mmrMessage=saved.mmrMessage||(config.mmr===null?'尚未获取 MMR':config.mmrSource==='estimate'?'MMR为估算，不是官方结算值':config.mmrSource==='replay'?'MMR来自录像字段，不代表最新官方结算值':'手动填写 MMR');
  }
  const savedHasActivity=saved?.session&&records.some(r=>r.at>=saved.session.startedAt&&!saved.session.excludedIds.includes(r.id));
  previousSession=saved?.previousSession&&!savedHasActivity?saved.previousSession:saved?.session?.endedAt===null?saved.session:saved?.previousSession||null;
  session.excludedIds=records.map(r=>r.id);
  function persist(){accounts[identity()]=Object.fromEntries(['mmr','mmrAt','mmrSource','mmrUpdatedAt'].map(k=>[k,config[k]]));storage.writeJSON(file,{schema:2,config,records,seen,pending,baselines,accounts,active,mmrMessage,session,previousSession});lastPersistAt=now();dirty=false;}
  function startSession(){session={id:crypto.randomUUID(),startedAt:now(),endedAt:null,excludedIds:records.map(r=>r.id)};previousSession=null;persist();return snapshot();}
  function endSession(){if(session.endedAt===null){session.endedAt=now();persist();}return snapshot();}
  function resumeSession(){if(!previousSession)throw Error('没有可继续的上一场直播');session={...previousSession,endedAt:null};previousSession=null;persist();return snapshot();}
  function flush(){if(dirty)persist();}
  function identity(){const folder=config.replayDirectory.match(/(?:^|[\\/])(\d+-S2-\d+-\d+)(?:[\\/]|$)/);return config.toonHandle||(!config.names.length&&folder?folder[1]:'name:'+config.names.join('|'));}
  function baseline(at=now()){const key=identity()+':'+dayKey(at);if(!(key in baselines)&&config.mmr!==null)baselines[key]=config.mmr;return key;}
  function countStats(counted){
    const wins=counted.filter(r=>r.result==='win').length,losses=counted.length-wins;
    const matchups=Object.fromEntries(['T','Z','P'].map(r=>[r,{wins:counted.filter(m=>m.opponentRace===r&&m.result==='win').length,losses:counted.filter(m=>m.opponentRace===r&&m.result==='loss').length}]));
    let streak=0,last=counted.at(-1)?.result;for(let i=counted.length-1;i>=0&&counted[i].result===last;i--)streak++;
    return{wins,losses,total:counted.length,winrate:counted.length?Math.round(wins/counted.length*100):null,streak:last?`${streak}连${last==='win'?'胜':'败'}`:'尚未开始',matchups};
  }
  function countedRecord(r){return !r.excluded&&(r.matchType!=='ai1v1'||config.includeAI);}
  function snapshot(){
    const today=records.filter(r=>r.identity===identity()&&dayKey(r.at)===dayKey(now())).sort((a,b)=>a.at-b.at),counted=today.filter(countedRecord),wins=counted.filter(r=>r.result==='win').length,losses=counted.length-wins;
    const matchups=Object.fromEntries(['T','Z','P'].map(r=>[r,{wins:counted.filter(m=>m.opponentRace===r&&m.result==='win').length,losses:counted.filter(m=>m.opponentRace===r&&m.result==='loss').length}]));
    let streak=0,last=counted.at(-1)?.result;for(let i=counted.length-1;i>=0&&counted[i].result===last;i--)streak++;
    const longest=counted.filter(r=>r.replayKey&&Number.isFinite(r.durationSeconds)&&r.durationSeconds>0).reduce((best,r)=>!best||r.durationSeconds>best.durationSeconds||r.durationSeconds===best.durationSeconds&&r.at>best.at?r:best,null);
    const longestMatch=longest?{id:longest.id,at:longest.at,durationSeconds:Math.round(longest.durationSeconds),opponent:longest.opponent,map:longest.map||'',result:longest.result}:null;
    const sessionRecords=records.filter(r=>r.identity===identity()&&r.at>=session.startedAt&&(session.endedAt===null||r.at<=session.endedAt)&&!session.excludedIds.includes(r.id)).sort((a,b)=>a.at-b.at);
    const sessionView={id:session.id,startedAt:session.startedAt,endedAt:session.endedAt,running:session.endedAt===null,resumeAvailable:!!previousSession,previousStartedAt:previousSession?.startedAt||null,stats:countStats(sessionRecords.filter(countedRecord)),records:sessionRecords.slice(-200).reverse()};
    const history=records.filter(r=>r.identity===identity()).sort((a,b)=>b.at-a.at);
    const key=baseline();return{session:sessionView,history:history.slice(0,500),historyTotal:history.length,config:{...config,names:[...config.names]},date:dayKey(now()),status,mmrMessage,stats:{daily:daily.summarize(counted),longestMatch,wins,losses,total:counted.length,winrate:counted.length?Math.round(wins/counted.length*100):null,streak:last?`${streak}连${last==='win'?'胜':'败'}`:'尚未开始',delta:config.mmr!==null&&Number.isInteger(baselines[key])?config.mmr-baselines[key]:null,matchups},records:today.slice(-200).reverse(),pending:Object.values(pending).filter(p=>p.identity===identity()),active};
  }
  function configure(input){const before=identity(),previous=Object.fromEntries(['mmr','mmrAt','mmrSource','mmrUpdatedAt'].map(k=>[k,config[k]]));config=sanitize(input,config);if(identity()!==before){accounts[before]=previous;active=null;Object.assign(config,accounts[identity()]||{mmr:null,mmrAt:null,mmrSource:'unknown',mmrUpdatedAt:null});mmrMessage=config.mmr===null?'游戏身份已改变，请重新扫描或填写 MMR':'已恢复此账号保存的 MMR';}persist();return snapshot();}
  function updateMMR(value){if(value!==null&&!validMMR(value))throw Error('MMR请填1～20000整数或留空');baseline();config.mmr=value;config.mmrSource=value===null?'unknown':'manual';config.mmrUpdatedAt=value===null?null:now();config.mmrAt=value===null?null:now();baseline();mmrMessage=value===null?'MMR已清空':'手动修正 MMR';persist();return snapshot();}
  function observe({phase,game}){
    if(!config.enabled||!game||game.isReplay!==false||game.players?.length!==2||game.players.some(p=>p.type!=='user'))return;
    // The client has names but no account handles. It never creates a result.
    const me=game.players.filter(p=>config.names.includes(p.name));if(me.length!==1)return;
    const opponent=game.players.find(p=>p!==me[0]),key=JSON.stringify(game.players.map(p=>[p.name,p.race]).sort());
    let boundary=false;
    if(phase==='live'&&(!active||active.key!==key||game.displayTime<active.lastTime-3||active.endedAt)){boundary=true;active={id:crypto.randomUUID(),key,startedAt:now()-game.displayTime*1000,opponent:opponent.name,opponentRace:race(opponent.race),identity:identity(),lastTime:game.displayTime};}
    if(active&&active.key===key){active.lastTime=game.displayTime;active.updatedAt=now();if(phase==='menu'&&!active.endedAt){active.endedAt=now();boundary=true;}dirty=true;if(boundary||now()-lastPersistAt>=5000)persist();}
  }
  function add(result,extra={}){
    if(!['win','loss'].includes(result))throw Error('战绩只能是胜或负');
    const at=extra.at??now();if(!Number.isFinite(at)||at<0||at>now()+60000)throw Error('补记时间无效');
    if(typeof(extra.opponent??'')!=='string'||(extra.opponent||'').length>60)throw Error('对手名称不正确');
    const session=active&&now()-(active.endedAt||active.updatedAt||active.startedAt)<120000?active:null;
    if(session&&records.some(r=>r.id===session.id))throw Error('当前对局已经补记，请直接修改原记录');
    if(records.some(r=>r.identity===identity()&&r.replayKey&&Math.abs(r.at-at)<=120000&&(!extra.opponent||r.opponent===extra.opponent)))throw Error('此时间附近已有录像战绩，请先核对并修改原记录，避免重复补记');
    const r={id:session?.id||crypto.randomUUID(),identity:identity(),at,result,opponent:extra.opponent||session?.opponent||'手动记录',opponentRace:session?.opponentRace||'',startedAt:session?.startedAt,source:'manual',excluded:false};records.push(r);persist();return snapshot();
  }
  function edit(id,patch){const r=records.find(r=>r.id===id&&r.identity===identity());if(!r)throw Error('记录不存在');if('result'in patch){if(!['win','loss'].includes(patch.result))throw Error('胜负无效');r.result=patch.result;}if('excluded'in patch){if(typeof patch.excluded!=='boolean')throw Error('排除格式无效');r.excluded=patch.excluded;}persist();return snapshot();}
  function undo(scope='today'){if(!['today','session'].includes(scope))throw Error('撤销范围无效');const snap=snapshot(),r=(scope==='session'?snap.session.records:snap.records).find(countedRecord);if(r)return edit(r.id,{excluded:true});return snapshot();}
  function updateFromReplay(p,result){
    if(config.mmrMode==='manual')return;
    if(config.mmrAt!==null&&p.at<=config.mmrAt)return;
    const self=p.selfPlayers[0],op=p.opponents[0],value=self.mmr;
    if(!validMMR(value)||(config.mmr!==null&&Math.abs(value-config.mmr)>1200)){mmrMessage='录像 MMR 缺失、占位或异常，已保留原显示；可手动修正';return;}
    let next=value,source='replay';
    if(config.mmrMode==='estimate'){
      const seed=config.mmr??value;if(!validMMR(op.mmr)||Math.abs(seed-op.mmr)>1200){mmrMessage='对手 MMR 无效或差距异常，无法估算；已保留原显示';return;}
      next=Math.round(seed+44*((result==='win'?1:0)-1/(1+Math.pow(10,(op.mmr-seed)/850))));source='estimate';
    }
    baseline(p.at);config.mmr=next;config.mmrSource=source;config.mmrAt=p.at;config.mmrUpdatedAt=now();baseline(p.at);
    mmrMessage=source==='estimate'?'MMR为估算（K=44，尺度=850），不是官方结算值':'MMR来自录像字段；不代表最新官方结算值';
  }
  function acceptReplay(p,hash,{recordId,newRecord=false}={}){
    if(!p?.ok)throw Error(p?.error||'录像解析失败');
    const me=p.selfPlayers?.[0],op=p.opponents?.[0],isAI=p.players?.some(x=>x.human===false);
    const metricsOpponent=isAI?{...op,mmr:null}:op;
    if(isAI&&!config.includeAI){status='已跳过：人机对局不计入真人1v1战绩；可开启“计入人机对局”';return{kind:'skipped',message:status};}
    if(p.players?.length!==2||p.selfPlayers?.length!==1||p.opponents?.length!==1||me?.human!==true||(isAI?op?.human!==false:op?.human!==true)||p.players.some(x=>x.human!==true&&x.human!==false)||!['W','L'].includes(p.selfResult)||!Number.isFinite(p.at)||p.at<=0||p.at>now()+60000){status='已跳过：旁观、身份不明、非1v1或胜负/时间无效';return{kind:'skipped',message:status};}
    const matchKey=crypto.createHash('sha256').update(JSON.stringify([p.at,p.durationSeconds,p.map,p.players.map(x=>x.toonHandle).sort()])).digest('hex'),key=identity()+':'+matchKey,hashKey=identity()+':'+hash;
    if(seen[key]||seen[hashKey]){const previous=records.find(r=>r.id===(seen[key]||seen[hashKey])&&r.identity===identity());let changed=previous?daily.enrich(previous,p,metricsOpponent):false;if(previous&&(!Number.isFinite(previous.durationSeconds)||previous.durationSeconds<=0)&&Number.isFinite(p.durationSeconds)&&p.durationSeconds>0){previous.durationSeconds=p.durationSeconds;changed=true;}if(changed)persist();return{kind:'duplicate',message:'已处理过这盘录像，统计已核对'};}
    const result=p.selfResult==='W'?'win':'loss';
    const replayStart=Number.isFinite(p.durationSeconds)&&p.durationSeconds>0?p.at-p.durationSeconds*1000:null;
    const candidates=records.filter(r=>r.identity===identity()&&r.source==='manual'&&!r.replayKey&&((Math.abs(r.at-p.at)<=120000&&(replayStart===null||r.at>=replayStart-15000))||(Number.isFinite(r.startedAt)&&replayStart!==null&&Math.abs(r.startedAt-replayStart)<=15000))&&(r.opponent==='手动记录'||r.opponent===op.name));
    let r=recordId?records.find(r=>r.id===recordId&&r.identity===identity()&&!r.replayKey):null;
    if(recordId&&!r)throw Error('关联的手动记录不存在或已绑定录像');
    if(!r&&!newRecord&&candidates.length===1)r=candidates[0];
    if(!r&&!newRecord&&candidates.length>1){pending[key]={key,hash,parsed:p,identity:identity(),candidates:candidates.map(r=>r.id)};status='录像可能对应多条手动补记，请在待核对区关联原记录';persist();return{kind:'pending',message:status};}
    if(!r){r={id:crypto.randomUUID(),at:p.at,result,identity:identity(),source:'replay',excluded:false};records.push(r);}
    Object.assign(r,{at:p.at,replayKey:key,replayHash:hash,map:p.map,opponent:op.name,opponentRace:race(op.race),race:race(me.race),matchType:isAI?'ai1v1':'human1v1',replayAt:p.at,replayResult:result,durationSeconds:Number.isFinite(p.durationSeconds)&&p.durationSeconds>0?p.durationSeconds:null});
    daily.enrich(r,p,metricsOpponent);if(!r.excluded&&!isAI)updateFromReplay(p,r.result);seen[key]=r.id;seen[hashKey]=r.id;delete pending[key];status=`已${r.source==='manual'?'关联手动记录':'读取一'+(result==='win'?'胜':'负')} · ${op.name}${isAI?' · 人机1v1':''}`;persist();return{kind:'recorded',message:status};
  }
  function resolve(key,recordId,newRecord){const p=pending[key];if(!p)throw Error('待核对录像不存在');return acceptReplay(p.parsed,p.hash,{recordId,newRecord});}
  return{snapshot,startSession,endSession,resumeSession,flush,saveSession:persist,configure,updateMMR,observe,add,edit,undo,acceptReplay,resolve,getConfig:()=>config,getSessionStartedAt:()=>session.startedAt,getSessionEndedAt:()=>session.endedAt,setStatus:s=>{status=s;}};
}
module.exports={createReplayStore,sanitize,defaults,validMMR};
