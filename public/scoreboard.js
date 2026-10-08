(()=>{
  const $=id=>document.getElementById(id);
  function render(state,{standalone=false,preview=false}={}){
    const widget=$('scoreboardWidget');if(!widget)return;
    const c=state.ladder.config,s=state.ladder.session?.stats||state.ladder.stats;
    widget.hidden=!preview&&(state.scene==='blank'||!c.enabled||!c.scoreboardEnabled||(!standalone&&!(window.SceneCustomization?.allowed(c,state.scene,'Scoreboard',state.scene==='game')??(state.scene==='game'))));
    widget.className='scoreboard-widget scoreboard-template-'+c.scoreboardTemplate+(c.scoreboardAccent?' scoreboard-tinted':'');widget.style.setProperty('--score-accent',c.scoreboardAccent||'#83c5b6');
    const panel=Math.max(0,Math.min(100,c.scoreboardPanelOpacity??96))/100,edge=Math.min(1,panel/.96),accent=c.scoreboardAccent||'#83c5b6';widget.style.setProperty('--score-panel-opacity',panel);widget.style.setProperty('--score-edge-opacity',edge);widget.style.setProperty('--score-border-accent',accent+Math.round(edge*255).toString(16).padStart(2,'0'));
    Object.assign(widget.style,{opacity:(c.scoreboardOpacity??100)/100,left:c.scoreboardX+'px',top:c.scoreboardY+'px',width:c.scoreboardWidth+'px',transform:`scale(${c.scoreboardScale/100})`});
    $('scoreboardName').textContent=c.name||c.names[0]||'本次直播';$('scoreboardWins').textContent=s.wins;$('scoreboardLosses').textContent=s.losses;
    $('scoreboardRate').textContent=(s.winrate===null?'胜率 —':'胜率 '+s.winrate+'%')+' · '+s.streak;
    $('scoreboardMatchups').textContent=['T','Z','P'].map(r=>`v${r} ${s.matchups[r].wins}-${s.matchups[r].losses}`).join(' · ');
    $('scoreboardDetails').hidden=!c.scoreboardDetails;
  }
  window.ScoreboardOverlay={render};
  if(document.body.dataset.scoreboardSource==='true'){
    const params=new URLSearchParams(location.search),preview=params.get('preview')==='1',detail=preview&&params.get('detail')==='1';let saved,draft={};if(preview)document.body.classList.add('preview');
    const resize=(c=saved?.ladder.config||{})=>{const factor=(c.scoreboardScale||100)/100;$('canvas').style.transform=`scale(${Math.min(innerWidth/(detail?(c.scoreboardWidth||560)*factor+80:1920),innerHeight/(detail?160*factor+60:1080))})`;};resize();addEventListener('resize',()=>resize({...saved?.ladder.config,...draft}));
    function draw(){if(!saved)return;const c={...saved.ladder.config,...draft};if(detail)Object.assign(c,{scoreboardX:40,scoreboardY:30});resize(c);render({...saved,ladder:{...saved.ladder,config:c}},{standalone:true,preview});}
    if(preview)addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='scoreboardDraft')return;draft=Object.fromEntries(Object.entries(event.data.config||{}).filter(([key])=>key.startsWith('scoreboard')));draw();});
    window.PreviewConnection.create({preview:preview,onState:next=>{saved=next;draw();}});
  }
})();
