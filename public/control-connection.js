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
    function adopt(value) {
      if (!value || typeof value.serverInstanceId !== 'string') return value;
      if (latestState?.serverInstanceId === value.serverInstanceId && Number.isInteger(latestState.revision) && Number.isInteger(value.revision) && value.revision < latestState.revision) return latestState;
      latestState = value;
      return value;
    }
    events.onmessage = event => {
      if (closed || !streamOpen) return;
      try {
        const incoming = JSON.parse(event.data);
        if (adopt(incoming) !== incoming) return;
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
    function assertResponseCurrent(epoch, instance) {
      if (!current(epoch) || session?.serverInstanceId !== instance || latestState?.serverInstanceId !== instance) {
        throw Error('连接已变化，已忽略旧响应；请核对操作结果后再试');
      }
    }
    function guardResponse(response, epoch, instance) {
      const readers = new Set(['json', 'text', 'blob', 'arrayBuffer', 'formData', 'bytes']);
      return new Proxy(response, {get(target, key) {
        const value = Reflect.get(target, key, target);
        if (readers.has(key) && typeof value === 'function') return async (...args) => {
          assertResponseCurrent(epoch, instance);
          const result = await value.apply(target, args);
          assertResponseCurrent(epoch, instance);
          if (key === 'json') {
            if (result?.serverInstanceId) {if(result.serverInstanceId !== instance) throw Error('服务已变化，已忽略旧响应');return adopt(result);}
            if (result?.state?.serverInstanceId) {if(result.state.serverInstanceId !== instance) throw Error('服务已变化，已忽略旧响应');return {...result, state: adopt(result.state)};}
          }
          return result;
        };
        if (key === 'clone' && typeof value === 'function') return () => {
          assertResponseCurrent(epoch, instance);
          return guardResponse(value.call(target), epoch, instance);
        };
        return typeof value === 'function' ? value.bind(target) : value;
      }});
    }
    async function request(url, options = {}) {
      if (closed || !streamOpen) throw Error('与助手连接中断，正在自动重连，请稍后再试');
      if (refreshJob) await refreshJob;
      if (!ready) throw Error('连接恢复中，请稍后再试');
      const epoch = generation, token = session.token, instance = session.serverInstanceId;
      const send = value => {
        const headers = new Headers(options.headers);
        headers.set('X-Control-Token', value);
        return fetchImpl(url, {...options, headers});
      };
      const response = await send(token);
      // Only an explicit authorization rejection proves the operation did not run.
      // Never replay a request after a timeout, disconnect, or other uncertain result.
      assertResponseCurrent(epoch, instance);
      if (response.status !== 403) return guardResponse(response, epoch, instance);
      if (session?.token === token) await refresh();
      else if (refreshJob) await refreshJob;
      if (!current(epoch) || !ready) throw Error('连接恢复中，请稍后再试');
      assertResponseCurrent(epoch, instance);
      const result = session.token === token ? response : await send(session.token);
      assertResponseCurrent(epoch, instance);
      return guardResponse(result, epoch, instance);
    }
    return {
      request,
      close() { closed = true; invalidate(); events.close(); status(false, '连接已关闭'); }
    };
  }
  return {create};
});
