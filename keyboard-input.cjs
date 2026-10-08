const path=require('node:path'),{spawn}=require('node:child_process');
const modifiers=['CtrlLeft','CtrlRight','ShiftLeft','ShiftRight','AltLeft','AltRight','WinLeft','WinRight'];
const keyList=[...modifiers,...Array.from({length:26},(_,n)=>String.fromCharCode(65+n)),...Array.from({length:10},(_,n)=>String(n)),...Array.from({length:12},(_,n)=>'F'+(n+1)),'Space','Tab','Enter','Escape','Backspace','CapsLock','Insert','Delete','Home','End','PageUp','PageDown','Backquote','Minus','Equal','BracketLeft','BracketRight','Backslash','Semicolon','Quote','Comma','Period','Slash','Up','Down','Left','Right','Mouse1','Mouse2'];
const allowed=new Set(keyList);
function filteredKeys(keys,c){return keyList.filter(key=>keys.includes(key)&&((c.catCharacter==='artanis'&&key===c.catRallyKey)||(
  /^[A-Z]$/.test(key)?c.catLetters!==false:/^\d$/.test(key)?c.catNumbers!==false:/^F\d+$/.test(key)?c.catFunctions!==false:
  /^Mouse/.test(key)?c.catMouse===true:modifiers.includes(key)?c.catModifiers!==false:c.catNavigation!==false)));}
function createKeyboardInput({getConfig,onUpdate=()=>{},spawnWorker=spawn,now=Date.now}={}){
  let child=null,generation=0,signature='',closed=false,lastMessage=0,sequence=0;
  let frame={status:'disabled',pressed:[],sequence:0,at:now()};
  const snapshot=()=>({...frame,pressed:[...frame.pressed]});
  function publish(status,pressed=[],force=false){
    if(!force&&frame.status===status&&JSON.stringify(frame.pressed)===JSON.stringify(pressed))return;
    frame={status,pressed,sequence:++sequence,at:now()};onUpdate(snapshot());
  }
  function stop(){generation++;if(child){const previous=child;child=null;previous.kill();}}
  function configure({reset=false}={}){
    if(closed)return;const c=getConfig(),next=JSON.stringify([c.enabled!==false,c.catEnabled===true,c.catChatGuard!==false]);
    if(next===signature&&!reset){if(child)publish(frame.status,filteredKeys(frame.pressed,c));return;}
    signature=next;stop();if(c.enabled===false||c.catEnabled!==true){publish('disabled');return;}
    const epoch=generation;publish('starting');let buffer='';lastMessage=now();
    try{
      child=spawnWorker(require('./runtime-paths.cjs').python(),['-X','utf8',path.join(__dirname,'capture-keyboard.py'),'--parent-pid',String(process.pid),...(c.catChatGuard===false?['--no-chat-guard']:[])],{windowsHide:true,stdio:['ignore','pipe','pipe']});
      const worker=child;worker.stdout.setEncoding('utf8');worker.stdout.on('data',text=>{
        if(epoch!==generation||closed)return;buffer+=text;if(buffer.length>8192){stop();publish('error');return;}
        let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{
          const value=JSON.parse(line);if(!['waiting','active','chat','unsupported','error'].includes(value.status)||!Array.isArray(value.pressed))throw Error('Invalid input frame');
          lastMessage=now();const keys=value.status==='active'?value.pressed.filter(key=>typeof key==='string'&&allowed.has(key)):[];
          publish(value.status,filteredKeys(keys,getConfig()));
        }catch{stop();publish('error');return;}}
      });
      // Drain diagnostics without storing or relaying any input content.
      worker.stderr.on('data',()=>{});
      worker.on('error',()=>{if(epoch===generation){child=null;publish('error');}});
      worker.on('close',()=>{if(epoch===generation&&!closed){child=null;publish('error');}});
    }catch{child=null;publish('error');}
  }
  const watchdog=setInterval(()=>{if(child&&now()-lastMessage>2500){stop();publish('error');}},1000);watchdog.unref();
  return{configure,snapshot,close(){closed=true;stop();clearInterval(watchdog);}};
}
module.exports={createKeyboardInput,filteredKeys,keyList};
