const { rootStore } = require('../stores/rootStore')

/**
 * 简化的帧数据导出 - 只负责数据捕获，不生成GIF
 * 专注于3帧抖动数据的捕获，供后端使用
 */

/**
 * 导出3帧抖动数据给后端
 * @param {Object} page - 页面实例
 * @returns {Promise<Object>} 标准格式的帧数据
 */
async function exportFramesForBackend(page) {
  try {
    wx.showLoading({ title: '正在捕获帧数据...' })
    
    // 检查是否有绘制内容
    if (!rootStore.pixelStore.activePixels || rootStore.pixelStore.activePixels.size === 0) {
      wx.hideLoading()
      wx.showToast({ title: '请先绘制一些内容', icon: 'none' })
      return {
        success: false,
        error: 'NO_CONTENT',
        message: '没有可导出的内容'
      }
    }

    // 使用新的简化接口捕获帧数据
    const frameData = await rootStore.captureFramesForBackend()
    
    wx.hideLoading()
    
    // 返回标准格式的帧数据，供后端使用
    return {
      success: true,
      data: frameData,
      message: '帧数据捕获成功'
    }
  } catch (error) {
    wx.hideLoading()
    console.error('帧数据捕获失败:', error)
    return {
      success: false,
      error: error.message || 'CAPTURE_FAILED',
      message: '帧数据捕获失败'
    }
  }
}

/**
 * 显示帧数据导出选项（简化版）
 * @param {Object} page - 页面实例
 */
function showFrameExportOptions(page) {
  wx.showActionSheet({
    itemList: ['导出到后端', '预览帧数据', '取消'],
    success: async (res) => {
      switch (res.tapIndex) {
        case 0:
          // 导出到后端
          await exportToBackend(page)
          break
        case 1:
          // 预览帧数据
          await previewFrameData(page)
          break
        default:
          break
      }
    }
  })
}

/**
 * 导出到后端（示例实现）
 * @param {Object} page - 页面实例
 */
async function exportToBackend(page) {
  try {
    const result = await exportFramesForBackend(page)
    
    if (result.success) {
      // 这里可以调用后端API
      console.log('准备发送到后端的数据:', result.data)
      
      // 示例：发送到后端
      // const response = await wx.request({
      //   url: 'https://your-backend.com/api/generate-gif',
      //   method: 'POST',
      //   data: result.data
      // })
      
      wx.showToast({
        title: '数据已准备好发送到后端',
        icon: 'success'
      })
    } else {
      wx.showToast({
        title: result.message,
        icon: 'none'
      })
    }
  } catch (error) {
    console.error('导出到后端失败:', error)
    wx.showToast({
      title: '导出失败',
      icon: 'none'
    })
  }
}

/**
 * 预览帧数据信息
 * @param {Object} page - 页面实例
 */
async function previewFrameData(page) {
  try {
    const result = await exportFramesForBackend(page)
    
    if (result.success) {
      const { frames, totalFrames, frameRate, backgroundColor, isTransparent } = result.data
      
      const info = [
        `总帧数: ${totalFrames}`,
        `帧率: ${frameRate}ms/帧`,
        `背景: ${isTransparent ? '透明' : backgroundColor}`,
        `第一帧尺寸: ${frames[0]?.width}x${frames[0]?.height}`,
        `数据大小: ${JSON.stringify(result.data).length} 字符`
      ].join('\n')
      
      wx.showModal({
        title: '帧数据预览',
        content: info,
        showCancel: false
      })
    } else {
      wx.showToast({
        title: result.message,
        icon: 'none'
      })
    }
  } catch (error) {
    console.error('预览帧数据失败:', error)
    wx.showToast({
      title: '预览失败',
      icon: 'none'
    })
  }
}

module.exports = {
  exportFramesForBackend,
  showFrameExportOptions,
  exportToBackend,
  previewFrameData
}
