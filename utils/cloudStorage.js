/**
 * 微信云开发存储功能
 * 用于上传和管理GIF文件
 */

/**
 * 初始化云开发
 */
function initCloud() {
  if (!wx.cloud) {
    console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    return false;
  }
  
  try {
    wx.cloud.init({
      env: 'cloud1-7gk3tqj6c1e40f81', // 您的云环境ID
      traceUser: true
    });
    console.log('云开发初始化成功');
    return true;
  } catch (error) {
    console.error('云开发初始化失败:', error);
    return false;
  }
}

/**
 * 上传GIF文件到云存储
 * @param {string} localFilePath - 本地文件路径
 * @param {string} fileName - 文件名（可选）
 * @returns {Promise<Object>} 上传结果
 */
async function uploadGifToCloud(localFilePath, fileName) {
  if (!initCloud()) {
    throw new Error('云开发初始化失败');
  }
  
  try {
    // 生成唯一文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const cloudFileName = fileName || `doudou_paint_${timestamp}_${randomStr}.gif`;
    const cloudPath = `gif/${cloudFileName}`;
    
    wx.showLoading({ title: '正在上传到云端...' });
    
    // 上传文件到云存储
    const uploadResult = await wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: localFilePath
    });
    
    wx.hideLoading();
    
    console.log('文件上传成功:', uploadResult);
    
    return {
      success: true,
      fileID: uploadResult.fileID,
      cloudPath: cloudPath,
      fileName: cloudFileName
    };
    
  } catch (error) {
    wx.hideLoading();
    console.error('上传文件失败:', error);
    throw error;
  }
}

/**
 * 获取云存储文件的临时链接
 * @param {string} fileID - 云存储文件ID
 * @returns {Promise<string>} 临时链接
 */
async function getCloudFileUrl(fileID) {
  try {
    const result = await wx.cloud.getTempFileURL({
      fileList: [fileID]
    });
    
    if (result.fileList && result.fileList.length > 0) {
      const fileInfo = result.fileList[0];
      if (fileInfo.status === 0) {
        return fileInfo.tempFileURL;
      } else {
        throw new Error(`获取文件链接失败: ${fileInfo.errMsg}`);
      }
    } else {
      throw new Error('未找到文件信息');
    }
  } catch (error) {
    console.error('获取云文件链接失败:', error);
    throw error;
  }
}

/**
 * 下载云存储文件到本地
 * @param {string} fileID - 云存储文件ID
 * @returns {Promise<string>} 本地文件路径
 */
async function downloadCloudFile(fileID) {
  try {
    // 先获取临时链接
    const tempUrl = await getCloudFileUrl(fileID);
    
    wx.showLoading({ title: '正在下载文件...' });
    
    // 下载文件到本地
    const downloadResult = await new Promise((resolve, reject) => {
      wx.downloadFile({
        url: tempUrl,
        success: resolve,
        fail: reject
      });
    });
    
    wx.hideLoading();
    
    return downloadResult.tempFilePath;
    
  } catch (error) {
    wx.hideLoading();
    console.error('下载云文件失败:', error);
    throw error;
  }
}

/**
 * 删除云存储文件
 * @param {string} fileID - 云存储文件ID
 * @returns {Promise<boolean>} 删除结果
 */
async function deleteCloudFile(fileID) {
  try {
    await wx.cloud.deleteFile({
      fileList: [fileID]
    });
    
    console.log('云文件删除成功:', fileID);
    return true;
    
  } catch (error) {
    console.error('删除云文件失败:', error);
    throw error;
  }
}

/**
 * 获取用户的GIF文件列表（需要配合云函数）
 * @returns {Promise<Array>} 文件列表
 */
async function getUserGifList() {
  try {
    // 这里需要调用云函数来获取用户的文件列表
    // 因为云存储没有直接的列表API
    const result = await wx.cloud.callFunction({
      name: 'getUserFiles',
      data: {
        folder: 'gif'
      }
    });
    
    return result.result.fileList || [];
    
  } catch (error) {
    console.error('获取文件列表失败:', error);
    return [];
  }
}

/**
 * 分享云存储GIF文件
 * @param {string} fileID - 云存储文件ID
 * @param {string} fileName - 文件名
 * @returns {Promise<Object>} 分享信息
 */
async function shareCloudGif(fileID, fileName) {
  try {
    // 获取临时链接用于分享
    const tempUrl = await getCloudFileUrl(fileID);
    
    return {
      title: '豆豆画板 - 抖动线条动画',
      path: `/pages/share/share?fileID=${encodeURIComponent(fileID)}&fileName=${encodeURIComponent(fileName)}`,
      imageUrl: tempUrl, // 使用GIF作为分享图片
      success: () => {
        wx.showToast({
          title: '分享成功',
          icon: 'success'
        });
      },
      fail: (error) => {
        console.error('分享失败:', error);
        wx.showToast({
          title: '分享失败',
          icon: 'none'
        });
      }
    };
    
  } catch (error) {
    console.error('准备分享失败:', error);
    throw error;
  }
}

/**
 * 保存云存储GIF到本地相册
 * @param {string} fileID - 云存储文件ID
 */
async function saveCloudGifToAlbum(fileID) {
  try {
    // 下载文件到本地
    const localPath = await downloadCloudFile(fileID);
    
    // 由于GIF无法直接保存到相册，使用openDocument打开
    await new Promise((resolve, reject) => {
      wx.openDocument({
        filePath: localPath,
        showMenu: true,
        success: resolve,
        fail: reject
      });
    });
    
  } catch (error) {
    console.error('保存到相册失败:', error);
    
    // 如果打开失败，提示用户通过分享保存
    wx.showModal({
      title: '保存提示',
      content: '无法直接保存GIF到相册，建议通过分享功能发送给文件传输助手或好友来保存文件。',
      showCancel: false,
      confirmText: '知道了'
    });
  }
}

module.exports = {
  initCloud,
  uploadGifToCloud,
  getCloudFileUrl,
  downloadCloudFile,
  deleteCloudFile,
  getUserGifList,
  shareCloudGif,
  saveCloudGifToAlbum
};
