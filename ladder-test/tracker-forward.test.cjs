const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('newer tracker streams require valid identity, unit fields, complete bytes and replay time coverage',()=>{
 const r=spawnSync(require('../runtime-paths.cjs').python(),['-X','utf8',path.join(__dirname,'tracker-forward-test.py')],{encoding:'utf8',windowsHide:true});
 assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stderr,/Ran 5 tests/);
});
