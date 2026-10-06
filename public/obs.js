/* OBS WebSocket v5 adapter. Password remains in the caller's connection closure. */
class ObsConnection {
  constructor(onStatus) { this.onStatus = onStatus; this.ws = null; this.pending = new Map(); this.ready = false; this.serial = 0; }
  async connect(port, password) {
    this.disconnect();
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('OBS端口需要是1024～65535的整数');
    this.onStatus('正在连接OBS…');
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`); this.ws = ws;
      let settled = false;
      const timer = setTimeout(() => { if (!settled) { settled = true; ws.close(); reject(new Error('连接超时，请检查OBS WebSocket设置')); } }, 7000);
      const hash = async value => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))));
      ws.onmessage = async event => {
        try {
          const message = JSON.parse(event.data), d = message.d;
          if (message.op === 0) {
            const identify = { rpcVersion: 1, eventSubscriptions: 0 };
            if (d.authentication) identify.authentication = await hash(await hash(password + d.authentication.salt) + d.authentication.challenge);
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 1, d: identify }));
          } else if (message.op === 2) { clearTimeout(timer); this.ready = true; settled = true; this.onStatus('OBS已连接'); resolve(); }
          else if (message.op === 7) {
            const request = this.pending.get(d.requestId);
            if (request) { this.pending.delete(d.requestId); clearTimeout(request.timer); d.requestStatus.result ? request.resolve(d.responseData || {}) : request.reject(new Error(d.requestStatus.comment || 'OBS操作失败')); }
          }
        } catch (e) { if (!settled) { settled = true; clearTimeout(timer); ws.close(); reject(e); } }
      };
      ws.onclose = event => {
        if (this.ws !== ws) return;
        clearTimeout(timer); this.ready = false;
        const reason = event.code === 4009 ? 'OBS密码不正确' : 'OBS连接已断开';
        this.onStatus(reason, true);
        for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error(reason)); } this.pending.clear();
        if (!settled) { settled = true; reject(new Error(reason + '，请检查服务器是否启用')); }
      };
      ws.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error('无法连接OBS，请确认服务器已启用')); } };
    });
  }
  request(requestType, requestData = {}) {
    if (!this.ready || this.ws?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('OBS尚未连接'));
    const requestId = `orbit-${++this.serial}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(new Error('OBS响应超时')); }, 4000);
      this.pending.set(requestId, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
    });
  }
  disconnect() {
    const ws = this.ws; this.ws = null; this.ready = false;
    if (ws) ws.close();
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error('OBS连接已断开')); }
    this.pending.clear(); this.onStatus('OBS已断开');
  }
}
window.ObsConnection = ObsConnection;
