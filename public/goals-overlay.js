(()=>{const root=document.getElementById('goalsWidget');if(!root)return;let signature='';window.GoalsOverlay={render(s,options={}){
 const c=s.ladder.config,rows=options.sample?window.GoalsModel.demo:s.ladder.goals||[],allowed=options.reveal||c.enabled&&c.goalsEnabled&&window.SceneCustomization.allowed(c,s.scene,'Goals',false);
 root.hidden=!allowed||!rows.length;if(root.hidden)return;
 root.style.left=(options.reveal?24:c.goalsX)+'px';root.style.top=(options.reveal?24:c.goalsY)+'px';root.style.width=c.goalsWidth+'px';root.style.setProperty('--goal-alpha',c.goalsOpacity/100);root.style.setProperty('--goal-accent',c.gameFrameAccent||'#90caa2');
 const key=JSON.stringify([rows,s.ladder.date,options.sample]);if(key===signature)return;signature=key;root.replaceChildren();
 const title=document.createElement('h3');title.textContent=(options.sample?'示例 · ':'')+'目标挑战';root.append(title);
 for(const scope of ['today','session']){const group=rows.filter(r=>(r.scope||'today')===scope);if(!group.length)continue;const heading=document.createElement('h4');heading.textContent=scope==='session'?'本次直播目标':'今日目标';root.append(heading);
  for(const r of group){const box=document.createElement('div');box.className='goal-live-row';box.dataset.complete=String(r.complete);const line=document.createElement('div');line.className='goal-live-title';const name=document.createElement('span'),value=document.createElement('b');name.textContent=r.label;value.textContent=r.complete?'达成 ✓':(r.valueText??r.value)+' / '+r.target;line.append(name,value);const progress=document.createElement('progress');progress.max=r.target;progress.value=Math.min(r.value??0,r.target);box.append(line,progress);if(r.pending||r.partial){const note=document.createElement('small');note.textContent=r.note;box.append(note);}root.append(box);}
 }
 const note=document.createElement('small');note.textContent=options.sample?'示例数据 · 不计入战绩':s.ladder.date+' · 当前账号';root.append(note);
 }};})();
