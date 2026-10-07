(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GameFrameTemplate=factory();})(typeof window==='object'?window:this,()=>{
  // Coordinates follow the supplied bottom HUD reference on a 1920 × 1080 canvas.
  const panels=[
    {key:'Minimap',x:5,y:791,w:307,h:281,cut:11},
    {key:'Selection',x:362,y:860,w:1028,h:212,cut:12},
    {key:'Portrait',x:1398,y:858,w:149,h:214,cut:8},
    {key:'Commands',x:1554,y:789,w:360,h:283,cut:11}
  ];
  const outline=p=>`M${p.x+p.cut} ${p.y}H${p.x+p.w-p.cut}L${p.x+p.w} ${p.y+p.cut}V${p.y+p.h-p.cut}L${p.x+p.w-p.cut} ${p.y+p.h}H${p.x+p.cut}L${p.x} ${p.y+p.h-p.cut}V${p.y+p.cut}Z`;
  function corners(p){const {x,y,w,h,cut:c}=p,l=31;return `M${x} ${y+l}V${y+c}L${x+c} ${y}H${x+l}M${x+w-l} ${y}H${x+w-c}L${x+w} ${y+c}V${y+l}M${x} ${y+h-l}V${y+h-c}L${x+c} ${y+h}H${x+l}M${x+w-l} ${y+h}H${x+w-c}L${x+w} ${y+h-c}V${y+h-l}`;}
  const themes={slim:{name:'星际 · 透明窄框',accent:'#83c5b6',note:'金属窄边框，内容区域透明。'},corners:{name:'轻量 · 四角装饰',accent:'#83c5b6',note:'只装饰四角，保留更多游戏画面。'},nailong:{name:'奶龙 · 优势在我',accent:'#ffc742',note:'奶油黄厚边、搞怪奶龙和文字气泡，允许局部遮挡。'},anes:{name:'ANES · 蓝金战队',accent:'#e6bc5c',note:'使用ANES战队队标，蓝金装甲与底部铭牌允许局部遮挡。'}};
  const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
  Object.assign(themes,{naiwa:{name:'奶蛙 · 人形恶搞',accent:'#efd253',note:'长脖子人形奶蛙、黄绿弧边与诡异气泡，允许局部遮挡。'},nahida:{name:'纳西妲 · 叶间微光',accent:'#b5d777',note:'草绿色窄边、叶片和藤蔓，角色点缀底部一角。'},vesna:{name:'薇斯纳 · 青白雪宴',accent:'#a4e2df',note:'青白冰晶线条与金色菱形，薇斯纳点缀底部一角。'}});
  themes.arknights={name:'明日方舟 · 罗德岛终端',accent:'#f5c928',note:'黑白切角细框、黄色标记与罗德岛标识，控制台内部透明。'};
  themes.nicole={name:'尼可 · 静默星谕',accent:'#e7cb90',note:'正面尼可与蓝白金透明边框，支持整体缩放与移动。'};
  themes.custom={name:'已安装 · 自定义边框',accent:'#83c5b6',note:'完整透明PNG边框；面板开关仅适用于内置矢量模板，自定义图片整体缩放与移动。'};
  const assetDefaults={arknights:'/assets/arknights-logo-v1.png',nailong:'/assets/nailong-meme-v1.png',anes:'/assets/bluegold-logo.png',naiwa:'/assets/naiwa-keys-v1.png',nahida:'/assets/nahida-frame-v1.png',vesna:'/assets/vesna-keys-v1.png'};
  function build(c,{assets={}}={}){
    const accent=/^#[a-f\d]{6}$/i.test(c.gameFrameAccent||'')?c.gameFrameAccent:'#83c5b6',number=(key,fallback,min,max)=>Number.isFinite(c[key])?Math.max(min,Math.min(max,c[key])):fallback;
    const thickness=number('gameFrameThickness',3,1,6),opacity=number('gameFrameOpacity',90,20,100)/100,scale=number('gameFrameScale',100,70,115)/100,x=number('gameFrameX',0,-120,120),y=number('gameFrameY',0,-80,60),style=Object.hasOwn(themes,c.gameFrameStyle)?c.gameFrameStyle:'slim',slim=style!=='corners',on=key=>c['gameFrame'+key]!==false;
    if(style==='custom'||style==='nicole'){const url=style==='nicole'?'/assets/nicole-frame-v1.png':/^\/style-assets\/[a-f\d]{64}\.png$/.test(c.gameFrameImage||'')?c.gameFrameImage:'';return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" data-frame-theme="${style}" role="img" aria-label="${themes[style].name}"><title>${themes[style].name}</title><g opacity="${opacity}" transform="translate(${x} ${y}) translate(960 1080) scale(${scale}) translate(-960 -1080)">${url?`<image href="${escape((style==='nicole'?assets.nicole:assets.customFrame)||url)}" width="1920" height="1080"/>`:''}</g></svg>`;}
    const paths=panels.filter(p=>c['gameFrame'+p.key]!==false).map(p=>{
      const d=slim?outline(p):corners(p);
      if(style==='arknights'){const {x,y,w,h}=p;return `<g data-panel="${p.key.toLowerCase()}"><path d="${d}" fill="none" stroke="#14191e" stroke-width="${thickness+5}"/><path d="${d}" fill="none" stroke="#f1f1ed" stroke-width="${thickness}"/><path d="M${x+25} ${y-2}h42M${x+w-67} ${y+h+2}h42" stroke="${accent}" stroke-width="5"/><path d="${corners(p)}" fill="none" stroke="${accent}" stroke-width="2"/></g>`;}
      if(style==='nailong'){
        const w=thickness*1.4+10;
        return `<g data-panel="${p.key.toLowerCase()}"><path d="${d}" fill="none" stroke="#4d3215" stroke-width="${w+5}"/><path d="${d}" fill="none" stroke="#d88719" stroke-width="${w+2}"/><path d="${d}" fill="none" stroke="url(#frameHoney)" stroke-width="${w}"/><path d="${d}" fill="none" stroke="#fff1b0" stroke-opacity=".8" stroke-width="2"/><circle cx="${p.x+p.cut}" cy="${p.y+p.h-2}" r="7" fill="${accent}" stroke="#fff4bf" stroke-width="2"/><circle cx="${p.x+p.w-p.cut}" cy="${p.y+2}" r="6" fill="#ffda60" stroke="#fff4bf" stroke-width="2"/></g>`;
      }
      if(style==='anes'){
        const {x,y,w,h}=p;
        return `<g data-panel="${p.key.toLowerCase()}"><path d="${d}" fill="none" stroke="#0b1324" stroke-width="${thickness+12}"/><path d="${d}" fill="none" stroke="url(#frameBlue)" stroke-width="${thickness+8}"/><path d="${d}" fill="none" stroke="${accent}" stroke-width="2"/><path d="${corners(p)}" fill="none" stroke="#fff1c3" stroke-width="3"/><path d="M${x} ${y+25}V${y+8}L${x+8} ${y}H${x+28}L${x+19} ${y+8}H${x+9}V${y+18}Z M${x+w} ${y+h-25}V${y+h-8}L${x+w-8} ${y+h}H${x+w-28}L${x+w-19} ${y+h-8}H${x+w-9}V${y+h-18}Z" fill="${accent}"/></g>`;
      }
      if(['naiwa','nahida','vesna'].includes(style)){
        const {x,y,w,h}=p,base={naiwa:'#34351a',nahida:'#19342a',vesna:'#133039'}[style],outer={naiwa:thickness+8,nahida:thickness+5,vesna:thickness+6}[style];
        const round=style==='naiwa'?`M${x+22} ${y}H${x+w-22}Q${x+w} ${y} ${x+w} ${y+22}V${y+h-22}Q${x+w} ${y+h} ${x+w-22} ${y+h}H${x+22}Q${x} ${y+h} ${x} ${y+h-22}V${y+22}Q${x} ${y} ${x+22} ${y}Z`:d;
        const motif=style==='naiwa'?`<circle cx="${x+w-24}" cy="${y}" r="9" fill="#cedb62" stroke="#364529" stroke-width="2"/><circle cx="${x+w-24}" cy="${y}" r="3" fill="#27492e"/>`:style==='nahida'?`<path d="M${x+14} ${y-6}q20-18 37 0q-19 16-37 0 M${x+w-16} ${y+h+3}q-18-15-34 0q17 15 34 0" fill="${accent}" stroke="#e5ebba" stroke-width="1"/><path d="M${x+20} ${y}Q${x+72} ${y-10} ${x+108} ${y}" fill="none" stroke="#91aa5c" stroke-width="2"/>`:`<path d="m${x+20} ${y-11} 8 11-8 11-8-11Z m${x+w-20} ${y+h-11} 8 11-8 11-8-11Z" fill="#e7d7a4" stroke="${accent}" stroke-width="1"/><path d="M${x+40} ${y-3}H${x+90}m-35-5 8 8-8 8" fill="none" stroke="#e6fbf7" stroke-width="1"/>`;
        return `<g data-panel="${p.key.toLowerCase()}"><path d="${round}" fill="none" stroke="${base}" stroke-width="${outer+3}"/><path d="${round}" fill="none" stroke="${accent}" stroke-opacity=".85" stroke-width="${outer}"/><path d="${round}" fill="none" stroke="#f1f3d4" stroke-opacity=".7" stroke-width="1.5"/>${motif}</g>`;
      }
      return `<g data-panel="${p.key.toLowerCase()}"><path d="${d}" fill="none" stroke="#090f15" stroke-width="${thickness+4}"/><path d="${d}" fill="none" stroke="url(#frameMetal)" stroke-width="${thickness+2}"/><path d="${d}" fill="none" stroke="${accent}" stroke-opacity=".5" stroke-width="${Math.max(.7,thickness*.32)}"/><path d="${corners(p)}" fill="none" stroke="${accent}" stroke-width="${Math.min(2,thickness*.55)}"/>${slim?`<path d="M${p.x+44} ${p.y+p.h-1}H${p.x+75}M${p.x+p.w-75} ${p.y+p.h-1}H${p.x+p.w-44}" fill="none" stroke="${accent}" stroke-width="2"/>`:''}</g>`;
    }).join('');
    const decorationScale=number('gameFrameDecorationScale',100,50,140)/100;let decorations='';
    const singleImage=(key,x,y,w,h)=>`<image href="${escape(assets[key]||assetDefaults[key])}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
    const image=(key,x,y,w,h)=>['naiwa','vesna'].includes(key)?`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 512 512" overflow="hidden"><svg width="512" height="${key==='naiwa'?486:512}" overflow="hidden"><image href="${escape(assets[key]||assetDefaults[key])}" width="1536" height="1024"/></svg></svg>`:singleImage(key,x,y,w,h);
    if(c.gameFrameDecorations!==false&&['naiwa','nahida','vesna'].includes(style)){
      if(on('Selection')){const size=style==='naiwa'?248:220;decorations+=`<g data-decoration="${style}-character" transform="translate(1388 1076) scale(${decorationScale}) translate(-1388 -1076)">${image(style,1388-size,1076-size,size,size)}${style==='naiwa'?`<text x="1100" y="1055" text-anchor="middle" font-family="Microsoft YaHei, sans-serif" font-size="22" font-weight="900" fill="#fff2a0" stroke="#303719" stroke-width="1">${escape(String(c.gameFrameMemeText??'哟嚯嚯！').slice(0,16))}</text>`:''}</g>`;}
      if(on('Minimap'))decorations+=style==='nahida'?`<path data-decoration="leaf" d="M277 786q14-37 39-15q-3 29-39 15" fill="${accent}" stroke="#e4eabb" stroke-width="2"/>`:style==='vesna'?`<path data-decoration="crystal" d="m288 770 12 20-12 20-12-20Z" fill="#d6f0e9" stroke="${accent}" stroke-width="2"/>`:'';
    }
    if(c.gameFrameDecorations!==false&&style==='arknights'&&on('Minimap'))decorations+=`<g transform="translate(336 821) scale(${decorationScale}) translate(-336 -821)">${singleImage('arknights',319,801,34,40)}</g>`;
    if(c.gameFrameDecorations!==false&&style==='nailong'){
      const text=String(c.gameFrameMemeText??'优势在我！').slice(0,32),font=Math.min(26,214/Math.max(1,[...text].length));
      if(on('Selection'))decorations+=`<g data-decoration="nailong-main" transform="translate(1388 1076) scale(${decorationScale}) translate(-1388 -1076)">${image('nailong',1160,848,228,228)}${text?`<path d="M940 1018H1128Q1148 1018 1148 1038V1049Q1148 1069 1128 1069H1119L1142 1077L1098 1069H940Q920 1069 920 1049V1038Q920 1018 940 1018Z" fill="#fff6cd" stroke="#7b4d14" stroke-width="4"/><text x="1034" y="1051" text-anchor="middle" font-family="Microsoft YaHei, sans-serif" font-size="${font}" font-weight="900" fill="#7b4d14">${escape(text)}</text>`:''}</g>`;
      if(on('Minimap'))decorations+=`<g data-decoration="nailong-corner" transform="translate(358 1076) scale(${decorationScale}) translate(-358 -1076)">${image('nailong',232,950,126,126)}</g>`;
    }
    if(c.gameFrameDecorations!==false&&style==='anes'){
      if(on('Selection'))decorations+=`<g data-decoration="anes-badge" transform="translate(1384 1078) scale(${decorationScale}) translate(-1384 -1078)"><path d="M906 1078V1048L925 1032H1239L1273 1000H1352L1384 1032V1078Z" fill="url(#frameBlue)" stroke="${accent}" stroke-width="3"/><path d="M918 1072H1198L1235 1038" fill="none" stroke="#88b7e5" stroke-width="2"/><text x="1064" y="1064" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="900" letter-spacing="3" fill="#ffe7a5">TEAM AENEAS</text>${image('anes',1225,953,125,125)}</g>`;
      if(on('Minimap'))decorations+=`<path data-decoration="anes-bolt" d="M26 777H51L42 795H59L31 823L38 802H20Z" fill="${accent}" stroke="#fff3cc" stroke-width="2"/>`;
      if(on('Commands'))decorations+=`<path data-decoration="anes-star" d="m1889 777 5 12 13 1-10 8 3 12-11-6-11 6 3-12-10-8 13-1Z" fill="#e49bad" stroke="#ffe7a5" stroke-width="2"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" data-frame-theme="${style}" role="img" aria-label="${themes[style].name}"><title>${themes[style].name}</title><defs><linearGradient id="frameMetal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#9aa5ad"/><stop offset=".28" stop-color="#495764"/><stop offset=".65" stop-color="#1b2733"/><stop offset="1" stop-color="#727f8b"/></linearGradient><linearGradient id="frameHoney" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff5bf"/><stop offset=".3" stop-color="${accent}"/><stop offset="1" stop-color="#eda323"/></linearGradient><linearGradient id="frameBlue" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#528dcc"/><stop offset=".45" stop-color="#254e83"/><stop offset="1" stop-color="#14283e"/></linearGradient></defs><g opacity="${opacity}" transform="translate(${x} ${y}) translate(960 1080) scale(${scale}) translate(-960 -1080)" stroke-linejoin="round" stroke-linecap="round">${paths}${decorations}</g></svg>`;
  }
  return{build,panels,themes,assetDefaults};
});
