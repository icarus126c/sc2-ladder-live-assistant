(()=>{
  const $=id=>document.getElementById(id),stamp=at=>at?new Date(at).toLocaleString('zh-CN',{hour12:false}):'尚未检测';
  let diagnosticKey='';
  function render(state,connected){
    const ladder=state.ladder,session=ladder.session,c=ladder.config;
    if(!session)return;
    $('streamSummary').textContent=`${session.stats.wins} 胜 ${session.stats.losses} 负${session.running?'':' · 已结束'}`;
    $('streamToday').textContent=`今日 ${ladder.stats.wins} 胜 ${ladder.stats.losses} 负 · ${ladder.date}（北京时间）`;
    $('streamBoundary').textContent='开始：'+stamp(session.startedAt)+(session.endedAt?' · 结束：'+stamp(session.endedAt):'');
    $('streamResume').hidden=false;
    $('streamResume').textContent='恢复上一场';
    $('streamResume').title=session.resumeAvailable?'继续从 '+stamp(session.previousStartedAt)+' 开始的直播统计':'暂无可恢复的上一场；重启后可继续未结束的直播';
    for(const id of ['streamStart','streamEnd','streamResume','diagnose','diagnosticScan','dataBackup'])$(id).disabled=!connected;
    $('streamEnd').disabled=!connected||!session.running;
    $('streamResume').disabled=!connected||!session.resumeAvailable;
    const key=JSON.stringify([state.diagnostics,state.recovery,c.toonHandle,c.names,c.replayDirectory,c.enabled,c.autoTrack,ladder.pending.length,ladder.mmrMessage,state.replays.errors,state.replays.lastScanAt,state.automation.phase]);
    if(key!==diagnosticKey){
      diagnosticKey=key;
      const checks=state.diagnostics?.checks||[
        {name:'游戏身份',message:c.toonHandle||c.names.join('、')||'请先确认账号'},
        {name:'录像目录',message:c.replayDirectory||'尚未设置'},
        {name:'自动读取',message:c.enabled&&c.autoTrack?'已开启':'已关闭'},
        {name:'游戏连接',message:state.automation.label},
        {name:'录像核对',message:`${ladder.pending.length} 条待关联 · ${state.replays.errors.length} 条解析失败`},
        {name:'MMR',message:ladder.mmrMessage}
      ];
      $('diagnosticChecks').replaceChildren();
      for(const check of checks){const row=document.createElement('p');row.className='diagnostic-row';row.textContent=(check.ok===true?'✓ ':check.ok===false?'待处理 · ':'')+check.name+'：'+check.message;$('diagnosticChecks').append(row);}
      $('diagnosticTime').textContent=(state.diagnostics?'诊断快照：'+stamp(state.diagnostics.at)+' · 设置改变后可重新诊断。':'点击一键诊断检查目录与账号是否对应。')+' 最近扫描：'+stamp(state.replays.lastScanAt);
      $('dataRecovery').replaceChildren();
      for(const warning of state.recovery||[]){const p=document.createElement('p');p.className='recovery-warning';p.textContent=warning.file+'：'+warning.message;$('dataRecovery').append(p);}
      if(state.recovery?.length){$('diagnosticPanel').open=true;$('sessionMore').open=true;}
    }
    if(state.lastBackup)$('dataBackupStatus').textContent='已备份 '+state.lastBackup.files+' 个数据文件 · '+state.lastBackup.path;
  }
  for(const id of ['streamStart','streamEnd','streamResume','diagnose','diagnosticScan','dataBackup'])$(id).addEventListener('click',async()=>{
    const button=$(id);button.disabled=true;
    try{
      await window.AssistantActions.act(id==='diagnosticScan'?'replayScan':id,id==='diagnosticScan'?{mode:'today'}:{});
      if(['diagnose','dataBackup'].includes(id))$('diagnosticPanel').open=true;
      window.AssistantActions.toast(({streamStart:'已开始新一场，历史战绩保留',streamEnd:'本场已结束，今日数据继续更新',streamResume:'已继续上一场直播',dataBackup:'当前数据已备份',diagnose:'诊断完成',diagnosticScan:'录像扫描完成'})[id]);
    }catch(error){window.AssistantActions.toast(error.message);button.disabled=false;}
  });
  window.SessionWorkspace={render};
})();
