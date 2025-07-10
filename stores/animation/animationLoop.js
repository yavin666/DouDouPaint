const { makeAutoObservable, reaction } = require('mobx-miniprogram')

/**
 * 动画循环控制器 - 专门负责3帧抖动动画的循环控制
 * 职责单一：只管理动画状态，不负责渲染
 */
class AnimationLoop {
  constructor(pixelStore, frameRenderer) {
    this.pixelStore = pixelStore
    this.frameRenderer = frameRenderer
    
    // 动画状态
    this.isRunning = false
    this.animationId = null
    this.frameRate = 200 // 3帧抖动，每帧200ms
    
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
      clearTimeout(this.animationId)
      this.animationId = null
    }
    console.log('3帧抖动动画已停止')
  }
  
  /**
   * 动画循环（简化版）
   */
  animate() {
    if (!this.isRunning) return
    
    try {
      // 更新所有像素到下一帧
      this.pixelStore.updateActivePixels()
      
      // 渲染当前帧
      this.frameRenderer.renderFrame(this.pixelStore)
      
      // 继续下一帧
      this.animationId = setTimeout(() => this.animate(), this.frameRate)
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
