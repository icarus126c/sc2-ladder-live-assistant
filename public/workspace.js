(()=>{
  const $=id=>document.getElementById(id);
  const views={tools:{name:'工具库',title:'选择今天要用的工具。',eyebrow:'按需添加 · 自由组合',description:'从直播预览开始，把需要的工具加入你的直播。'},console:{name:'直播预览',title:'直播预览',eyebrow:'直播主界面',description:'在这里看画面、切场景，独立控制按键与录像助手。'},scoreboard:{name:'战绩计分器',title:'战绩计分器',eyebrow:'战绩工具',description:'选择计分器模板，调整位置，并管理今天的每一局。'},overlay:{name:'信息栏模板',title:'信息栏模板',eyebrow:'直播外观',description:'选择等待或局间展示的信息栏模板，游戏进行时自动隐藏。'},settings:{name:'录像与账号',title:'录像与账号',eyebrow:'个人设置',description:'连接你的游戏身份，让每盘录像都记在正确的账号下。'}};
  views.scenes={name:'画面自定义',title:'每个场景，都按你的习惯。',eyebrow:'场景工作台',description:'选择场景，定制显示内容与布局。这里只编辑预览，应用后更新直播。'};
  views.waiting={name:'等待画面',title:'自定义等待画面',eyebrow:'局间外观',description:'用自己的背景、文字和布局，装饰搜索与局间等待的时间。'};
  views.break={name:'暂离画面',title:'自定义暂离画面',eyebrow:'暂离外观',description:'暂离使用独立主题，支持自定义图片与循环视频。'};
  views.gameframe={name:'控制台模板',title:'游戏控制台模板',eyebrow:'游戏外观',description:'窄边、战队与奶蛙 / 纳西妲 / 薇斯纳边框，按需调整遮挡。'};
  views.catkeyboard={name:'按键小助手',title:'按键小助手',eyebrow:'直播互动',description:'切换猫娘、纳西妲、薇斯纳和奶蛙，左右半键盘与自然弧度均可设置。'};
  views.outfits={name:'一键换装',title:'一套风格，整场直播。',eyebrow:'成套外观',description:'先预览游戏、等待与暂离效果，再将喜欢的风格一次应用到所选元素。'};
  views.liveinteraction={name:'直播间互动',title:'让直播间一起参与。',eyebrow:'B站联动',description:'接收礼物、计算收益，使用弹幕口令邀请观众参与抽奖。'};
  views.daily={name:'今日数据',title:'每一局，都留下一点战报。',eyebrow:'录像小工具',description:'统计自己的生产与击杀，选择等待、游戏和暂离中的展示内容。'};
  views.tutorial={name:'使用教程',title:'从这里，开始你的直播。',eyebrow:'新手指南',description:'接入直播姬 / OBS，连接自己的录像与账号。每一步都能直接跳转到设置。'};
  views.sponsor={name:'赞助与合作',title:'支持下一场好比赛。',eyebrow:'AENEAS / SUPPORT',description:'支持选手、赛事与工具，也欢迎品牌合作。'};
  const frameFields=['gameFrameStyle','gameFrameAccent','gameFrameThickness','gameFrameOpacity','gameFrameScale','gameFrameX','gameFrameY','gameFrameMinimap','gameFrameSelection','gameFramePortrait','gameFrameCommands','gameFrameDecorations','gameFrameDecorationScale','gameFrameMemeText'];
  const frameNumbers=new Set(['gameFrameThickness','gameFrameOpacity','gameFrameScale','gameFrameX','gameFrameY','gameFrameDecorationScale']);
  const scoreFields=['scoreboardAccent','scoreboardTemplate','scoreboardX','scoreboardY','scoreboardWidth','scoreboardScale','scoreboardOpacity','scoreboardPanelOpacity','scoreboardDetails'];
  let state,connected=false,scoreboardDirty=false,frameDirty=false,mainTextDirty=false;
  const mainSwitches={mainFrameEnabled:'gameFrameEnabled',mainScoreEnabled:'scoreboardEnabled',mainDailyEnabled:'dailyEnabled',mainHUDEnabled:'showHUD'},mainTextFields={mainWaitingTitle:'waitingTitle',mainWaitingNote:'waitingNote',mainBreakTitle:'breakTitle',mainBreakNote:'breakNote',mainWaitingShowText:'waitingShowText',mainBreakShowText:'breakShowText'};
  function route(){const key=location.hash.slice(1);const view=Object.hasOwn(views,key)?key:'console',meta=views[view];
    for(const panel of document.querySelectorAll('[data-view]')){panel.hidden=panel.dataset.view!==view;for(const frame of panel.querySelectorAll('iframe[data-src]')){const target=panel.hidden?'about:blank':frame.dataset.src;if(frame.getAttribute('src')!==target)frame.setAttribute('src',target);}}
    for(const link of document.querySelectorAll('[data-route]')){if(link.dataset.route===view)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
    $('breadcrumb').textContent=meta.name;$('viewTitle').textContent=meta.title;$('viewEyebrow').textContent=meta.eyebrow;$('viewDescription').textContent=meta.description;$('backTools').hidden=view==='console';$('homeShortcuts').hidden=view!=='console';document.body.dataset.workspaceView=view;document.title=meta.name+' · 天梯直播工作室';
    if(['waiting','break','gameframe','overlay','catkeyboard'].includes(view)){$('backTools').href='#scenes';$('backTools').textContent='返回画面自定义';}else{$('backTools').href='#console';$('backTools').textContent='返回直播预览';}
    window.scrollTo({top:0,behavior:'instant'});window.CatWorkspace?.route(view);
  }
  addEventListener('hashchange',route);route();
  const scenePreviewNames={game:'游戏画面',intermission:'搜索 / 等待',break:'暂离画面',loading:'比赛载入',blank:'空白场景',custom:'自定义场景'};
  let scenePreviewPhase='game';
  function sendScenePreview(){ $('sceneOnlyPreview').contentWindow?.postMessage({type:'scenePreview',phase:scenePreviewPhase},location.origin); }
  $('sceneOnlyPreview').addEventListener('load',sendScenePreview);
  document.querySelectorAll('[data-scene-preview]').forEach(button=>button.addEventListener('click',()=>{
    const phase=button.dataset.scenePreview;if(!Object.hasOwn(scenePreviewNames,phase))return;
    scenePreviewPhase=phase;
    $('sceneOnlyPreview').dataset.src='/output?preview=1&module=scene&phase='+phase;
    $('sceneOnlyPreviewLabel').textContent='正在预览：'+scenePreviewNames[phase]+' · 不影响直播输出';
    document.querySelectorAll('[data-scene-preview]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scenePreview===phase)));
    sendScenePreview();
  }));
  async function perform(fn){try{await fn();}catch(error){window.AssistantActions.toast(error.message);if(state)render(state);}}
  const configure=config=>window.AssistantActions.act('ladderConfigure',{config});
  function connection(value){connected=value;window.SceneEditor?.connection(value);window.DailyWorkspace?.connection(value);window.LiveWorkspace?.connection(value);window.OutfitWorkspace?.connection(value);window.CatWorkspace?.connection(value);for(const id of ['homeScoreboard','homeHUD','scoreboardEnabled','homeGameFrame','gameFrameEnabled','gameFrameApply','scoreboardApply',...Object.keys(mainSwitches),'mainFrameStyle','mainKeyboardSide','mainKeyboardView','mainTextSave','mainTextDiscard'])$(id).disabled=!value||!state;for(const b of document.querySelectorAll('[data-main-record]'))b.disabled=!value||!state;for(const id of Object.keys(mainTextFields))$(id).disabled=!value||!state;for(const key of scoreFields)$(key).disabled=!state;$('scoreboardAccentCustom').disabled=!state;for(const b of document.querySelectorAll('[data-score-template],[data-score-position],[data-score-size],[data-frame-quick]'))b.disabled=!state;$('mainKeyboardSide').disabled=!value||!state||state.ladder.config.catView==='classic';window.SceneWorkspace?.connection(value);}
  function obsStatus(ready){$('homeOBSStatus').textContent=ready?'OBS已连接':'OBS未连接';$('homeOBSDot').classList.toggle('connected',ready);}
  function render(next){state=next;window.SceneEditor?.render(next);window.DailyWorkspace?.render(next);window.LiveWorkspace?.render(next);window.OutfitWorkspace?.render(next);window.CatWorkspace?.render(next);const c=next.ladder.config,s=next.ladder.stats,live=next.ladder.session?.stats||s;
    for(const [id,key]of Object.entries(mainSwitches))$(id).checked=c[key]===true;
    $('mainFrameStyle').value=c.gameFrameStyle;$('mainKeyboardSide').value=c.catKeyboardSide;$('mainKeyboardView').value=c.catView;$('mainKeyboardSide').disabled=!connected||c.catView==='classic';
    $('mainFrameStyle').querySelector('option[value=custom]').disabled=!c.gameFrameImage;
    $('mainRecordSummary').textContent=live.wins+' 胜 '+live.losses+' 负 · MMR '+(c.mmr??'—');
    if(!mainTextDirty)for(const [id,key]of Object.entries(mainTextFields)){const input=$(id);if(input.type==='checkbox')input.checked=c[key]===true;else input.value=c[key]||'';}
    for(const b of document.querySelectorAll('[data-main-record]'))b.disabled=!connected;

    $('homeScoreboard').checked=c.scoreboardEnabled;$('scoreboardEnabled').checked=c.scoreboardEnabled;$('homeHUD').checked=c.showHUD;
    $('homeGameFrame').checked=c.gameFrameEnabled;$('gameFrameEnabled').checked=c.gameFrameEnabled;$('gameFrameToolState').textContent=c.gameFrameEnabled?'已启用':'未启用';
    if(!frameDirty)for(const key of frameFields){const input=$(key);if(input.type==='checkbox')input.checked=c[key];else input.value=c[key];}
    updateFramePreview();$('gameFrameURL').value=location.origin+'/gameframe';
    $('scoreboardToolState').textContent=c.scoreboardEnabled?'已启用':'未启用';$('overlayToolState').textContent=c.showHUD?'已启用':'未启用';
    $('homeWins').textContent=live.wins;$('homeLosses').textContent=live.losses;$('homeName').textContent=c.name||c.names[0]||'信息栏模板';
    $('homeMMR').textContent='MMR '+(c.mmr??'—')+' · '+({manual:'手动',replay:'录像',estimate:'估算',unknown:'待获取'}[c.mmrSource]||'待获取');
    $('homeIdentityTitle').textContent=c.replayDirectory?'账号与录像设置':'先连接你的游戏身份';
    $('homeIdentity').textContent=c.toonHandle?'账号 '+c.toonHandle+(c.replayDirectory?' · 录像目录已配置':' · 请设置录像目录'):c.names.length?'已设置精确昵称 · '+(c.replayDirectory?'录像目录已配置':'请设置录像目录'):c.replayDirectory?'录像目录已配置 · 可指定账号或使用目录账号':'配置录像目录与账号，战绩就会自动同步。';
    const online=!['offline','unknown'].includes(next.automation?.phase);$('homeGameStatus').textContent=c.enabled?(next.automation?.label||'等待游戏连接'):'助手已暂停';$('homeGameDot').classList.toggle('connected',online&&c.enabled);
    document.querySelector('.score-visual').dataset.template=c.scoreboardTemplate;
    if(!scoreboardDirty)$('scoreboardAccentCustom').checked=!!c.scoreboardAccent;
    if(!scoreboardDirty)for(const key of scoreFields){const input=$(key);if(input.type==='checkbox')input.checked=c[key];else input.value=key==='scoreboardAccent'?(c[key]||'#83c5b6'):c[key];}
    updateScorePreview();
    const longest=s.longestMatch,summary=longest?'今日最长 '+Math.floor(longest.durationSeconds/60)+':'+String(longest.durationSeconds%60).padStart(2,'0')+' · '+longest.opponent+' · '+(longest.result==='win'?'胜利':'失利'):'今日尚无可用录像时长';
    $('scoreboardLongestSummary').textContent=summary;$('waitingLongestSummary').textContent=summary;
    window.SceneWorkspace?.render(next);$('scoreboardURL').value=location.origin+'/scoreboard';connection(connected);
  }
  for(const id of ['homeScoreboard','scoreboardEnabled'])$(id).addEventListener('change',()=>perform(()=>configure({scoreboardEnabled:$(id).checked})));
  $('homeHUD').addEventListener('change',()=>perform(()=>configure({showHUD:$('homeHUD').checked})));
  for(const id of ['homeGameFrame','gameFrameEnabled'])$(id).addEventListener('change',()=>perform(()=>configure({gameFrameEnabled:$(id).checked})));
  function scoreConfig(){return Object.fromEntries(scoreFields.map(key=>[key,key==='scoreboardAccent'?($('scoreboardAccentCustom').checked?$(key).value:''):key==='scoreboardTemplate'?$(key).value:key==='scoreboardDetails'?$(key).checked:Number($(key).value)]));}
  function updateScorePreview(){const config=scoreConfig();for(const key of ['scoreboardOpacity','scoreboardPanelOpacity'])$(key+'Value').textContent=config[key]+'%';$('scoreboardDraftStatus').textContent=scoreboardDirty?'预览草稿 · 尚未应用':'已保存';for(const b of document.querySelectorAll('[data-score-template]'))b.setAttribute('aria-pressed',String(b.dataset.scoreTemplate===config.scoreboardTemplate));if(state)for(const id of ['scoreboardDetailPreview','scoreboardPositionPreview'])$(id).contentWindow?.postMessage({type:'scoreboardDraft',config},location.origin);}
  function scoreChanged(){scoreboardDirty=true;updateScorePreview();}
  for(const id of ['scoreboardDetailPreview','scoreboardPositionPreview'])$(id).addEventListener('load',updateScorePreview);
  for(const b of document.querySelectorAll('[data-score-template]'))b.addEventListener('click',()=>{$('scoreboardTemplate').value=b.dataset.scoreTemplate;scoreChanged();});
  for(const b of document.querySelectorAll('[data-score-position]'))b.addEventListener('click',()=>{const c=scoreConfig(),right=Math.max(0,Math.round(1920-c.scoreboardWidth*c.scoreboardScale/100-32));$('scoreboardX').value=b.dataset.scorePosition==='top-left'?32:right;$('scoreboardY').value=b.dataset.scorePosition==='bottom-right'?Math.max(0,Math.round(1080-230*c.scoreboardScale/100-32)):120;scoreChanged();});
  for(const b of document.querySelectorAll('[data-score-opacity]'))b.addEventListener('click',()=>{const modes={light:[100,55],text:[100,0],normal:[100,96]},[whole,panel]=modes[b.dataset.scoreOpacity];$('scoreboardOpacity').value=whole;$('scoreboardPanelOpacity').value=panel;scoreChanged();});
  for(const b of document.querySelectorAll('[data-score-size]'))b.addEventListener('click',()=>{const sizes={small:[400,90],normal:[560,100],large:[660,110]},[width,scale]=sizes[b.dataset.scoreSize];$('scoreboardWidth').value=width;$('scoreboardScale').value=scale;$('scoreboardX').value=Math.min(Number($('scoreboardX').value),Math.round(1920-width*scale/100-32));scoreChanged();});
  $('scoreboardForm').addEventListener('input',scoreChanged);$('scoreboardForm').addEventListener('change',scoreChanged);
  $('scoreboardDiscard').addEventListener('click',()=>{scoreboardDirty=false;if(state)render(state);});
  $('scoreboardForm').addEventListener('submit',e=>{e.preventDefault();perform(async()=>{const next=await configure(scoreConfig());scoreboardDirty=false;render(next);window.AssistantActions.toast('计分器设置已应用');});});
  function frameConfig(){return Object.fromEntries(frameFields.map(key=>{const input=$(key);return[key,input.type==='checkbox'?input.checked:frameNumbers.has(key)?Number(input.value):input.value];}));}
  function updateFramePreview(){
    const config=frameConfig(),theme=window.GameFrameTemplate.themes[config.gameFrameStyle]||window.GameFrameTemplate.themes.slim;
    $('gameFrameBannerTitle').textContent=theme.name;$('gameFrameBannerNote').textContent=theme.note;
    $('gameFrameDecorationSettings').hidden=!['nailong','anes','naiwa','nahida','vesna'].includes(config.gameFrameStyle);$('gameFrameMemeField').hidden=!['nailong','naiwa'].includes(config.gameFrameStyle);
    $('gameFrameDraftStatus').textContent=frameDirty?'预览草稿 · 尚未应用':'已保存';
    for(const button of document.querySelectorAll('[data-frame-style]'))button.setAttribute('aria-pressed',String(button.dataset.frameStyle===config.gameFrameStyle));
    for(const id of ['gameFramePreview','gameFrameFullPreview'])if(state)$(id).contentWindow?.postMessage({type:'gameFrameDraft',config},location.origin);
  }
  function frameChanged(){frameDirty=true;updateFramePreview();}
  for(const id of ['gameFramePreview','gameFrameFullPreview'])$(id).addEventListener('load',updateFramePreview);
  $('gameFrameForm').addEventListener('input',frameChanged);$('gameFrameForm').addEventListener('change',frameChanged);
  for(const button of document.querySelectorAll('[data-frame-style]'))button.addEventListener('click',()=>{$('gameFrameStyle').value=button.dataset.frameStyle;$('gameFrameAccent').value=window.GameFrameTemplate.themes[button.dataset.frameStyle].accent;frameChanged();});
  for(const button of document.querySelectorAll('[data-frame-color]'))button.addEventListener('click',()=>{$('gameFrameAccent').value=button.dataset.frameColor;frameChanged();});
  for(const button of document.querySelectorAll('[data-frame-quick]'))button.addEventListener('click',()=>{const style=button.dataset.frameQuick;for(const [key,value]of Object.entries({gameFrameThickness:style==='light'?2:3,gameFrameOpacity:style==='light'?75:90,gameFrameDecorations:style!=='off',gameFrameDecorationScale:style==='light'?65:100})){const input=$(key);if(input.type==='checkbox')input.checked=value;else input.value=value;}frameChanged();});
  $('gameFrameForm').addEventListener('submit',event=>{event.preventDefault();perform(async()=>{const next=await configure(frameConfig());frameDirty=false;render(next);window.AssistantActions.toast('控制台模板已应用');});});
  $('gameFrameDiscard').addEventListener('click',()=>{frameDirty=false;if(state)render(state);});
  $('gameFrameReset').addEventListener('click',()=>{for(const [key,value]of Object.entries({gameFrameScale:100,gameFrameX:0,gameFrameY:0}))$(key).value=value;frameChanged();});
  for(const [key,theme]of Object.entries(window.GameFrameTemplate.themes)){const option=document.createElement('option');option.value=key;option.textContent=theme.name;$('mainFrameStyle').append(option);}
  for(const [id,key]of Object.entries(mainSwitches))$(id).addEventListener('change',()=>perform(()=>configure({[key]:$(id).checked})));
  $('mainFrameStyle').addEventListener('change',()=>perform(()=>{const style=$('mainFrameStyle').value;return configure({gameFrameStyle:style,...(style==='custom'?{}:{gameFrameAccent:window.GameFrameTemplate.themes[style].accent})});}));
  for(const [id,key]of [['mainKeyboardSide','catKeyboardSide'],['mainKeyboardView','catView']])$(id).addEventListener('change',()=>perform(()=>configure({[key]:$(id).value})));
  $('mainSceneTextForm').addEventListener('input',()=>mainTextDirty=true);
  $('mainSceneTextForm').addEventListener('submit',e=>{e.preventDefault();perform(async()=>{const next=await configure(Object.fromEntries(Object.entries(mainTextFields).map(([id,key])=>[key,$(id).type==='checkbox'?$(id).checked:$(id).value])));mainTextDirty=false;render(next);window.AssistantActions.toast('等待与暂离文字已保存');});});
  $('mainTextDiscard').addEventListener('click',()=>{mainTextDirty=false;if(state)render(state);});
  for(const b of document.querySelectorAll('[data-main-record]'))b.addEventListener('click',()=>perform(()=>b.dataset.mainRecord==='undo'?window.AssistantActions.act('ladderUndo',{scope:'session'}):window.AssistantActions.act('ladderRecord',{result:b.dataset.mainRecord})));
  window.Workspace={render,connection,obsStatus};connection(false);
})();
