/**
 * GIF导出相关功能
 * 使用修改后的gif.js库，适配微信小程序环境
 * 支持直接在小程序中生成GIF文件
 */

// 引入修改后的gif.js库
const GIF = require('./gif-miniprogram.js');
const { rootStore } = require('../stores/rootStore.js');
const { uploadGifToCloud, shareCloudGif, saveCloudGifToAlbum, getCloudFileUrl } = require('./cloudStorage');

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
 * 打开GIF文件供用户查看和保存
 * @param {string} gifPath - GIF文件路径
 */
async function openGifFile(gifPath) {
  try {
    // 使用wx.openDocument打开GIF文件
    await new Promise((resolve, reject) => {
      wx.openDocument({
        filePath: gifPath,
        showMenu: true, // 显示右上角菜单，允许用户转发保存
        success: (res) => {
          console.log('GIF文件打开成功');
          resolve(res);
        },
        fail: (error) => {
          console.error('打开GIF文件失败:', error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error('打开GIF文件失败:', error);

    // 如果打开失败，显示提示信息
    wx.showModal({
      title: 'GIF生成成功',
      content: `GIF文件已保存到本地临时目录。\n\n由于系统限制，无法直接预览GIF文件，但文件已成功生成。您可以通过其他方式访问该文件。`,
      showCancel: true,
      confirmText: '查看路径',
      cancelText: '知道了',
      success: (res) => {
        if (res.confirm) {
          // 显示文件路径
          wx.showModal({
            title: '文件路径',
            content: gifPath,
            showCancel: false,
            confirmText: '复制路径',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.setClipboardData({
                  data: gifPath,
                  success: () => {
                    wx.showToast({
                      title: '路径已复制',
                      icon: 'success'
                    });
                  }
                });
              }
            }
          });
        }
      }
    });
  }
}

/**
 * 创建可分享的GIF文件
 * @param {string} gifPath - 本地GIF文件路径
 * @returns {Promise<string>} 可分享的文件路径
 */
async function createShareableGif(gifPath) {
  try {
    // 读取GIF文件数据
    const fm = wx.getFileSystemManager();
    const gifData = await new Promise((resolve, reject) => {
      fm.readFile({
        filePath: gifPath,
        encoding: 'binary',
        success: (res) => resolve(res.data),
        fail: reject
      });
    });

    // 创建一个新的临时文件用于分享
    const shareablePath = `${wx.env.USER_DATA_PATH}/share_doudou_paint_${Date.now()}.gif`;
    await new Promise((resolve, reject) => {
      fm.writeFile({
        filePath: shareablePath,
        data: gifData,
        encoding: 'binary',
        success: resolve,
        fail: reject
      });
    });

    return shareablePath;
  } catch (error) {
    console.error('创建可分享GIF失败:', error);
    throw error;
  }
}

/**
 * 显示GIF操作选项（云开发版本）
 * @param {string} gifPath - 本地GIF文件路径
 */
async function showGifOptions(gifPath) {
  return new Promise((resolve) => {
    wx.showActionSheet({
      itemList: ['本地预览', '上传到云端', '查看文件信息'],
      success: async (res) => {
        try {
          switch (res.tapIndex) {
            case 0: // 本地预览
              await openGifFile(gifPath);
              break;

            case 1: // 上传到云端
              try {
                await uploadAndShareGif(gifPath);
              } catch (error) {
                wx.showToast({
                  title: '上传失败',
                  icon: 'none'
                });
              }
              break;

            case 2: // 查看文件信息
              await showFileInfo(gifPath);
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

/**
 * 上传GIF到云端并显示分享选项
 * @param {string} localGifPath - 本地GIF文件路径
 */
async function uploadAndShareGif(localGifPath) {
  try {
    // 上传到云存储
    const uploadResult = await uploadGifToCloud(localGifPath);

    if (uploadResult.success) {
      // 显示云端操作选项
      await showCloudGifOptions(uploadResult.fileID, uploadResult.fileName);
    } else {
      throw new Error('上传失败');
    }

  } catch (error) {
    console.error('上传GIF失败:', error);
    wx.showModal({
      title: '上传失败',
      content: `无法上传到云端: ${error.message}\n\n您可以选择本地预览或查看文件信息。`,
      showCancel: false,
      confirmText: '知道了'
    });
  }
}

/**
 * 显示云端GIF操作选项
 * @param {string} fileID - 云存储文件ID
 * @param {string} fileName - 文件名
 */
async function showCloudGifOptions(fileID, fileName) {
  return new Promise((resolve) => {
    wx.showActionSheet({
      itemList: ['分享给好友', '保存到本地', '获取分享链接', '删除云端文件'],
      success: async (res) => {
        try {
          switch (res.tapIndex) {
            case 0: // 分享给好友
              try {
                const shareInfo = await shareCloudGif(fileID, fileName);
                // 触发页面分享
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
                await saveCloudGifToAlbum(fileID);
              } catch (error) {
                wx.showToast({
                  title: '保存失败',
                  icon: 'none'
                });
              }
              break;

            case 2: // 获取分享链接
              try {
                const tempUrl = await getCloudFileUrl(fileID);
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

            case 3: // 删除云端文件
              wx.showModal({
                title: '确认删除',
                content: '确定要删除云端的GIF文件吗？删除后无法恢复。',
                success: async (modalRes) => {
                  if (modalRes.confirm) {
                    try {
                      await deleteCloudFile(fileID);
                      wx.showToast({
                        title: '删除成功',
                        icon: 'success'
                      });
                    } catch (error) {
                      wx.showToast({
                        title: '删除失败',
                        icon: 'none'
                      });
                    }
                  }
                }
              });
              break;
          }
        } catch (error) {
          console.error('云端操作失败:', error);
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

/**
 * 显示文件信息
 * @param {string} filePath - 文件路径
 */
async function showFileInfo(filePath) {
  try {
    const fm = wx.getFileSystemManager();
    const stats = await new Promise((resolve, reject) => {
      fm.stat({
        path: filePath,
        success: resolve,
        fail: reject
      });
    });

    const fileSizeKB = Math.round(stats.size / 1024);
    const createTime = new Date(stats.lastModifiedTime).toLocaleString();

    wx.showModal({
      title: 'GIF文件信息',
      content: `文件大小: ${fileSizeKB}KB\n创建时间: ${createTime}\n文件路径: ${filePath}`,
      showCancel: true,
      confirmText: '复制路径',
      cancelText: '关闭',
      success: (modalRes) => {
        if (modalRes.confirm) {
          wx.setClipboardData({
            data: filePath,
            success: () => {
              wx.showToast({
                title: '路径已复制',
                icon: 'success'
              });
            }
          });
        }
      }
    });
  } catch (error) {
    wx.showToast({
      title: '获取文件信息失败',
      icon: 'none'
    });
  }
}

module.exports = {
  captureFramesForGif,
  generateGif,
  exportGif,
  openGifFile,
  createShareableGif,
  showGifOptions,
  uploadAndShareGif,
  showCloudGifOptions,
  showFileInfo
}