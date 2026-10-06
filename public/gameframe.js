(()=>{
  const $=id=>document.getElementById(id);let rendered='';
  function render(state,{standalone=false,preview=false}={}){
    const frame=$('gameFrame');if(!frame)return;
    const c=state.ladder.config;frame.hidden=!preview&&(state.scene==='blank'||!c.enabled||!c.gameFrameEnabled||(!standalone&&state.scene!=='game'));
    const markup=window.GameFrameTemplate.build(c);if(markup!==rendered){frame.innerHTML=markup;rendered=markup;}
  }
  window.GameFrameOverlay={render};
  if(document.body.dataset.gameFrameSource==='true'){
    const params=new URLSearchParams(location.search),preview=params.get('preview')==='1',detail=preview&&params.get('detail')==='1';let state,draft={};
    if(preview){document.body.classList.add('preview');$('referenceGround').hidden=false;const image=$('frameReferenceImage');image.src='/frame-reference.png';image.addEventListener('error',()=>image.hidden=true);}
    function resize(){const scale=Math.min(innerWidth/1920,innerHeight/(detail?355:1080));$('canvas').style.transform=`scale(${scale})`;$('canvas').style.top=detail?-725*scale+'px':'0';}
    resize();addEventListener('resize',resize);
    const draw=()=>{if(state)render({...state,ladder:{...state.ladder,config:{...state.ladder.config,...draft}}},{standalone:true,preview});};
    if(preview)addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='gameFrameDraft')return;draft=Object.fromEntries(Object.entries(event.data.config||{}).filter(([key])=>key.startsWith('gameFrame')));draw();});
    const events=new EventSource('/api/events?role='+(preview?'preview':'output'));events.onmessage=e=>{state=JSON.parse(e.data);draw();};
  }
})();
