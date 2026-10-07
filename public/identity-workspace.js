(function(){
  const $=id=>document.getElementById(id),button=$('detectIdentity'),select=$('detectedAccounts'),message=$('identityDetectStatus');
  let candidates=[],busy=false,pendingDirectory='',pendingHandle='';
  const api=()=>window.AssistantActions;
  const region=id=>({'1':'美服','2':'欧服','3':'韩服','5':'国服'})[id.split('-')[0]]||'其他区域';
  function setBusy(value){busy=value;button.disabled=value;$('switchIdentity').disabled=value;$('switchIdentityQuick').disabled=value;select.disabled=value;$('identitySave').disabled=value;button.textContent=value?'正在读取…':'自动读取本机账号';}
  async function fill(candidate){
    const value=await api().act('identityInspect',{replayDirectory:candidate.replayDirectory});
    $('toonHandle').value=value.toonHandle;$('playerNames').value=value.names.join('\n');if(value.race)$('playerRace').value=value.race;
    pendingDirectory=value.replayDirectory;pendingHandle=value.toonHandle;$('identityForm').dispatchEvent(new Event('input',{bubbles:true}));
    message.textContent=value.message+' 目录：'+value.replayDirectory;
    $('identitySave').textContent='保存身份与录像目录';
  }
  async function detect(switching=false){
    if(busy)return;pendingDirectory='';pendingHandle='';$('identitySave').textContent='保存身份';setBusy(true);message.textContent='正在查找星际2账号和录像目录…';
    try{
      const value=await api().act('identityDetect');candidates=value.candidates;select.replaceChildren();
      const empty=document.createElement('option');empty.value='';empty.textContent='请选择你使用的账号';select.append(empty);
      for(const [index,c]of candidates.entries()){
        const option=document.createElement('option');option.value=String(index);
        option.textContent=region(c.toonHandle)+' · '+c.toonHandle+(c.lastReplayAt?' · 最近录像 '+new Date(c.lastReplayAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):' · 尚无录像');select.append(option);
      }
      $('detectedAccountsBox').hidden=!candidates.length;message.textContent=value.message;
      const current=$('toonHandle').value.trim(),matching=candidates.filter(c=>c.toonHandle===current),chosen=candidates.length===1?candidates[0]:!switching&&matching.length===1?matching[0]:null;
      if(chosen){select.value=String(candidates.indexOf(chosen));await fill(chosen);}else if(switching&&candidates.length){select.value='';message.textContent='请选择刚切换到的游戏账号，然后点击“保存身份与录像目录”。账号列表按最近录像排序。';}
    }catch(error){message.textContent=error.message;api().toast(error.message);}finally{setBusy(false);}
  }
  button.addEventListener('click',()=>detect());
  $('switchIdentity').addEventListener('click',()=>detect(true));
  $('switchIdentityQuick').addEventListener('click',()=>{location.hash='settings';return detect(true);});
  select.addEventListener('change',async()=>{
    if(busy||select.value==='')return;const candidate=candidates[Number(select.value)];if(!candidate)return;
    setBusy(true);message.textContent='正在读取这个账号的昵称…';
    try{await fill(candidate);}catch(error){message.textContent=error.message;api().toast(error.message);}finally{setBusy(false);}
  });
  window.IdentityDiscovery={directory:()=>pendingHandle===$('toonHandle').value.trim()?pendingDirectory:'',saved(){
    if(pendingDirectory){pendingDirectory='';pendingHandle='';message.textContent='身份与录像目录已保存，可以扫描今日录像了。';}
    $('identitySave').textContent='保存身份';
  }};
})();
