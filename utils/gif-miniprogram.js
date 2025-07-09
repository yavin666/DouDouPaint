/**
 * 适配微信小程序的GIF.js库
 * 基于gif.js修改，移除DOM操作，适配小程序环境
 */

// 帧默认配置
const frameDefaults = {
  delay: 500,
  dispose: -1,
  transparent: false,
  copy: false
};

// GIF构造函数
function GIF(options = {}) {
  this.options = {
    workers: 1,
    quality: 10,
    width: null,
    height: null,
    transparent: null,
    debug: false,
    globalPalette: false,
    repeat: 0,
    ...options
  };
  
  this.frames = [];
  this.freeWorkers = [];
  this.activeWorkers = [];
  this.imageParts = [];
  this.running = false;
  this.events = {};
  
  // 初始化worker（小程序环境下简化处理）
  this.initWorker();
}

// 事件系统
GIF.prototype.on = function(event, callback) {
  if (!this.events[event]) {
    this.events[event] = [];
  }
  this.events[event].push(callback);
};

GIF.prototype.emit = function(event, ...args) {
  if (this.events[event]) {
    this.events[event].forEach(callback => {
      try {
        callback.apply(this, args);
      } catch (error) {
        console.error('Event callback error:', error);
      }
    });
  }
};

// 初始化Worker（小程序环境简化版）
GIF.prototype.initWorker = function() {
  // 小程序环境下创建简化的worker
  const worker = {
    postMessage: (data) => {
      // 模拟worker处理
      setTimeout(() => {
        this.handleWorkerMessage(data);
      }, 10);
    },
    terminate: () => {
      // 清理资源
    }
  };
  
  this.freeWorkers.push(worker);
};

// 处理Worker消息
GIF.prototype.handleWorkerMessage = function(data) {
  // 简化的图像处理逻辑
  const imageData = this.processFrame(data);
  
  this.imageParts.push({
    data: [imageData],
    pageSize: imageData.length,
    cursor: imageData.length
  });
  
  // 触发进度事件
  const progress = this.imageParts.length / this.frames.length;
  this.emit('progress', progress);
  
  // 如果所有帧都处理完成，开始最终渲染
  if (this.imageParts.length === this.frames.length) {
    this.finishRendering();
  }
};

// 简化的帧处理
GIF.prototype.processFrame = function(frameData) {
  const { width, height, data, delay = 200 } = frameData;

  // 创建GIF帧数据结构
  const frameHeader = this.createFrameHeader(width, height, delay);
  const imageData = this.processImageData(data, width, height);

  // 合并帧头和图像数据
  const frameBytes = new Uint8Array(frameHeader.length + imageData.length);
  frameBytes.set(frameHeader, 0);
  frameBytes.set(imageData, frameHeader.length);

  return frameBytes;
};

// 创建GIF帧头
GIF.prototype.createFrameHeader = function(width, height, delay) {
  const header = [];

  // 图像分隔符
  header.push(0x21, 0xF9, 0x04); // 图形控制扩展
  header.push(0x00); // 处置方法

  // 延迟时间（1/100秒为单位）
  const delayTime = Math.round(delay / 10);
  header.push(delayTime & 0xFF, (delayTime >> 8) & 0xFF);

  header.push(0x00); // 透明色索引
  header.push(0x00); // 块终止符

  // 图像描述符
  header.push(0x2C); // 图像分隔符
  header.push(0x00, 0x00); // 左边距
  header.push(0x00, 0x00); // 上边距
  header.push(width & 0xFF, (width >> 8) & 0xFF); // 宽度
  header.push(height & 0xFF, (height >> 8) & 0xFF); // 高度
  header.push(0x00); // 标志

  return new Uint8Array(header);
};

// 处理图像数据
GIF.prototype.processImageData = function(data, width, height) {
  // 简化的颜色量化和LZW压缩
  const pixels = [];

  // 转换RGBA到RGB并进行颜色量化
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // 简单的颜色量化（减少到256色）
    const quantizedColor = this.quantizeColor(r, g, b);
    pixels.push(quantizedColor);
  }

  // 简化的LZW压缩
  const compressed = this.simpleLZW(pixels);

  // 添加LZW最小代码大小
  const result = [0x08]; // 8位颜色深度
  result.push(...compressed);
  result.push(0x00); // 块终止符

  return new Uint8Array(result);
};

// 简单的颜色量化
GIF.prototype.quantizeColor = function(r, g, b) {
  // 将RGB值量化到6x6x6色彩空间（216色）
  const qr = Math.floor(r / 51) * 51;
  const qg = Math.floor(g / 51) * 51;
  const qb = Math.floor(b / 51) * 51;

  // 返回颜色索引
  return Math.floor(qr / 51) * 36 + Math.floor(qg / 51) * 6 + Math.floor(qb / 51);
};

