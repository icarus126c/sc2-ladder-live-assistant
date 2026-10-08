(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ProtossConsole=factory();})(typeof window==='object'?window:this,()=>{
 // Calibrated to the supplied 16:9 Protoss HUD. These cutouts stay in screen
 // coordinates even when the decorative chassis is moved or scaled.
 const safeAreas=[
  {name:'army-buttons',x:0,y:739,w:163,h:67},
  {name:'clock',x:254,y:770,w:72,h:39},
  {name:'minimap',x:12,y:809,w:283,h:260},
  {name:'minimap-tools',x:301,y:802,w:63,h:277},
  {name:'control-groups',x:365,y:787,w:1007,h:74},
  {name:'unit-information',x:364,y:879,w:1008,h:192},
  {name:'unit-portrait',x:1381,y:872,w:135,h:199},
  {name:'command-card',x:1533,y:840,w:375,h:231},
  {name:'menu-chat',x:1697,y:777,w:223,h:65}
 ];
 const escape=v=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
 const clamp=(v,f,min,max)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):f;
 const plate=(d,cyan)=>`<path d="${d}" fill="url(#protoss-metal)" stroke="#171d2a" stroke-width="3"/><path d="${d}" fill="url(#protoss-etch)" stroke="#f0dfaf" stroke-opacity=".6" stroke-width=".7"/><path d="${d}" fill="none" stroke="${cyan}" stroke-opacity=".15" stroke-width="1"/>`;
 const ring=(x,y,w,h)=>`M${x+16} ${y}H${x+w-16}L${x+w} ${y+16}V${y+h-16}L${x+w-16} ${y+h}H${x+16}L${x} ${y+h-16}V${y+16}Z`;
 function panel(x,y,w,h,cyan){const d=ring(x,y,w,h);return `<path d="${d}" fill="none" stroke="#07121e" stroke-width="17"/><path d="${d}" fill="none" stroke="url(#protoss-metal)" stroke-width="13"/><path d="${d}" fill="none" stroke="#fff2cf" stroke-opacity=".7" stroke-width="1.5"/><path d="${d}" fill="none" stroke="${cyan}" stroke-opacity=".28" stroke-width="3"/>`;}
 function jewel(x,y,size,cyan){return `<g transform="translate(${x} ${y})"><path d="M0 ${-size}L${size*.65} 0L0 ${size}L${-size*.65} 0Z" fill="#102b40" stroke="#f1d99e" stroke-width="2"/><path d="M0 ${-size*.65}L${size*.4} 0L0 ${size*.65}L${-size*.4} 0Z" fill="${cyan}"/><path d="M0 ${-size*.65}V${size*.65}" stroke="#e5ffff" stroke-width="1"/></g>`;}
 function build(c){
  const zealot=c.gameFrameStyle==='zealot',style=zealot?'zealot':'artanis',cyan=/^#[a-f\d]{6}$/i.test(c.gameFrameAccent||'')?c.gameFrameAccent:'#72d9ef',name=zealot?'狂热者 · 灵能双刃':'阿塔尼斯 · 大主教',scale=clamp(c.gameFrameScale,100,70,115)/100,dx=clamp(c.gameFrameX,0,-120,120),dy=clamp(c.gameFrameY,0,-80,60),alpha=clamp(c.gameFrameOpacity,90,20,100)/100;
  const on=k=>c['gameFrame'+k]!==false,details=c.gameFrameDecorations!==false,s=clamp(c.gameFrameDecorationScale,100,50,140)/100;let parts='';
  if(on('Minimap'))parts+=`<g data-panel="minimap">${panel(5,803,295,269,cyan)}${plate('M0 801H32L43 810H280L300 800L304 823L286 826H20L0 817Z',cyan)}${plate('M0 1047L17 1062H292L304 1052V1080H0Z',cyan)}${details?jewel(7,955,18,cyan)+jewel(296,936,15,cyan):''}</g>`;
  if(on('Selection')){
   parts+=`<g data-panel="selection">${panel(361,870,1014,207,cyan)}${plate('M363 861H452L468 868H1266L1285 861H1374L1383 876H358Z',cyan)}<path d="M477 866H1257" stroke="${cyan}" stroke-width="2"/><path d="M475 872H1259" stroke="#fff0ca" stroke-opacity=".55"/>${plate('M361 1068H670L699 1074H1034L1063 1068H1374V1080H361Z',cyan)}`;
   if(details){const emblem=zealot?`<path d="M-14 4L-2-7L-5 6L-13 9Z M14 4L2-7L5 6L13 9Z" fill="${cyan}" stroke="#c7f7ff" stroke-width=".8"/>`:`<path d="M-18 4L-7-4L0-9L7-4L18 4L6 1L0 7L-6 1Z" fill="#fff0c0"/><path d="M0-7V5" stroke="${cyan}" stroke-width="2"/>`;
    parts+=`<g data-decoration="${style}-insignia" transform="translate(875 867) scale(${s})">${emblem}</g><path d="M391 866h45m879 0h34" stroke="#fff4d5" stroke-width="2"/>${jewel(1369,1072,7,cyan)}`;
   }parts+='</g>';
  }
  if(on('Portrait'))parts+=`<g data-panel="portrait">${panel(1378,866,148,211,cyan)}${plate('M1372 870L1381 856H1414L1402 867H1384V1080H1372Z',cyan)}${plate('M1518 863L1528 871V1080H1518Z',cyan)}${details?jewel(1523,968,18,cyan):''}</g>`;
  if(on('Commands'))parts+=`<g data-panel="commands">${panel(1530,833,388,242,cyan)}${plate('M1529 839L1554 816H1639L1657 828H1700V839Z',cyan)}${plate('M1528 1065H1884L1905 1048L1920 1054V1080H1528Z',cyan)}${details?`<path d="M1563 825H1632" stroke="${cyan}" stroke-width="3"/>`+jewel(1917,917,20,cyan):''}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" data-frame-theme="${style}" data-hud-profile="protoss-16x9" role="img" aria-label="${name}"><title>${name} · 游戏信息保护镂空</title><defs><linearGradient id="protoss-metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffefc9"/><stop offset=".18" stop-color="#cdb783"/><stop offset=".45" stop-color="#81704f"/><stop offset=".66" stop-color="#3d3b38"/><stop offset=".82" stop-color="#b49968"/><stop offset="1" stop-color="#f6e1aa"/></linearGradient><pattern id="protoss-etch" patternUnits="userSpaceOnUse" width="46" height="46"><path d="M0 23L23 0L46 23L23 46Z" fill="none" stroke="#fff0cb" stroke-opacity=".12" stroke-width="1"/></pattern><mask id="protoss-information-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080" style="mask-type:luminance"><rect width="1920" height="1080" fill="white"/><path data-protected="playfield" d="M0 0H1920V730H1650V800H1530V858H368V795H160V738H0Z" fill="black"/>${safeAreas.map(p=>`<rect data-protected="${escape(p.name)}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="black"/>`).join('')}</mask></defs><g mask="url(#protoss-information-mask)"><g opacity="${alpha}" transform="translate(${dx} ${dy}) translate(960 1080) scale(${scale}) translate(-960 -1080)" stroke-linejoin="round" stroke-linecap="round">${parts}</g></g></svg>`;
 }
 return{build,safeAreas};
});
