const shared={Theme:'team',Background:'gradient',BackgroundImage:'',BackgroundVideo:'',VideoMuted:true,VideoLoop:true,ShowText:true,TeamName:'TEAM AENEAS',Color:'#08121f',ColorSecondary:'#285476',Accent:'#e6bc5c',TextColor:'#f0f5fb',Layout:'center',ImageFit:'cover',Dim:35,PanelOpacity:35,Width:1320,TitleSize:66,Kicker:'TEAM AENEAS / LADDER SESSION',ShowName:true,ShowMMR:true,ShowRecord:true,ShowMatchups:true,ShowPhase:true,ShowHUD:false,ShowLongest:false,ShowZerglings:false,ShowZealots:false,ShowWorkersKilled:false,ShowStrongest:false,ShowDailyTime:false,FreePosition:false,TextX:240,TextY:210};
const sceneDefaults=Object.fromEntries(['waiting','break','loading'].flatMap(p=>Object.entries(shared).map(([k,v])=>[p+k,v])));
Object.assign(sceneDefaults,{breakTitle:'稍作休息，马上回来',breakNote:'补充能量，下一局继续',breakKicker:'TEAM AENEAS / BE RIGHT BACK',breakShowMMR:false,breakShowRecord:false,breakShowMatchups:false,breakShowPhase:false,loadingTheme:'starcraft',loadingTitle:'正在载入下一场',loadingNote:'准备就绪，比赛开始后自动切回游戏',loadingKicker:'MATCH LOADING',loadingShowMMR:false,loadingShowRecord:false,loadingShowMatchups:false,loadingShowPhase:true});
const scenePrefixes=['game','waiting','loading','break','blank'],layers=['Frame','Keyboard','Scoreboard','DailyWidget','Gifts','Income','Raffle'];
for(const p of scenePrefixes)for(const layer of layers)sceneDefaults[p+'Show'+layer]=p!=='blank'&&(layer==='Frame'||layer==='Keyboard'||layer==='Scoreboard'?p==='game':layer==='DailyWidget'?p!=='loading':true);
const imageURL=/^\/(?:(?:waiting-backgrounds|scene-media)\/[a-f\d]{64}\.(png|jpg|webp)|style-assets\/[a-f\d]{64}\.png|assets\/nicole-(?:waiting|away)-v1\.png)$/,videoURL=/^\/scene-media\/[a-f\d]{64}\.(mp4|webm)$/;
function sanitizeScenes(input,c){
  for(const p of ['waiting','break','loading']){
    for(const [suffix,values]of Object.entries({Theme:['team','starcraft','naiwa','vesna','nahida','nicole','arknights','custom'],Background:['gradient','solid','image','video'],Layout:['center','left','right'],ImageFit:['cover','contain']})){const k=p+suffix;if(k in input){if(!values.includes(input[k]))throw Error('画面风格选项不正确');c[k]=input[k];}}
    for(const suffix of ['Color','ColorSecondary','Accent','TextColor']){const k=p+suffix;if(k in input){if(typeof input[k]!=='string'||!/^#[a-f\d]{6}$/i.test(input[k]))throw Error('画面颜色不正确');c[k]=input[k];}}
    for(const [suffix,min,max]of [['Dim',0,100],['PanelOpacity',0,100],['Width',700,1760],['TitleSize',32,100],['TextX',0,1220],['TextY',0,1000]]){const k=p+suffix;if(k in input){if(!Number.isInteger(input[k])||input[k]<min||input[k]>max)throw Error('画面外观数值超出范围');c[k]=input[k];}}
    for(const suffix of ['FreePosition','VideoMuted','VideoLoop','ShowText','ShowName','ShowMMR','ShowRecord','ShowMatchups','ShowPhase','ShowHUD','ShowLongest','ShowZerglings','ShowZealots','ShowWorkersKilled','ShowStrongest','ShowDailyTime']){const k=p+suffix;if(k in input){if(typeof input[k]!=='boolean')throw Error('画面开关格式不正确');c[k]=input[k];}}
    for(const [suffix,max]of [['Title',60],['Note',100],['Kicker',80],['TeamName',40]]){const k=p+suffix;if(k in input){if(typeof input[k]!=='string'||input[k].length>max||input[k].includes('\0'))throw Error('画面文字太长或格式不正确');c[k]=input[k].trim();}}
    for(const [suffix,pattern]of [['BackgroundImage',imageURL],['BackgroundVideo',videoURL]]){const k=p+suffix;if(k in input){if(typeof input[k]!=='string'||(input[k]!==''&&!pattern.test(input[k])))throw Error('请选择本地上传的图片或视频');c[k]=input[k];}}
  }
  for(const p of scenePrefixes)for(const layer of layers){const k=p+'Show'+layer;if(k in input){if(typeof input[k]!=='boolean')throw Error('场景图层开关格式不正确');c[k]=input[k];}}
  return c;
}
module.exports={sceneDefaults,sanitizeScenes,imageURL,videoURL};
