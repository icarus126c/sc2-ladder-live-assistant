(()=>{
  let expanded=null,trigger=null;
  function close(){if(!expanded)return;expanded.classList.remove('preview-expanded');expanded.removeAttribute('role');expanded.removeAttribute('aria-modal');document.body.classList.remove('preview-is-expanded');const button=expanded.querySelector('[data-preview-zoom]');button.textContent='放大预览';button.setAttribute('aria-expanded','false');expanded=null;trigger?.focus();}
  for(const frame of document.querySelectorAll('.workspace-view iframe[data-src]')){
    const section=frame.closest('section.surface');if(!section||section.querySelector('[data-preview-zoom]'))continue;
    let head=section.querySelector('.section-head');if(!head){head=document.createElement('div');head.className='section-head';const title=section.querySelector('h2');if(title){title.before(head);head.append(title);}else section.prepend(head);}
    const button=document.createElement('button');button.type='button';button.dataset.previewZoom='';button.textContent='放大预览';button.setAttribute('aria-expanded','false');head.append(button);
    button.addEventListener('click',()=>{if(expanded===section){close();return;}close();expanded=section;trigger=button;section.classList.add('preview-expanded');section.setAttribute('role','dialog');section.setAttribute('aria-modal','true');section.setAttribute('aria-label',frame.title||'画面预览');document.body.classList.add('preview-is-expanded');button.textContent='收起预览 · Esc';button.setAttribute('aria-expanded','true');button.focus();});
  }
  addEventListener('keydown',event=>{if(!expanded)return;if(event.key==='Escape'){event.preventDefault();close();return;}if(event.key==='Tab'){const buttons=[...expanded.querySelectorAll('button,a,input,select,textarea,[tabindex]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});addEventListener('hashchange',close);
  for(const button of document.querySelectorAll('[data-scan-today]'))button.addEventListener('click',async()=>{button.disabled=true;try{await window.AssistantActions.act('replayScan',{mode:'today'});window.AssistantActions.toast('今日录像已检查');}catch(error){window.AssistantActions.toast(error.message);}finally{button.disabled=false;}});
  // Tutorial links reveal the exact control without changing saved settings.
  let tutorialRoute='',navigationTicket=0;
  const tutorialReturn=document.getElementById('tutorialReturn');
  const tutorialDestination=document.getElementById('tutorialDestination');
  function closeTutorialNavigation(){navigationTicket++;tutorialRoute='';tutorialReturn.hidden=true;}
  document.getElementById('tutorialDismiss').addEventListener('click',closeTutorialNavigation);
  addEventListener('hashchange',()=>{if(location.hash!==tutorialRoute)closeTutorialNavigation();});
  for(const link of document.querySelectorAll('[data-guide-target]'))link.addEventListener('click',event=>{
    if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    const target=document.getElementById(link.dataset.guideTarget);if(!target)return;
    event.preventDefault();const ticket=++navigationTicket;tutorialRoute=link.hash;location.hash=tutorialRoute;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(ticket!==navigationTicket||location.hash!==tutorialRoute)return;
      for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
      tutorialReturn.hidden=false;tutorialDestination.textContent='教程导航 · '+link.textContent.replace(/[→↗]/g,'').trim();
      target.scrollIntoView({block:'center',behavior:'instant'});target.focus({preventScroll:true});
    }));
  });

})();
