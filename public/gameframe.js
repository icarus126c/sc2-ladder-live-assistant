(()=>{
  const $=id=>document.getElementById(id);let rendered='';
  function render(state,{standalone=false,preview=false}={}){
    const frame=$('gameFrame');if(!frame)return;
    const c=state.ladder.config;frame.hidden=!preview&&(state.scene==='blank'||!c.enabled||!c.gameFrameEnabled||(!standalone&&!(window.SceneCustomization?.allowed(c,state.scene,'Frame',state.scene==='game')??(state.scene==='game'))));
    const markup=window.GameFrameTemplate.build(c);if(markup!==rendered){frame.innerHTML=markup;rendered=markup;}
  }
  window.GameFrameOverlay={render};
  if(document.body.dataset.gameFrameSource==='true'){
    const params=new URLSearchParams(location.search),preview=params.get('preview')==='1';let detail=preview&&params.get('detail')==='1',state,draft={};
    if(preview){document.body.classList.add('preview');$('referenceGround').hidden=false;const image=$('frameReferenceImage');image.src='/frame-reference.png';image.addEventListener('load',()=>image.classList.toggle('frame-reference-full',Math.abs(image.naturalWidth/image.naturalHeight-16/9)<.02));image.addEventListener('error',()=>image.hidden=true);}
    function resize(){const scale=Math.min(innerWidth/1920,innerHeight/(detail?460:1080));$('canvas').style.transform=`scale(${scale})`;$('canvas').style.top=detail?-620*scale+'px':'0';}
    resize();addEventListener('resize',resize);
    const draw=()=>{if(preview&&state){const style=draft.gameFrameStyle??state.ladder.config.gameFrameStyle,image=$('frameReferenceImage'),next=style.endsWith('-luxury')?'/assets/console-game-reference.png':'/frame-reference.png';if(image.getAttribute('src')!==next){image.hidden=false;image.src=next;}}if(state)render({...state,ladder:{...state.ladder,config:{...state.ladder.config,...draft}}},{standalone:true,preview});};
    if(preview)addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent)return;if(event.data?.type==='gameFrameCamera'){if(!['full','detail'].includes(event.data.mode))return;detail=event.data.mode==='detail';resize();return;}if(event.data?.type!=='gameFrameDraft')return;draft=Object.fromEntries(Object.entries(event.data.config||{}).filter(([key])=>key.startsWith('gameFrame')));draw();});
    window.PreviewConnection.create({preview:preview,onState:next=>{state=next;draw();}});
  }
})();
