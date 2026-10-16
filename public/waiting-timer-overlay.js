(()=>{const root=document.getElementById('waitingTimerWidget');if(!root)return;const M=window.WaitingTimer;let state,sample=false,serverAt=0,receivedAt=0,active=false;
 const clock=()=>performance.now();
 function tick(){if(!state||root.hidden)return;document.getElementById('waitingTimerValue').textContent=M.format(sample?42:active?M.seconds(state,serverAt+(clock()-receivedAt)):0);}
 window.WaitingTimerOverlay={render(next,options={}){state=next;const c=next.ladder.config;root.hidden=!c.enabled||next.scene!=='intermission'||c.waitingShowTimer!==true;serverAt=Number.isFinite(next.serverNow)?next.serverNow:Date.now();receivedAt=clock();active=(options.actualScene??next.scene)==='intermission';sample=options.preview===true&&!active;if(root.hidden)return;
  Object.assign(root.style,{left:c.waitingTimerX+'px',top:c.waitingTimerY+'px',width:c.waitingTimerWidth+'px',fontSize:(c.waitingTimerWidth/340*48)+'px'});root.style.setProperty('--timer-accent',c.waitingAccent||'#83c5b6');root.style.setProperty('--timer-alpha',(c.waitingTimerOpacity??80)/100);document.getElementById('waitingTimerTitle').textContent=c.waitingTimerTitle||'已等待';document.getElementById('waitingTimerSample').hidden=!sample;tick();
 }};setInterval(tick,250);
})();
