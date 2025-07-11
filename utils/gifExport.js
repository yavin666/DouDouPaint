/**
 * GIF导出相关功能
 * 基于云开发的GIF生成工作流
 * 前端负责帧捕获和上传，云函数负责GIF合成
 */

const { shareCloudGif, saveCloudGifToAlbum, getCloudFileUrl } = require('./cloudStorage');

/**
 * 将Canvas转换为临时图片文件
 * @param {Object} canvas - Canvas实例
 * @param {string} format - 图片格式，默认'png'
 * @param {number} quality - 图片质量，默认0.8
 * @returns {Promise<string>} 临时文件路径
 */
async function canvasToTempFile(canvas, format = 'png', quality = 0.8) {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas: canvas,
      fileType: format,
      quality: quality,
      success: (res) => {
        resolve(res.tempFilePath);
      },
      fail: (error) => {
        reject(error);
      }
    });
  });
}

/**
 * 捕获3帧动画并转换为图片文件
 * @param {Object} frameCapture - FrameCapture实例
 * @param {Object} canvas - Canvas实例
 * @returns {Promise<Array<string>>} 图片文件路径数组
 */
async function capture3FramesAsImages(frameCapture, canvas) {
  const imagePaths = [];

  try {
    // 暂停动画
    const wasAnimating = frameCapture.animationLoop?.isRunning || false;
    if (wasAnimating) {
      frameCapture.animationLoop.stop();
    }

    // 捕获3帧
    for (let frameIndex = 0; frameIndex < 3; frameIndex++) {
      // 设置所有像素到指定帧
      const activePixels = Array.from(frameCapture.pixelStore.activePixels.values());
      activePixels.forEach(pixel => {
        pixel.currentFrame = frameIndex % (pixel.frameData?.length || 3);
      });

      // 渲染当前帧
      frameCapture.frameRenderer.renderFrame(frameCapture.pixelStore);

      // 等待渲染完成
      await new Promise(resolve => setTimeout(resolve, 50));

      // 转换为临时图片文件
      const tempFilePath = await canvasToTempFile(canvas, 'png', 0.9);
      imagePaths.push(tempFilePath);

      console.log(`已捕获第 ${frameIndex + 1}/3 帧: ${tempFilePath}`);
    }

    // 恢复动画
    if (wasAnimating) {
      frameCapture.animationLoop.start();
    }

    return imagePaths;

  } catch (error) {
    console.error('捕获帧失败:', error);
    throw error;
  }
}

/**
 * 上传图片到云存储
 * @param {Array<string>} imagePaths - 图片文件路径数组
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<Array<string>>} 云存储文件ID数组
 */
async function uploadImagesToCloud(imagePaths, onProgress) {
  const fileIds = [];

  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];

    try {
      // 生成云存储路径
      const timestamp = Date.now();
      const cloudPath = `gif-frames/frame_${timestamp}_${i}.png`;

      // 上传到云存储
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: imagePath
      });

      fileIds.push(uploadResult.fileID);

      // 更新进度
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: imagePaths.length,
          progress: Math.round(((i + 1) / imagePaths.length) * 100)
        });
      }

      console.log(`已上传第 ${i + 1}/${imagePaths.length} 张图片: ${uploadResult.fileID}`);

    } catch (error) {
      console.error(`上传第 ${i + 1} 张图片失败:`, error);
      throw error;
    }
  }

  return fileIds;
}

/**
 * 调用云函数合成GIF
 * @param {Array<string>} fileIds - 云存储文件ID数组
 * @param {Object} options - GIF配置选项
 * @returns {Promise<Object>} 合成结果
 */
async function callGifCloudFunction(fileIds, options = {}) {
  const {
    delay = 200,
    repeat = 0,
    quality = 10
  } = options;

  try {
    const result = await wx.cloud.callFunction({
      name: 'generateGif',
      data: {
        fileIds: fileIds,
        options: {
          delay,
          repeat,
          quality
        }
      }
    });

    if (result.result.success) {
      return result.result;
    } else {
      throw new Error(result.result.error || 'GIF合成失败');
    }

  } catch (error) {
    console.error('调用云函数失败:', error);
    throw error;
  }
}

