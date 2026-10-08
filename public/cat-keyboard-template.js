(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CatKeyboardTemplate=factory();})(typeof window==='object'?window:this,()=>{
  const labels={Escape:'Esc',Backquote:'`',Minus:'−',Equal:'=',Backspace:'Back',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',CapsLock:'Caps',CtrlLeft:'Ctrl',CtrlRight:'Ctrl',ShiftLeft:'Shift',ShiftRight:'Shift',AltLeft:'Alt',AltRight:'Alt',WinLeft:'Win',WinRight:'Win',PageUp:'PgUp',PageDown:'PgDn',Insert:'Ins',Delete:'Del',Space:'Space',Up:'↑',Down:'↓',Left:'←',Right:'→',Mouse1:'左键',Mouse2:'右键'};
  const rows=[
    [['Escape',1.1],['F1'],['F2'],['F3'],['F4'],['F5'],['F6'],['F7'],['F8'],['F9'],['F10'],['F11'],['F12']],
    [['Backquote'],['1'],['2'],['3'],['4'],['5'],['6'],['7'],['8'],['9'],['0'],['Minus'],['Equal'],['Backspace',1.8]],
    [['Tab',1.5],['Q'],['W'],['E'],['R'],['T'],['Y'],['U'],['I'],['O'],['P'],['BracketLeft'],['BracketRight'],['Backslash',1.3]],
    [['CapsLock',1.7],['A'],['S'],['D'],['F'],['G'],['H'],['J'],['K'],['L'],['Semicolon'],['Quote'],['Enter',2.1]],
    [['ShiftLeft',2.1],['Z'],['X'],['C'],['V'],['B'],['N'],['M'],['Comma'],['Period'],['Slash'],['ShiftRight',2.7]],
    [['CtrlLeft',1.25],['WinLeft',1.25],['AltLeft',1.25],['Space',5.3],['AltRight',1.25],['WinRight',1.25],['CtrlRight',1.25]]
  ];
  const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
  const selected=(key,c)=>/^[A-Z]$/.test(key)?c.catLetters!==false:/^\d$/.test(key)?c.catNumbers!==false:/^F\d+$/.test(key)?c.catFunctions!==false:/^Mouse/.test(key)?c.catMouse!==false:/^(Ctrl|Shift|Alt|Win)/.test(key)?c.catModifiers!==false:c.catNavigation!==false;
  const key=(id,width=1)=>`<span class="cat-key" data-cat-key="${id}" style="--key-width:${width}">${escape(labels[id]||id)}</span>`;
  const halfRows={
    left:[
      [['Escape'],['F1'],['F2'],['F3'],['F4'],['F5'],['F6']],
      [['Backquote'],['1'],['2'],['3'],['4'],['5']],
      [['Tab',1.3],['Q'],['W'],['E'],['R'],['T']],
      [['CapsLock',1.3],['A'],['S'],['D'],['F'],['G']],
      [['ShiftLeft',1.5],['Z'],['X'],['C'],['V'],['B']],
      [['CtrlLeft',1.2],['WinLeft',1.2],['AltLeft',1.2],['Space',3.3]]
    ],
    right:[
      [['F7'],['F8'],['F9'],['F10'],['F11'],['F12']],
      [['6'],['7'],['8'],['9'],['0'],['Minus'],['Equal'],['Backspace',1.5]],
      [['Y'],['U'],['I'],['O'],['P'],['BracketLeft'],['BracketRight'],['Backslash']],
      [['H'],['J'],['K'],['L'],['Semicolon'],['Quote'],['Enter',1.8]],
      [['N'],['M'],['Comma'],['Period'],['Slash'],['ShiftRight',2.5]],
      [['Space',2.8],['AltRight',1.2],['WinRight',1.2],['CtrlRight',1.2]]
    ]
  };
  const renderRows=value=>value.map(row=>`<div class="cat-key-row">${row.map(([id,w])=>key(id,w)).join('')}</div>`).join('');
  const navigation=()=>`<div class="cat-navigation"><div class="cat-navigation-grid">${['Insert','Home','PageUp','Delete','End','PageDown'].map(id=>key(id)).join('')}</div><div class="cat-arrows"><span></span>${key('Up')}<span></span>${['Left','Down','Right'].map(id=>key(id)).join('')}</div></div>`;
  const mouse=()=>`<div class="cat-mouse"><span data-cat-key="Mouse1">L</span><span data-cat-key="Mouse2">R</span><i></i></div>`;
  const caption=()=>`<div class="cat-caption" aria-live="off"><b class="cat-combo">准备好啦</b><small class="cat-rhythm">喵 · 等待按键</small></div>`;
  function buildBase(c={}){
    c={catView:'rear',...c};
    if(c.catView==='classic')return `<div class="cat-stage cat-classic"><div class="cat-avatar" role="img" aria-label="敲键盘的猫娘" data-pose="0"></div><div class="cat-board-angle"><div class="cat-board"><div class="cat-main-keys">${renderRows(rows)}</div>${navigation()}</div>${mouse()}</div>${caption()}<div class="cat-spark cat-spark-left">✧</div><div class="cat-spark cat-spark-right">✦</div></div>`;
    const side=c.catKeyboardSide==='right'?'right':'left';
    if(c.catView==='flat')return `<div class="cat-stage cat-split cat-flat" data-keyboard-side="${side}"><div class="cat-keyboard-view"><span class="cat-side-label">${side==='right'?'右半键盘':'左半键盘'}</span><div class="cat-board-angle"><div class="cat-board"><div class="cat-main-keys">${renderRows(halfRows[side])}</div>${side==='right'?navigation():''}</div>${mouse()}</div></div>${caption()}</div>`;
    if(c.catView==='rear')return `<div class="cat-stage cat-split cat-rear" data-keyboard-side="${side}"><div class="cat-keyboard-view"><span class="cat-side-label">${side==='right'?'右半键盘':'左半键盘'}</span><div class="cat-board-angle"><div class="cat-board"><div class="cat-main-keys">${renderRows(halfRows[side])}</div>${side==='right'?navigation():''}</div>${mouse()}</div></div><div class="cat-avatar" role="img" aria-label="侧后方镜头下露出侧脸的猫娘敲键盘" data-pose="0"></div>${caption()}</div>`;
    // The character's unlabeled keyboard faces her; the adjacent key map faces viewers.
    const touchboard=`<div class="cat-touchboard" aria-hidden="true">${[0,1,2].map(()=>'<div>'+Array(9).fill('<i></i>').join('')+'</div>').join('')}<div class="cat-touchboard-bottom"><i></i><i class="cat-touchboard-space"></i><i></i></div></div>`;
    return `<div class="cat-stage cat-split" data-keyboard-side="${side}"><div class="cat-character-view"><div class="cat-avatar" role="img" aria-label="猫娘面对自己的键盘拍键" data-pose="0"></div>${touchboard}</div><div class="cat-keyboard-view"><span class="cat-side-label">${side==='right'?'右半键盘':'左半键盘'}</span><div class="cat-board-angle"><div class="cat-board"><div class="cat-main-keys">${renderRows(halfRows[side])}</div>${side==='right'?navigation():''}</div>${mouse()}</div></div>${caption()}</div>`;
  }
  function build(c={}){const character=['cat','vesna','naiwa','nahida','nicole','artanis','custom'].includes(c.catCharacter)?c.catCharacter:'cat',name={cat:'猫娘',vesna:'薇斯纳',naiwa:'奶蛙',nahida:'纳西妲',nicole:'尼可',artanis:'大主教',custom:'自定义角色'}[character],idle=character==='cat'?'喵 · 等待按键':character==='naiwa'?'呱 · 等待按键':'等待按键';return (buildBase(c)+(character==='artanis'&&c.catView!=='flat'?'<div class="cat-rally-callout" aria-hidden="true">集结部队</div>':'')).replace('class="cat-stage ','class="cat-stage cat-character-'+character+(c.catCurve!==false&&c.catView!=='flat'?' cat-curved':'')+' ').replaceAll('猫娘',name).replaceAll('喵 · 等待按键',idle);}
  function createModel({now=Date.now}={}){
    let down=new Set(),glow=new Map(),taps=[],lastTap=-Infinity,lastSequence=-1,parity=0,status='waiting',rawDown=new Set(),rallyUntil=-Infinity,rallyBinding='',rallyHeld=false;
    const validKeys=new Set([...rows.flat().map(([id])=>id),'Insert','Home','PageUp','Delete','End','PageDown','Up','Down','Left','Right','Mouse1','Mouse2']);
    function binding(c){return c.catCharacter==='artanis'&&validKeys.has(c.catRallyKey)?c.catRallyKey:'';}
    function syncBinding(c){const next=binding(c);if(next!==rallyBinding){rallyBinding=next;rallyUntil=-Infinity;rallyHeld=false;}}
    function ingest(frame,c={}){
      syncBinding(c);if(!frame||frame.sequence===lastSequence)return;lastSequence=frame.sequence;status=frame.status;
      if(status!=='active'){down.clear();glow.clear();taps=[];lastTap=-Infinity;rawDown.clear();rallyUntil=-Infinity;rallyHeld=false;return;}
      const at=now(),raw=new Set((frame.pressed||[]).filter(k=>validKeys.has(k)));
      if(rallyBinding&&raw.has(rallyBinding)&&!rawDown.has(rallyBinding)){rallyUntil=at+(c.catRallyHold??1000);rallyHeld=true;}
      if(rallyHeld&&!raw.has(rallyBinding)){rallyUntil=Math.max(rallyUntil,at+(c.catRallyHold??1000));rallyHeld=false;}rawDown=raw;
      const current=new Set((frame.pressed||[]).filter(k=>selected(k,c)&&(rows.some(row=>row.some(([id])=>id===k))||['Insert','Home','PageUp','Delete','End','PageDown','Up','Down','Left','Right','Mouse1','Mouse2'].includes(k))));
      const fresh=[...current].filter(k=>!down.has(k));
      taps=taps.filter(t=>at-t<1000);
      if(fresh.length){taps.push(at);lastTap=at;parity=1-parity;}
      for(const k of current)glow.set(k,at+(c.catHold??300));down=current;
    }
    function snapshot(c={}){
      syncBinding(c);const at=now();taps=taps.filter(t=>at-t<1000);for(const [key,expires]of glow)if(expires<=at&&!down.has(key))glow.delete(key);
      const rate=taps.length,age=at-lastTap,active=age<Math.max(160,Math.min(420,1000/Math.max(1,rate)));
      const pose=active?(rate>3?1+(Math.floor(age/Math.max(65,180-rate*8))%2):(parity?1:2)):0;
      const pressed=[...glow.keys()].filter(k=>selected(k,c));const current=[...down].filter(k=>selected(k,c));const raw=current.length?current:pressed;const combo=[...new Set(raw.map(k=>labels[k]||k))].slice(0,6).join(' + ');
      return{rally:!!rallyBinding&&c.catView!=='flat'&&status==='active'&&(rallyHeld||at<rallyUntil),pressed,pose,rate,status,combo:combo||'准备好啦',active};
    }
    return{ingest,snapshot};
  }
  return{build,createModel,rows,halfRows,labels};
});
