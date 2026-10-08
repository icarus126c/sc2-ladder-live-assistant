(()=>{
  const $=id=>document.getElementById(id),packs=window.OutfitPresets;let state,connected=false,busy=false,selected='anes',phase='game',lastSignature='';
  const cards=$('outfitPresets');let cardSignature='';
  function buildCards(){
  const signature=JSON.stringify(packs.presets);if(signature===cardSignature)return;cardSignature=signature;cards.replaceChildren();
  for(const [id,p]of Object.entries(packs.presets)){
    const button=document.createElement('button');button.type='button';button.dataset.outfit=id;button.className='outfit-card';button.style.setProperty('--pack-dark',p.colors[0]);button.style.setProperty('--pack-mid',p.colors[1]);button.style.setProperty('--pack-accent',p.accent);
    const visual=document.createElement('span');visual.className='outfit-card-art outfit-art-'+id;visual.setAttribute('aria-hidden','true');const mark=document.createElement('i');mark.className='outfit-mark';visual.append(mark);
    if(p.installed||p.assets?.cover){visual.classList.add('outfit-art-installed');const url=p.assets?.cover||p.assets?.waiting;if(/^\/(?:style-assets\/[a-f\d]{64}|assets\/(?:nicole-(?:waiting|away)|(?:artanis|zealot)-character)-v1)\.png$/.test(url||'')){visual.style.backgroundImage=`url("${url}")`;visual.style.backgroundSize='cover';visual.style.backgroundPosition='center';mark.hidden=true;}}
    const name=document.createElement('b');name.textContent=p.name;const note=document.createElement('small');note.textContent=(p.installed?'外部 · ':'')+p.note;
    const swatches=document.createElement('span');swatches.className='outfit-swatches';for(const color of p.colors){const dot=document.createElement('i');dot.style.background=color;swatches.append(dot);}
    button.append(visual,name,note,swatches);cards.append(button);button.addEventListener('click',()=>{selected=id;update();});
  }
  }buildCards();
  function choice(){return{preset:selected,modules:[...document.querySelectorAll('[data-outfit-module]:checked')].map(e=>e.dataset.outfitModule),preserveMedia:$('outfitPreserveMedia').checked,preserveLayout:$('outfitPreserveLayout').checked,enableTools:$('outfitEnableTools').checked};}
  function update(){
    const input=choice(),p=packs.presets[selected];$('outfitName').textContent=p.name;
    for(const card of cards.children){card.setAttribute('aria-pressed',String(card.dataset.outfit===selected));card.disabled=!state||busy;}
    for(const button of document.querySelectorAll('[data-outfit-phase]'))button.setAttribute('aria-pressed',String(button.dataset.outfitPhase===phase));
    $('outfitApply').textContent=p.combination?'应用这套搭配':'应用这套风格';$('outfitSaveCombination').disabled=!connected||!state||busy;$('outfitRemoveCombination').hidden=!p.combination;$('outfitRemoveCombination').disabled=!connected||!state||busy;$('outfitApply').disabled=!connected||!state||busy||!input.modules.length;
    $('outfitUndo').disabled=!connected||busy||!state?.outfit?.canUndo;
    for(const e of document.querySelectorAll('#outfitOptions input,[data-outfit-scope]'))e.disabled=!state||busy;
    $('outfitScope').textContent=input.modules.length?input.modules.map(k=>packs.modules[k]).join(' · '):'勾选至少一个元素后即可预览和应用';
    const matches=state&&input.modules.length&&Object.entries(packs.buildPatch(state.ladder.config,input)).every(([k,v])=>state.ladder.config[k]===v);$('outfitDraftStatus').textContent=matches?'当前外观 · 已保存':'整套预览 · 尚未应用';
    $('outfitLiveStatus').textContent=state?.outfit?.lastName?'最近应用：'+state.outfit.lastName+(state.outfit.canUndo?' · 可撤销':' · 已另行调整'):'选风格仅改变预览，点击应用后才更换直播外观。';
    window.StylePackWorkspace?.selection(selected,p,connected&&!busy);
    $('outfitPreviewNote').textContent=$('outfitReveal').checked?'停用的所选工具也会展示，仅用于预览。':'按当前工具开关预览。';
    if(state){const message={type:'outfitDraft',choice:input,phase,reveal:$('outfitReveal').checked},signature=JSON.stringify([message,state.revision]);if(signature!==lastSignature){$('outfitPreview').contentWindow?.postMessage(message,location.origin);lastSignature=signature;}}
  }
  $('outfitOptions').addEventListener('change',update);$('outfitReveal').addEventListener('change',update);
  $('outfitPreview').addEventListener('load',()=>{lastSignature='';update();});
  for(const button of document.querySelectorAll('[data-outfit-phase]'))button.addEventListener('click',()=>{phase=button.dataset.outfitPhase;update();});
  for(const button of document.querySelectorAll('[data-outfit-scope]'))button.addEventListener('click',()=>{const scope=button.dataset.outfitScope;for(const e of document.querySelectorAll('[data-outfit-module]'))e.checked=scope==='all'||(scope==='game'?['gameframe','catkeyboard','scoreboard']:['waiting','break','overlay']).includes(e.dataset.outfitModule);update();});
  async function perform(action,data){busy=true;update();try{state=await window.AssistantActions.act(action,data);packs.registerInstalled(state.stylePacks||[],state.outfit?.combinations||[]);if(!packs.presets[selected])selected='anes';buildCards();window.AssistantActions.toast(({outfitApply:'整套外观已应用，等待与暂离同步更换',outfitUndo:'已恢复换装前的外观',outfitSave:'当前搭配已保存',outfitRemove:'已移除保存的搭配'})[action]);}catch(error){window.AssistantActions.toast(error.message);}finally{busy=false;update();}}
  $('outfitApply').addEventListener('click',()=>perform('outfitApply',{choice:choice()}));$('outfitUndo').addEventListener('click',()=>perform('outfitUndo',{}));
  $('outfitSaveCombination').addEventListener('click',()=>perform('outfitSave',{name:$('outfitCombinationName').value}));
  $('outfitRemoveCombination').addEventListener('click',()=>perform('outfitRemove',{id:selected}));
  window.OutfitWorkspace={render(next){state=next;packs.registerInstalled(next.stylePacks||[],next.outfit?.combinations||[]);if(!packs.presets[selected])selected='anes';buildCards();update();},select(id){if(packs.presets[id]){selected=id;lastSignature='';update();}},connection(value){connected=value;update();}};update();
})();