// 简化的LZW压缩
GIF.prototype.simpleLZW = function(pixels) {
  const result = [];
  const dict = new Map();

  // 初始化字典
  for (let i = 0; i < 256; i++) {
    dict.set(String(i), i);
  }

  let dictSize = 256;
  let current = '';

  for (const pixel of pixels) {
    const next = current + pixel;

    if (dict.has(next)) {
      current = next;
    } else {
      // 输出当前字符串的代码
      if (current !== '') {
        result.push(dict.get(current));
      }

      // 添加新字符串到字典
      if (dictSize < 4096) {
        dict.set(next, dictSize++);
      }

      current = String(pixel);
    }
  }

  // 输出最后的字符串
  if (current !== '') {
    result.push(dict.get(current));
  }

  // 将结果打包成字节
  const packed = [];
  let bitBuffer = 0;
  let bitCount = 0;
  const codeSize = 9; // 简化为固定9位

  for (const code of result) {
    bitBuffer |= (code << bitCount);
    bitCount += codeSize;

    while (bitCount >= 8) {
      packed.push(bitBuffer & 0xFF);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  }

  // 处理剩余位
  if (bitCount > 0) {
    packed.push(bitBuffer & 0xFF);
  }

  // 分块输出
  const chunked = [];
  for (let i = 0; i < packed.length; i += 255) {
    const chunk = packed.slice(i, i + 255);
    chunked.push(chunk.length);
    chunked.push(...chunk);
  }

  return chunked;
};

// 设置选项
GIF.prototype.setOption = function(key, value) {
  this.options[key] = value;
};

// 添加帧（修改版，适配小程序）
GIF.prototype.addFrame = function(image, options = {}) {
  const frame = {};
  
  frame.index = options.index || 0;
  frame.transparent = this.options.transparent;
  
  // 应用默认配置
  for (const key in frameDefaults) {
    frame[key] = options[key] !== undefined ? options[key] : frameDefaults[key];
  }
  
  // 设置尺寸
  if (this.options.width == null) {
    this.setOption("width", image.width);
  }
  if (this.options.height == null) {
    this.setOption("height", image.height);
  }
  
  // 处理图像数据
  if (image && image.width && image.height && image.data) {
    frame.data = image.data;
    frame.width = image.width;
    frame.height = image.height;
  } else {
    throw new Error("Invalid image data");
  }
  
  return this.frames.push(frame);
};

// 开始渲染
GIF.prototype.render = function() {
  if (this.running) {
    return;
  }
  
  this.running = true;
  this.emit('start');
  
  // 处理每一帧
  this.frames.forEach((frame, index) => {
    const worker = this.freeWorkers[0]; // 小程序只用一个worker
    if (worker) {
      worker.postMessage({
        index: index,
        data: frame.data,
        width: frame.width,
        height: frame.height,
        delay: frame.delay,
        transparent: frame.transparent,
        dispose: frame.dispose
      });
    }
  });
};

// 完成渲染（修改版，适配小程序）
GIF.prototype.finishRendering = function() {
  this.log("开始最终渲染...");

  // 创建完整的GIF文件
  const gifHeader = this.createGifHeader();
  const gifTrailer = new Uint8Array([0x3B]); // GIF文件结束标记

  // 计算总长度
  let totalLength = gifHeader.length;
  this.imageParts.forEach(frame => {
    frame.data.forEach(page => {
      totalLength += page.length;
    });
  });
  totalLength += gifTrailer.length;

  this.log("rendering finished - filesize " + Math.round(totalLength / 1000) + "kb");

  // 创建最终数据
  const data = new Uint8Array(totalLength);
  let offset = 0;

  // 写入GIF头部
  data.set(gifHeader, offset);
  offset += gifHeader.length;

  // 写入所有帧数据
  this.imageParts.forEach(frame => {
    frame.data.forEach(page => {
      data.set(page, offset);
      offset += page.length;
    });
  });

  // 写入GIF尾部
  data.set(gifTrailer, offset);

  // 清理worker
  if (this.freeWorkers.length > 0) {
    const worker = this.freeWorkers.shift();
    worker.terminate();
  }

  this.running = false;
  this.emit("finished", data);
};

// 创建GIF文件头
GIF.prototype.createGifHeader = function() {
  const header = [];

  // GIF签名和版本
  header.push(...[0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // "GIF89a"

  // 逻辑屏幕宽度和高度
  const width = this.options.width || 100;
  const height = this.options.height || 100;
  header.push(width & 0xFF, (width >> 8) & 0xFF);
  header.push(height & 0xFF, (height >> 8) & 0xFF);

  // 全局颜色表标志
  header.push(0xF7); // 全局颜色表存在，8位颜色深度
  header.push(0x00); // 背景色索引
  header.push(0x00); // 像素宽高比

  // 全局颜色表（256色）
  const colorTable = this.createColorTable();
  header.push(...colorTable);

  // 应用程序扩展（循环控制）
  if (this.options.repeat !== undefined) {
    header.push(...[
      0x21, 0xFF, 0x0B, // 应用程序扩展
      0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, // "NETSCAPE"
      0x32, 0x2E, 0x30, // "2.0"
      0x03, 0x01, // 子块大小和标识
      this.options.repeat & 0xFF, (this.options.repeat >> 8) & 0xFF, // 循环次数
      0x00 // 块终止符
    ]);
  }

  return new Uint8Array(header);
};

// 创建颜色表
GIF.prototype.createColorTable = function() {
  const colorTable = [];

  // 生成6x6x6颜色立方体（216色）
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        colorTable.push(r * 51, g * 51, b * 51);
      }
    }
  }

  // 填充剩余的颜色槽为黑色
  while (colorTable.length < 768) { // 256 * 3
    colorTable.push(0, 0, 0);
  }

  return colorTable;
};

// 日志输出
GIF.prototype.log = function(message) {
  if (this.options.debug) {
    console.log('[GIF]', message);
  }
};

module.exports = GIF;
