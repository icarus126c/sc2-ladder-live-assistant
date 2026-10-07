const zlib = require('node:zlib');
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const table = Array.from({length: 256}, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = table[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length); result.write(type, 4); data.copy(result, 8);
  result.writeUInt32BE(crc(result.subarray(4, -4)), result.length - 4);
  return result;
}
function decode(bytes) {
  if (bytes.length > 16 * 1024 * 1024 || !bytes.subarray(0, 8).equals(signature)) throw Error('接口需返回 16MB 以内的 PNG 图片');
  let header, transparentRGB, end = false, offset = 8;
  const parts = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw Error('PNG 数据不完整');
    const size = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    if (size > bytes.length - offset - 12) throw Error('PNG 数据长度无效');
    const data = bytes.subarray(offset + 8, offset + 8 + size);
    if (crc(bytes.subarray(offset + 4, offset + 8 + size)) !== bytes.readUInt32BE(offset + 8 + size)) throw Error('PNG 校验失败');
    if (!header && type !== 'IHDR') throw Error('PNG 缺少图片头');
    if (type === 'IHDR') {
      if (header || size !== 13) throw Error('PNG 图片头无效');
      header = {width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], color: data[9]};
      if (data[10] || data[11] || data[12]) throw Error('请使用非隔行 PNG 图片');
    } else if (type === 'tRNS') {
      if (header.color !== 2 || size !== 6) throw Error('PNG 透明数据无效');
      transparentRGB = [data.readUInt16BE(0), data.readUInt16BE(2), data.readUInt16BE(4)];
    } else if (type === 'IDAT') parts.push(data);
    else if (type === 'IEND') {
      if (size || offset + 12 !== bytes.length) throw Error('PNG 结束标记无效');
      end = true; break;
    } else if (/^[A-Z]/.test(type) && type !== 'PLTE') throw Error('PNG 包含不支持的数据块');
    offset += size + 12;
  }
  if (!end || !parts.length) throw Error('PNG 缺少像素数据');
  const {width, height, depth, color} = header;
  if (!width || !height || width > 4096 || height > 4096 || width * height > 9e6 || depth !== 8 || ![2, 6].includes(color)) throw Error('请使用最长边不超过4096的8位 RGB / RGBA PNG');
  const channels = color === 6 ? 4 : 3, stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(parts), {maxOutputLength: (stride + 1) * height});
  if (raw.length !== (stride + 1) * height) throw Error('PNG 像素数据不完整');
  const pixels = Buffer.alloc(width * height * 4);
  let previous = Buffer.alloc(stride);
  const paeth = (a, b, c) => { const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c); return x <= y && x <= z ? a : y <= z ? b : c; };
  for (let y = 0; y < height; y++) {
    const kind = raw[y * (stride + 1)], row = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    if (kind > 4) throw Error('PNG 行过滤器无效');
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0, b = previous[x], c = x >= channels ? previous[x - channels] : 0;
      row[x] = (row[x] + (kind === 1 ? a : kind === 2 ? b : kind === 3 ? Math.floor((a + b) / 2) : kind === 4 ? paeth(a, b, c) : 0)) & 255;
    }
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) pixels[at + c] = row[x * channels + c];
      pixels[at + 3] = channels === 4 ? row[x * channels + 3] : 255;
      if (transparentRGB?.every((value, c) => value === pixels[at + c])) pixels[at + 3] = 0;
    }
    previous = row;
  }
  return {width, height, pixels};
}
function create(width, height) { return {width, height, pixels: Buffer.alloc(width * height * 4)}; }
function encode({width, height, pixels}) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const stride = width * 4, raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function paint(image, x, y, width, height, color) {
  for (let row = Math.max(0, y); row < Math.min(image.height, y + height); row++) {
    for (let col = Math.max(0, x); col < Math.min(image.width, x + width); col++) image.pixels.set(color, (row * image.width + col) * 4);
  }
}
// Bilinear interpolation uses premultiplied alpha to avoid dark fringes.
function draw(source, target, rect, box) {
  for (let y = Math.max(0, Math.ceil(box.y)); y < Math.min(target.height, box.y + box.height); y++) {
    for (let x = Math.max(0, Math.ceil(box.x)); x < Math.min(target.width, box.x + box.width); x++) {
      const sx = Math.max(rect.x, Math.min(rect.x + rect.width - 1, rect.x + (x + .5 - box.x) * rect.width / box.width - .5));
      const sy = Math.max(rect.y, Math.min(rect.y + rect.height - 1, rect.y + (y + .5 - box.y) * rect.height / box.height - .5));
      const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
      const at = (y * target.width + x) * 4, sums = [0, 0, 0, 0];
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const pos = (Math.min(iy + j, rect.y + rect.height - 1) * source.width + Math.min(ix + i, rect.x + rect.width - 1)) * 4;
        const alpha = source.pixels[pos + 3] * (i ? fx : 1 - fx) * (j ? fy : 1 - fy);
        sums[3] += alpha;
        for (let c = 0; c < 3; c++) sums[c] += source.pixels[pos + c] * alpha;
      }
      target.pixels[at + 3] = Math.round(sums[3]);
      for (let c = 0; c < 3; c++) target.pixels[at + c] = sums[3] ? Math.round(sums[c] / sums[3]) : 0;
    }
  }
}
function fit(source, width, height, mode = 'cover') {
  const target = create(width, height), scale = Math[mode === 'contain' ? 'min' : 'max'](width / source.width, height / source.height);
  draw(source, target, {x: 0, y: 0, width: source.width, height: source.height}, {x: (width - source.width * scale) / 2, y: (height - source.height * scale) / 2, width: source.width * scale, height: source.height * scale});
  return target;
}
module.exports = {decode, encode, create, paint, draw, fit};
