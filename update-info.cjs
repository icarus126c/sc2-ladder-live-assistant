const current=require('./package.json').version;
const currentBuild=require('./package.json').build||'';
function newer(a,b){const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;}
async function check(fetchImpl=fetch){const r=await fetchImpl('https://raw.githubusercontent.com/icarus126c/sc2-ladder-live-assistant/codex/initial-release/package.json',{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('官方项目暂时无法访问，请稍后重试');const p=await r.json();if(p.name!=='starcraft-ladder-live-assistant'||!/^\d+\.\d+\.\d+$/.test(p.version)||p.build&& !/^[a-zA-Z0-9_-]{1,64}$/.test(p.build))throw Error('更新信息格式无效');return{current,currentBuild,latest:p.version,latestBuild:p.build||'',newer:newer(p.version,current)||(p.version===current&&!!p.build&&p.build!==currentBuild),url:'https://github.com/icarus126c/sc2-ladder-live-assistant'};}
module.exports={check,newer};
