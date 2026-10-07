(() => {
  const $=id=>document.getElementById(id),races={T:'人族',P:'神族',Z:'虫族',R:'随机',Terr:'人族',Prot:'神族',Zerg:'虫族'};
  function render(next) {
    const l=next.ladder, hud=$('ladderHUD'),waiting=$('ladderWaiting');
    if(!hud||!waiting)return false;
    const enabled=!!l?.config.enabled,c=window.SceneThemes?.resolve(l?.config,next.scene)||l?.config,s={...l?.stats,...l?.session?.stats};
    const hudScene=next.scene==='custom'?'custom':typeof c?.scoreboardEnabled==='boolean'?'intermission':'game';
    hud.hidden=!enabled||!c.showHUD||next.scene!==hudScene;
    if(c?.waitingShowHUD===false||(next.scene!=='custom'&&c?.waitingShowText===false))hud.hidden=true;
    waiting.hidden=!enabled||!['intermission','loading','break','custom'].includes(next.scene);
    window.SceneVideo?.render(c,waiting.hidden);
    if(!enabled)return false;
    hud.className='hud-template-'+c.template;waiting.className='waiting-template-'+c.template;
    const logo=$('hudLogo'),logoURL=c.template==='bluegold'?'/assets/bluegold-logo.png':'/assets/cnzs-logo.png';
    if(logo.getAttribute('src')!==logoURL)logo.src=logoURL;
    for(const [key,value] of Object.entries({left:c.x+'px',top:c.y+'px',width:c.width+'px',transform:`scale(${c.scale/100})`})) if(hud.style[key]!==value)hud.style[key]=value;
    hud.style.setProperty('--hud-accent',c.accent);hud.style.setProperty('--hud-alpha',c.opacity/100);hud.style.setProperty('--hud-font',c.fontSize+'px');
    const source={manual:'手动',replay:'录像值',estimate:'估算',unknown:'待获取'}[c.mmrSource]||'手动';
    const name=c.name||c.names[0]||'主播昵称',mmr=c.mmr===null?'—':String(c.mmr)+(c.mmrSource==='estimate'?'（估算）':''),record=`${s.wins} 胜 ${s.losses} 负`,rate=s.winrate===null?'—':s.winrate+'%',delta=s.delta===null?'—':(s.delta>0?'+':'')+s.delta;
    const fields={hudTitle:c.title,hudName:name+' · '+races[c.race],hudMMR:mmr,hudRecord:record,hudWinrate:'胜率 '+rate,hudStreak:s.streak,hudDelta:'今日 MMR '+delta,
      waitingTitle:c.waitingTitle,waitingSubtitle:c.waitingNote,waitingName:name+' · '+races[c.race],waitingMMR:mmr,waitingRecord:record,waitingRate:'胜率 '+rate+' · '+s.streak,
      waitingPhase:next.scene==='custom'?'自定义场景':next.scene==='loading'?'比赛载入中 · 即将开始':next.scene==='break'?'暂离 / 稍后回来':next.automation?.phase==='menu'?'大厅 / 搜索阶段':next.automation?.label||'等待连接游戏'};
    for(const [id,value]of Object.entries(fields))$(id).textContent=value;
    for(const id of ['hudMMRSource','waitingMMRSource'])if($(id))$(id).textContent='MMR · '+source;
    const matchups=s.matchups?['T','Z','P'].map(r=>`v${r} ${s.matchups[r].wins}-${s.matchups[r].losses}`).join(' · '):'';
    const longest=$('waitingLongest'),match=l.stats.longestMatch;
    if(longest){longest.hidden=!c.waitingShowLongest||!match;if(match){const seconds=match.durationSeconds;$('waitingLongestTime').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');$('waitingLongestDetail').textContent=[match.opponent?'对阵 '+match.opponent:'',match.map,match.result==='win'?'胜利':'失利'].filter(Boolean).join(' · ');}}
    const dailyList=$('waitingDailyMetrics'),dailyFlags={dailyZerglings:c.waitingShowZerglings===true,dailyZealots:c.waitingShowZealots===true,dailyWorkersKilled:c.waitingShowWorkersKilled===true,dailyStrongest:c.waitingShowStrongest===true,dailyTime:c.waitingShowDailyTime===true,dailyLongest:false,dailyRecord:false};
    if(dailyList){dailyList.hidden=!Object.values(dailyFlags).some(Boolean);dailyList.replaceChildren?.();if(!dailyList.hidden&&window.DailyModel){for(const row of window.DailyModel.rows({...l,config:{...l.config,...dailyFlags}})){const item=document.createElement('div');for(const [tag,text]of [['span',row.title],['b',row.value],['small',row.detail]]){const part=document.createElement(tag);part.textContent=text;item.append(part);}dailyList.append(item);}}}
    for(const id of ['hudMatchups','waitingMatchups'])if($(id)){$(id).textContent=matchups;$(id).hidden=!c.showRecord||c.template==='custom';}
    for(const [id,key]of [['hudName','showName'],['hudMMRBox','showMMR'],['hudRecordBox','showRecord'],['hudWinrate','showWinrate'],['hudStreak','showStreak'],['hudDelta','showDelta']])$(id).hidden=!c[key];
    if(typeof c.scoreboardEnabled==='boolean'){
      for(const id of ['hudRecordBox','hudMatchups','hudWinrate','hudStreak'])$(id).hidden=true;
      $('waitingRecord').parentElement.hidden=!c.scoreboardEnabled;$('waitingRate').hidden=!c.scoreboardEnabled;$('waitingMatchups').hidden=!c.scoreboardEnabled;
    }
    if(c.waitingBackground){
      waiting.className+=' waiting-custom waiting-layout-'+c.waitingLayout+' waiting-theme-'+(c.waitingTheme||'custom');
      const image=c.waitingBackground==='image'&&c.waitingBackgroundImage;
      const background=window.SceneThemes?.background(c)||(image?`url("${c.waitingBackgroundImage}")`:c.waitingBackground==='gradient'?`radial-gradient(ellipse at 12% 0,${c.waitingColorSecondary},transparent 75%)`:'none');
      for(const [key,value]of Object.entries({'--waiting-background':background,'--waiting-color':c.waitingBackground==='transparent'?'transparent':c.waitingColor,'--waiting-text':c.waitingTextColor,'--waiting-accent':c.waitingAccent,'--waiting-fit':c.waitingImageFit,'--waiting-dim':c.waitingBackground==='transparent'?0:image||c.waitingBackground==='video'||c.waitingTheme==='starcraft'?c.waitingDim/100:0,'--waiting-panel-alpha':c.waitingPanelOpacity/100,'--waiting-width':c.waitingWidth+'px','--waiting-title-size':c.waitingTitleSize+'px'}))waiting.style.setProperty(key,value);
      const decoration=$('waitingDecoration'),markup=window.SceneThemes?.decoration(c)||'';if(decoration&&decoration.innerHTML!==markup)decoration.innerHTML=markup;
      if($('waitingInner')){const inner=$('waitingInner');inner.hidden=c.waitingShowText===false;Object.assign(inner.style,{position:c.waitingFreePosition?'absolute':'',left:c.waitingFreePosition?c.waitingTextX+'px':'',top:c.waitingFreePosition?c.waitingTextY+'px':'',margin:c.waitingFreePosition?'0':''});}
      if(decoration)decoration.hidden=c.waitingShowText===false;
      $('waitingKicker').textContent=c.waitingKicker;$('waitingKicker').hidden=!c.waitingKicker;
      $('waitingName').hidden=!c.waitingShowName;$('waitingMMR').parentElement.hidden=!c.waitingShowMMR;
      $('waitingRecord').parentElement.hidden=!c.waitingShowRecord;
      $('waitingMetrics').hidden=!c.waitingShowMMR&&(!c.waitingShowRecord);
      $('waitingRate').hidden=!c.waitingShowRecord;
      $('waitingMatchups').hidden=!c.waitingShowMatchups;$('waitingPhase').hidden=!c.waitingShowPhase;
    }
    const tokens={name,race:races[c.race],mmr,mmrSource:source,matchups,wins:s.wins,losses:s.losses,winrate:rate,streak:s.streak,delta,date:l.date};
    $('hudText').textContent=c.text.replace(/\{(name|race|mmr|mmrSource|matchups|wins|losses|winrate|streak|delta|date)\}/g,(_match,key)=>String(tokens[key]));
    $('hudText').hidden=c.template!=='custom';
    return true;
  }
  window.LadderOverlay={render};
})();
