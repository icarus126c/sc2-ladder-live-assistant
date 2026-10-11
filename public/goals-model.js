(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GoalsModel=factory();})(typeof window==='object'?window:this,()=>{
 const defaults={goalsEnabled:false,goals:[],goalsX:36,goalsY:320,goalsWidth:420,goalsOpacity:96};
 const units={zealots:'刷叉',zerglings:'造狗',workersKilled:'击杀敌方农民'};
 function sanitize(input,base){const c={...base};
  if('goalsEnabled'in input){if(typeof input.goalsEnabled!=='boolean')throw Error('目标开关格式不正确');c.goalsEnabled=input.goalsEnabled;}
  for(const [k,min,max]of [['goalsX',0,1700],['goalsY',0,980],['goalsWidth',240,900],['goalsOpacity',0,100]])if(k in input){if(!Number.isInteger(input[k])||input[k]<min||input[k]>max)throw Error('目标位置或外观超出范围');c[k]=input[k];}
  if('goals'in input){if(!Array.isArray(input.goals)||input.goals.length>12)throw Error('最多设置12个目标');const ids=new Set();c.goals=input.goals.map(g=>{
   if(!g||typeof g!=='object'||Array.isArray(g)||typeof g.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(g.id)||ids.has(g.id))throw Error('目标编号不正确');ids.add(g.id);
   if(!['streak','race','player','wins',...Object.keys(units)].includes(g.kind)||!Number.isInteger(g.target)||g.target<1||g.target>(units[g.kind]?10000000:9999))throw Error('目标类型或数量不正确');
   const scope=g.scope??'today';if(!['today','session'].includes(scope))throw Error('请选择今日或本次直播');const row={id:g.id,kind:g.kind,target:g.target,scope};
   if(g.kind==='race'){if(!['T','P','Z'].includes(g.race))throw Error('请选择对手种族');row.race=g.race;}
   if(g.kind==='player'){if(typeof g.player!=='string'||!g.player.trim()||[...g.player].length>80||/[\r\n\0]/.test(g.player))throw Error('请填写玩家精确昵称或完整账号ID');row.player=g.player.trim();}return row;});}
  return c;
 }
 function summarize(today,goals=[],session=[]){return goals.map(g=>{
  const scope=g.scope??'today',records=scope==='session'?session:today,scopeLabel=scope==='session'?'本次直播':'今日';
  let current=0,best=0;for(const r of records){current=r.result==='win'?current+1:0;best=Math.max(best,current);}
  let value=0,label='',partial=false,pending=false,note='按当前账号'+scopeLabel+'计入战绩统计';
  if(g.kind==='streak'){value=best;label=g.target+' 连胜';note=scopeLabel+'最高 '+best+' 连胜 · 当前 '+current+' 连胜';}
  if(g.kind==='race'){value=records.filter(r=>r.result==='win'&&r.opponentRace===g.race).length;label='v'+g.race+' '+g.target+' 胜';}
  if(g.kind==='wins'){value=records.filter(r=>r.result==='win').length;label='累计 '+g.target+' 胜';}
  if(g.kind==='player'){value=records.filter(r=>r.result==='win'&&(r.opponentHandle===g.player||r.opponent===g.player)).length;label='战胜 '+g.player+' '+g.target+' 次';}
  if(units[g.kind]){
   const replays=records.filter(r=>r.replayKey),known=replays.filter(r=>Number.isSafeInteger(r.dailyMetrics?.[g.kind])&&r.dailyMetrics[g.kind]>=0);
   value=records.length&&!known.length?null:known.reduce((n,r)=>n+r.dailyMetrics[g.kind],0);pending=value===null;partial=known.length<records.length;
   label=units[g.kind]+' '+g.target+(g.kind==='workersKilled'?' 位':' 只');note=pending?'等待读取录像单位数据':partial?'已解析 '+known.length+' / '+records.length+' 盘，仅累计已确认数量':g.kind==='workersKilled'?'确认由你击杀的敌方农民':'自己完成生产的单位，含后来阵亡的单位';
  }
  const complete=value!==null&&value>=g.target;
  return {...g,scope,scopeLabel,label,value,complete,partial,pending,percent:value===null?0:Math.min(100,Math.round(value/g.target*100)),valueText:value===null?'待解析':(partial?'≥ ':'')+value,note};
 });}
 const demo=[{id:'demo-streak',scope:'today',scopeLabel:'今日',label:'3 连胜',value:2,valueText:'2',target:3,complete:false},{id:'demo-units',scope:'session',scopeLabel:'本次直播',label:'刷叉 200 只',value:72,valueText:'72',target:200,complete:false}];
 return {defaults,sanitize,summarize,demo};
});
