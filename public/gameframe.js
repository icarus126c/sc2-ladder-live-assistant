(()=>{
  const $=id=>document.getElementById(id);let rendered='';
  function render(state,{standalone=false,preview=false}={}){
    const frame=$('gameFrame');if(!frame)return;
    const c=state.ladder.config;frame.hidden=!preview&&(state.scene==='blank'||!c.enabled||!c.gameFrameEnabled||(!standalone&&!(window.SceneCustomization?.allowed(c,state.scene,'Frame',state.scene==='game')??(state.scene==='game'))));
    const markup=window.GameFrameTemplate.build(c);if(markup!==rendered){frame.innerHTML=markup;rendered=markup;}
  }
  window.GameFrameOverlay={render};
  if(document.body.dataset.gameFrameSource==='true'){
    const params=new URLSearchParams(location.search),preview=params.get('preview')==='1';let detail=preview&&params.get('detail')==='1',state,draft={},guidesEnabled=false;
    if(preview){document.body.classList.add('preview');$('referenceGround').hidden=false;const image=$('frameReferenceImage');image.src='/frame-reference.png';image.addEventListener('load',()=>image.classList.toggle('frame-reference-full',Math.abs(image.naturalWidth/image.naturalHeight-16/9)<.02));image.addEventListener('error',()=>image.hidden=true);}
    function resize(){const luxury=(draft.gameFrameStyle??state?.ladder.config.gameFrameStyle??'').endsWith('-luxury'),height=detail?(luxury?720:460):1080,offset=detail?(luxury?360:620):0,scale=Math.min(innerWidth/1920,innerHeight/height);$('canvas').style.transform=`scale(${scale})`;$('canvas').style.top=-offset*scale+'px';}
    resize();addEventListener('resize',resize);
    const draw=()=>{resize();if(preview&&state){const style=draft.gameFrameStyle??state.ladder.config.gameFrameStyle,image=$('frameReferenceImage'),next=style.endsWith('-luxury')?'/assets/console-game-reference.png':'/frame-reference.png';if(image.getAttribute('src')!==next){image.hidden=false;image.src=next;}}if(state)render({...state,ladder:{...state.ladder,config:{...state.ladder.config,...draft}}},{standalone:true,preview});};
    function guides(){if(!preview)return;let layer=$('frameRegionGuides');if(!layer){layer=document.createElement('div');layer.id='frameRegionGuides';layer.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:20';$('canvas').append(layer);}layer.hidden=!guidesEnabled;if(!guidesEnabled)return;const luxury=(draft.gameFrameStyle??state?.ladder.config.gameFrameStyle??'').endsWith('-luxury')&&(draft.gameFrameCoverage??state?.ladder.config.gameFrameCoverage)!=='safe',areas=luxury?window.LuxuryConsole.greenAreas:window.LuxuryConsole.protectedAreas;layer.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">'+areas.map(a=>'<rect x="'+a.x+'" y="'+a.y+'" width="'+a.w+'" height="'+a.h+'" rx="5" fill="#42dc8a" fill-opacity=".10" stroke="#42dc8a" stroke-width="2"/>').join('')+'<text x="600" y="845" fill="#66eeac" font-family="Microsoft YaHei,sans-serif" font-size="19">绿色窗口保留游戏信息 · 仅在预览显示</text></svg>';}
    if(preview)addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent)return;if(event.data?.type==='gameFrameGuides'){guidesEnabled=event.data.enabled===true;guides();return;}if(event.data?.type==='gameFrameCamera'){if(!['full','detail'].includes(event.data.mode))return;detail=event.data.mode==='detail';resize();return;}if(event.data?.type!=='gameFrameDraft')return;draft=Object.fromEntries(Object.entries(event.data.config||{}).filter(([key])=>key.startsWith('gameFrame')));draw();guides();});
    window.PreviewConnection.create({preview:preview,onState:next=>{state=next;draw();guides();}});
  }
})();
