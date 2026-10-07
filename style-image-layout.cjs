const png = require('./png-image.cjs');
const {roles} = require('./public/style-image-spec.js');
const {panels} = require('./public/gameframe-template.js');
const {png: validate} = require('./style-packs.cjs');

function guide(role) {
  if (!Object.hasOwn(roles, role)) throw Error('素材类型不正确');
  const {width, height} = roles[role], image = png.create(width, height);
  png.paint(image, 0, 0, width, height, [234, 236, 238, 255]);
  if (role === 'frame') {
    png.paint(image, 0, 0, width, 750, [36, 42, 48, 255]);
    for (const {x, y, w, h} of panels) {
      png.paint(image, x - 7, y - 7, w + 14, h + 14, [245, 201, 40, 255]);
      png.paint(image, x, y, w, h, [36, 42, 48, 255]);
    }
  } else if (role.startsWith('assistant')) {
    for (let i = 0; i < 3; i++) {
      png.paint(image, i * 512 + 30, 30, 452, 452, [214, 224, 226, 255]);
      png.paint(image, i * 512 + 30, 479, 452, 3, [245, 201, 40, 255]);
    }
  } else if (role !== 'cover') png.paint(image, 500, 260, 920, 540, [36, 42, 48, 255]);
  return png.encode(image);
}
function bounds(image, left, right) {
  let x0 = right, y0 = image.height, x1 = left - 1, y1 = -1;
  for (let y = 0; y < image.height; y++) for (let x = left; x < right; x++) {
    if (image.pixels[(y * image.width + x) * 4 + 3] > 4) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  if (x1 < x0) throw Error('角色图缺少一个或多个状态，请按横排三格模板重新生成');
  return {x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1};
}
function normalize(bytes, role) {
  if (!Object.hasOwn(roles, role)) throw Error('素材类型不正确');
  const spec = roles[role], source = png.decode(bytes);
  let transparent = 0, visible = 0;
  for (let i = 3; i < source.pixels.length; i += 4) { if (!source.pixels[i]) transparent++; else visible++; }
  if (!visible) throw Error('接口返回了全透明图片，请重新生成');
  if (spec.transparent && transparent < source.width * source.height * .05) throw Error('图片缺少真实透明区域；请使用支持透明PNG的模型重新生成，不能以棋盘格代替');
  let result, note;
  if (role.startsWith('assistant')) {
    if (source.width / source.height < 1.4) throw Error('角色图需要横排三态，接口返回了竖图或方图；请选横向生成尺寸');
    const cells = Array.from({length: 3}, (_, i) => bounds(source, Math.floor(i * source.width / 3), Math.floor((i + 1) * source.width / 3)));
    const scale = Math.min(452 / Math.max(...cells.map(c => c.width)), 452 / Math.max(...cells.map(c => c.height)));
    result = png.create(1536, 512);
    cells.forEach((cell, i) => png.draw(source, result, cell, {x: i * 512 + (512 - cell.width * scale) / 2, y: 482 - cell.height * scale, width: cell.width * scale, height: cell.height * scale}));
    note = '已按三格分别去除透明空白、统一缩放并对齐基线；请预览确认角色和动作一致。';
  } else {
    result = png.fit(source, spec.width, spec.height, role === 'frame' ? 'contain' : 'cover');
    note = '已等比裁切并适配为 ' + spec.width + '×' + spec.height + '；请预览确认重要内容未被裁掉。';
    if (role === 'frame') {
      png.paint(result, 0, 0, 1920, 750, [0, 0, 0, 0]);
      for (const {x, y, w, h} of panels) png.paint(result, x + 4, y + 4, w - 8, h - 8, [0, 0, 0, 0]);
      if (!result.pixels.some((v, i) => i % 4 === 3 && v > 0)) throw Error('清除游戏遮挡区域后没有可用边框，请让模型把装饰放在底部边缘');
      note = '已等比适配画布，并清除上方750像素及控制台内部；请预览检查边线位置。';
    }
  }
  const output = png.encode(result);
  validate(output, role);
  return {dataUrl: 'data:image/png;base64,' + output.toString('base64'), width: spec.width, height: spec.height, bytes: output.length, note};
}
module.exports = {guide, normalize};
