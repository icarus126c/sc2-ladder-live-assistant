(()=>{
 const $=id=>document.getElementById(id);let selected='anes',preset=null,connected=false,busy=false;
 const status=$('stylePackStatus'),roles={cover:'封面（可选）',frame:'游戏边框（1920×1080 透明PNG）',assistantFront:'角色正面三态图（1536×512 透明PNG）',assistantRear:'角色侧后方三态图（1536×512 透明PNG）',waiting:'等待背景（1920×1080 PNG）',away:'暂离背景（1920×1080 PNG）'};
 for(const [role,label]of Object.entries(roles)){const field=document.createElement('label');field.textContent=label;const input=document.createElement('input');input.type='file';input.accept='image/png';input.dataset.styleAsset=role;field.append(input);$('stylePackAssets').append(field);}
 function message(s,error=false){status.textContent=s;status.classList.toggle('is-error',error);}
 function update(){$('stylePackInstall').disabled=!connected||busy;$('stylePackExport').disabled=!connected||busy||!preset?.installed;$('stylePackRemove').disabled=!connected||busy||!preset?.installed;$('stylePackBuildInstall').disabled=!connected||busy;}
 function save(pack){const url=URL.createObjectURL(new Blob([JSON.stringify(pack,null,2)],{type:'application/json;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=pack.id+'.sc2style.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function install(file){if(file.size>32*1024*1024)throw Error('风格包请控制在32MB以内');const response=await window.AssistantActions.request('/api/style-pack-install',{method:'POST',headers:{'Content-Type':'application/json'},body:file}),data=await response.json();if(!response.ok)throw Error(data.error||'安装失败');window.OutfitWorkspace.render(data.state);window.OutfitWorkspace.select(data.pack.id);message('已安装“'+data.pack.name+'”，当前直播外观未改变。可切换三个画面预览，再点击应用。');}
 async function perform(fn){busy=true;update();try{await fn();}catch(e){message(e.message,true);}finally{busy=false;update();}}
 $('stylePackInstall').addEventListener('click',()=>perform(async()=>{const f=$('stylePackFile').files[0];if(!f)throw Error('先选择.sc2style.json文件');await install(f);}));
 $('stylePackExport').addEventListener('click',()=>perform(async()=>{const r=await window.AssistantActions.request('/api/style-pack-export?id='+encodeURIComponent(selected)),v=await r.json();if(!r.ok)throw Error(v.error);save(v);message('风格包已导出，可分享给其他人安装。');}));
 $('stylePackRemove').addEventListener('click',()=>perform(async()=>{await window.AssistantActions.act('stylePackRemove',{id:selected});message('已从风格库移出；已应用的图片外观继续保留，也可选择内置风格替换。');}));
 const dataURL=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('素材读取失败'));reader.readAsDataURL(file);});
 async function build(){
  const id=$('stylePackId').value.trim(),name=$('stylePackName').value.trim();if(!/^[a-z][a-z0-9-]{2,47}$/.test(id)||id.startsWith('user-'))throw Error('ID需为3～48位小写字母、数字或短横线，以字母开头');if(!name||name.length>40)throw Error('填写40字以内的风格名称');
  const pack={format:'sc2-style-pack',version:1,id,name,note:$('stylePackNote').value.trim(),base:$('stylePackBase').value,palette:Object.fromEntries(['dark','mid','accent','text'].map(k=>[k,$('stylePack-'+k).value])),templates:{score:$('stylePackScore').value,hud:$('stylePackHUD').value},assets:{}};
  for(const input of document.querySelectorAll('[data-style-asset]')){const f=input.files[0];if(f){if(!/\.png$/i.test(f.name)||f.size>8*1024*1024)throw Error('请选择8MB以内的PNG素材');pack.assets[input.dataset.styleAsset]=await dataURL(f);}}
  if(new Blob([JSON.stringify(pack)]).size>32*1024*1024)throw Error('素材合计过大，请压缩后再制作');return pack;
 }
 $('stylePackBuild').addEventListener('click',()=>perform(async()=>{save(await build());message('已生成一个风格包文件。安装时会检查图片尺寸与透明区域。');}));
 $('stylePackBuildInstall').addEventListener('click',()=>perform(async()=>{await install(new Blob([JSON.stringify(await build())],{type:'application/json'}));}));
 window.StylePackWorkspace={selection(id,p,isConnected){selected=id;preset=p;connected=isConnected;$('stylePackSelected').textContent=p?.installed?'已选外部风格：'+p.name:'选中的是内置风格。外部风格安装后可导出或移出列表。';update();}};update();
})();
