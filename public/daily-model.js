(function(root){
 const time=n=>Number.isFinite(n)?Math.floor(Math.round(n)/60)+':'+String(Math.round(n)%60).padStart(2,'0'):'—';
 function rows(ladder){const c=ladder.config,s=ladder.stats,d=s.daily||{replayCount:0,coverage:{},zerglings:null,zealots:null,workersKilled:null};const out=[];
  for(const [flag,key,title]of [['dailyZerglings','zerglings','今日造狗'],['dailyZealots','zealots','今日刷叉'],['dailyWorkersKilled','workersKilled','击杀敌方农民']])if(c[flag]){const n=d[key],parsed=d.coverage[key]||0,partial=parsed<d.replayCount;out.push({title,value:n===null?'—':(partial?'≥ ':'')+n,detail:n===null?'扫描录像后解析':partial?'已解析 '+parsed+' / '+d.replayCount+' 盘':key==='workersKilled'?'确认由你击杀':'自己完成生产的单位'});}
  if(c.dailyLongest){const r=s.longestMatch;out.push({title:'今日最长对局',value:r?time(r.durationSeconds):'—',detail:r?r.opponent+' · '+(r.result==='win'?'胜':'负')+' · '+r.map:'尚无可用录像时长'});}
  if(c.dailyStrongest){const r=d.strongest;out.push({title:'今日最强对手',value:r?'MMR '+r.mmr:'—',detail:r?r.name+' · '+(r.result==='win'?'胜':'负')+(d.mmrCount<d.replayCount?' · 仅已知MMR':''):'录像对手MMR待获取'});}
  if(c.dailyRecord)out.push({title:'今日战绩',value:s.wins+'胜 '+s.losses+'负',detail:s.total+' 场 · 胜率 '+(s.winrate===null?'—':s.winrate+'%')});
  if(c.dailyTime)out.push({title:'今日对局时长',value:(d.timeCount<d.replayCount?'≥ ':'')+time(d.seconds),detail:'已确认录像时长合计'});return out;
 }
 const demo={date:'示例预览',stats:{wins:3,losses:2,total:5,winrate:60,longestMatch:{durationSeconds:1942,opponent:'示例对手',result:'win',map:'示例地图'},daily:{zerglings:368,zealots:72,workersKilled:46,coverage:{zerglings:5,zealots:5,workersKilled:5},replayCount:5,manualCount:0,mmrCount:5,timeCount:5,seconds:5820,strongest:{name:'示例高分对手',mmr:6200,result:'loss'}}}};
 root.DailyModel={rows,time,demo};
})(typeof window==='undefined'?globalThis:window);
