(function(root){
 const time=n=>Number.isFinite(n)?Math.floor(Math.round(n)/60)+':'+String(Math.round(n)%60).padStart(2,'0'):'—';
 function rows(ladder){const c=ladder.config,s=ladder.stats,d=s.daily||{replayCount:0,coverage:{},zerglings:null,zealots:null,workersKilled:null};const out=[];
  for(const [flag,key,title]of [['dailyZerglings','zerglings','今日造狗'],['dailyZealots','zealots','今日刷叉'],['dailyWorkersKilled','workersKilled','击杀敌方农民']])if(c[flag]){const n=d[key],parsed=d.coverage[key]||0,partial=parsed<d.replayCount;out.push({title,value:n==null?'—':(partial?'≥ ':'')+n,detail:n==null?'单位统计待解析':partial?'已解析 '+parsed+' / '+d.replayCount+' 盘':key==='workersKilled'?'确认由你击杀':'自己完成生产的单位'});}
  if(c.dailyLongest){const r=s.longestMatch;out.push({title:'今日最长对局',value:r?time(r.durationSeconds):'—',detail:r?r.opponent+' · '+(r.result==='win'?'胜':'负')+' · '+r.map:'尚无可用录像时长'});}
  if(c.dailyStrongest){const r=d.strongest;out.push({title:'今日最强对手',value:r?'MMR '+r.mmr:'—',detail:r?r.name+' · '+(r.result==='win'?'胜':'负')+(d.mmrCount<d.replayCount?' · 仅已知MMR':''):'录像对手MMR待获取'});}
  if(c.dailyRecord)out.push({title:'今日战绩',value:s.wins+'胜 '+s.losses+'负',detail:s.total+' 场 · 胜率 '+(s.winrate===null?'—':s.winrate+'%')});
  if(c.dailyTime)out.push({title:'今日对局时长',value:(d.timeCount<d.replayCount?'≥ ':'')+time(d.seconds),detail:'已确认录像时长合计'});return out;
 }
 const demo={date:'示例预览',stats:{wins:3,losses:2,total:5,winrate:60,longestMatch:{durationSeconds:1942,opponent:'示例对手',result:'win',map:'示例地图'},daily:{zerglings:368,zealots:72,workersKilled:46,coverage:{zerglings:5,zealots:5,workersKilled:5},replayCount:5,manualCount:0,mmrCount:5,timeCount:5,seconds:5820,strongest:{name:'示例高分对手',mmr:6200,result:'loss'}}}};
 function diagnostics(ladder,replays){const c=ladder.config,d=ladder.stats.daily||{},out=[];if(!c.enabled||!c.autoTrack)out.push('自动读取未开启，请到账号与录像设置开启总开关和自动读取');if(!c.replayDirectory)out.push('尚未设置录像目录');if(!c.toonHandle&&!c.names?.length&&!/(?:^|[\\/])\d+-S2-\d+-\d+(?:[\\/]|$)/.test(c.replayDirectory||''))out.push('尚未确认自己的账号或精确昵称');if(d.manualCount)out.push(d.manualCount+' 条手动补记尚未关联录像，不能计算单位生产');for(const issue of (d.issues||[]).slice(0,3))out.push(issue.count+' 盘：'+issue.note+(/暂不支持版本/.test(issue.note)?'；请更新分享包后扫描今日录像':''));if(replays?.errors?.length)out.push('录像读取失败：'+replays.errors[0].message);if(!d.replayCount&&!d.manualCount)out.push('今天暂无已计入的录像；对局结束并保存后自动更新');return out;}
 root.DailyModel={rows,time,demo,diagnostics};
})(typeof window==='undefined'?globalThis:window);
