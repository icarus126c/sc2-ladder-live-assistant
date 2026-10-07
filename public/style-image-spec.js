(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StyleImageSpec = factory();
})(typeof window === 'object' ? window : globalThis, function() {
  const roles = {
    cover: {name: '风格封面', width: 960, height: 540, transparent: false, note: '一张主题封面，突出角色与氛围；不画按钮或小字。'},
    frame: {name: '游戏边框', width: 1920, height: 1080, transparent: true, note: '上方750像素完全透明，装饰仅在底部控制台边缘；小地图、单位信息、头像和指令内部留空。'},
    assistantFront: {name: '角色正面三态图', width: 1536, height: 512, transparent: true, note: '横排三个等宽格：待机、左手轻拍、右手轻拍。相同角色、服装、大小、机位与身体基准；不画键盘、鼠标或桌面。'},
    assistantRear: {name: '角色侧后三态图', width: 1536, height: 512, transparent: true, note: '横排待机、左拍、右拍三格。侧后方露出侧脸，朝左下方，双手伸向左侧；不画键盘、鼠标或桌面。'},
    waiting: {name: '等待背景', width: 1920, height: 1080, transparent: false, note: '16:9，角色与装饰靠边。中心x=500–1420、y=260–800留出低细节区域供直播文字使用。'},
    away: {name: '暂离背景', width: 1920, height: 1080, transparent: false, note: '16:9，与等待图同一角色和氛围，改为休息姿态。中心x=500–1420、y=260–800保持低细节。'}
  };
  function prompt({role, theme, palette, useGuide = false, hasReference = false}) {
    if (!Object.hasOwn(roles, role)) throw Error('请选择需要制作的素材');
    if (typeof theme !== 'string' || !theme.trim() || theme.length > 2000) throw Error('请填写2000字以内的主题描述');
    if (!palette || ['dark', 'mid', 'accent', 'text'].some(key => !/^#[a-f\d]{6}$/i.test(palette[key]))) throw Error('请填写完整的四个主题配色');
    const spec = roles[role];
    return [
      '为星际2天梯直播助手制作一张可安装的PNG素材，仅输出本项素材，不要拼接其他类型的素材。',
      '用户主题：' + theme.trim(),
      `配色：深色 ${palette.dark}，过渡 ${palette.mid}，强调 ${palette.accent}，文字 ${palette.text}。`,
      `本次制作：${spec.name}。最终画布 ${spec.width}×${spec.height}。${spec.note}`,
      role === 'frame' ? '以1920×1080坐标为准，控制台留空矩形：小地图(5,791,307,281)，单位信息(362,860,1028,212)，头像(1398,858,149,214)，指令(1554,789,360,283)。' : '',
      role.startsWith('assistant') ? '三格各保留约30像素安全边距，禁止跨格，额外高度保持透明。动作仅改变手臂和轻微身体起伏。' : '',
      spec.transparent ? '必须有真实RGBA透明通道。不要用白底、黑底或棋盘格伪装透明，不要加不透明底板。' : '背景构图保持横屏，避免将重要角色放在四周裁切边缘。',
      useGuide ? '附图中的布局导引仅用于定位，不能照抄导引色块或辅助线；深色区域必须留空，彩色窄边表示装饰范围。' : '',
      hasReference ? '附带的角色/风格参考图用于保持角色身份、服饰、颜色与画风一致。' : '',
      '文字、战绩、昵称、MMR、按键和时间全部由程序实时绘制，素材里不要画这些内容。不要添加水印、标题或假按钮。'
    ].filter(Boolean).join('\n');
  }
  return {roles, prompt};
});
