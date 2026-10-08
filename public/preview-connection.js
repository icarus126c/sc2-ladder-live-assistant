(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PreviewConnection=factory();})(typeof window==='object'?window:this,()=>{
 // Embedded previews receive the control page's state. Only standalone sources
 // keep an EventSource, leaving HTTP/1 connection slots available for artwork.
 function create({onState,preview=false,scope=window,EventSourceImpl=EventSource,setTimeoutImpl=setTimeout,clearTimeoutImpl=clearTimeout}={}){
  let closed=false,last=null,retry=null,events=null;
  function deliver(state){if(!state?.ladder?.config)return;if(last?.serverInstanceId===state.serverInstanceId&&Number.isInteger(state.revision)&&Number.isInteger(last.revision)&&state.revision<last.revision)return;last=state;onState(state);}
  const embedded=preview&&scope.parent!==scope;
  const receive=event=>{if(closed||event.source!==scope.parent||event.origin!==scope.location.origin||event.data?.type!=='previewState')return;clearTimeoutImpl(retry);retry=null;deliver(event.data.state);};
  function ready(){if(closed||last)return;scope.parent.postMessage({type:'previewReady'},scope.location.origin);retry=setTimeoutImpl(ready,1000);}
  function close(){if(closed)return;closed=true;clearTimeoutImpl(retry);events?.close();scope.removeEventListener('message',receive);scope.removeEventListener('pagehide',close);}
  if(embedded){scope.addEventListener('message',receive);ready();}
  else{events=new EventSourceImpl('/api/events?role='+(preview?'preview':'output'));events.onmessage=event=>{if(!closed)try{deliver(JSON.parse(event.data));}catch{}};}
  scope.addEventListener('pagehide',close);return{close,embedded};
 }
 function attachHost({getState,scope=window,documentImpl=document}={}){
  const paths=new Set(['/output','/cat-keyboard','/gameframe','/resource-template','/scoreboard','/live-interaction']);
  function eligible(frame){if(frame.closest('[data-view]')?.hidden)return false;try{const u=new URL(frame.getAttribute('src'),scope.location.href);return u.origin===scope.location.origin&&paths.has(u.pathname)&&u.searchParams.get('preview')==='1';}catch{return false;}}
  function send(frame,state){if(state&&eligible(frame))frame.contentWindow?.postMessage({type:'previewState',state},scope.location.origin);}
  const receive=event=>{if(event.origin!==scope.location.origin||event.data?.type!=='previewReady')return;for(const frame of documentImpl.querySelectorAll('iframe[data-src]'))if(frame.contentWindow===event.source){send(frame,getState());break;}};
  scope.addEventListener('message',receive);
  return{publish(state){for(const frame of documentImpl.querySelectorAll('iframe[data-src]'))send(frame,state);},close(){scope.removeEventListener('message',receive);}};
 }
 return{create,attachHost};
});
