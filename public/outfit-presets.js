(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./scene-themes.js'));else root.OutfitPresets=factory(root.SceneThemes);})(typeof window!=='undefined'?window:this,function(scenes){
  const modules={gameframe:'游戏边框',catkeyboard:'按键小助手',scoreboard:'战绩计分器',overlay:'信息栏',waiting:'等待画面',break:'暂离画面'};
  const presets={
    anes:{name:'ANES · 蓝金主场',note:'战队队标、蓝金边框与同色猫娘键帽',scene:'team',frame:'anes',cat:'cat',accent:'#e6bc5c',score:'bluegold',hud:'bluegold',colors:['#081526','#203d64','#e6bc5c']},
    protoss:{name:'星灵 · 大主教与狂热者',note:'同一套金白装甲与蓝色灵能，双角色舞台、丰富控制台与 Q 版大主教助手',scene:'protoss',frame:'artanis',cat:'artanis',accent:'#72d9ef',score:'compact',hud:'compact',colors:['#080f1c','#264760','#72d9ef'],assets:{cover:'/assets/artanis-character-v1.png'}},
    starcraft:{name:'星际 · 深空指挥',note:'深空背景、轻量窄框与冰蓝猫娘键帽',scene:'starcraft',frame:'slim',cat:'cat',accent:'#74d9ed',score:'dual',hud:'compact',colors:['#07111d','#183c5c','#74d9ed']},
    naiwa:{name:'奶蛙 · 呱呱出击',note:'人形奶蛙、恶搞边框与黄绿舞台',scene:'naiwa',frame:'naiwa',cat:'naiwa',accent:'#efd253',score:'dual',hud:'compact',colors:['#1c210c','#535a21','#f2d34f']},
    nahida:{name:'纳西妲 · 叶间微光',note:'纳西妲助手、叶饰边框与柔绿舞台',scene:'nahida',frame:'nahida',cat:'nahida',accent:'#c5dc8e',score:'compact',hud:'compact',colors:['#10251e','#3e6345','#c5dc8e']},
    nicole:{name:'尼可 · 静默星谕',note:'内置 · 正面角色边框、蓝白金星盘与侧脸按键助手',scene:'nicole',frame:'nicole',cat:'nicole',accent:'#e7cb90',score:'compact',hud:'compact',colors:['#10172c','#394c79','#e7cb90'],assets:{cover:'/assets/nicole-waiting-v1.png',waiting:'/assets/nicole-waiting-v1.png',away:'/assets/nicole-away-v1.png'}},
    vesna:{name:'薇斯纳 · 青白雪宴',note:'薇斯纳助手、雪饰边框与青白舞台',scene:'vesna',frame:'vesna',cat:'vesna',accent:'#a4e2df',score:'compact',hud:'compact',colors:['#091d2a','#386e7d','#a4e2df']}
  };
  for(const [base,name,accent]of [['nahida','纳西妲 · 豪华叶宫','#b9db84'],['vesna','薇斯纳 · 豪华霜剑','#a4e2df'],['nicole','妮可 · 豪华星谕','#d6ccf6']])presets[base+'-luxury']={...presets[base],name,note:'自然溢出豪华控制台 + 同主题助手、等待与暂离画面',frame:base+'-luxury',accent,assets:{...presets[base].assets,cover:'/assets/'+base+'-console-luxury-v1.png'}};
  function resolve(id,installed){return installed&&/^(?:user-|combo-)/.test(String(id))?installed.find(p=>p.id===id):Object.hasOwn(presets,id)?presets[id]:null;}
  function registerInstalled(installed=[],combinations=[]){for(const id of Object.keys(presets))if(/^(?:user-|combo-)/.test(id))delete presets[id];for(const p of installed)if(/^user-[a-z][a-z0-9-]{2,47}$/.test(p.id))presets[p.id]=p;for(const p of combinations)if(/^combo-[a-f0-9]{16}$/.test(p.id)&&p.combination===true)presets[p.id]=p;}
  function normalize(input={},installed){
    if(!input||typeof input!=='object'||Array.isArray(input)||!resolve(input.preset,installed))throw Error('请选择有效的整套风格');
    const selected=input.modules??Object.keys(modules);
    if(!Array.isArray(selected)||!selected.length||selected.length>6||new Set(selected).size!==selected.length||selected.some(k=>!Object.hasOwn(modules,k)))throw Error('请至少选择一个有效的换装元素');
    const options={};for(const key of ['preserveMedia','preserveLayout','enableTools']){if(key in input&&typeof input[key]!=='boolean')throw Error('换装选项格式不正确');options[key]=input[key]??false;}
    return{preset:input.preset,modules:[...selected],...options};
  }
  const combinationFields={
    gameframe:['gameFrameCoverage','gameFrameStyle','gameFrameAccent','gameFrameImage'],
    catkeyboard:['catCharacter','catAccent','catFrontImage','catRearImage'],
    scoreboard:['scoreboardTemplate','scoreboardAccent','scoreboardOpacity','scoreboardPanelOpacity'],
    overlay:['template','accent'],
    waiting:['waitingTheme','waitingBackground','waitingBackgroundImage','waitingBackgroundVideo','waitingColor','waitingColorSecondary','waitingAccent','waitingTextColor','waitingPanelOpacity','waitingLayout','waitingWidth'],
    break:['breakTheme','breakBackground','breakBackgroundImage','breakBackgroundVideo','breakColor','breakColorSecondary','breakAccent','breakTextColor','breakPanelOpacity','breakLayout','breakWidth']
  };
  combinationFields.waiting.push(...combinationFields.waiting.map(k=>k.replace(/^waiting/,'loading')));
  function captureCombination(config){return Object.fromEntries(Object.values(combinationFields).flat().map(k=>[k,config[k]]));}
  function buildPatch(config,input,installed){
    const choice=normalize(input,installed),p=resolve(choice.preset,installed),patch={};
    if(p.combination){for(const key of choice.modules){for(const field of combinationFields[key]){if(choice.preserveMedia&&/Background(?:Image|Video)?$/.test(field))continue;if(choice.preserveLayout&&/(?:Layout|Width)$/.test(field))continue;if(Object.hasOwn(p.patch,field))patch[field]=p.patch[field];}if(choice.enableTools){const field={gameframe:'gameFrameEnabled',catkeyboard:'catEnabled',scoreboard:'scoreboardEnabled',overlay:'showHUD'}[key];if(field)patch[field]=true;}}return patch;}
    for(const key of choice.modules){
      if(key==='gameframe')Object.assign(patch,{gameFrameStyle:p.frame,gameFrameAccent:p.accent,gameFrameImage:p.assets?.frame||'',...(p.frame.endsWith('-luxury')?{gameFrameCoverage:'rich'}:{})});
      if(key==='catkeyboard')Object.assign(patch,{catCharacter:p.cat,catAccent:p.accent,catFrontImage:p.assets?.assistantFront||p.assets?.assistantRear||'',catRearImage:p.assets?.assistantRear||p.assets?.assistantFront||''});
      if(key==='scoreboard')Object.assign(patch,{scoreboardTemplate:p.score,scoreboardAccent:p.accent});
      if(key==='overlay')Object.assign(patch,{template:p.hud,accent:p.accent});
      if(key==='waiting'||key==='break'){
        const s={...scenes.presets[p.scene],...p.sceneSpec};patch[key+'Theme']=p.scene;
        for(const suffix of ['Color','ColorSecondary','Accent','TextColor','PanelOpacity'])patch[key+suffix]=s[suffix];
        if(!choice.preserveLayout)for(const suffix of ['Layout','Width'])patch[key+suffix]=s[suffix];
        const knownKickers=Object.values(scenes.presets).flatMap(v=>v.Kicker?[v.Kicker,v.Kicker.replace('LADDER SESSION','BE RIGHT BACK')]:[]);
        if(knownKickers.includes(config[key+'Kicker']))patch[key+'Kicker']=key==='break'?s.Kicker.replace('LADDER SESSION','BE RIGHT BACK'):s.Kicker;
        if(!choice.preserveMedia||!['image','video'].includes(config[key+'Background'])){
          const asset=p.assets?.[key==='break'?'away':'waiting'];patch[key+'Background']=asset?'image':'gradient';if(asset){patch[key+'BackgroundImage']=asset;patch[key+'Theme']=p.installed?'custom':p.scene;}
        }
      }
      if(choice.enableTools){const field={gameframe:'gameFrameEnabled',catkeyboard:'catEnabled',scoreboard:'scoreboardEnabled',overlay:'showHUD'}[key];if(field)patch[field]=true;}
    }
    if(choice.modules.includes('waiting'))for(const [k,v]of Object.entries({...patch}))if(k.startsWith('waiting')&&!k.endsWith('Kicker'))patch['loading'+k.slice(7)]=v;
    return patch;
  }
  return{modules,presets,normalize,buildPatch,registerInstalled,resolve,captureCombination,combinationFields};
});
