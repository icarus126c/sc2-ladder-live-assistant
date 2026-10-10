(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.LuxuryConsole=factory();})(typeof window==='object'?window:this,()=>{
  // Keep rigid chassis away from HUD text. Rich decorative artwork uses only
  // the minimap and skill windows, so heads and organic silhouettes stay whole.
  const protectedAreas=[
    {name:'army-buttons',x:0,y:739,w:163,h:67},
    {name:'clock',x:254,y:770,w:72,h:39},
    {name:'minimap',x:12,y:809,w:283,h:260},
    {name:'control-groups',x:365,y:787,w:1007,h:74},
    {name:'unit-silhouette-and-vitals',x:600,y:885,w:181,h:187},
    {name:'unit-name-and-upgrades',x:830,y:885,w:280,h:187},
    {name:'command-card',x:1533,y:840,w:375,h:231}
  ];
  const styles={
    'nahida-luxury':{name:'纳西妲 · 豪华叶宫',accent:'#b9db84',base:'#294e37',light:'#eef3d5',character:[1068,660,308,410],portrait:[1375,705,136,365],pillar:[712,787,51,282]},
    'vesna-luxury':{name:'薇斯纳 · 豪华霜剑',accent:'#a4e2df',base:'#2f6575',light:'#eaf6f4',character:[1110,710,375,365],portrait:[1430,690,125,375],pillar:[820,821,61,245]},
    'nicole-luxury':{name:'妮可 · 豪华星谕',accent:'#d6ccf6',base:'#4a507b',light:'#f2ecfa',character:[1130,807,269,261],portrait:[1403,809,123,255],pillar:[710,850,34,214]}
  };
  const naturalAreas=protectedAreas.filter(a=>['minimap','command-card'].includes(a.name));
  const assetFiles=Object.fromEntries(Object.keys(styles).map(k=>[k,k.replace('-luxury','')+'-console-luxury-v1.png']));
  const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  // These windows follow the user's red / green / blue annotation. Keep
  // the green cores fixed in game coordinates even when artwork moves.
  const greenAreas=[
    ...protectedAreas.filter(a=>['army-buttons','clock','minimap','unit-silhouette-and-vitals'].includes(a.name)),
    {name:'control-groups',x:520,y:825,w:73,h:49},
    {name:'unit-name-and-upgrades',x:875,y:884,w:152,h:33},
    {name:'upgrade-icons-and-values',x:882,y:976,w:144,h:67},
    {name:'unit-type-caption',x:872,y:1041,w:169,h:29},
    {name:'command-card',x:1538,y:845,w:143,h:73},
    {name:'command-move',x:1840,y:916,w:65,h:70},
    {name:'command-bottom-icons',x:1538,y:987,w:220,h:72},
    {name:'command-cancel',x:1840,y:990,w:65,h:70}
  ];
  const blueAreas=[{name:'信息区过渡',x:595,y:881,w:520,h:195},{name:'技能区过渡',x:1533,y:840,w:375,h:231}];
  const redAreas=[{name:'左侧装饰',x:367,y:879,w:228,h:201},{name:'角色与头像',x:1115,y:879,w:418,h:201}];
  function build(c,options={}){return c.gameFrameCoverage==='safe'?buildSafe(c,options):buildUnified(c,options);}
  function buildUnified(c,{assets={}}={}){
    const key=c.gameFrameStyle,t=styles[key];if(!t)return '';
    const id='luxury-'+key,accent=/^#[a-f\d]{6}$/i.test(c.gameFrameAccent||'')?c.gameFrameAccent:t.accent;
    const n=(k,d,min,max)=>Number.isFinite(c[k])?Math.max(min,Math.min(max,c[k])):d,on=k=>c['gameFrame'+k]!==false;
    const asset=assets[key]||'/assets/'+assetFiles[key],alpha=n('gameFrameOpacity',90,20,100)/100;
    const transform=`translate(${n('gameFrameX',0,-120,120)} ${n('gameFrameY',0,-80,60)}) translate(960 1080) scale(${n('gameFrameScale',100,70,115)/100}) translate(-960 -1080)`;
    const windows=greenAreas.map(a=>`<rect data-protected="${a.name}" x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="black"/>`).join('');
    const disabled=[['Minimap',0,600,367,480],['Selection',367,600,1009,480],['Portrait',1376,600,157,480],['Commands',1533,600,387,480]].filter(([k])=>!on(k)).map(([,x,y,w,h])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="black"/>`).join('');
    const [sx,sy,sw,sh]=t.character,layout=key==='nahida-luxury'?[1108,685,286,391]:key==='vesna-luxury'?[1098,733,314,343]:[1106,736,295,340],scale=n('gameFrameDecorationScale',100,50,140)/100;
    const motif=key==='nahida-luxury'?'<path d="M20 47Q1 20 31 12Q48 31 20 47ZM20 47 31 12M59 67Q38 46 69 37Q86 55 59 67Z"/>':key==='vesna-luxury'?'<path d="M24 8 37 30 24 52 11 30ZM24 8V52M11 30H37M60 62H84M72 50V74"/>':'<circle cx="28" cy="30" r="20"/><ellipse cx="28" cy="30" rx="28" ry="8" transform="rotate(-25 28 30)"/><path d="M72 49V75M59 62H85"/>';
    const softWindows=greenAreas.map(a=>`<rect x="${a.x-6}" y="${a.y-6}" width="${a.w+12}" height="${a.h+12}" fill="black"/>`).join('');
    const defs=`<defs>${on('Decorations')&&['Minimap','Selection','Portrait','Commands'].some(on)?`<image id="${id}-art" href="${escape(asset)}" width="1920" height="1080" preserveAspectRatio="none"/>`:''}<filter id="${id}-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter><mask id="${id}-safety" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080" style="mask-type:luminance"><rect width="1920" height="1080" fill="white"/><g filter="url(#${id}-blur)">${softWindows}</g>${windows}${disabled}</mask><mask id="${id}-natural" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080" style="mask-type:luminance"><rect width="1920" height="1080" fill="white"/><g filter="url(#${id}-blur)">${softWindows}</g>${windows}${disabled}</mask><mask id="${id}-blue" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080" style="mask-type:luminance"><rect width="1920" height="1080" fill="white"/><g filter="url(#${id}-blur)">${blueAreas.map(a=>`<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="#333333"/>`).join('')}</g>${blueAreas.map(a=>`<rect data-zone="blue" x="${a.x+12}" y="${a.y+12}" width="${a.w-24}" height="${a.h-24}" rx="24" fill="#333333"/>`).join('')}</mask><mask id="${id}-base-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080" style="mask-type:luminance"><rect width="1920" height="1080" fill="white"/><rect x="${sx-8}" y="${sy-8}" width="${sw+16}" height="${sh+16}" rx="36" fill="black"/></mask><linearGradient id="${id}-char-feather" gradientUnits="userSpaceOnUse" x1="${sx}" y1="0" x2="${sx+sw}" y2="0"><stop stop-color="white" stop-opacity="0"/><stop offset=".12" stop-color="white"/><stop offset=".88" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><mask id="${id}-char" maskUnits="userSpaceOnUse" x="${sx}" y="${sy}" width="${sw}" height="${sh}" style="mask-type:alpha"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="url(#${id}-char-feather)"/></mask><linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${t.base}" stop-opacity=".15"/><stop offset=".3" stop-color="${accent}" stop-opacity=".5"/><stop offset=".7" stop-color="${accent}" stop-opacity=".5"/><stop offset="1" stop-color="${t.base}" stop-opacity=".15"/></linearGradient><pattern id="${id}-pattern" width="96" height="80" patternUnits="userSpaceOnUse"><g fill="none" stroke="${t.light}" stroke-width="1.4">${motif}</g></pattern></defs>`;
    let parts='',free='';
    if(on('Decorations')&&['Minimap','Selection','Portrait','Commands'].some(on)){
      // Preserve the original continuous illustration instead of splitting it
      // into rectangular pillars. Reposition only the character for readability.
      parts+=`<svg data-decoration="continuous-architecture" x="0" y="714" width="1920" height="366" viewBox="0 530 1920 550" preserveAspectRatio="none" overflow="hidden"><g mask="url(#${id}-base-cut)"><use href="#${id}-art"/></g></svg>`;
      if(on('Selection')){parts+=`<g data-decoration="translucent-pattern"><path d="M367 881H1376V1076H367Z" fill="url(#${id}-glass)" opacity=".55"/><path d="M367 881H1376V1076H367Z" fill="url(#${id}-pattern)" opacity=".36"/><path d="M384 966Q570 867 817 959T1350 959M384 1001Q570 902 817 994T1350 994" fill="none" stroke="${accent}" stroke-opacity=".2" stroke-width="2"/></g>`;free+=`<g transform="translate(1245 1076) scale(${scale}) translate(-1245 -1076)"><svg data-decoration="character" x="${layout[0]}" y="${layout[1]}" width="${layout[2]}" height="${layout[3]}" viewBox="${t.character.join(' ')}" preserveAspectRatio="xMidYMax meet" overflow="hidden"><g mask="url(#${id}-char)"><use href="#${id}-art"/></g></svg></g>${ornaments(key,accent,t.light)}`;}
      if(on('Commands'))parts+=`<g data-decoration="command-glass"><rect x="1533" y="840" width="375" height="231" fill="url(#${id}-pattern)" opacity=".13"/></g>`;
    }else{
      if(on('Minimap'))parts+='<rect data-panel="minimap" x="6" y="804" width="295" height="269" rx="9" fill="none" stroke="'+accent+'" stroke-width="3"/>';
      if(on('Selection'))parts+='<path data-panel="selection" d="M367 873H1376M367 1076H1376" stroke="'+accent+'" stroke-width="3"/>';
      if(on('Portrait'))parts+='<path data-panel="portrait" d="M1380 874V1073H1521V874" fill="none" stroke="'+accent+'" stroke-width="3"/>';
      if(on('Commands'))parts+='<rect data-panel="commands" x="1527" y="834" width="386" height="241" rx="9" fill="none" stroke="'+accent+'" stroke-width="3"/>';
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" data-frame-theme="${key}" data-frame-coverage="rich" data-region-layout="annotated" role="img" aria-label="${t.name}"><title>${t.name}</title>${defs}<g mask="url(#${id}-blue)"><g mask="url(#${id}-safety)"><g opacity="${alpha}" transform="${transform}">${parts}</g></g>${free?`<g data-art-flow="natural" mask="url(#${id}-natural)"><g opacity="${alpha}" transform="${transform}">${free}</g></g>`:''}</g></svg>`;
  }
  function buildSafe(c,{assets={}}={}){
    const key=c.gameFrameStyle,t=styles[key],n=(k,d,min,max)=>Number.isFinite(c[k])?Math.max(min,Math.min(max,c[k])):d,on=k=>c['gameFrame'+k]!==false;
    if(!t)return '';
    const prefix='luxury-'+key,asset=assets[key]||'/assets/'+assetFiles[key],rich=c.gameFrameCoverage!=='safe';
    const areaMask=protectedAreas.concat(rich?[]:[{name:'full-unit-information',x:364,y:879,w:1008,h:193}]);
    const accent=/^#[a-f\d]{6}$/i.test(c.gameFrameAccent||'')?c.gameFrameAccent:t.accent;
    let usedArt=false,freeArt='',artMasks='';
    const art=(name,x,y,w,h,source,aspect='none')=>{
      usedArt=true;const [sx,sy,sw,sh]=source,id=prefix+'-'+name+'-feather';
      artMasks+=`<linearGradient id="${id}-x" gradientUnits="userSpaceOnUse" x1="${sx}" y1="0" x2="${sx+sw}" y2="0"><stop stop-color="white" stop-opacity="0"/><stop offset=".08" stop-color="white"/><stop offset=".92" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><mask id="${id}" maskUnits="userSpaceOnUse" x="${sx}" y="${sy}" width="${sw}" height="${sh}" style="mask-type:alpha"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="url(#${id}-x)"/></mask>`;
      return `<svg data-decoration="${name}" data-edge="feathered" x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${source.join(' ')}" preserveAspectRatio="${aspect}" overflow="hidden"><g mask="url(#${id})"><use href="#${prefix}-art"/></g></svg>`;
    };
    const fill=(name,x,y,w,h)=>`<rect data-panel="${name}" x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${prefix}-glass)" fill-opacity=".38"/>`;
    const ring=(name,x,y,w,h)=>`<g data-panel="${name}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="none" stroke="${t.light}" stroke-width="${n('gameFrameThickness',3,1,6)+6}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="none" stroke="#cfb980" stroke-width="2"/></g>`;
    const crest=t.name.startsWith('纳西妲')?`<path d="M490 931Q460 961 490 987Q520 961 490 931M490 987Q463 1019 432 992Q459 966 490 987M490 987Q521 966 548 992Q519 1019 490 987M490 987V1040"/>`:t.name.startsWith('薇斯纳')?`<path d="M489 924 510 970 489 1018 468 970ZM466 1007H512M489 1018V1041M478 1041H500M433 939 445 955 433 971 421 955ZM542 989 552 1003 542 1017 532 1003Z"/>`:`<circle cx="490" cy="984" r="51"/><ellipse cx="490" cy="984" rx="67" ry="27" transform="rotate(-28 490 984)"/><path d="M490 946 498 976 528 984 498 992 490 1022 482 992 452 984 482 976ZM423 932H439M431 924V940M540 1034H556M548 1026V1042"/>`;
    let parts='';
    if(on('Minimap')){parts+=ring('minimap',6,804,295,269);if(on('Decorations'))parts+=art('minimap-architecture',0,725,367,355,[0,530,365,550]);}
    if(on('Selection')){
      parts+=ring('unit-silhouette',595,881,191,193)+ring('upgrades',825,881,290,193);
      if(rich&&on('Decorations'))parts+=fill('selection-left',367,875,229,205)+fill('selection-right',1115,875,261,205)+fill('selection-divider',786,875,39,205);
      if(on('Decorations')){
        parts+=art('central-rail',367,860,1008,26,[370,778,1005,65]);
        if(rich){parts+=art('left-architecture',367,881,229,197,[330,792,258,280]);parts+=`<g data-decoration="theme-seal" fill="none" stroke="${t.light}" stroke-opacity=".55" stroke-width="2">${crest}</g>`;parts+=art('divider',786,880,39,200,t.pillar);const scale=n('gameFrameDecorationScale',100,50,140)/100;const layout=key==='nahida-luxury'?[1108,685,286,391]:key==='vesna-luxury'?[1098,733,314,343]:[1106,736,295,340];freeArt+=`<g transform="translate(1245 1076) scale(${scale}) translate(-1245 -1076)">${art('character',...layout,t.character,'xMidYMax meet')}</g>`;}
      }
      parts+=`<path data-panel="bottom-rail" d="M367 1076H1376" stroke="#cfb980" stroke-width="6"/><path d="M367 1073H1376" stroke="${accent}" stroke-width="2"/>`;
    }
    if(on('Portrait')){if(on('Decorations'))parts+=fill('portrait-fill',1376,863,152,217);parts+=ring('portrait',1380,871,141,202);if(on('Decorations'))parts+=art('portrait-architecture',1380,872,141,200,t.portrait);}
    if(on('Commands')){parts+=ring('commands',1527,834,386,241);if(on('Decorations'))parts+=art('commands-architecture',1518,766,402,314,[1530,592,390,484]);}
    if(rich&&on('Decorations')){
      if(on('Minimap'))freeArt+=art('minimap-crown',0,714,363,187,[0,530,365,210]);
      if(on('Commands'))freeArt+=art('commands-crown',1523,724,397,140,[1530,592,390,170]);
      if(on('Selection'))freeArt+=ornaments(key,accent,t.light);
    }
    const mask=(id,areas,playfield=false)=>`<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080" style="mask-type:luminance"><rect width="1920" height="1080" fill="white"/>${playfield?'<path data-protected="playfield" d="M0 0H1920V757H1795V787H1530V858H368V795H160V738H0Z" fill="black"/>':''}${rich?`<g filter="url(#${prefix}-soft-window)">${areas.map(a=>`<rect x="${a.x-14}" y="${a.y-14}" width="${a.w+28}" height="${a.h+28}" fill="black"/>`).join('')}</g>`:''}${areas.map(a=>`<rect data-protected="${a.name}" x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="black"/>`).join('')}</mask>`;
    const transform=`translate(${n('gameFrameX',0,-120,120)} ${n('gameFrameY',0,-80,60)}) translate(960 1080) scale(${n('gameFrameScale',100,70,115)/100}) translate(-960 -1080)`,alpha=n('gameFrameOpacity',90,20,100)/100;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" data-frame-theme="${key}" data-frame-coverage="${rich?'rich':'safe'}" role="img" aria-label="${t.name}"><title>${t.name}</title><defs>${usedArt?`<image id="${prefix}-art" href="${escape(asset)}" width="1920" height="1080" preserveAspectRatio="none"/>`:''}${artMasks}<filter id="${prefix}-soft-window" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="8"/></filter><linearGradient id="${prefix}-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${t.light}"/><stop offset=".45" stop-color="${accent}"/><stop offset="1" stop-color="${t.base}"/></linearGradient>${mask(prefix+'-safety',areaMask,!rich)}${rich?mask(prefix+'-natural',naturalAreas):''}</defs><g mask="url(#${prefix}-safety)"><g opacity="${alpha}" transform="${transform}">${parts}</g></g>${freeArt?`<g data-art-flow="natural" mask="url(#${prefix}-natural)"><g opacity="${alpha}" transform="${transform}">${freeArt}</g></g>`:''}</svg>`;
  }
  function ornaments(key,accent,light){
    const gold='#dfc28a',stroke=`fill="none" stroke="${gold}" stroke-width="2" stroke-linecap="round"`;
    if(key==='nahida-luxury')return `<g data-decoration="leaf-garden"><path d="M330 853Q358 767 408 822Q447 882 524 843M1017 863Q1054 789 1124 817Q1168 842 1148 916" ${stroke}/>${[[355,797,-28],[380,812,22],[405,840,-18],[1064,809,-25],[1110,819,24]].map(([x,y,r])=>`<g transform="translate(${x} ${y}) rotate(${r})"><path d="M0 8Q-32-22 5-45Q35-13 0 8" fill="${accent}" fill-opacity=".88" stroke="${light}" stroke-width="1.5"/><path d="M0 6 5-34" ${stroke}/></g>`).join('')}<path d="M978 828Q973 812 958 823Q971 841 978 828Q994 811 1003 825Q993 840 978 828M436 788Q433 775 423 782Q431 799 436 788Q448 775 454 787Q447 798 436 788" fill="${light}" fill-opacity=".85"/></g>`;
    if(key==='vesna-luxury')return `<g data-decoration="frost-ribbons"><path d="M321 836Q397 770 465 821Q491 850 546 837M1019 862Q1084 800 1152 848M1412 914Q1471 882 1482 763" fill="none" stroke="${accent}" stroke-width="7" stroke-opacity=".55"/><path d="M327 841Q395 785 462 827Q501 851 546 842M1419 921Q1482 873 1486 768" ${stroke}/>${[[365,803,17],[474,821,12],[1048,834,12],[1480,764,31]].map(([x,y,s])=>`<g transform="translate(${x} ${y})"><path d="M0 ${-s} ${s*.55} 0 0 ${s} ${-s*.55} 0Z" fill="${accent}" fill-opacity=".78" stroke="${light}" stroke-width="1.5"/><path d="M0 ${-s}V${s}M${-s*.55} 0H${s*.55}" ${stroke}/></g>`).join('')}<path d="M445 766V798M429 782H461M435 772 455 792M455 772 435 792M1457 716V742M1444 729H1470" fill="none" stroke="${light}" stroke-width="2"/></g>`;
    return `<g data-decoration="astral-orbits"><g transform="translate(1454 792) rotate(-20)"><circle r="57" fill="#4a507b" fill-opacity=".15" stroke="${gold}" stroke-width="2"/><ellipse rx="78" ry="23" fill="none" stroke="${light}" stroke-width="2"/><circle r="42" fill="none" stroke="${accent}" stroke-width="1"/><path d="M0-26 7-7 26 0 7 7 0 26-7 7-26 0-7-7Z" fill="${light}" fill-opacity=".9"/></g><path d="M323 837Q427 791 508 846M1014 860Q1080 803 1160 859" ${stroke}/><path d="M370 818V776M475 830V802M1043 839V799" stroke="${gold}" stroke-width="1.5"/>${[[370,766,10],[475,792,8],[1043,788,11],[1524,718,9]].map(([x,y,s])=>`<path d="M${x} ${y-s} ${x+s*.3} ${y-s*.3} ${x+s} ${y} ${x+s*.3} ${y+s*.3} ${x} ${y+s} ${x-s*.3} ${y+s*.3} ${x-s} ${y} ${x-s*.3} ${y-s*.3}Z" fill="${light}" stroke="${gold}"/>`).join('')}</g>`;
  }
  return{build,protectedAreas,naturalAreas,greenAreas,blueAreas,redAreas,styles,assetFiles};
});
