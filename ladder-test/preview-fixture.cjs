// Rendering tests mock the transport; preview-connection.test.cjs exercises the
// real parent/frame handshake, origin checks, streams and cache behavior.
module.exports=`window.PreviewConnection={create({onState}){const e=new EventSource('/api/events');e.onmessage=x=>onState(JSON.parse(x.data));return{close(){e.close?.();}};},attachHost(){return{publish(){}};}};\n`;
