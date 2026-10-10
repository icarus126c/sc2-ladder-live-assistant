(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.LuxuryConsole=factory();})(typeof window==='object'?window:this,()=>{
  // Fixed 1920×1080 windows follow the user's annotated single-unit Protoss HUD.
  // Mask the outer group so moving or resizing art never moves the information windows.
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
  const assetFiles=Object.fromEntries(Object.keys(styles).map(k=>[k,k.replace('-luxury','')+'-console-luxury-v1.png']));
  const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  function build(c,{assets={}}={}){
    const key=c.gameFrameStyle,t=styles[key],n=(k,d,min,max)=>Number.isFinite(c[k])?Math.max(min,Math.min(max,c[k])):d,on=k=>c['gameFrame'+k]!==false;
    if(!t)return '';
    const prefix='luxury-'+key,asset=assets[key]||'/assets/'+assetFiles[key],rich=c.gameFrameCoverage!=='safe';
    const areaMask=protectedAreas.concat(rich?[]:[{name:'full-unit-information',x:364,y:879,w:1008,h:193}]);
    const accent=/^#[a-f\d]{6}$/i.test(c.gameFrameAccent||'')?c.gameFrameAccent:t.accent;
    let usedArt=false;
    const art=(name,x,y,w,h,source,aspect='none')=>{usedArt=true;return `<svg data-decoration="${name}" x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${source.join(' ')}" preserveAspectRatio="${aspect}" overflow="hidden"><use href="#${prefix}-art"/></svg>`;};
    const fill=(name,x,y,w,h)=>`<rect data-panel="${name}" x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${prefix}-glass)"/>`;
    const ring=(name,x,y,w,h)=>`<g data-panel="${name}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="none" stroke="${t.light}" stroke-width="${n('gameFrameThickness',3,1,6)+6}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="none" stroke="#cfb980" stroke-width="2"/></g>`;
    const crest=t.name.startsWith('纳西妲')?`<path d="M490 931Q460 961 490 987Q520 961 490 931M490 987Q463 1019 432 992Q459 966 490 987M490 987Q521 966 548 992Q519 1019 490 987M490 987V1040"/>`:t.name.startsWith('薇斯纳')?`<path d="M489 924 510 970 489 1018 468 970ZM466 1007H512M489 1018V1041M478 1041H500M433 939 445 955 433 971 421 955ZM542 989 552 1003 542 1017 532 1003Z"/>`:`<circle cx="490" cy="984" r="51"/><ellipse cx="490" cy="984" rx="67" ry="27" transform="rotate(-28 490 984)"/><path d="M490 946 498 976 528 984 498 992 490 1022 482 992 452 984 482 976ZM423 932H439M431 924V940M540 1034H556M548 1026V1042"/>`;
    let parts='';
    if(on('Minimap')){parts+=ring('minimap',6,804,295,269);if(on('Decorations'))parts+=art('minimap-architecture',0,725,367,355,[0,530,365,550]);}
    if(on('Selection')){
      parts+=ring('unit-silhouette',595,881,191,193)+ring('upgrades',825,881,290,193);
      if(rich&&on('Decorations'))parts+=fill('selection-left',367,875,229,205)+fill('selection-right',1115,875,261,205)+fill('selection-divider',786,875,39,205);
      if(on('Decorations')){
        parts+=art('central-rail',367,860,1008,26,[370,778,1005,65]);
        if(rich){parts+=art('left-architecture',367,881,229,197,[330,792,258,280]);parts+=`<g data-decoration="theme-seal" fill="none" stroke="${t.light}" stroke-opacity=".55" stroke-width="2">${crest}</g>`;parts+=art('divider',786,880,39,200,t.pillar);const scale=n('gameFrameDecorationScale',100,50,140)/100;parts+=`<g transform="translate(1245 1078) scale(${scale}) translate(-1245 -1078)">${art('character',1115,878,261,202,t.character,'xMidYMax meet')}</g>`;}
      }
      parts+=`<path data-panel="bottom-rail" d="M367 1076H1376" stroke="#cfb980" stroke-width="6"/><path d="M367 1073H1376" stroke="${accent}" stroke-width="2"/>`;
    }
    if(on('Portrait')){if(on('Decorations'))parts+=fill('portrait-fill',1376,863,152,217);parts+=ring('portrait',1380,871,141,202);if(on('Decorations'))parts+=art('portrait-architecture',1380,872,141,200,t.portrait);}
    if(on('Commands')){parts+=ring('commands',1527,834,386,241);if(on('Decorations'))parts+=art('commands-architecture',1518,766,402,314,[1530,592,390,484]);}
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" data-frame-theme="${key}" role="img" aria-label="${t.name}"><title>${t.name}</title><defs>${usedArt?`<image id="${prefix}-art" href="${escape(asset)}" width="1920" height="1080" preserveAspectRatio="none"/>`:""}<linearGradient id="${prefix}-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${t.light}"/><stop offset=".45" stop-color="${accent}"/><stop offset="1" stop-color="${t.base}"/></linearGradient><mask id="${prefix}-safety" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080" style="mask-type:luminance"><rect width="1920" height="1080" fill="white"/><path data-protected="playfield" d="M0 0H1920V757H1795V787H1530V858H368V795H160V738H0Z" fill="black"/>${areaMask.map(a=>`<rect data-protected="${a.name}" x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="black"/>`).join('')}</mask></defs><g mask="url(#${prefix}-safety)"><g opacity="${n('gameFrameOpacity',90,20,100)/100}" transform="translate(${n('gameFrameX',0,-120,120)} ${n('gameFrameY',0,-80,60)}) translate(960 1080) scale(${n('gameFrameScale',100,70,115)/100}) translate(-960 -1080)">${parts}</g></g></svg>`;
  }
  return{build,protectedAreas,styles,assetFiles};
});
