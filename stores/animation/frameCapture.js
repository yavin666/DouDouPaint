/**
 * 帧数据捕获器 - 专门负责捕获帧数据用于后端GIF生成
 * 职责单一：只负责数据捕获，不生成GIF文件
 */
class FrameCapture {
  constructor(pixelStore, frameRenderer) {
    this.pixelStore = pixelStore
    this.frameRenderer = frameRenderer
    this.animationLoop = null // 将在AnimationStore中设置
  }
  
  /**
   * 捕获3帧抖动数据（简化版）
   * 返回给后端的标准格式数据
   */
  async capture3Frames() {
    const frames = []
    
    // 暂停动画
    const wasAnimating = this.animationLoop?.isRunning || false
    if (wasAnimating) {
      this.animationLoop.stop()
    }
    
    try {
      // 捕获3帧数据
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
        
        // 获取帧数据
        const frameData = await this.getFrameImageData()
        frames.push({
          frameIndex,
          width: frameData.width,
          height: frameData.height,
          data: Array.from(frameData.data), // 转换为普通数组便于传输
          timestamp: Date.now()
        })
      }
    } finally {
      // 恢复动画
      if (wasAnimating) {
        this.animationLoop.start()
      }
    }
    
    return {
      frames,
      totalFrames: 3,
      frameRate: 200,
      backgroundColor: this.frameRenderer.backgroundColor,
      isTransparent: this.frameRenderer.backgroundColor === 'transparent'
    }
  }
  
  /**
   * 获取当前帧的图像数据
   */
  async getFrameImageData() {
    return new Promise((resolve, reject) => {
      try {
        const ctx = this.frameRenderer.ctx
        const imageData = ctx.getImageData(
          0, 0, 
          this.frameRenderer.canvasWidth, 
          this.frameRenderer.canvasHeight
        )
        resolve(imageData)
      } catch (error) {
        reject(error)
      }
    })
  }
}

module.exports = { FrameCapture }
