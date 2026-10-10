(()=>{
  const params=new URLSearchParams(location.search),preview=params.get('preview')==='1',phase=params.get('phase'),livePreview=preview&&params.get('live')==='1';
  const standaloneSticker=location.pathname==='/sticker';
  const source=location.pathname==='/custom-screen'?'custom':location.pathname==='/waiting-screen'?'intermission':location.pathname==='/away-screen'?'break':location.pathname==='/loading-screen'?'loading':null;
  let saved,draft={},outfitChoice=null,outfitPhase='game',outfitReveal=true,dailySample=false,dailyPhase='intermission',scenePreviewPhase=phase;
  if(preview)document.body.classList.add('preview');
  let guide,showGuides=false,reference;if(preview&&['editor','sticker'].includes(params.get('module'))){reference=document.createElement('img');reference.src='/assets/console-game-reference.png';reference.alt='游戏参考画面，仅在预览显示';Object.assign(reference.style,{position:'absolute',inset:'0',width:'1920px',height:'1080px',pointerEvents:'none',zIndex:'0'});document.getElementById('canvas').insertBefore(reference,document.getElementById('canvas').firstChild);guide=document.createElement('div');guide.hidden=true;guide.setAttribute?.('aria-label','游戏重要信息区，仅用于预览');Object.assign(guide.style,{position:'absolute',inset:'0',pointerEvents:'none',zIndex:'80'});guide.innerHTML='<svg viewBox="0 0 1920 1080" width="1920" height="1080">'+window.LuxuryConsole.protectedAreas.map(a=>'<rect x="'+a.x+'" y="'+a.y+'" width="'+a.w+'" height="'+a.h+'" fill="#4ad884" fill-opacity=".09" stroke="#51e899" stroke-width="2"/>').join('')+'</svg>';document.getElementById('canvas').insertBefore(guide,null);}
  function resize(){const scale=Math.min(innerWidth/1920,innerHeight/1080),canvas=document.getElementById('canvas');canvas.style.transform=`scale(${scale})`;if(preview){canvas.style.left=(innerWidth-1920*scale)/2+'px';canvas.style.top=(innerHeight-1080*scale)/2+'px';}}
  resize();addEventListener('resize',resize);
  function render(){
    if(!saved)return;
    const outfit=preview&&params.get('module')==='outfit';
    if(outfit&&outfitChoice)draft=window.OutfitPresets.buildPatch(saved.ladder.config,outfitChoice);
    const state={...saved,ladder:{...saved.ladder,config:{...saved.ladder.config,...draft}}};
    if(source&&saved.scene!=='blank')state.scene=source;
    if(preview&&!livePreview&&['game','intermission','loading','break','blank','custom'].includes(scenePreviewPhase))state.scene=scenePreviewPhase;
    if(preview&&params.get('module')==='overlay')Object.assign(state.ladder.config,{enabled:true,showHUD:true,waitingShowHUD:true,waitingShowText:true});
    if(preview&&params.get('module')==='scoreboard')Object.assign(state.ladder.config,{enabled:true,scoreboardEnabled:true,catEnabled:false,gameFrameEnabled:false,showHUD:false});
    if(outfit){state.scene=outfitPhase;state.ladder.config.enabled=true;if(outfitReveal&&outfitChoice){for(const key of outfitChoice.modules){const field={gameframe:'gameFrameEnabled',catkeyboard:'catEnabled',scoreboard:'scoreboardEnabled',overlay:'showHUD'}[key];if(field)state.ladder.config[field]=true;}if(outfitChoice.modules.includes('overlay'))state.ladder.config.waitingShowHUD=true;}}
    const dailyPreview=preview&&params.get('module')==='daily';if(dailyPreview){state.scene=dailyPhase;state.ladder.config.dailyEnabled=true;state.ladder.config.enabled=true;state.ladder.config.catEnabled=false;}
    if(preview&&['editor','sticker'].includes(params.get('module')))window.SceneEditorPreviewState=state;
    if(guide)guide.hidden=!showGuides||state.scene!=='game';
    if(reference){reference.hidden=state.scene!=='game';document.getElementById('previewGround').style.display=state.scene==='game'?'none':'';}
    window.LadderOverlay.render(state);window.ScoreboardOverlay.render(state);
    window.StickerOverlay?.render(state);window.ResourceOverlay?.render(state);window.GameFrameOverlay?.render(state);window.CatKeyboardOverlay?.render(state,preview&&!livePreview?{preview:true,respectVisibility:true}:{});
    if(outfit)document.getElementById('catWidget').hidden=state.scene!=='game'||!state.ladder.config.catEnabled;
    if(preview&&params.get('module')==='overlay'){document.getElementById('scoreboardWidget').hidden=true;document.getElementById('ladderWaiting').hidden=true;}
    if(!preview||!params.get('module')||['scene','editor'].includes(params.get('module')))window.LiveInteractionOverlay?.render(state);
    window.DailyOverlay?.render(state,{sample:dailyPreview&&dailySample,reveal:dailyPreview});
    if(dailyPreview){for(const id of ['ladderHUD','scoreboardWidget','gameFrame','catWidget','liveGift','liveRaffle','liveIncome'])document.getElementById(id).hidden=true;}
    else if(preview&&params.get('module')&&!['waiting','loading','break','scene','editor'].includes(params.get('module')))document.getElementById('dailyWidget').hidden=true;
    document.getElementById('breakScreen').hidden=true;
    if(preview&&params.get('module')&&!['outfit','scene','editor'].includes(params.get('module')))document.getElementById('resourceWidget').hidden=true;
    if((preview&&params.get('module')&&!['editor','sticker','scene'].includes(params.get('module'))))document.getElementById('stickerWidget').hidden=true;
    if(standaloneSticker)for(const id of ['resourceWidget','ladderWaiting','ladderHUD','scoreboardWidget','dailyWidget','gameFrame','catWidget','liveGift','liveRaffle','liveIncome'])document.getElementById(id).hidden=true;
    if(state.scene==='blank')for(const id of ['stickerWidget','resourceWidget','ladderWaiting','ladderHUD','scoreboardWidget','dailyWidget','gameFrame','catWidget','liveGift','liveRaffle','liveIncome'])document.getElementById(id).hidden=true;
  }
  if(preview&&['waiting','loading','break'].includes(params.get('module')))addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='waitingDraft')return;
    const prefix=params.get('module')==='waiting'?'waiting':params.get('module');draft=Object.fromEntries(Object.entries(event.data.config||{}).filter(([key])=>key.startsWith(prefix)));render();
  });
  if(preview&&['scoreboard','overlay'].includes(params.get('module')))addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent)return;
    const score=params.get('module')==='scoreboard',type=score?'scoreboardDraft':'hudDraft';if(event.data?.type!==type)return;
    const fields=new Set(['template','x','y','width','scale','fontSize','opacity','accent','title','text','showName','showMMR','showRecord','showWinrate','showStreak','showDelta']);
    draft=Object.fromEntries(Object.entries(event.data.config||{}).filter(([key])=>score?key.startsWith('scoreboard'):fields.has(key)));render();
  });
  if(preview&&params.get('module')==='outfit')addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='outfitDraft')return;
    try{const choice=event.data.choice;if(Array.isArray(choice?.modules)&&choice.modules.length===0){outfitChoice=null;draft={};}else outfitChoice=window.OutfitPresets.normalize(choice);if(['game','intermission','break'].includes(event.data.phase))outfitPhase=event.data.phase;outfitReveal=event.data.reveal===true;render();}catch{}
  });
  if(preview&&!livePreview&&['editor','sticker'].includes(params.get('module')))addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='editorDraft')return;if(!window.SceneCustomization.phases.includes(event.data.phase))return;scenePreviewPhase=event.data.phase;draft=window.SceneCustomization.filter(event.data.config,scenePreviewPhase);render();});
  const documentedDailyFields=new Set(['dailyEnabled','dailyWaiting','dailyGame','dailyBreak','dailyZerglings','dailyZealots','dailyWorkersKilled','dailyLongest','dailyStrongest','dailyRecord','dailyTime','dailyTitle','dailyStyle','dailyFollowTheme','dailyAccent','dailyX','dailyY','dailyWidth','dailyScale','dailyOpacity']);
  if(preview&&params.get('module')==='daily')addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='dailyDraft')return;draft=Object.fromEntries(Object.entries(event.data.config||{}).filter(([k])=>k.startsWith('daily')&&documentedDailyFields.has(k)));dailySample=event.data.sample===true;if(['game','intermission','break'].includes(event.data.phase))dailyPhase=event.data.phase;render();});
  if(preview&&!livePreview&&params.get('module')==='scene')addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='scenePreview')return;
    if(!['game','intermission','loading','break','blank','custom'].includes(event.data.phase))return;
    scenePreviewPhase=event.data.phase;render();
  });
  if(guide)addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='editorGuides')return;showGuides=event.data.show===true;render();});
  window.PreviewConnection.create({preview,onState:state=>{saved=state;window.OutfitPresets?.registerInstalled(saved.stylePacks||[],saved.outfit?.combinations||[]);render();}});
})();

