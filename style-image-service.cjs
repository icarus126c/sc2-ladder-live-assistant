const crypto = require('node:crypto');
const {prompt, roles} = require('./public/style-image-spec.js');
const layout = require('./style-image-layout.cjs');
const png = require('./png-image.cjs');
const MAX_RESPONSE = 24 * 1024 * 1024;

async function readLimited(body, limit) {
  const chunks = []; let size = 0;
  for await (const chunk of body) {
    size += chunk.length;
    if (size > limit) throw Error('图片接口数据过大，请降低生成尺寸后重试');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
function endpoint(value) {
  let url;
  try { url = new URL(value); } catch { throw Error('请填写完整的图像 API 地址'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw Error('API 地址需使用 HTTPS；本机服务可使用 HTTP');
  if (url.username || url.password || url.search || url.hash) throw Error('API 地址不能包含账号、密钥、查询参数或锚点');
  url.pathname = url.pathname.replace(/\/(?:images\/(?:generations|edits)|responses)\/?$/, '').replace(/\/+$/, '') + '/';
  return url;
}
function text(value, label, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) throw Error('请填写有效的' + label);
  return value.trim();
}
function reference(value) {
  if (!value) return null;
  if (typeof value !== 'string' || value.length > 6 * 1024 * 1024 || !/^data:image\/png;base64,[a-zA-Z0-9+/]+={0,2}$/.test(value)) throw Error('参考图需为4MB以内的PNG');
  const bytes = Buffer.from(value.slice(22), 'base64');
  if (bytes.length > 4 * 1024 * 1024) throw Error('参考图需为4MB以内的PNG');
  png.decode(bytes);
  return bytes;
}
function prepare(input) {
  if (!input || typeof input !== 'object' || !/^[a-f\d-]{20,64}$/i.test(input.requestId || '')) throw Error('生成请求标识无效，请重新点击生成');
  const provider = input.provider;
  if (!provider || !['images', 'responses'].includes(provider.kind)) throw Error('请选择 Images 或 Responses 接口');
  const base = endpoint(provider.baseUrl), model = text(provider.model, '模型名称'), key = text(provider.apiKey, 'API Key', 4000);
  const ref = reference(input.reference);
  const useGuide = input.useGuide === true;
  const instructions = prompt({role: input.role, theme: input.theme, palette: input.palette, useGuide, hasReference: !!ref});
  const size = provider.size || '1536x1024';
  if (!['1536x1024', '1536x864', '1536x512', '1024x1024', 'auto'].includes(size)) throw Error('生成尺寸不受支持');
  const spec = roles[input.role], images = [];
  if (useGuide) images.push({name: 'layout-guide.png', bytes: layout.guide(input.role)});
  if (ref) images.push({name: 'character-reference.png', bytes: ref});
  const settings = {size, output_format: 'png', background: spec.transparent ? 'transparent' : 'opaque'};
  const headers = {Authorization: 'Bearer ' + key};
  let body, pathname;
  if (provider.kind === 'responses') {
    const tool = {type: 'image_generation', ...settings};
    if (provider.imageModel) tool.model = text(provider.imageModel, '图片模型名称');
    pathname = 'responses';
    body = JSON.stringify({model, store: false, tools: [tool], tool_choice: {type: 'image_generation'}, input: [{role: 'user', content: [
      {type: 'input_text', text: instructions},
      ...images.map(image => ({type: 'input_image', image_url: 'data:image/png;base64,' + image.bytes.toString('base64')}))
    ]}]});
    headers['Content-Type'] = 'application/json';
  } else if (images.length) {
    pathname = 'images/edits'; body = new FormData();
    for (const [k, v] of Object.entries({model, prompt: instructions, n: '1', ...settings})) body.append(k, v);
    for (const image of images) body.append('image[]', new Blob([image.bytes], {type: 'image/png'}), image.name);
  } else {
    pathname = 'images/generations';
    body = JSON.stringify({model, prompt: instructions, n: 1, ...settings});
    headers['Content-Type'] = 'application/json';
  }
  return {url: new URL(pathname, base), headers, body, instructions};
}
function downloadURL(value, providerURL) {
  let url;
  try { url = new URL(value); } catch { throw Error('图片接口返回了无效的下载地址'); }
  if (url.username || url.password || url.hash) throw Error('图片下载地址不受支持');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (local && url.origin !== providerURL.origin) throw Error('图片下载地址不能指向其他本机服务');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local && url.origin === providerURL.origin)) throw Error('图片下载地址需使用 HTTPS');
  if (/^(?:10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.)/.test(url.hostname)) throw Error('图片下载地址不能指向内网地址');
  return url;
}
function createStyleImageService({fetchImpl = fetch, timeoutMs = 180000} = {}) {
  let active = null, closed = false;
  const jobs = new Map();
  function generate(input, {signal} = {}) {
    if (closed) throw Error('助手正在关闭');
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const old = jobs.get(input?.requestId);
    if (old) {
      if (old.fingerprint !== fingerprint) throw Error('生成请求标识已使用，请重新点击生成');
      return old.promise;
    }
    if (active) throw Error('已有图片正在生成，请等待完成或取消后再试');
    const prepared = prepare(input), controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, {once: true});
    if (signal?.aborted) abort();
    const requestSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);
    active = controller;
    const job = {fingerprint};
    job.promise = Promise.resolve().then(async () => {
      let response, data;
      try {
        response = await fetchImpl(prepared.url, {method: 'POST', headers: prepared.headers, body: prepared.body, signal: requestSignal, redirect: 'error'});
        if (!response.ok) {
          await response.body?.cancel();
          const hint = [401, 403].includes(response.status) ? '请检查密钥、模型权限和服务商生图开关' : response.status === 429 ? '请检查服务商额度或稍后手动重试' : '请检查接口类型与模型支持的图片参数';
          throw Error(`图像接口返回 ${response.status}；${hint}。本次未自动重试。`);
        }
        const bytes = await readLimited(response.body, MAX_RESPONSE);
        try { data = JSON.parse(bytes.toString('utf8')); } catch { throw Error('接口未返回有效JSON；请检查 API 地址和接口类型'); }
      } catch (error) {
        if (requestSignal.aborted) throw Error('生成已取消或超时，未自动重试；服务商可能仍在处理本次请求');
        if (/^(?:图像接口|图片接口数据|接口未返回)/.test(error.message)) throw error;
        throw Error('无法连接图片接口或连接中断，未自动重试；请检查服务地址与网络');
      }
      const item = input.provider.kind === 'responses'
        ? (Array.isArray(data?.output) ? data.output.find(x => x?.type === 'image_generation_call' && typeof x.result === 'string') : null)
        : (Array.isArray(data?.data) ? data.data[0] : null);
      const base64 = input.provider.kind === 'responses' ? item?.result : item?.b64_json;
      let image;
      if (typeof base64 === 'string' && /^[a-zA-Z0-9+/]+={0,2}$/.test(base64)) image = Buffer.from(base64, 'base64');
      else if (item?.url && input.provider.kind === 'images') {
        const url = downloadURL(item.url, prepared.url);
        try {
          // Signed CDN URLs never receive the provider's API key or control token.
          const download = await fetchImpl(url, {signal: requestSignal, redirect: 'error'});
          if (!download.ok) { await download.body?.cancel(); throw Error('download failed'); }
          image = await readLimited(download.body, 16 * 1024 * 1024);
        } catch { throw Error('图片已生成但下载失败，未重新生成；请检查服务商返回的图片链接'); }
      } else throw Error('接口没有返回图片；请确认所选模型及服务商分组已开启生图');
      if (requestSignal.aborted) throw Error('生成已取消或超时，未自动重试');
      return {role: input.role, ...layout.normalize(image, input.role)};
    }).finally(() => {
      signal?.removeEventListener('abort', abort);
      if (active === controller) active = null;
    });
    jobs.set(input.requestId, job);
    while (jobs.size > 4) jobs.delete(jobs.keys().next().value);
    return job.promise;
  }
  return {generate, close() { closed = true; active?.abort(); jobs.clear(); }};
}
module.exports = {createStyleImageService, prepare, endpoint, readLimited, downloadURL};
