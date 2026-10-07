(() => {
  const $ = id => document.getElementById(id), spec = window.StyleImageSpec;
  let connected = false, pending = null, candidate = null, candidateTheme = '', serial = 0;
  const status = $('styleImageStatus');
  for (const [role, value] of Object.entries(spec.roles)) {
    const option = document.createElement('option'); option.value = role; option.textContent = value.name; $('styleImageRole').append(option);
  }
  $('styleImageRole').value = 'waiting';
  function message(text, error = false) { status.textContent = text; status.classList.toggle('is-error', error); }
  function update() {
    $('styleImageGenerate').disabled = !connected || !!pending;
    $('styleImageInputs').disabled = !!pending;
    $('styleImageCancel').hidden = !pending;
  }
  function promptInput() {
    return {role: $('styleImageRole').value, theme: $('styleImageTheme').value, palette: window.StylePackWorkspace.draft().palette, useGuide: $('styleImageGuide').checked, hasReference: !!$('styleImageReference').files[0]};
  }
  function refreshTemplate() {
    const role = $('styleImageRole').value, value = spec.roles[role];
    $('styleImageRoleNote').textContent = value.width + '×' + value.height + ' · ' + value.note;
    $('styleImageTemplateDownload').href = '/api/style-image/template?role=' + encodeURIComponent(role);
    try { $('styleImagePrompt').value = spec.prompt(promptInput()); } catch { $('styleImagePrompt').value = '先填写主题描述，这里会显示按当前素材类型和配色生成的完整模板。'; }
  }
  for (const id of ['styleImageTheme', 'styleImageRole', 'styleImageGuide', 'styleImageReference', 'stylePack-dark', 'stylePack-mid', 'stylePack-accent', 'stylePack-text']) {
    $(id).addEventListener('input', refreshTemplate); $(id).addEventListener('change', refreshTemplate);
  }
  $('styleImageKind').addEventListener('change', () => {
    const responses = $('styleImageKind').value === 'responses';
    $('styleImageToolModelField').hidden = !responses;
    $('styleImageModelLabel').textContent = responses ? '对话模型（支持图片工具）' : '图片模型';
    $('styleImageModel').placeholder = responses ? '填写服务商支持的对话模型' : '例如 gpt-image-2';
    if (responses && $('styleImageModel').value === 'gpt-image-2') $('styleImageModel').value = '';
    else if (!responses && !$('styleImageModel').value) $('styleImageModel').value = 'gpt-image-2';
  });
  function readReference(file) {
    if (!file) return Promise.resolve(undefined);
    if (!/\.png$/i.test(file.name) || file.size > 4 * 1024 * 1024) return Promise.reject(Error('参考图请选择4MB以内的PNG'));
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(Error('参考图读取失败')); reader.readAsDataURL(file);
    });
  }
  $('styleImageGenerate').addEventListener('click', async () => {
    if (pending || !connected) return;
    const epoch = ++serial, abort = new AbortController(); pending = abort; update();
    const inputs = promptInput(), theme = inputs.theme;
    try {
      spec.prompt(inputs);
      const provider = {kind: $('styleImageKind').value, baseUrl: $('styleImageBaseURL').value.trim(), model: $('styleImageModel').value.trim(), imageModel: $('styleImageToolModel').value.trim(), apiKey: $('styleImageKey').value.trim(), size: $('styleImageSize').value};
      if (!provider.apiKey || !provider.model || !provider.baseUrl) throw Error('请展开“配置图像 API”，填写地址、模型和 API Key');
      const reference = await readReference($('styleImageReference').files[0]);
      if (epoch !== serial) return;
      message('正在生成' + spec.roles[inputs.role].name + '… 可继续使用助手，完成后在这里预览。');
      const response = await window.AssistantActions.request('/api/style-image/generate', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, signal: abort.signal,
        body: JSON.stringify({requestId: crypto.randomUUID(), role: inputs.role, theme, palette: inputs.palette, useGuide: inputs.useGuide, reference, provider})
      });
      const result = await response.json();
      if (epoch !== serial) return;
      if (!response.ok) throw Error(result.error || '生成失败');
      if (result.role !== inputs.role || !/^data:image\/png;base64,[a-zA-Z0-9+/]+={0,2}$/.test(result.dataUrl || '')) throw Error('生成结果格式无效');
      candidate = result; candidateTheme = theme;
      $('styleImagePreview').src = result.dataUrl;
      $('styleImagePreview').alt = spec.roles[result.role].name + ' · 待采用';
      $('styleImageResultNote').textContent = `${result.width}×${result.height} · ${result.note}`;
      $('styleImageDownload').href = result.dataUrl; $('styleImageDownload').download = 'theme-' + result.role + '.png';
      $('styleImageResult').hidden = false; $('styleImageAdopt').disabled = false;
      message('生成完成。检查图片后点击“采用这张素材”，或修改描述再次生成。');
    } catch (error) {
      if (epoch === serial) message(error.message || '生成连接中断，未自动重试', true);
    } finally {
      if (epoch === serial) { pending = null; update(); }
    }
  });
  $('styleImageCancel').addEventListener('click', () => {
    serial++; pending?.abort(); pending = null; update();
    message('已取消等待，未自动重试。服务商可能仍在处理本次请求并产生费用；已采用素材保留。');
  });
  $('styleImageAdopt').addEventListener('click', () => {
    if (!candidate) return;
    try {
      window.StylePackWorkspace.adopt(candidate, candidateTheme); $('styleImageAdopt').disabled = true;
      message('已加入下方风格包素材。可以继续生成其他部分，或点击“制作并安装”。');
    } catch (error) { message(error.message, true); }
  });
  window.StyleImageWorkspace = {connection(value) { connected = value; update(); }};
  addEventListener('pagehide', () => { serial++; pending?.abort(); $('styleImageKey').value = ''; });
  refreshTemplate(); update();
})();
