const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup(){
  const events={},frames=[],link={hash:'#settings',dataset:{guideTarget:'playerNames'},textContent:'填写游戏用户名 ↗',addEventListener(type,fn){this[type]=fn;}},fold={tagName:'DETAILS',open:false,parentElement:null},target={parentElement:fold,scrollIntoView(){this.scrolled=true;},focus(){this.focused=true;}};
  const nodes={tutorialReturn:{hidden:true},tutorialDestination:{},tutorialDismiss:{addEventListener(type,fn){this[type]=fn;}},playerNames:target},location={hash:'#tutorial'};
  const document={querySelectorAll(selector){return selector==='[data-guide-target]'?[link]:[];},getElementById(id){return nodes[id];}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/usage-ui.js'),'utf8'),{document,location,addEventListener(type,fn){(events[type]??=[]).push(fn);},requestAnimationFrame(fn){frames.push(fn);}});
  function hashchange(){for(const fn of events.hashchange)fn();}
  function flush(){while(frames.length)frames.shift()();}
  return {link,fold,target,nodes,location,hashchange,flush};
}

test('tutorial navigation reveals and focuses the requested setting, and offers a return link',()=>{
  const c=setup();let prevented=false;c.link.click({button:0,preventDefault(){prevented=true;}});c.hashchange();c.flush();
  assert.equal(prevented,true);assert.equal(c.location.hash,'#settings');assert.equal(c.fold.open,true);assert.equal(c.target.scrolled,true);assert.equal(c.target.focused,true);assert.equal(c.nodes.tutorialReturn.hidden,false);assert.equal(c.nodes.tutorialDestination.textContent,'教程导航 · 填写游戏用户名');
  c.location.hash='#tutorial';c.hashchange();assert.equal(c.nodes.tutorialReturn.hidden,true);
});
test('leaving a tutorial destination before reveal cancels stale scrolling and focus',()=>{
  const c=setup();c.link.click({button:0,preventDefault(){}});c.location.hash='#console';c.hashchange();c.flush();assert.equal(c.target.focused,undefined);assert.equal(c.fold.open,false);assert.equal(c.nodes.tutorialReturn.hidden,true);
});
test('modified tutorial link clicks preserve normal browser navigation',()=>{
  const c=setup();c.link.click({button:0,ctrlKey:true,preventDefault(){assert.fail('Must preserve new-tab behavior');}});c.flush();assert.equal(c.location.hash,'#tutorial');assert.equal(c.target.focused,undefined);
});
