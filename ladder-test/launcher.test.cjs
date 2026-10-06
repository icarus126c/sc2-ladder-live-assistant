const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),path=require('node:path'),{openBrowser}=require('../ladder-server.cjs');
test('Actual Windows launcher keeps readable feedback and preserves the server exit status in a Chinese spaced path',{skip:process.platform!=='win32'},t=>{
 const os=require('node:os'),{spawnSync}=require('node:child_process'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'天梯 启动检查-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.mkdirSync(path.join(dir,'runtime/python'),{recursive:true});fs.copyFileSync(process.execPath,path.join(dir,'runtime/node.exe'));fs.writeFileSync(path.join(dir,'runtime/python/python.exe'),'');
 const file=path.join(dir,'启动天梯助手.cmd');fs.copyFileSync(path.join(__dirname,'../start.cmd'),file);
 for(const code of [0,1]){
  fs.writeFileSync(path.join(dir,'ladder-server.cjs'),`console.log('LOCAL_LAUNCH_CHECK');process.exit(${code});`);
  const result=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c',`""${file}""`],{windowsVerbatimArguments:true,windowsHide:true,encoding:'utf8',input:'\r\n',timeout:10000});
  assert.ifError(result.error);assert.equal(result.status,code,result.stdout+result.stderr);assert.match(result.stdout,/LOCAL_LAUNCH_CHECK/);assert.match(result.stdout,/http:\/\/127\.0\.0\.1:/);assert.match(result.stdout,/此窗口保留提示/);
 }
});
test('Windows browser command preserves the empty START title and quotes the local URL',()=>{
 const child=new EventEmitter();let call,unref=false;child.unref=()=>{unref=true;};const warnings=[];
 openBrowser(17864,{spawn:(...args)=>{call=args;return child;},logger:{warn:s=>warnings.push(s)}});
 assert.deepEqual(call[1],['/d','/s','/c','start "" "http://127.0.0.1:17864/"']);
 assert.equal(call[2].windowsVerbatimArguments,true);assert.equal(call[2].windowsHide,true);assert.equal(unref,true);
 child.emit('exit',0);assert.deepEqual(warnings,[]);
});
test('Failed browser launch prints one usable manual URL for both process errors and nonzero exit',()=>{
 const child=new EventEmitter();child.unref=()=>{};const warnings=[];
 openBrowser(17866,{spawn:()=>child,logger:{warn:s=>warnings.push(s)}});child.emit('error',Error('No browser'));child.emit('exit',1);
 assert.equal(warnings.length,1);assert.match(warnings[0],/http:\/\/127\.0\.0\.1:17866\//);
 const sync=[];openBrowser(17866,{spawn:()=>{throw Error('Unavailable');},logger:{warn:s=>sync.push(s)}});assert.equal(sync.length,1);
});
test('Launcher has valid bundled paths and retains diagnostics after success or failure',()=>{
 const cmd=fs.readFileSync(path.join(__dirname,'../start.cmd'),'utf8');
 assert.ok(cmd.includes('"%~dp0runtime\\node.exe" "%~dp0ladder-server.cjs" --open'));
 assert.ok(cmd.includes('"%~dp0runtime\\python\\python.exe"'));
 assert.ok(cmd.indexOf('pause >nul')>cmd.indexOf('--open'));
 assert.match(cmd,/chcp 65001/);assert.match(cmd,/SC2_LAUNCH_RESULT=%ERRORLEVEL%/);
});
