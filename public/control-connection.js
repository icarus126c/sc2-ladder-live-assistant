(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ControlConnection = factory();
})(typeof window === 'object' ? window : globalThis, function() {
  function create({fetchImpl = fetch, EventSourceImpl = EventSource, onState, onStatus = () => {}, onToken = () => {}, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout} = {}) {
    let closed = false, streamOpen = false, generation = 0, ready = false;
    let session = null, latestState = null, refreshJob = null, controller = null, retryTimer = null, statusKey = '';
    const events = new EventSourceImpl('/api/events?role=control');
    const current = epoch => !closed && streamOpen && epoch === generation;
    function status(value, message) {
      ready = value;
      const key = value + ':' + message;
      if (key !== statusKey) { statusKey = key; onStatus(value, message); }
    }
    function updateReady() {
      const matched = !!session && !!latestState && session.serverInstanceId === latestState.serverInstanceId;
      status(matched, matched ? '本机已连接' : '正在恢复连接…');
    }
    function clearRetry() {
      if (retryTimer !== null) clearTimeoutImpl(retryTimer);
      retryTimer = null;
    }
    function refresh() {
      if (refreshJob) return refreshJob;
      if (closed || !streamOpen) return Promise.reject(Error('与助手连接中断，正在自动重连，请稍后再试'));
      clearRetry();
      const epoch = generation, abort = new AbortController();
      controller = abort;
      status(false, '正在恢复连接…');
      const job = Promise.resolve().then(async () => {
        try {
          const response = await fetchImpl('/api/control-session', {
            headers: {'X-Control-Client': 'assistant'}, cache: 'no-store',
            signal: AbortSignal.any([abort.signal, AbortSignal.timeout(5000)])
          });
          if (!response.ok) throw Error('控制连接尚未就绪');
          const value = await response.json();
          if (!current(epoch)) throw Error('连接已变化，请稍后再试');
          if (!/^[a-f\d]{48}$/.test(value.token) || typeof value.serverInstanceId !== 'string' || !value.serverInstanceId) throw Error('控制连接数据无效');
          session = value;
          onToken(value.token);
          updateReady();
        } catch (error) {
          if (current(epoch)) {
            session = null;
            status(false, '连接恢复中，正在自动重试');
            retryTimer = setTimeoutImpl(() => { retryTimer = null; void refresh().catch(() => {}); }, 1000);
          }
          throw error;
        } finally {
          if (refreshJob === job) refreshJob = null;
          if (controller === abort) controller = null;
        }
      });
      refreshJob = job;
      return job;
    }
    function invalidate() {
      generation++;
      streamOpen = false;
      clearRetry();
      controller?.abort();
      controller = null;
      refreshJob = null;
      session = latestState = null;
    }
    events.onopen = () => {
      if (closed) return;
      invalidate();
      streamOpen = true;
      void refresh().catch(() => {});
    };
    events.onmessage = event => {
      if (closed || !streamOpen) return;
      try {
        latestState = JSON.parse(event.data);
        if (!latestState || typeof latestState.serverInstanceId !== 'string') throw Error('状态格式错误');
        if (session && session.serverInstanceId === latestState.serverInstanceId) updateReady();
        else if (!refreshJob && retryTimer === null) void refresh().catch(() => {});
        onState(latestState);
      } catch {
        status(false, '状态同步失败，正在重新连接');
      }
    };
    events.onerror = () => {
      if (closed) return;
      invalidate();
      status(false, '连接中断，正在自动重连');
    };
    async function request(url, options = {}) {
      if (closed || !streamOpen) throw Error('与助手连接中断，正在自动重连，请稍后再试');
      if (refreshJob) await refreshJob;
      if (!ready) throw Error('连接恢复中，请稍后再试');
      const epoch = generation, token = session.token;
      const send = value => {
        const headers = new Headers(options.headers);
        headers.set('X-Control-Token', value);
        return fetchImpl(url, {...options, headers});
      };
      const response = await send(token);
      // Only an explicit authorization rejection proves the operation did not run.
      // Never replay a request after a timeout, disconnect, or other uncertain result.
      if (response.status !== 403 || !current(epoch)) return response;
      if (session?.token === token) await refresh();
      else if (refreshJob) await refreshJob;
      if (!current(epoch) || !ready) throw Error('连接恢复中，请稍后再试');
      return session.token === token ? response : send(session.token);
    }
    return {
      request,
      close() { closed = true; invalidate(); events.close(); status(false, '连接已关闭'); }
    };
  }
  return {create};
});
