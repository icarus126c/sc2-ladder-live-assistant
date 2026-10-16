(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WaitingTimer=factory();})(typeof window==='object'?window:this,()=>{
 const defaults={waitingTimerX:1480,waitingTimerY:70,waitingTimerWidth:340,waitingTimerOpacity:80,waitingTimerTitle:'已等待'};
 function sanitize(input,base){const c={...base};for(const [key,min,max]of [['waitingTimerX',0,1800],['waitingTimerY',0,1000],['waitingTimerWidth',200,700],['waitingTimerOpacity',0,100]])if(key in input){if(!Number.isInteger(input[key])||input[key]<min||input[key]>max)throw Error('等待计时器的位置或外观超出范围');c[key]=input[key];}if('waitingTimerTitle'in input){if(typeof input.waitingTimerTitle!=='string'||[...input.waitingTimerTitle].length>24||/[\r\n\0]/.test(input.waitingTimerTitle))throw Error('计时器标题最多24字，不能换行');c.waitingTimerTitle=input.waitingTimerTitle.trim();}return c;}
 function seconds(state,now){if(state?.scene!=='intermission'||!Number.isFinite(state.sceneEnteredAt)||!Number.isFinite(now))return 0;return Math.max(0,Math.floor((now-state.sceneEnteredAt)/1000));}
 function format(seconds){const n=Math.max(0,Math.floor(Number(seconds)||0)),h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;return(h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
 return{defaults,sanitize,seconds,format};
});
