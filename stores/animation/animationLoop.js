const { makeAutoObservable, reaction } = require('mobx-miniprogram')
/**
 * 动画循环控制器 - 专门负责3帧抖动动画的循环控制
 * 职责单一：只管理动画状态，不负责渲染
 * 性能优化：调整循环间隔匹配帧更新频率，减少无效调用
 */
class AnimationLoop {
  constructor(pixelStore, frameRenderer) {
    this.pixelStore = pixelStore
    this.frameRenderer = frameRenderer

    // 动画状态
    this.isRunning = false
    this.animationId = null
    this.frameInterval = 200 // 3帧抖动，每帧200ms（每秒5帧，更活跃的抖动效果）
    this.lastFrameTime = 0 // 上次更新帧的时间戳

    // 固定循环间隔，确保严格的3帧循环
    this.checkInterval = 50 // 检查间隔50ms，确保及时响应帧更新

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
      // 使用 Canvas.cancelAnimationFrame 或 clearTimeout 作为兼容方案
      if (this.frameRenderer.canvas && this.frameRenderer.canvas.cancelAnimationFrame) {
        this.frameRenderer.canvas.cancelAnimationFrame(this.animationId)
      } else {
        clearTimeout(this.animationId)
      }
      this.animationId = null
    }
    this.lastFrameTime = 0 // 重置时间戳
    console.log('3帧抖动动画已停止')
  }
  
  /**
   * 简化的动画循环
   * 严格按照300ms间隔进行3帧循环，确保抖动效果稳定
   */
  animate() {
    if (!this.isRunning) return

    try {
      const currentTime = Date.now()
      const timeSinceLastFrame = currentTime - this.lastFrameTime

      // 检查是否到了更新帧的时间
      if (timeSinceLastFrame >= this.frameInterval) {
        // 更新所有像素到下一帧
        this.pixelStore.updateActivePixels()

        // 渲染当前帧
        this.frameRenderer.renderFrame(this.pixelStore)

        // 更新时间戳
        this.lastFrameTime = currentTime
      }

      // 使用固定间隔继续下一帧
      if (this.frameRenderer.canvas && this.frameRenderer.canvas.requestAnimationFrame) {
        this.animationId = this.frameRenderer.canvas.requestAnimationFrame(() => this.animate())
      } else {
        // 兼容方案：使用固定检查间隔
        this.animationId = setTimeout(() => this.animate(), this.checkInterval)
      }
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
