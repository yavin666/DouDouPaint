/**
 * 帧数据捕获器 - 专门负责捕获帧数据并转换为图片文件
 * 职责：帧捕获、图片转换、云存储上传
 */
class FrameCapture {
  constructor(pixelStore, frameRenderer) {
    this.pixelStore = pixelStore
    this.frameRenderer = frameRenderer
    this.animationLoop = null // 将在AnimationStore中设置
    this.canvas = null // Canvas实例，用于图片转换
  }

  /**
   * 设置Canvas引用
   */
  setCanvas(canvas) {
    this.canvas = canvas
  }

  /**
   * 捕获3帧并转换为图片文件
   * @param {Function} onProgress - 进度回调函数
   * @returns {Promise<Array<string>>} 图片文件路径数组
   */
  async capture3FramesAsImages(onProgress) {
    const imagePaths = []

    // 暂停动画
    const wasAnimating = this.animationLoop?.isRunning || false
    if (wasAnimating) {
      this.animationLoop.stop()
    }

    try {
      // 捕获3帧
      for (let frameIndex = 0; frameIndex < 3; frameIndex++) {
        // 设置所有像素到指定帧
        const activePixels = Array.from(this.pixelStore.activePixels.values())
        activePixels.forEach(pixel => {
          pixel.currentFrame = frameIndex % (pixel.frameData?.length || 3)
        })

        // 渲染当前帧
        this.frameRenderer.renderFrame(this.pixelStore)

        // 等待渲染完成
        await new Promise(resolve => setTimeout(resolve, 50))

        // 转换为临时图片文件
        const tempFilePath = await this.canvasToTempFile()
        imagePaths.push(tempFilePath)

        // 更新进度
        if (onProgress) {
          onProgress({
            current: frameIndex + 1,
            total: 3,
            progress: Math.round(((frameIndex + 1) / 3) * 100),
            stage: 'capture'
          })
        }

        console.log(`已捕获第 ${frameIndex + 1}/3 帧: ${tempFilePath}`)
      }
    } finally {
      // 恢复动画
      if (wasAnimating) {
        this.animationLoop.start()
      }
    }

    return imagePaths
  }

  /**
   * 将Canvas转换为临时图片文件
   * @param {string} format - 图片格式，默认'png'
   * @param {number} quality - 图片质量，默认0.8（压缩以减少文件大小）
   * @returns {Promise<string>} 临时文件路径
   */
  async canvasToTempFile(format = 'png', quality = 0.8) {
    if (!this.canvas) {
      throw new Error('Canvas未设置，请先调用setCanvas方法')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Canvas转换超时，请重试'))
      }, 10000) // 10秒超时

      wx.canvasToTempFilePath({
        canvas: this.canvas,
        fileType: format,
        quality: quality,
        success: (res) => {
          clearTimeout(timeout)
          if (res.tempFilePath) {
            resolve(res.tempFilePath)
          } else {
            reject(new Error('Canvas转换失败：未获取到文件路径'))
          }
        },
        fail: (error) => {
          clearTimeout(timeout)
          console.error('Canvas转换失败:', error)
          reject(new Error(`Canvas转换失败: ${error.errMsg || '未知错误'}`))
        }
      })
    })
  }

  /**
   * 上传图片到云存储（带重试机制）
   * @param {Array<string>} imagePaths - 图片文件路径数组
   * @param {Function} onProgress - 进度回调
   * @param {number} maxRetries - 最大重试次数，默认3次
   * @returns {Promise<Array<string>>} 云存储文件ID数组
   */
  async uploadImagesToCloud(imagePaths, onProgress, maxRetries = 3) {
    // 检查云开发是否已初始化
    if (!wx.cloud) {
      throw new Error('请使用 2.2.3 或以上的基础库以使用云能力')
    }

    const fileIds = []

    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i]
      let lastError = null

      // 重试机制
      for (let retry = 0; retry <= maxRetries; retry++) {
        try {
          // 检查文件是否存在
          const fm = wx.getFileSystemManager()
          const stats = await new Promise((resolve, reject) => {
            fm.stat({
              path: imagePath,
              success: resolve,
              fail: reject
            })
          })

          if (stats.size === 0) {
            throw new Error('图片文件为空')
          }

          // 生成云存储路径
          const timestamp = Date.now()
          const randomStr = Math.random().toString(36).substring(2, 8)
          const cloudPath = `gif-frames/frame_${timestamp}_${i}_${randomStr}.png`

          // 上传到云存储
          const uploadResult = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('上传超时'))
            }, 30000) // 30秒超时

            wx.cloud.uploadFile({
              cloudPath: cloudPath,
              filePath: imagePath,
              success: (res) => {
                clearTimeout(timeout)
                resolve(res)
              },
              fail: (error) => {
                clearTimeout(timeout)
                reject(error)
              }
            })
          })

          if (!uploadResult.fileID) {
            throw new Error('上传成功但未获取到文件ID')
          }

          fileIds.push(uploadResult.fileID)

          // 更新进度
          if (onProgress) {
            onProgress({
              current: i + 1,
              total: imagePaths.length,
              progress: Math.round(((i + 1) / imagePaths.length) * 100),
              stage: 'upload'
            })
          }

          console.log(`已上传第 ${i + 1}/${imagePaths.length} 张图片: ${uploadResult.fileID}`)
          break // 成功，跳出重试循环

        } catch (error) {
          lastError = error
          console.warn(`上传第 ${i + 1} 张图片失败 (重试 ${retry}/${maxRetries}):`, error)

          if (retry === maxRetries) {
            // 最后一次重试也失败了
            throw new Error(`上传第 ${i + 1} 张图片失败: ${error.message || '未知错误'}`)
          }

          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)))
        }
      }
    }

    return fileIds
  }

  /**
   * 完整的帧捕获和上传流程
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Array<string>>} 云存储文件ID数组
   */
  async captureAndUpload(onProgress) {
    try {
      // 第一步：捕获帧并转换为图片
      const imagePaths = await this.capture3FramesAsImages((progress) => {
        if (onProgress) {
          onProgress({
            ...progress,
            stage: 'capture',
            message: `正在捕获第 ${progress.current}/${progress.total} 帧...`
          })
        }
      })

      // 第二步：上传图片到云存储
      const fileIds = await this.uploadImagesToCloud(imagePaths, (progress) => {
        if (onProgress) {
          onProgress({
            ...progress,
            stage: 'upload',
            message: `正在上传第 ${progress.current}/${progress.total} 张图片...`
          })
        }
      })

      // 清理临时文件
      try {
        const fm = wx.getFileSystemManager()
        imagePaths.forEach(path => {
          fm.unlinkSync(path)
        })
      } catch (error) {
        console.warn('清理临时文件失败:', error)
      }

      return fileIds

    } catch (error) {
      console.error('帧捕获和上传失败:', error)
      throw error
    }
  }
}
module.exports = { FrameCapture }
