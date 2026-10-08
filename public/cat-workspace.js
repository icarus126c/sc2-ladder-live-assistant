(()=>{
  const $=id=>document.getElementById(id),fields=['catRallyKey','catRallyHold','catCharacter','catCurve','catView','catKeyboardSide','catX','catY','catWidth','catOpacity','catAccent','catHold','catHints','catLetters','catNumbers','catFunctions','catModifiers','catNavigation','catMouse','catChatGuard'],numbers=new Set(['catX','catY','catWidth','catOpacity','catHold','catRallyHold']);
  const statusText={disabled:'已关闭 · 不读取按键',starting:'正在连接按键助手…',waiting:'等待星际2位于前台',active:'正在响应游戏按键',chat:'聊天保护中 · 按Enter结束或Esc退出',error:'按键连接中断，可点击恢复响应',unsupported:'当前系统暂不支持按键读取'};
  let recording=false,state,dirty=false,demoTimer=null,releaseTimer=null,manual=new Set(),view=location.hash.slice(1)||'tools';
  const customOption=document.createElement('option');customOption.value='custom';customOption.textContent='已安装风格的角色';$('catCharacter').append(customOption);
  const perform=async fn=>{try{await fn();}catch(error){window.AssistantActions.toast(error.message);}};
  const config=()=>Object.fromEntries(fields.map(key=>{const input=$(key);return[key,input.type==='checkbox'?input.checked:numbers.has(key)?Number(input.value):input.value];}));
  function update(){
    $('catDraftStatus').textContent=dirty?'预览草稿 · 尚未应用':'已保存';
    $('catRallySettings').hidden=$('catCharacter').value!=='artanis';$('catRallyDemo').disabled=!$('catRallyKey').value;
    const classic=$('catView').value==='classic';$('catHalfSettings').hidden=classic;
    $('catViewNote').textContent=$('catView').value==='flat'?'纯平面半键盘，不显示角色；按键和鼠标直接亮起。':classic?'原版保留完整键盘和倾斜立体外观。':$('catView').value==='rear'?'侧后方露出侧脸，角色与同一个约30°倾斜的键盘一起展示。':'角色动作与按键展示分开；半边键盘更大、更清楚。';
    for(const button of document.querySelectorAll('[data-cat-view]'))button.setAttribute('aria-pressed',String(button.dataset.catView===$('catView').value));
    if(state)for(const id of ['catDetailPreview','catPositionPreview'])$(id).contentWindow?.postMessage({type:'catDraft',config:config()},location.origin);
  }
  function sendDemo(pressed){for(const id of ['catDetailPreview','catPositionPreview'])$(id).contentWindow?.postMessage({type:'catDemo',pressed},location.origin);}
  function stopDemo(){clearInterval(demoTimer);clearTimeout(releaseTimer);demoTimer=releaseTimer=null;manual.clear();sendDemo([]);$('catDemoStatus').textContent='仅预览 · 不改变直播';}
  function sample(keys){stopDemo();sendDemo(keys);$('catDemoStatus').textContent='演示中 · '+keys.map(key=>key.replace(/Left$|Right$/,'')).join(' + ');releaseTimer=setTimeout(()=>{sendDemo([]);$('catDemoStatus').textContent='仅预览 · 不改变直播';},1200);}
  for(const button of document.querySelectorAll('[data-cat-demo]'))button.addEventListener('click',()=>sample(button.dataset.catDemo.split(',')));
  $('catDemoFast').addEventListener('click',()=>{stopDemo();let index=0;const samples=[['A'],['S'],['D'],['Q'],['W'],['E'],['CtrlLeft','1'],['F2'],['Mouse2']];demoTimer=setInterval(()=>{sendDemo(index%2===0?samples[(Math.floor(index/2))%samples.length]:[]);index++;},100);$('catDemoStatus').textContent='连按演示中 · 角色随频率拍动';});
  $('catDemoStop').addEventListener('click',stopDemo);
  const physical={ControlLeft:'CtrlLeft',ControlRight:'CtrlRight',MetaLeft:'WinLeft',MetaRight:'WinRight',ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right'};
  function keyId(event){return physical[event.code]||event.code.replace(/^Key|^Digit/,'');}
  function stopRecording(){recording=false;$('catRallyRecord').textContent='录制触发键';}
  $('catRallyRecord').addEventListener('click',()=>{recording=!recording;$('catRallyRecord').textContent=recording?'请按一个键 · Esc取消':'录制触发键';});
  $('catRallyClear').addEventListener('click',()=>{stopRecording();$('catRallyKey').value='';dirty=true;update();});
  $('catRallyDemo').addEventListener('click',()=>sample([$('catRallyKey').value]));
  addEventListener('keydown',event=>{if(!recording||view!=='catkeyboard')return;event.preventDefault();event.stopImmediatePropagation();if(event.code==='Escape'){stopRecording();return;}if(event.repeat)return;const id=keyId(event),known=new Set(window.CatKeyboardTemplate.rows.flat().map(([id])=>id).concat(['Insert','Home','PageUp','Delete','End','PageDown','Up','Down','Left','Right']));if(!known.has(id)){window.AssistantActions.toast('这个键暂不支持，请换一个键');return;}$('catRallyKey').value=id;stopRecording();dirty=true;update();},true);
  addEventListener('blur',stopRecording);
  $('catTryKeys').addEventListener('keydown',event=>{if(view!=='catkeyboard')return;event.preventDefault();if(event.repeat)return;clearInterval(demoTimer);demoTimer=null;manual.add(keyId(event));sendDemo([...manual]);$('catDemoStatus').textContent='试按预览 · '+[...manual].map(key=>key.replace(/Left$|Right$/,'')).join(' + ');});
  $('catTryKeys').addEventListener('keyup',event=>{event.preventDefault();manual.delete(keyId(event));sendDemo([...manual]);});
  $('catTryKeys').addEventListener('blur',()=>{if(manual.size)stopDemo();});addEventListener('blur',()=>{if(manual.size)stopDemo();});
  $('catCharacter').addEventListener('change',()=>{const value={cat:'#f2a7d5',vesna:'#8bded4',naiwa:'#c7db71',nahida:'#aedc81',nicole:'#e7cb90',artanis:'#72d9ef'}[$('catCharacter').value];if(value)$('catAccent').value=value;});
  $('catForm').addEventListener('input',()=>{dirty=true;update();});$('catForm').addEventListener('change',()=>{dirty=true;update();});
  for(const button of document.querySelectorAll('[data-cat-view]'))button.addEventListener('click',()=>{$('catView').value=button.dataset.catView;dirty=true;update();});
  $('catForm').addEventListener('submit',event=>{event.preventDefault();perform(async()=>{const next=await window.AssistantActions.act('ladderConfigure',{config:config()});dirty=false;render(next);window.AssistantActions.toast('按键助手设置已应用');});});
  $('catDiscard').addEventListener('click',()=>{dirty=false;if(state)render(state);});
  for(const id of ['homeCatEnabled','catEnabled','previewCatEnabled'])$(id).addEventListener('change',()=>perform(async()=>{const next=await window.AssistantActions.act('ladderConfigure',{config:{catEnabled:$(id).checked}});render(next);window.AssistantActions.toast($(id).checked?(next.ladder.config.catGlobalInput?'按键助手已开启 · 全局响应':'按键助手已开启，切到星际2即可响应'):'按键助手已关闭');}));
  $('catGlobalInput').addEventListener('change',()=>perform(async()=>{const on=$('catGlobalInput').checked;const next=await window.AssistantActions.act('ladderConfigure',{config:{catGlobalInput:on}});render(next);window.AssistantActions.toast(on?'全局按键响应已开启':'已恢复仅星际2前台响应');}));
  $('catResume').addEventListener('click',()=>perform(()=>window.AssistantActions.act('catResume')));
  for(const button of document.querySelectorAll('[data-cat-position]'))button.addEventListener('click',()=>{const positions={right:[1400,320],left:[45,320],bottom:[660,700]},[x,y]=positions[button.dataset.catPosition];$('catX').value=x;$('catY').value=y;dirty=true;update();});
  for(const id of ['catDetailPreview','catPositionPreview'])$(id).addEventListener('load',update);
  function render(next){state=next;const c=next.ladder.config;$('catGlobalInput').checked=c.catGlobalInput===true;const inputStatus=next.keyboard?.status==='active'&&c.catGlobalInput?'正在响应全部窗口按键':statusText[next.keyboard?.status]||statusText.waiting;
    for(const id of ['homeCatEnabled','catEnabled','previewCatEnabled'])$(id).checked=c.catEnabled===true;$('catToolState').textContent=c.catEnabled?'已启用':'未启用';
    $('catInputStatus').textContent=inputStatus;$('previewCatStatus').textContent=!c.enabled?'已暂停 · 直播工具总开关关闭':inputStatus;
    if(!dirty)for(const key of fields){const input=$(key);if(input.type==='checkbox')input.checked=c[key];else input.value=c[key];}
    $('catSourceURL').value=location.origin+'/cat-keyboard';update();
  }
  function connection(connected){for(const id of ['homeCatEnabled','catEnabled','previewCatEnabled','catApply','catResume','catGlobalInput'])$(id).disabled=!connected;for(const key of fields)$(key).disabled=!state;for(const b of document.querySelectorAll('[data-cat-view],[data-cat-position]'))b.disabled=!state;}
  window.CatWorkspace={render,connection,route(next){view=next;if(view!=='catkeyboard'){stopDemo();stopRecording();}}};connection(false);
})();
