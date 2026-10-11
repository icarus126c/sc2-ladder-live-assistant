const {dayKey}=require('./ladder.cjs');
function explain(records,{identity,session,includeAI,now}){
 const date=dayKey(now),eligible=r=>!r.excluded&&(r.matchType!=='ai1v1'||includeAI);
 const dailyReason=r=>r.excluded?'已手动排除':r.matchType==='ai1v1'&&!includeAI?'人机开关关闭':dayKey(r.at)!==date?'不是北京时间今天结束的对局':'计入今日';
 const sessionReason=r=>!eligible(r)?dailyReason(r):r.at<session.startedAt?'结束时间早于本次直播开始':session.endedAt!==null&&r.at>session.endedAt?'结束时间晚于本次直播结束':session.excludedIds.includes(r.id)?'开始本次直播前已存在的记录':'计入本次直播';
 const own=records.filter(r=>r.identity===identity).sort((a,b)=>b.at-a.at),rows=own.slice(0,300).map(r=>({id:r.id,at:r.at,opponent:r.opponent,opponentRace:r.opponentRace,opponentHandle:r.opponentHandle||'',result:r.result,map:r.map||'',source:r.source,matchType:r.matchType||'human1v1',dailyIncluded:eligible(r)&&dayKey(r.at)===date,sessionIncluded:eligible(r)&&r.at>=session.startedAt&&(session.endedAt===null||r.at<=session.endedAt)&&!session.excludedIds.includes(r.id),dailyReason:dailyReason(r),sessionReason:sessionReason(r),unitStatus:r.replayKey?((['zealots','zerglings','workersKilled'].every(k=>Number.isSafeInteger(r.dailyMetrics?.[k]))?'单位统计已解析':r.dailyMetrics?.note||'等待单位解析')):'未关联录像，暂无单位统计'}));
 return {date,startedAt:session.startedAt,endedAt:session.endedAt,includeAI,rows,total:own.length,limit:300};
}
module.exports={explain};
