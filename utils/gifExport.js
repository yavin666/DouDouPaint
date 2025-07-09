/**
 * GIF导出相关功能
 * 使用修改后的gif.js库，适配微信小程序环境
 * 支持直接在小程序中生成GIF文件
 */

// 引入修改后的gif.js库
const GIF = require('./gif-miniprogram.js');
const { rootStore } = require('../stores/rootStore');

/**
 * 捕获多帧画布内容用于GIF生成
 * @param {Object} page - 页面实例
 * @param {number} frames - 帧数
 * @param {number} delay - 每帧延迟时间(ms)
 * @returns {Promise<Array<Object>>} 帧数据数组
 */
async function captureFramesForGif(page, frames = 10, delay = 200) {
  const frameDataList = [];

  // 暂停当前动画
  page.animationController.stopAnimation();

  try {
    // 获取画布尺寸
    const canvasWidth = page.canvas.width / 2; // 考虑scale(2,2)
    const canvasHeight = page.canvas.height / 2;

    // 捕获每一帧
    for (let i = 0; i < frames; i++) {
      // 设置每个像素的当前帧（模拟抖动动画的不同状态）
      // 通过rootStore访问pixelStore中的activePixels
      const activePixels = Array.from(rootStore.pixelStore.activePixels.values());
      activePixels.forEach(pixel => {
        // 为每个像素设置不同的抖动状态
        const pixelHash = pixel.id ? pixel.id.split('_')[1] || 0 : 0;
        pixel.currentFrame = (i + parseInt(pixelHash)) % (pixel.frameData?.length || 4);
      });

      // 清除画布并绘制当前帧
      const backgroundColor = rootStore.getCurrentBackgroundColor();
      if (backgroundColor === 'transparent') {
        // 透明背景：清除画布
        page.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      } else {
        // 非透明背景：填充背景色
        page.ctx.fillStyle = backgroundColor;
        page.ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }

      // 绘制所有像素
      activePixels.forEach(pixel => {
        pixel.draw(page.ctx);
      });

      // 等待绘制完成
      await new Promise(resolve => setTimeout(resolve, 50));

      // 获取画布图像数据 (type="2d" canvas)
      const imageData = await new Promise((resolve, reject) => {
        try {
          // 对于type="2d"的canvas，直接使用canvas context获取图像数据
          const ctx = page.canvas.getContext('2d');
          const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
          resolve(imgData);
        } catch (error) {
          // 如果直接获取失败，尝试使用wx.canvasGetImageData
          wx.canvasGetImageData({
            canvasId: 'myCanvas',
            x: 0,
            y: 0,
            width: canvasWidth,
            height: canvasHeight,
            success: resolve,
            fail: reject
          }, page);
        }
      });

      frameDataList.push({
        data: imageData.data,
        width: imageData.width,
        height: imageData.height,
        delay: delay
      });
    }
  } catch (error) {
    console.error('捕获帧失败', error);
    wx.showToast({
      title: '捕获帧失败',
      icon: 'none'
    });
  } finally {
    // 重新启动动画
    page.animationController.startAnimation();
  }

  return frameDataList;
}

/**
 * 生成GIF文件并保存到本地
 * @param {Array<Object>} frameDataList - 帧数据数组
 * @param {Object} options - GIF配置选项
 * @returns {Promise<string>} GIF文件路径
 */
async function generateGif(frameDataList, options = {}) {
  if (!frameDataList || frameDataList.length === 0) {
    throw new Error('没有可用的帧数据');
  }

  const firstFrame = frameDataList[0];

  // 检查是否需要透明背景
  const isTransparent = rootStore.getTransparentBackground();

  const gif = new GIF({
    workers: 1, // 小程序只支持一个worker
    width: firstFrame.width,
    height: firstFrame.height,
    debug: false,
    transparent: isTransparent ? 0x00000000 : null, // 设置透明色
    ...options
  });

  return new Promise((resolve, reject) => {
    let progress = 0;

    // 监听GIF生成进度
    gif.on('start', function() {
      console.log('开始生成GIF...');
    });

    gif.on('progress', function(p) {
      progress = Math.round(p * 100);
      console.log(`GIF生成进度: ${progress}%`);
      // 可以在这里更新UI进度条
    });

    gif.on('finished', function(data) {
      console.log('GIF生成完成');

      // 使用FileSystemManager保存GIF文件
      const fm = wx.getFileSystemManager();
      const ab = new ArrayBuffer(data.length);
      const dv = new DataView(ab);

      for (let i = 0; i < data.length; i++) {
        dv.setInt8(i, data[i]);
      }

      const gifPath = `${wx.env.USER_DATA_PATH}/doudou_paint_${Date.now()}.gif`;

      fm.writeFile({
        filePath: gifPath,
        encoding: 'binary',
        data: ab,
        success: () => {
          console.log('GIF文件保存成功:', gifPath);
          resolve(gifPath);
        },
        fail: (error) => {
          console.error('GIF文件保存失败:', error);
          reject(error);
        }
      });
    });

    gif.on('error', function(error) {
      console.error('GIF生成失败:', error);
      reject(error);
    });

    // 添加所有帧到GIF
    frameDataList.forEach(frameData => {
      gif.addFrame({
        data: frameData.data,
        width: frameData.width,
        height: frameData.height
      }, {
        delay: frameData.delay || 200
      });
    });

    // 开始渲染GIF
    gif.render();
  });
}

/**
 * 完整的GIF导出功能
 * @param {Object} page - 页面实例
 * @param {Object} options - 导出配置
 * @returns {Promise<string>} GIF文件路径
 */
async function exportGif(page, options = {}) {
  const {
    frames = 10,
    delay = 200,
    quality = 10,
    repeat = 0 // 0表示无限循环
  } = options;

  try {
    wx.showLoading({ title: '正在捕获帧...' });

    // 捕获帧数据
    const frameDataList = await captureFramesForGif(page, frames, delay);

    if (frameDataList.length === 0) {
      throw new Error('未能捕获到有效帧');
    }

    wx.showLoading({ title: '正在生成GIF...' });

    // 生成GIF文件
    const gifPath = await generateGif(frameDataList, {
      quality,
      repeat
    });

    wx.hideLoading();
    return gifPath;

  } catch (error) {
    wx.hideLoading();
    console.error('GIF导出失败:', error);
    throw error;
  }
}

/**
 * 保存GIF到相册（需要用户授权）
 * @param {string} gifPath - GIF文件路径
 */
async function saveGifToAlbum(gifPath) {
  try {
    // 由于微信小程序不支持直接保存GIF到相册
    // 这里提供文件路径供用户分享或其他操作
    wx.showModal({
      title: 'GIF生成成功',
      content: `GIF文件已保存到本地，路径：${gifPath}\n\n注意：微信小程序暂不支持直接保存GIF到相册，您可以通过分享功能发送给好友。`,
      showCancel: false,
      confirmText: '知道了'
    });
  } catch (error) {
    console.error('保存GIF失败:', error);
    wx.showToast({
      title: '保存失败',
      icon: 'none'
    });
  }
}

module.exports = {
  captureFramesForGif,
  generateGif,
  exportGif,
  saveGifToAlbum
}