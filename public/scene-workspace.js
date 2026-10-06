(()=>{
  const $=id=>document.getElementById(id),suffixes=['Theme','Background','BackgroundImage','BackgroundVideo','VideoMuted','VideoLoop','ShowText','TeamName','Title','Note','Kicker','Color','ColorSecondary','Accent','TextColor','Layout','ImageFit','Dim','PanelOpacity','Width','TitleSize','ShowName','ShowMMR','ShowRecord','ShowMatchups','ShowPhase','ShowHUD','ShowLongest','ShowZerglings','ShowZealots','ShowWorkersKilled','ShowStrongest','ShowDailyTime'],numbers=new Set(['Dim','PanelOpacity','Width','TitleSize']);
  let state,connected=false;
  const editors={waiting:{dirty:false,uploading:false,label:'等待'},break:{dirty:false,uploading:false,label:'暂离'}};
  const config=p=>Object.fromEntries(suffixes.map(s=>{const e=$(p+s);return[p+s,e.type==='checkbox'?e.checked:numbers.has(s)?Number(e.value):e.value];}));
  function update(p){const e=editors[p],mode=$(p+'Background').value;
    $(p+'MediaSettings').hidden=!['image','video'].includes(mode);$(p+'VideoSettings').hidden=mode!=='video';$(p+'SecondaryField').hidden=mode!=='gradient';
    $(p+'TeamName').closest('label').hidden=$(p+'Theme').value!=='team';
    $(p+'DraftStatus').textContent=e.uploading?'正在保存素材…':e.dirty?'预览草稿 · 尚未应用':'已保存';
    $(p+'Apply').disabled=!connected||!state||e.uploading;$(p+'MediaFile').disabled=!connected||!state||e.uploading;$(p+'ClearMedia').disabled=!state||e.uploading;$(p+'Discard').disabled=!state||e.uploading;
    for(const s of suffixes)$(p+s).disabled=!state;
    for(const b of document.querySelectorAll(`[data-scene-prefix="${p}"]`)){b.disabled=!state;b.setAttribute('aria-pressed',String(b.dataset.sceneTheme===$(p+'Theme').value));}
    for(const b of document.querySelectorAll(`[data-content-prefix="${p}"]`))b.disabled=!state;
    if(state)$(p+'Preview').contentWindow?.postMessage({type:'waitingDraft',config:config(p)},location.origin);
  }
  function fill(p){if(!state)return;for(const s of suffixes){const e=$(p+s),value=state.ladder.config[p+s];if(e.type==='checkbox')e.checked=value===true;else e.value=value??'';}const c=config(p);$(p+'MediaStatus').textContent=c[p+'BackgroundVideo']||c[p+'BackgroundImage']?'素材已保存在本机':'尚未选择素材';}
  function changed(p){editors[p].dirty=true;update(p);}
  async function perform(p,fn){try{await fn();}catch(error){$(p+'MediaStatus').textContent=error.message;window.AssistantActions.toast(error.message);}finally{update(p);}}
  for(const [p,e]of Object.entries(editors)){
    $(p+'Preview').addEventListener('load',()=>update(p));
    $(p+'Form').addEventListener('input',()=>changed(p));$(p+'Form').addEventListener('change',()=>changed(p));
    $(p+'Form').addEventListener('submit',event=>{event.preventDefault();perform(p,async()=>{if(e.uploading)throw Error('请等待素材保存完成');const c=config(p),mode=c[p+'Background'];if(mode==='image'&&!c[p+'BackgroundImage'])throw Error('请先上传背景图片');if(mode==='video'&&!c[p+'BackgroundVideo'])throw Error('请先上传背景视频');state=await window.AssistantActions.act('ladderConfigure',{config:c});e.dirty=false;fill(p);window.AssistantActions.toast(e.label+'画面已应用');});});
    $(p+'Discard').addEventListener('click',()=>{e.dirty=false;fill(p);update(p);});
    $(p+'ClearMedia').addEventListener('click',()=>{$(p+'BackgroundImage').value='';$(p+'BackgroundVideo').value='';$(p+'Background').value='gradient';$(p+'MediaStatus').textContent='素材已移除 · 尚未应用';changed(p);});
    $(p+'MediaFile').addEventListener('change',()=>perform(p,async()=>{
      const file=$(p+'MediaFile').files[0];if(!file)return;
      const image=/\.(png|jpe?g|webp)$/i.test(file.name),video=/\.(mp4|webm)$/i.test(file.name);
      if(!image&&!video)throw Error('支持 PNG / JPG / WebP 图片，以及 MP4 / WebM 视频');if(file.size>(image?8:150)*1024*1024)throw Error(image?'图片请控制在8MB以内':'视频请控制在150MB以内');
      e.uploading=true;update(p);$(p+'MediaStatus').textContent='正在保存 '+file.name;
      try{const token=document.querySelector('meta[name="control-token"]').content,response=await fetch('/api/scene-media',{method:'POST',headers:{'X-Control-Token':token,'Content-Type':file.type||'application/octet-stream'},body:file}),value=await response.json();if(!response.ok)throw Error(value.error||'素材保存失败');$(p+(value.kind==='video'?'BackgroundVideo':'BackgroundImage')).value=value.url;$(p+'Background').value=value.kind;$(p+'Theme').value='custom';$(p+'MediaStatus').textContent=file.name+' · 已保存，点击应用后用于直播';changed(p);}finally{e.uploading=false;$(p+'MediaFile').value='';}
    }));
    for(const b of document.querySelectorAll(`[data-scene-prefix="${p}"]`))b.addEventListener('click',()=>{const theme=window.SceneThemes.presets[b.dataset.sceneTheme];$(p+'Theme').value=b.dataset.sceneTheme;if(b.dataset.sceneTheme==='custom')$(p+'AppearanceFold').open=true;for(const [s,v]of Object.entries(theme))if(s!=='name'&&$(p+s))$(p+s).value=v;if(b.dataset.sceneTheme!=='custom')$(p+'Background').value='gradient';if(p==='break')$(p+'Kicker').value=$(p+'Kicker').value.replace('LADDER SESSION','BE RIGHT BACK');changed(p);});
    $(p+'SourceURL').value=location.origin+(p==='waiting'?'/waiting-screen':'/away-screen');
    for(const button of document.querySelectorAll(`[data-content-prefix="${p}"]`))button.addEventListener('click',()=>{const mode=button.dataset.sceneContent;for(const s of ['ShowText','ShowName','ShowMMR','ShowRecord','ShowMatchups','ShowPhase','ShowHUD','ShowLongest'])$(p+s).checked=mode==='background'?false:s==='ShowHUD'?false:['ShowRecord','ShowMatchups','ShowLongest'].includes(s)?mode==='stats':true;changed(p);});
  }
  addEventListener('message',event=>{if(event.origin!==location.origin||event.data?.type!=='sceneMediaError')return;for(const p of Object.keys(editors))if(event.source===$(p+'Preview').contentWindow)$(p+'MediaStatus').textContent=event.data.message;});
  window.SceneWorkspace={render(next){state=next;for(const p of Object.keys(editors)){if(!editors[p].dirty&&!editors[p].uploading)fill(p);update(p);}},connection(value){connected=value;for(const p of Object.keys(editors))update(p);}};
})();
