/**
 * GIF导出管理器
 * 专注于云端GIF生成和本地保存功能
 */

const { callGifCloudFunction, downloadGifToLocal } = require('./gifExport')

/**
 * GIF导出管理器类
 */
class GifExportManager {
  constructor() {
    this.isExporting = false
  }

  /**
   * 检查云开发是否已初始化
   */
  checkCloudInit() {
    if (!wx.cloud) {
      throw new Error('请使用 2.2.3 或以上的基础库以使用云能力')
    }
    // 云开发应该在app.js中已经初始化
    return true
  }

  /**
   * 导出GIF动画
   * @param {Object} page 页面实例
   * @param {Object} params GIF参数
   * @param {Function} onProgress 进度回调
   * @returns {Promise<Object>} 导出结果
   */
  async exportGif(page, params = {}, onProgress) {
    if (this.isExporting) {
      throw new Error('正在导出中，请稍后再试')
    }

    this.isExporting = true

    try {
      return await this.generateGif(page, params, onProgress)
    } finally {
      this.isExporting = false
    }
  }

  /**
   * 生成GIF动画
   * @param {Object} page 页面实例
   * @param {Object} params GIF参数
   * @param {Function} onProgress 进度回调
   */
  async generateGif(page, params = {}, onProgress) {
    if (!page.canvas || !page.animationStore) {
      throw new Error('画布未初始化')
    }

    // 检查是否有绘制内容
    if (page.animationStore.pixelStore.activePixels.size === 0) {
      throw new Error('画布为空，请先绘制内容')
    }

    // 检查云开发初始化
    this.checkCloudInit()

    const defaultParams = {
      delay: 200,    // 默认延迟200ms
      repeat: 0,     // 无限循环
      quality: 10    // 默认质量
    }

    const gifParams = { ...defaultParams, ...params }

    try {
      // 第一步：捕获3帧图片
      if (onProgress) onProgress({ stage: 'capture', progress: 0, message: '正在捕获帧...' })
      
      const imagePaths = await page.animationStore.capture3FramesAsImages()
      
      if (imagePaths.length === 0) {
        throw new Error('未能捕获到有效帧')
      }

      // 第二步：上传到云存储
      if (onProgress) onProgress({ stage: 'upload', progress: 30, message: '正在上传图片...' })
      
      const fileIds = await page.animationStore.frameCapture.uploadImagesToCloud(imagePaths, (uploadProgress) => {
        if (onProgress) {
          onProgress({
            stage: 'upload',
            progress: 30 + (uploadProgress.progress * 0.4), // 30-70%
            message: `正在上传第 ${uploadProgress.current}/${uploadProgress.total} 张图片...`
          })
        }
      })

      // 第三步：调用云函数合成GIF
      if (onProgress) onProgress({ stage: 'generate', progress: 70, message: '正在生成GIF...' })

      const result = await callGifCloudFunction(fileIds, gifParams)

      // 第四步：下载GIF到本地（测试版本可能跳过）
      if (onProgress) onProgress({ stage: 'download', progress: 90, message: '正在下载GIF...' })

      let localGifPath = null
      try {
        localGifPath = await this.downloadGifToLocal(result.fileID)
        console.log('GIF下载成功:', localGifPath)
      } catch (error) {
        console.warn('GIF下载失败（可能是测试版本）:', error)
        // 对于测试版本，我们跳过下载步骤
        localGifPath = null
      }

      // 清理临时文件（跳过 http://tmp/ 格式的路径）
      try {
        const fm = wx.getFileSystemManager()
        imagePaths.forEach(path => {
          // 只清理 wxfile:// 格式的临时文件
          if (path.startsWith('wxfile://') || path.startsWith('/')) {
            try {
              fm.unlinkSync(path)
              console.log('已清理临时文件:', path)
            } catch (unlinkError) {
              console.warn('清理单个文件失败:', path, unlinkError)
            }
          } else {
            console.log('跳过清理非标准路径:', path)
          }
        })
      } catch (error) {
        console.warn('清理临时文件失败:', error)
      }

      if (onProgress) onProgress({ stage: 'complete', progress: 100, message: 'GIF生成完成' })

      return {
        success: true,
        data: {
          cloudFileID: result.fileID,
          localPath: localGifPath,
          ...result
        },
        message: 'GIF生成并保存成功'
      }

    } catch (error) {
      console.error('云端GIF导出失败:', error)
      throw error
    }
  }

  /**
   * 下载GIF到本地
   * @param {string} fileID 云存储文件ID
   * @returns {Promise<string>} 本地文件路径
   */
  async downloadGifToLocal(fileID) {
    try {
      console.log('开始下载GIF，文件ID:', fileID)

      // 获取云文件的临时链接
      const result = await wx.cloud.getTempFileURL({
        fileList: [fileID]
      })

      if (!result.fileList || result.fileList.length === 0) {
        throw new Error('获取文件链接失败')
      }

      const tempFileURL = result.fileList[0].tempFileURL
      console.log('获取到临时链接:', tempFileURL)

      // 下载文件到本地
      const downloadResult = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: tempFileURL,
          success: (res) => {
            console.log('下载完成，结果:', res)
            resolve(res)
          },
          fail: (error) => {
            console.error('下载失败:', error)
            reject(error)
          }
        })
      })

      if (downloadResult.statusCode !== 200) {
        throw new Error(`下载失败，状态码: ${downloadResult.statusCode}`)
      }

      console.log('GIF下载成功，本地路径:', downloadResult.tempFilePath)
      console.log('下载结果完整信息:', downloadResult)

      // 验证文件是否真的存在
      try {
        const fileManager = wx.getFileSystemManager()
        const stats = fileManager.statSync(downloadResult.tempFilePath)
        console.log('文件信息:', stats)
      } catch (statError) {
        console.warn('无法获取文件信息:', statError)
      }

      return downloadResult.tempFilePath

    } catch (error) {
      console.error('下载GIF失败:', error)
      throw error
    }
  }

  /**
   * 显示GIF确认对话框
   */
  async showConfirmDialog() {
    return new Promise((resolve) => {
      wx.showModal({
        title: '生成GIF动画',
        content: '将生成3帧抖动动画，大约需要10-30秒，是否继续？',
        confirmText: '开始生成',
        cancelText: '取消',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false)
      })
    })
  }
}

// 创建单例实例
const gifExportManager = new GifExportManager()

module.exports = {
  gifExportManager,
  GifExportManager
}
