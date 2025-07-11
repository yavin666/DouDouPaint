const { makeAutoObservable } = require('mobx-miniprogram')
const { FrameRenderer } = require('./frameRenderer')
const { AnimationLoop } = require('./animationLoop')
const { FrameCapture } = require('./frameCapture')

/**
 * 动画Store - 聚合动画相关的所有功能
 * 替代原来的 optimizedAnimationController
 */
class AnimationStore {
  constructor(pixelStore) {
    this.pixelStore = pixelStore
    
    // 创建各个专门的组件
    this.frameRenderer = new FrameRenderer()
    this.animationLoop = new AnimationLoop(pixelStore, this.frameRenderer)
    this.frameCapture = new FrameCapture(pixelStore, this.frameRenderer)
    this.frameCapture.animationLoop = this.animationLoop
    
    makeAutoObservable(this)
  }
  
  /**
   * 初始化Canvas（保持向后兼容的接口）
   */
  setupCanvas(canvas, ctx, width, height, backgroundColor) {
    this.frameRenderer.setupCanvas(canvas, ctx, width, height)
    this.frameRenderer.setBackgroundColor(backgroundColor)
    // 设置frameCapture的canvas引用
    this.frameCapture.setCanvas(canvas)
  }
  
  /**
   * 设置背景色
   */
  setBackgroundColor(color) {
    this.frameRenderer.setBackgroundColor(color)
  }
  
  /**
   * 启动动画（向后兼容接口）
   */
  startAnimation() {
    this.animationLoop.start()
  }
  
  /**
   * 停止动画（向后兼容接口）
   */
  stopAnimation() {
    this.animationLoop.stop()
  }
  
  /**
   * 捕获帧数据用于后端GIF生成（保持向后兼容）
   */
  async captureFramesForBackend() {
    return await this.frameCapture.capture3Frames()
  }

  /**
   * 新的云开发GIF导出功能
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Array<string>>} 云存储文件ID数组
   */
  async captureAndUploadFrames(onProgress) {
    return await this.frameCapture.captureAndUpload(onProgress)
  }

  /**
   * 捕获3帧并转换为图片文件
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Array<string>>} 图片文件路径数组
   */
  async capture3FramesAsImages(onProgress) {
    return await this.frameCapture.capture3FramesAsImages(onProgress)
  }
  
  /**
   * 获取性能报告（简化版）
   */
  getPerformanceReport() {
    return {
      isAnimating: this.animationLoop.isRunning,
      activePixels: this.pixelStore.activePixels.size,
      totalPixels: this.pixelStore.totalPixelCount,
      frameRate: this.animationLoop.frameRate
    }
  }
  
  /**
   * 销毁Store
   */
  destroy() {
    this.animationLoop.destroy()
    console.log('AnimationStore已销毁')
  }
}

module.exports = { AnimationStore }
