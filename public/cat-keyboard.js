(()=>{
  const widget=document.getElementById('catWidget');if(!widget)return;
  widget.innerHTML=window.CatKeyboardTemplate.build();const model=window.CatKeyboardTemplate.createModel();let config={},scene='intermission',preview=false,standalone=false,ready=false,lastCombo='',lastRhythm='',lastPose=-1,lastBusy=false,lastPaint=0;
  let layout='',keys,avatar,combo,rhythm,inputEvents=null;
  function inputConnection(){
    const needed=!widget.hidden&&!preview;
    if(needed&&!inputEvents){inputEvents=new EventSource('/api/keyboard-events');inputEvents.onmessage=e=>ingest(JSON.parse(e.data));inputEvents.onerror=()=>ingest({status:'waiting',pressed:[],sequence:'lost-'+Date.now()});}
    if(!needed&&inputEvents){inputEvents.close();inputEvents=null;ingest({status:'waiting',pressed:[],sequence:'hidden-'+Date.now()});}
  }
  function updateLayout(){const next=(config.catView||'split')+':'+(config.catKeyboardSide||'left')+':'+(config.catCharacter||'cat')+':'+(config.catCurve!==false);if(next===layout)return;layout=next;widget.innerHTML=window.CatKeyboardTemplate.build(config);keys=[...widget.querySelectorAll('[data-cat-key]')];avatar=widget.querySelector('.cat-avatar');combo=widget.querySelector('.cat-combo');rhythm=widget.querySelector('.cat-rhythm');lastCombo=lastRhythm='';lastPose=-1;lastBusy=null;}
  const render=(state,options={})=>{config=state.ladder.config;scene=state.scene;preview=options.preview===true;standalone=options.standalone===true;ready=true;
    updateLayout();
    widget.hidden=!preview&&(scene==='blank'||config.enabled===false||config.catEnabled!==true||(!standalone&&scene!=='game'));
    inputConnection();
    widget.style.left=(config.catX??1400)+'px';widget.style.top=(config.catY??320)+'px';widget.style.transform=`scale(${(config.catWidth??460)/570})`;
    widget.style.opacity=(config.catOpacity??100)/100;widget.style.setProperty('--cat-accent',config.catAccent||'#f2a7d5');
    if(config.catCharacter==='nicole'){avatar.style.backgroundImage='url("/assets/nicole-keys-v1.png")';}else if(config.catCharacter==='custom'){const url=config.catView==='rear'?config.catRearImage:config.catFrontImage;const safe=/^\/style-assets\/[a-f\d]{64}\.png$/.test(url||'');avatar.style.backgroundImage=safe?`url("${url}")`:'none';}else avatar.style.backgroundImage='';
    widget.querySelector('.cat-mouse').hidden=config.catMouse===false;widget.querySelector('.cat-caption').hidden=config.catHints===false;
  };
  function ingest(frame){model.ingest(frame,config);}
  function animate(tick){if(ready&&!widget.hidden&&tick-lastPaint>=32){lastPaint=tick;const value=model.snapshot(config),pressed=new Set(value.pressed);
    for(const key of keys){const lit=pressed.has(key.dataset.catKey);if(lit!==key.classList.contains('is-down'))key.classList.toggle('is-down',lit);}
    if(lastPose!==value.pose){avatar.dataset.pose=String(value.pose);lastPose=value.pose;}const busy=value.rate>=5;if(lastBusy!==busy){widget.classList.toggle('is-busy',busy);lastBusy=busy;}
    if(lastCombo!==value.combo){combo.textContent=value.combo;lastCombo=value.combo;}
    const text=value.active?(value.rate>=5?'啪嗒啪嗒！':(config.catCharacter==='naiwa'?'哟嚯 · 敲击中':config.catCharacter==='nahida'?'叶间 · 哒哒':['vesna','nicole','custom'].includes(config.catCharacter)?'轻敲 · 哒哒':'喵 · 敲击中')):(config.catCharacter==='naiwa'?'呱 · 等待按键':['vesna','nahida','nicole','custom'].includes(config.catCharacter)?'等待按键':'喵 · 等待按键');if(lastRhythm!==text){rhythm.textContent=text;lastRhythm=text;}
  }requestAnimationFrame(animate);}
  window.CatKeyboardOverlay={render,ingest};requestAnimationFrame(animate);
  if(document.body.dataset.catSource==='true'){
    const params=new URLSearchParams(location.search),isPreview=params.get('preview')==='1',detail=isPreview&&params.get('detail')==='1';let saved,draft={},demoSequence=0;
    if(isPreview){document.body.classList.add('preview');document.getElementById('catPreviewGround').hidden=false;}
    function resize(){const scale=Math.min(innerWidth/(detail?680:1920),innerHeight/(detail?450:1080)),canvas=document.getElementById('canvas');canvas.style.transform=`scale(${scale})`;canvas.style.top='0';}
    const draw=()=>{if(!saved)return;const c={...saved.ladder.config,...draft};if(detail)Object.assign(c,{catX:55,catY:28,catWidth:570});render({...saved,ladder:{...saved.ladder,config:c}},{standalone:true,preview:isPreview});};
    resize();addEventListener('resize',resize);
    const events=new EventSource('/api/events?role='+(isPreview?'preview':'output'));events.onmessage=e=>{saved=JSON.parse(e.data);draw();};
    if(isPreview){addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent)return;
      if(event.data?.type==='catDraft'){draft=Object.fromEntries(Object.entries(event.data.config||{}).filter(([key])=>key.startsWith('cat')));draw();}
      if(event.data?.type==='catDemo')ingest({status:event.data.status||'active',pressed:Array.isArray(event.data.pressed)?event.data.pressed:[],sequence:'demo-'+(++demoSequence)});
    });}
  }
})();