/**
 * 完整的GIF导出功能 - 新的云开发工作流
 * @param {Object} frameCapture - FrameCapture实例
 * @param {Object} canvas - Canvas实例
 * @param {Object} options - 导出配置
 * @returns {Promise<Object>} 导出结果
 */
async function exportGifWithCloud(frameCapture, canvas, options = {}) {
  const {
    delay = 200,
    repeat = 0,
    quality = 10
  } = options;

  try {
    // 第一步：捕获帧并转换为图片
    wx.showLoading({ title: '正在捕获帧...' });
    const imagePaths = await capture3FramesAsImages(frameCapture, canvas);

    if (imagePaths.length === 0) {
      throw new Error('未能捕获到有效帧');
    }

    // 第二步：上传图片到云存储
    wx.showLoading({ title: '正在上传图片...' });
    const fileIds = await uploadImagesToCloud(imagePaths, (progress) => {
      wx.showLoading({
        title: `上传中 ${progress.progress}%`
      });
    });

    // 第三步：调用云函数合成GIF
    wx.showLoading({ title: '正在合成GIF...' });
    const result = await callGifCloudFunction(fileIds, {
      delay,
      repeat,
      quality
    });

    wx.hideLoading();

    // 清理临时文件
    try {
      const fm = wx.getFileSystemManager();
      imagePaths.forEach(path => {
        fm.unlinkSync(path);
      });
    } catch (error) {
      console.warn('清理临时文件失败:', error);
    }

    return {
      success: true,
      gifFileId: result.gifFileId,
      gifUrl: result.gifUrl,
      frameCount: imagePaths.length
    };

  } catch (error) {
    wx.hideLoading();
    console.error('GIF导出失败:', error);
    throw error;
  }
}

/**
 * 显示GIF操作选项（云开发版本）
 * @param {Object} result - GIF导出结果
 */
async function showCloudGifOptions(result) {
  return new Promise((resolve) => {
    wx.showActionSheet({
      itemList: ['分享给好友', '保存到本地', '获取分享链接'],
      success: async (res) => {
        try {
          switch (res.tapIndex) {
            case 0: // 分享给好友
              try {
                const shareInfo = await shareCloudGif(result.gifFileId, `doudou_paint_${Date.now()}.gif`);
                wx.showModal({
                  title: '分享提示',
                  content: '请点击右上角菜单选择"转发"来分享您的GIF作品！',
                  showCancel: false,
                  confirmText: '知道了'
                });

                // 将分享信息存储到全局，供页面分享使用
                getApp().globalData = getApp().globalData || {};
                getApp().globalData.shareInfo = shareInfo;

              } catch (error) {
                wx.showToast({
                  title: '准备分享失败',
                  icon: 'none'
                });
              }
              break;

            case 1: // 保存到本地
              try {
                await saveCloudGifToAlbum(result.gifFileId);
              } catch (error) {
                wx.showToast({
                  title: '保存失败',
                  icon: 'none'
                });
              }
              break;

            case 2: // 获取分享链接
              try {
                const tempUrl = await getCloudFileUrl(result.gifFileId);
                wx.showModal({
                  title: '分享链接',
                  content: `文件链接已生成（24小时有效）:\n${tempUrl}`,
                  showCancel: true,
                  confirmText: '复制链接',
                  cancelText: '关闭',
                  success: (modalRes) => {
                    if (modalRes.confirm) {
                      wx.setClipboardData({
                        data: tempUrl,
                        success: () => {
                          wx.showToast({
                            title: '链接已复制',
                            icon: 'success'
                          });
                        }
                      });
                    }
                  }
                });
              } catch (error) {
                wx.showToast({
                  title: '获取链接失败',
                  icon: 'none'
                });
              }
              break;
          }
        } catch (error) {
          console.error('操作失败:', error);
          wx.showToast({
            title: '操作失败',
            icon: 'none'
          });
        }
        resolve();
      },
      fail: () => resolve()
    });
  });
}

module.exports = {
  canvasToTempFile,
  capture3FramesAsImages,
  uploadImagesToCloud,
  callGifCloudFunction,
  exportGifWithCloud,
  showCloudGifOptions
}