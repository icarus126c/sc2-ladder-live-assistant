(()=>{
  const video=document.getElementById('sceneVideo');if(!video)return;let source='';
  function report(message){if(document.body.classList.contains('preview'))parent.postMessage({type:'sceneMediaError',message},location.origin);}
  video.addEventListener('error',()=>{video.hidden=true;report('视频无法播放，请选择可播放的MP4或WebM文件。');});
  function render(c,hidden){
    const next=!hidden&&c?.waitingBackground==='video'?c.waitingBackgroundVideo:'';
    if(!next){video.hidden=true;if(source){video.pause();video.removeAttribute('src');video.load();source='';}return;}
    video.hidden=false;video.style.objectFit=c.waitingImageFit||'cover';video.muted=c.waitingVideoMuted!==false;video.loop=c.waitingVideoLoop!==false;
    if(source!==next){source=next;video.src=next;video.load();video.play()?.catch(()=>report('视频未自动播放，可先启用静音播放。'));}
  }
  window.SceneVideo={render};
})();
