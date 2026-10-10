(()=>{
  const $=id=>document.getElementById(id),M=window.SceneCustomization,frame=$('sceneEditorPreview');
  if(!frame)return;
  const names={game:'游戏画面',loading:'比赛载入画面',intermission:'搜索 / 等待画面',break:'暂离画面',blank:'空白场景',custom:'自定义场景'};
  const descriptions={game:'保留游戏画面，搭配边框、计分器与小助手。',loading:'下一场开始前，展示标题与本次直播战报。',intermission:'搜索对手时，用背景、文字和战报填满等待时间。',break:'暂时离开时，告诉观众何时回来。',blank:'隐藏所有助手图层，露出直播软件下方的原始画面。',custom:'为节目、活动或自由组合准备一个独立场景。'};
  const content={ShowName:'昵称与种族',ShowMMR:'当前 MMR',ShowRecord:'本次直播胜负',ShowMatchups:'对阵种族',ShowPhase:'游戏状态',ShowHUD:'信息栏',ShowLongest:'今日最长对局',ShowZealots:'今日刷叉',ShowZerglings:'今日造狗',ShowWorkersKilled:'击杀对方农民',ShowStrongest:'今日最强对手',ShowDailyTime:'今日对局时长'};
  const layerMeta={Frame:['边','装饰游戏边沿'],Keyboard:['键','展示按键与角色'],Scoreboard:['胜','本次直播的胜负'],DailyWidget:['今','今日对局与单位统计'],Resources:['矿','矿物、瓦斯与人口图标'],Gifts:['礼','直播间礼物答谢'],Income:['收','直播间收益信息'],Raffle:['奖','直播间抽奖进度'],Sticker:['贴','自由摆放的图片挂件']};
  const dragTargets={Keyboard:'keyboard',Scoreboard:'scoreboard',DailyWidget:'daily',Text:'text',Sticker:'sticker'};
  let state,connected=false,phase='game',draft={},dirty=false,uploading=false,saving=false,lastConfig='',selected='Scoreboard',pendingScene='',controls=[],cards=[],buttons=[],visibilityNote=null;
  const values=()=>({...state?.ladder.config,...draft});
  const busy=()=>uploading||saving;
  function field(key){return controls.find(el=>el.dataset.sceneField===key);}
  function node(tag,text,className){const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;}
  function input(key,label,type='text',options=null){
    const wrap=node('label',label),el=document.createElement(options?'select':'input');el.id='sceneEdit-'+key;el.dataset.sceneField=key;
    if(options){for(const [value,text]of Object.entries(options)){const option=node('option',text);option.value=value;el.append(option);}}else el.type=type;
    for(const [suffix,max]of Object.entries({Title:60,Note:100,Kicker:80,TeamName:40}))if(key.endsWith(suffix))el.maxLength=max;
    if(/Opacity$/.test(key)||key==='opacity'){el.min=['scoreboardOpacity','scoreboardPanelOpacity','stickerOpacity','opacity'].includes(key)||/^(waiting|loading|break|custom)PanelOpacity$/.test(key)?0:20;el.max=100;el.step=1;}
    const c=values();if(type==='checkbox')el.checked=isVisible(key,c);else el.value=c[key]??'';
    if(key==='stickerX'||key==='stickerY'){el.min=0;el.max=key==='stickerX'?1919:1079;}if(key==='stickerWidth'||key==='stickerHeight'){el.min=40;el.max=1000;}el.disabled=!state||busy();wrap.append(el);controls.push(el);return wrap;
  }
  function isVisible(key,c=values()){
    if(c[key]!==true)return false;
    const prefix=M.prefixes[phase];
    for(const [layer,global]of Object.entries(M.enableFields))if(key===prefix+'Show'+layer&&c[global]!==true)return false;
    if(key===prefix+'ShowDailyWidget'){const flag={game:'dailyGame',intermission:'dailyWaiting',break:'dailyBreak'}[phase];if(flag&&c[flag]!==true)return false;}
    if(key===prefix+'ShowHUD'&&c.showHUD!==true)return false;
    return true;
  }
  function section(title,fold=false){const el=node(fold?'details':'div',null,'scene-editor-section');el.append(node(fold?'summary':'h3',title));return el;}
  function pair(parent,items){const row=node('div',null,'scene-editor-pair');for(const item of items)row.append(input(...item));parent.append(row);}
  function checks(parent,items){const row=node('div',null,'scene-editor-checks');for(const [key,label]of items)row.append(input(key,label,'checkbox'));parent.append(row);}
  function hint(parent,text){parent.append(node('p',text,'hint'));}
  function button(text,action,className){const el=node('button',text,className);el.type='button';el.disabled=!state||busy();el.addEventListener('click',()=>{if(!busy())action();});buttons.push(el);return el;}
  function setValue(key,value){draft[key]=value;dirty=true;}
  function chooseLayer(layer){selected=layer;build();$('sceneComponentInspector')?.scrollIntoView?.({block:'nearest',behavior:'smooth'});}
  function contentCard(layer,label){
    const key=M.prefixes[phase]+'Show'+layer,meta=layerMeta[layer]||['文','场景标题与战报'];
    const card=node('div',null,'scene-content-card');card.dataset.layer=layer;card.dataset.selected=String(selected===layer);
    const pick=button('',()=>chooseLayer(layer),'scene-content-pick');pick.setAttribute('aria-pressed',String(selected===layer));pick.append(node('span',meta[0],'scene-content-icon'));
    const copy=node('span',null,'scene-content-copy');copy.append(node('strong',label),node('small',meta[1]));pick.append(copy);
    const toggle=input(key,'','checkbox');toggle.className='scene-content-toggle';const control=field(key);control.setAttribute('aria-label','在'+names[phase]+'显示'+label);
    const labelNode=node('span');toggle.append(labelNode);const toggleRow=node('div',null,'scene-content-toggle-row');toggleRow.append(toggle);card.append(pick,toggleRow);cards.push({card,control,labelNode});return card;
  }
  function build(){
    const box=$('sceneEditorFields');box.replaceChildren();controls=[];cards=[];buttons=[];visibilityNote=null;
    $('sceneEditorName').textContent=names[phase];$('sceneEditorDescription').textContent=descriptions[phase];
    for(const b of document.querySelectorAll('[data-edit-scene]'))b.setAttribute('aria-pressed',String(b.dataset.editScene===phase));
    if(phase==='blank'){box.append(node('p','这个场景没有可编辑的助手内容。后台战绩和直播互动仍会继续记录。','scene-editor-empty'));$('sceneDragTarget').value='';sync();return;}
    const prefix=M.prefixes[phase],visibility=section('2 · 选择显示内容');
    hint(visibility,'开关决定是否显示；点卡片名称，调整这个组件。');
    const grid=node('div',null,'scene-content-grid');
    if(phase!=='game')grid.append(contentCard('Text','场景文字与战报'));
    for(const [layer,label]of Object.entries(M.layers))grid.append(contentCard(layer,label));
    visibility.append(grid);hint(visibility,'显示开关仅作用于当前场景。启用组件会同时开启对应工具；礼物、收益、抽奖还需开启直播间互动。');box.append(visibility);
    if(phase!=='game')buildBackground(box,prefix);
    buildInspector(box,prefix);
    const advanced=section('高级设置 · 全部位置与透明度',true);
    hint(advanced,'以下工具参数在各场景共用；保存后，其他使用同一工具的场景也会更新。');
    pair(advanced,[['scoreboardPanelOpacity','计分器底色与边框 %','number'],['scoreboardOpacity','计分器整体 %','number'],['gameFrameOpacity','游戏边框 %','number'],['catOpacity','按键助手整体 %','number'],['dailyOpacity','今日数据底色 %','number'],['opacity','信息栏整体 %','number'],['resourceOpacity','资源图标整体 %','number']].filter(([key])=>!field(key)));
    pair(advanced,[['catX','键盘横向位置','number'],['catY','键盘纵向位置','number'],['catWidth','键盘宽度','number'],['scoreboardX','计分器横向位置','number'],['scoreboardY','计分器纵向位置','number'],['scoreboardWidth','计分器宽度','number'],['dailyX','今日数据横向位置','number'],['dailyY','今日数据纵向位置','number'],['dailyWidth','今日数据宽度','number']].filter(([key])=>!field(key)));
    box.append(advanced);$('sceneDragTarget').value=dragTargets[selected]||'';sync();
  }
  function buildBackground(box,prefix){
    const appearance=section('背景与主题',true);appearance.open=selected==='Background';
    appearance.append(input(prefix+'Theme','主题','text',Object.fromEntries(Object.entries(window.SceneThemes.presets).map(([k,v])=>[k,v.name]))));
    const backgrounds={gradient:'主题渐变',solid:'纯色',image:'图片',video:'视频',...(phase==='custom'?{transparent:'透明 · 露出下方游戏画面'}:{})};
    appearance.append(input(prefix+'Background','背景类型','text',backgrounds));
    const media=node('div');media.dataset.mediaOptions='true';const uploadLabel=node('label','上传图片或视频'),file=document.createElement('input');file.type='file';file.accept='.png,.jpg,.jpeg,.webp,.mp4,.webm';file.id='sceneEditorMediaFile';file.disabled=!connected||busy();file.addEventListener('change',()=>upload(file));uploadLabel.append(file);media.append(uploadLabel);hint(media,'图片不超过 8 MB，视频不超过 150 MB。素材保存在本机，保存场景后用于直播。');appearance.append(media);appearance._media=media;
    const video=node('div');checks(video,[[prefix+'VideoMuted','视频静音'],[prefix+'VideoLoop','循环播放']]);appearance.append(video);appearance._video=video;
    appearance.append(button('恢复主题背景',()=>{setValue(prefix+'Background','gradient');setValue(prefix+'BackgroundImage','');setValue(prefix+'BackgroundVideo','');selected='Background';build();}));
    const colors=section('颜色与媒体填充',true);pair(colors,[[prefix+'Color','背景色','color'],[prefix+'ColorSecondary','渐变色','color'],[prefix+'Accent','强调色','color'],[prefix+'TextColor','文字颜色','color']]);colors.append(input(prefix+'ImageFit','媒体填充','text',{cover:'铺满，适当裁切',contain:'完整显示'}));pair(colors,[[prefix+'Dim','背景压暗 %','number'],[prefix+'PanelOpacity','文字面板底色 %','number']]);appearance.append(colors);box.append(appearance);backgroundSection=appearance;
  }
  let backgroundSection=null;
  function buildInspector(box,prefix){
    const title=selected==='Text'?'场景文字与战报':M.layers[selected]||'组件设置',panel=section('调整 · '+title);panel.className+=' scene-component-inspector';panel.id='sceneComponentInspector';
    if(selected==='Background'){hint(panel,'展开上方“背景与主题”，选择背景图片、视频或主题。');box.append(panel);return;}
    visibilityNote=node('p','这个组件在当前场景中已隐藏。开启上方开关后，可在预览中查看调整效果。','hint');panel.append(visibilityNote);
    if(dragTargets[selected]){panel.append(button('在预览中拖动',()=>{$('sceneDragTarget').value=dragTargets[selected];sync();},'scene-drag-button'));hint(panel,'拖动预览里的蓝色边框调整位置，也可用方向键微调；按住 Shift 每次移动 10 像素。');}
    if(selected!=='Text')hint(panel,'组件外观与位置在各场景共用。');
    if(selected==='Text'){
      for(const [key,label]of [['Title','标题'],['Note','说明']])panel.append(input(prefix+key,label));
      const more=section('更多文字与战报',true);for(const [key,label]of [['Kicker','顶部小字'],['TeamName','战队名称']])more.append(input(prefix+key,label));checks(more,Object.entries(content).map(([key,label])=>[prefix+key,label]));panel.append(more);
      const layout=section('文字对齐、字号与位置',true);layout.append(input(prefix+'Layout','对齐方式','text',{left:'左侧',center:'居中',right:'右侧'}));checks(layout,[[prefix+'FreePosition','使用自由位置（可拖动）']]);pair(layout,[[prefix+'TextX','横向位置','number'],[prefix+'TextY','纵向位置','number'],[prefix+'Width','内容宽度','number'],[prefix+'TitleSize','标题字号','number']]);panel.append(layout);
    }else if(selected==='Scoreboard')pair(panel,[['scoreboardX','横向位置','number'],['scoreboardY','纵向位置','number'],['scoreboardWidth','宽度','number'],['scoreboardPanelOpacity','底色与边框 %','number'],['scoreboardOpacity','整体透明度 %','number']]);
    else if(selected==='DailyWidget')pair(panel,[['dailyX','横向位置','number'],['dailyY','纵向位置','number'],['dailyWidth','宽度','number'],['dailyOpacity','底色透明度 %','number']]);
    else if(selected==='Keyboard'){
      panel.append(input('catView','显示风格','text',{flat:'纯平面键盘 · 无角色',rear:'侧后方角色',split:'角色与键盘分开',classic:'保留的原版'}));panel.append(input('catKeyboardSide','键盘显示','text',{left:'左半键盘',right:'右半键盘'}));pair(panel,[['catX','横向位置','number'],['catY','纵向位置','number'],['catWidth','宽度','number'],['catOpacity','整体透明度 %','number'],['catAccent','按键高亮','color']]);
    }else if(selected==='Frame'){
      panel.append(input('gameFrameStyle','边框风格','text',Object.fromEntries(Object.entries(window.GameFrameTemplate?.themes||{slim:{name:'透明窄边框'}}).filter(([key])=>key!=='custom'||values().gameFrameImage).map(([key,t])=>[key,t.name]))));panel.append(input('gameFrameCoverage','装饰范围','text',{rich:'自然溢出 · 保留完整美术',safe:'仅边沿 · 优先游戏信息'}));pair(panel,[['gameFrameAccent','边框颜色','color'],['gameFrameOpacity','整体透明度 %','number']]);
    }else if(selected==='Resources'){
      panel.append(input('resourceStyle','图标模板','text',Object.fromEntries(Object.entries(window.ResourceTemplate.themes).map(([k,v])=>[k,v.name]))));panel.append(input('resourceBackdropStyle','图标底层','text',{transparent:'透明',glow:'柔和渐变',solid:'实色遮盖'}));pair(panel,[['resourceMineralX','矿物图标 X','number'],['resourceVespeneX','瓦斯图标 X','number'],['resourceSupplyX','人口图标 X','number'],['resourceY','图标 Y','number'],['resourceIconScale','图标大小 %','number'],['resourceOpacity','整体透明度 %','number']]);
    }else if(selected==='Sticker'){
      const styles=window.StickerTemplate?.styles||{},options=Object.fromEntries(Object.entries(styles).map(([key,value])=>[key,typeof value==='string'?value:value.name||value.label||key]));
      if(!Object.keys(options).length)Object.assign(options,{nahida:'纳西妲',vesna:'薇斯纳',nicole:'妮可',artanis:'阿塔尼斯','artanis-chibi':'Q 版大主教'});
      if(values().stickerImage)options.custom='自己的图片';panel.append(input('stickerStyle','挂件角色','text',options));
      pair(panel,[['stickerX','横向位置','number'],['stickerY','纵向位置','number'],['stickerWidth','宽度','number'],['stickerHeight','高度','number'],['stickerOpacity','整体透明度 %','number']]);checks(panel,[['stickerFlip','水平翻转'],['stickerProtect','避让游戏信息区']]);hint(panel,'游戏中自动避开小地图、血量、技能和资源数字，让关键信息保持清晰。');hint(panel,'上传自己的图片，请打开下方完整设置。');
    }else hint(panel,'在直播间互动中配置内容、连接状态与触发方式。');
    const routes={Frame:'gameframe',Keyboard:'catkeyboard',Scoreboard:'scoreboard',DailyWidget:'daily',Resources:'resources',Gifts:'liveinteraction',Income:'liveinteraction',Raffle:'liveinteraction',Sticker:'stickers'};
    if(routes[selected]){const link=node('a','打开完整设置 ↗','quiet-link');link.href='#'+routes[selected];panel.append(link);}box.append(panel);
  }
  function sync(){
    const locked=!state||busy();for(const el of [...controls,...buttons])el.disabled=locked;
    for(const {card,control,labelNode}of cards){card.dataset.visible=String(control.checked);labelNode.textContent=control.checked?(['Gifts','Income','Raffle'].includes(card.dataset.layer)?'允许显示':'已显示'):'已隐藏';}
    for(const b of document.querySelectorAll('[data-edit-scene]'))b.disabled=locked;
    if(!state)return;
    const c=values(),prefix=M.prefixes[phase];
    if(visibilityNote)visibilityNote.hidden=isVisible(prefix+'Show'+selected,c);
    for(const option of $('sceneDragTarget').options||[])if(option.value==='text')option.disabled=phase==='game';
    if(backgroundSection){backgroundSection._media.hidden=!['image','video'].includes(c[prefix+'Background']);backgroundSection._video.hidden=c[prefix+'Background']!=='video';}
    frame.contentWindow?.postMessage({type:'editorGuides',show:$('sceneEditorGuides')?.checked===true},location.origin);
    frame.contentWindow?.postMessage({type:'editorDraft',phase,config:M.filter(c,phase)},location.origin);
    frame.contentWindow?.postMessage({type:'editorDragTarget',target:$('sceneDragTarget').value},location.origin);
    $('sceneEditorStatus').textContent=uploading?'素材上传中':saving?'正在保存':dirty?'草稿 · 未保存':'与已保存设置一致';$('sceneEditorStatus').dataset.dirty=String(dirty);
    $('sceneEditorLiveStatus').textContent='实际输出：'+(names[state.scene]||state.scene||'连接中');
    $('sceneEditorSaveNote').textContent=!connected?'连接已断开，草稿保留在本页':dirty?'保存后更新直播配置；不会切换当前直播场景。':'修改会先出现在预览中，保存后才更新直播。';
    $('sceneEditorApply').textContent=saving?'正在保存…':'保存场景设置';$('sceneEditorApply').disabled=!connected||locked||!dirty||phase==='blank';$('sceneEditorDiscard').disabled=locked||!dirty;$('sceneDragTarget').disabled=locked||phase==='blank';
    $('sceneGlobalNote').textContent=c.enabled?(phase==='game'?'游戏截图是摆放参考，不会进入直播输出。':'透明底纹仅用于辨认透明区域，不会进入直播。'):'直播工具总开关已关闭，启用后才会在实际输出显示。';
    $('sceneSwitchNotice').hidden=!pendingScene;$('sceneSwitchMessage').textContent='“'+names[phase]+'”有未保存修改。保存或放弃后，前往“'+(names[pendingScene]||'')+'”。';$('sceneSwitchSave').disabled=locked||!connected;$('sceneSwitchDiscard').disabled=locked;$('sceneSwitchCancel').disabled=locked;
    if($('sceneEditorMediaFile'))$('sceneEditorMediaFile').disabled=!connected||locked;
  }
  function changed(event){
    const el=event.target,key=el.dataset.sceneField;if(!key||busy())return;setValue(key,el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value);const prefix=M.prefixes[phase];
    for(const [layer,global]of Object.entries(M.enableFields))if(key===prefix+'Show'+layer&&el.checked)draft[global]=true;
    if(key===prefix+'ShowDailyWidget'&&el.checked){const flag={game:'dailyGame',intermission:'dailyWaiting',break:'dailyBreak'}[phase];if(flag)draft[flag]=true;}
    if(key===prefix+'ShowHUD'&&el.checked)draft.showHUD=true;
    if(key===prefix+'Theme'){const preset=window.SceneThemes.presets[el.value];for(const suffix of ['Color','ColorSecondary','Accent','TextColor','Layout','Width','PanelOpacity'])if(preset?.[suffix]!==undefined){draft[prefix+suffix]=preset[suffix];if(field(prefix+suffix))field(prefix+suffix).value=preset[suffix];}draft[prefix+'Background']='gradient';field(prefix+'Background').value='gradient';}
    sync();
  }
  async function upload(file){
    const f=file.files[0];if(!f)return;const image=/\.(png|jpe?g|webp)$/i.test(f.name),video=/\.(mp4|webm)$/i.test(f.name);
    try{if(!image&&!video)throw Error('请选择 PNG/JPG/WebP 图片或 MP4/WebM 视频');if(f.size>(image?8:150)*1024*1024)throw Error('素材超过大小限制');uploading=true;sync();const response=await window.AssistantActions.request('/api/scene-media',{method:'POST',headers:{'Content-Type':f.type||'application/octet-stream'},body:f}),value=await response.json();if(!response.ok)throw Error(value.error||'素材上传失败');const prefix=M.prefixes[phase];setValue(prefix+(value.kind==='video'?'BackgroundVideo':'BackgroundImage'),value.url);draft[prefix+'Background']=value.kind;draft[prefix+'Theme']='custom';$('sceneEditorMediaStatus').textContent=f.name+' · 已保存在本机，保存场景后显示';selected='Background';}catch(error){window.AssistantActions.toast(error.message);$('sceneEditorMediaStatus').textContent=error.message;}finally{uploading=false;build();}
  }
  async function save(){
    if(busy()||!connected||!dirty||phase==='blank')return false;
    try{const c=values(),prefix=M.prefixes[phase];if(phase!=='game'&&((c[prefix+'Background']==='image'&&!c[prefix+'BackgroundImage'])||(c[prefix+'Background']==='video'&&!c[prefix+'BackgroundVideo'])))throw Error('请先上传对应的图片或视频');saving=true;sync();state=await window.AssistantActions.act('ladderConfigure',{config:M.filter(draft,phase)});draft={};dirty=false;lastConfig=JSON.stringify(state.ladder.config);window.AssistantActions.toast(names[phase]+'设置已保存');return true;}catch(error){window.AssistantActions.toast(error.message);return false;}finally{saving=false;build();}
  }
  function selectScene(next){
    if(busy()){window.AssistantActions.toast('请等待当前保存完成');return false;}if(!M.phases.includes(next))return false;if(next===phase)return true;
    if(dirty){pendingScene=next;sync();return false;}phase=next;pendingScene='';selected=phase==='game'?'Scoreboard':'Text';backgroundSection=null;$('sceneEditorMediaStatus').textContent='';frame.dataset.src='/output?preview=1&module=editor&phase='+phase;build();return true;
  }
  $('sceneEditorForm').addEventListener('input',changed);$('sceneEditorForm').addEventListener('change',changed);
  $('sceneEditorForm').addEventListener('submit',async event=>{event.preventDefault();const next=pendingScene;if(await save()&&next)selectScene(next);});
  $('sceneEditorDiscard').addEventListener('click',()=>{if(busy())return;draft={};dirty=false;pendingScene='';$('sceneEditorMediaStatus').textContent='';build();});
  $('sceneSwitchSave').addEventListener('click',async()=>{const next=pendingScene;if(await save())selectScene(next);});
  $('sceneSwitchDiscard').addEventListener('click',()=>{if(busy())return;const next=pendingScene;draft={};dirty=false;selectScene(next);});$('sceneSwitchCancel').addEventListener('click',()=>{pendingScene='';sync();});
  for(const b of document.querySelectorAll('[data-edit-scene]'))b.addEventListener('click',()=>selectScene(b.dataset.editScene));
  for(const link of document.querySelectorAll('[data-open-editor-scene]'))if(link.dataset.openEditorScene)link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();selectScene(link.dataset.openEditorScene);location.hash='#scenes';});
  $('sceneDragTarget').addEventListener('change',()=>{const target=$('sceneDragTarget').value,layer=Object.keys(dragTargets).find(key=>dragTargets[key]===target);if(layer&&!(layer==='Text'&&phase==='game'))chooseLayer(layer);else sync();});frame.addEventListener('load',sync);$('sceneEditorGuides')?.addEventListener('change',sync);
  addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='editorMoved'||busy())return;const patch=M.filter(event.data.config,phase);let moved=false;
    for(const [key,value]of Object.entries(patch)){if(!/^(?:cat[XY]|scoreboard[XY]|daily[XY]|sticker[XY]|(?:waiting|break|loading|custom)(?:Text[XY]|FreePosition))$/.test(key))continue;draft[key]=value;moved=true;if(field(key)){if(field(key).type==='checkbox')field(key).checked=value;else field(key).value=value;}}
    if(moved){dirty=true;sync();}
  });
  addEventListener('beforeunload',event=>{if(!dirty)return;event.preventDefault();event.returnValue='';});
  window.SceneEditor={render(next){state=next;const serialized=JSON.stringify(next.ladder.config);if(serialized!==lastConfig&&!dirty&&!busy()){lastConfig=serialized;build();}else sync();},connection(value){connected=value;sync();}};
})();
