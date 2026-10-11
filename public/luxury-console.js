(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.LuxuryConsole=factory();})(typeof window==='object'?window:this,()=>{
  // Existing regular themes and optional sticker protection retain their HUD policy.
  const protectedAreas=[
    {name:'army-buttons',x:0,y:739,w:163,h:67},
    {name:'clock',x:254,y:770,w:72,h:39},
    {name:'minimap',x:12,y:809,w:283,h:260},
    {name:'control-groups',x:365,y:787,w:1007,h:74},
    {name:'unit-silhouette-and-vitals',x:600,y:885,w:181,h:187},
    {name:'unit-name-and-upgrades',x:830,y:885,w:280,h:187},
    {name:'command-card',x:1533,y:840,w:375,h:231}
  ];
  const naturalAreas=protectedAreas.filter(a=>['minimap','command-card'].includes(a.name));
  const styles={
    'nahida-luxury':{name:'纳西妲 · 豪华叶宫',accent:'#b9db84',base:'#294e37',light:'#eef3d5'},
    'vesna-luxury':{name:'薇斯纳 · 豪华霜剑',accent:'#a4e2df',base:'#2f6575',light:'#eaf6f4'},
    'nicole-luxury':{name:'妮可 · 豪华星谕',accent:'#d6ccf6',base:'#4a507b',light:'#f2ecfa'}
  };
  const assetFiles=Object.fromEntries(Object.keys(styles).map(k=>[k,k.replace('-luxury','')+'-console-luxury-v2.png']));
  // Two connected negative spaces replace the old independently clipped slots.
  const greenAreas=[
    protectedAreas.find(a=>a.name==='minimap'),
    protectedAreas.find(a=>a.name==='unit-silhouette-and-vitals'),
    {name:'upgrade-icons-and-values',x:882,y:976,w:144,h:67},
    {name:'unit-name',x:875,y:884,w:152,h:33},
    {name:'unit-type-caption',x:872,y:1041,w:169,h:29}
  ];
  const blueAreas=[];
  const redAreas=[{name:'左侧主题装饰',x:304,y:735,w:286,h:345},{name:'角色与右侧控制台',x:1055,y:610,w:865,h:470}];
  const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  function build(c,{assets={}}={}){
    const key=c.gameFrameStyle,t=styles[key];if(!t)return '';
    const id='luxury-'+key,rich=c.gameFrameCoverage!=='safe',n=(k,d,min,max)=>Number.isFinite(c[k])?Math.max(min,Math.min(max,c[k])):d,on=k=>c['gameFrame'+k]!==false;
    const alpha=n('gameFrameOpacity',90,20,100)/100,accent=/^#[a-f\d]{6}$/i.test(c.gameFrameAccent||'')?c.gameFrameAccent:t.accent;
    const hasPanels=['Minimap','Selection','Portrait','Commands'].some(on),useArt=on('Decorations')&&hasPanels;
    const guards=rich?greenAreas:protectedAreas.concat([{name:'full-unit-information',x:364,y:879,w:1008,h:193}]);
    const cores=guards.map(a=>`<rect data-protected="${a.name}" x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="black"/>`).join('');
    const halos=guards.map(a=>`<rect x="${a.x-9}" y="${a.y-9}" width="${a.w+18}" height="${a.h+18}" rx="12" fill="black"/>`).join('');
    const bay=rich?'<rect data-protected="central-information-bay" x="590" y="878" width="465" height="196" rx="25" fill="black"/>':'';
    const disabled=[['Minimap',0,0,304,1080],['Selection',304,0,1072,1080],['Portrait',1376,0,157,1080],['Commands',1533,0,387,1080]].filter(([k])=>!on(k)).map(([,x,y,w,h])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="black"/>`).join('');
    const playfield='<rect data-protected="upper-game-field" width="1920" height="360" fill="black"/>'+(rich?'':'<path data-protected="playfield" d="M0 0H1920V757H1795V787H1530V858H368V795H160V738H0Z" fill="black"/>');
    // Draw native alpha once: no source crops, portrait extraction or panel reassembly.
    const art=useArt?`<image data-decoration="whole-console" href="${escape(assets[key]||'/assets/'+assetFiles[key])}" width="1920" height="1080" preserveAspectRatio="none"/>`:hasPanels?`<g data-panel="minimal-rails" fill="none" stroke="${accent}" stroke-width="${n('gameFrameThickness',3,1,6)}"><path d="M304 1076H1916M304 878Q340 858 375 870H1055Q1100 845 1140 866H1916"/>${on('Minimap')?'<rect x="6" y="804" width="295" height="269" rx="9"/>':''}</g>`:'';
    const decorationScale=1;
    const transform=`translate(${n('gameFrameX',0,-120,120)} ${n('gameFrameY',0,-80,60)}) translate(960 1080) scale(${n('gameFrameScale',100,70,115)/100*decorationScale}) translate(-960 -1080)`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" data-frame-theme="${key}" data-frame-coverage="${rich?'rich':'safe'}" data-art-generation="2" role="img" aria-label="${t.name}"><title>${t.name}</title><defs><filter id="${id}-feather" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="7"/></filter><mask id="${id}-safety" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080" style="mask-type:luminance"><rect width="1920" height="1080" fill="white"/><g filter="url(#${id}-feather)">${halos}${bay}${disabled}</g>${cores}${bay}${disabled}${playfield}</mask></defs><g data-art-flow="whole" mask="url(#${id}-safety)"><g opacity="${alpha}" transform="${transform}">${art}</g></g></svg>`;
  }
  return{build,protectedAreas,naturalAreas,greenAreas,blueAreas,redAreas,styles,assetFiles};
});
