const { makeAutoObservable, reaction } = require('mobx-miniprogram')

/**
 * 动画循环控制器 - 专门负责3帧抖动动画的循环控制
 * 职责单一：只管理动画状态，不负责渲染
 * 性能优化：使用 requestAnimationFrame 替代 setTimeout，提升性能并减少内存消耗
 */
class AnimationLoop {
  constructor(pixelStore, frameRenderer) {
    this.pixelStore = pixelStore
    this.frameRenderer = frameRenderer

    // 动画状态
    this.isRunning = false
    this.animationId = null
    this.frameInterval = 300 // 3帧抖动，每帧300ms（每秒3.33帧，适合3帧循环）
    this.lastFrameTime = 0 // 上次更新帧的时间戳

    // 设置响应式监听
    this.setupReactions()

    makeAutoObservable(this)
  }
  
  /**
   * 设置MobX响应式监听（简化版）
   */
  setupReactions() {
    // 只监听活跃像素数量变化
    this.pixelReaction = reaction(
      () => this.pixelStore.activePixels.size,
      (activePixelCount) => {
        if (activePixelCount > 0 && !this.isRunning) {
          this.start()
        } else if (activePixelCount === 0 && this.isRunning) {
          this.stop()
        }
      }
    )
  }
  
  /**
   * 启动动画循环
   */
  start() {
    if (this.isRunning) return
    
    this.isRunning = true
    this.animate()
    console.log('3帧抖动动画已启动')
  }
  
  /**
   * 停止动画循环
   */
  stop() {
    this.isRunning = false
    if (this.animationId) {
      // 使用 wx.cancelAnimationFrame 替代 clearTimeout
      wx.cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.lastFrameTime = 0 // 重置时间戳
    console.log('3帧抖动动画已停止')
  }
  
  /**
   * 动画循环（性能优化版）
   * 使用 requestAnimationFrame + 时间控制，避免递归 setTimeout 的性能问题
   */
  animate() {
    if (!this.isRunning) return

    try {
      const currentTime = Date.now()

      // 检查是否到了更新帧的时间
      if (currentTime - this.lastFrameTime >= this.frameInterval) {
        // 更新所有像素到下一帧
        this.pixelStore.updateActivePixels()

        // 渲染当前帧
        this.frameRenderer.renderFrame(this.pixelStore)

        // 更新时间戳
        this.lastFrameTime = currentTime
      }

      // 使用 requestAnimationFrame 继续下一帧，避免递归调用的性能问题
      this.animationId = wx.requestAnimationFrame(() => this.animate())
    } catch (error) {
      console.error('动画循环错误:', error)
      this.stop()
    }
  }
  
  /**
   * 销毁动画循环
   */
  destroy() {
    this.stop()
    
    // 清理MobX监听
    if (this.pixelReaction) {
      this.pixelReaction()
      this.pixelReaction = null
    }
    
    console.log('动画循环已销毁')
  }
}

module.exports = { AnimationLoop }
