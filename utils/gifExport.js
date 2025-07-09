/**
 * GIF导出相关功能
 * 注意：由于微信小程序环境限制，这里使用的是将多帧图像保存后再合成GIF的方法
 * 完整的GIF导出功能可能需要云函数支持
 */

/**
 * 捕获多帧画布内容并保存为临时文件
 * @param {Object} page - 页面实例
 * @param {number} frames - 帧数
 * @returns {Promise<Array<string>>} 临时文件路径数组
 */
async function captureFramesForGif(page, frames = 3) {
  const frameFiles = [];
  
  // 暂停当前动画
  page.animationController.stopAnimation();
  
  try {
    // 捕获每一帧
    for (let i = 0; i < frames; i++) {
      // 设置每个像素的当前帧
      page.animationController.activePixels.forEach(pixel => {
        pixel.currentFrame = i % pixel.frameData.length;
      });
      
      // 清除画布并绘制当前帧
      page.ctx.fillStyle = page.canvasBackground;
      page.ctx.fillRect(0, 0, page.canvasWidth, page.canvasHeight);
      
      page.animationController.activePixels.forEach(pixel => {
        pixel.draw(page.ctx);
      });
      
      // 等待绘制完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 将画布内容保存为图片
      const filePath = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas: page.canvas,
          success: res => resolve(res.tempFilePath),
          fail: err => reject(err)
        }, page);
      });
      
      frameFiles.push(filePath);
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
  
  return frameFiles;
}

/**
 * 保存多帧图像并提示用户
 * 注意：由于微信小程序限制，无法直接生成GIF，这里只是保存多张图片
 * 完整的GIF导出功能需要云函数支持
 * @param {Array<string>} frameFiles - 帧文件路径数组
 */
async function saveFrameImages(frameFiles) {
  if (!frameFiles || frameFiles.length === 0) {
    wx.showToast({
      title: '没有可用的帧',
      icon: 'none'
    });
    return;
  }
  
  try {
    // 保存第一帧作为示例
    await wx.saveImageToPhotosAlbum({
      filePath: frameFiles[0]
    });
    
    wx.showModal({
      title: '保存成功',
      content: '由于小程序限制，目前只能保存单帧图像。完整GIF导出功能需要云开发支持。',
      showCancel: false
    });
  } catch (error) {
    console.error('保存图片失败', error);
    wx.showToast({
      title: '保存失败',
      icon: 'none'
    });
  }
}

/**
 * 导出GIF动画（需要云函数支持）
 * 这是一个示例函数，实际实现需要配置云函数
 * @param {Array<string>} frameFiles - 帧文件路径数组
 * @param {Object} options - 配置选项
 * @returns {Promise<string>} GIF文件临时路径
 */
async function exportGif(frameFiles, options = {}) {
  if (!frameFiles || frameFiles.length === 0) {
    throw new Error('没有可用的帧');
  }
  
  // 这里应该调用云函数来合成GIF
  // 由于需要云开发支持，这里只返回提示信息
  wx.showModal({
    title: '功能提示',
    content: 'GIF导出功能需要云开发支持，请配置云函数后使用此功能。',
    showCancel: false
  });
  
  // 返回第一帧作为替代
  return frameFiles[0];
}

module.exports = {
  captureFramesForGif,
  saveFrameImages,
  exportGif
}