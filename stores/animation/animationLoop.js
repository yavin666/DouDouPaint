const { makeAutoObservable } = require('mobx-miniprogram')

/**
 * 动画循环控制器 - 使用微信小程序原生Canvas.requestAnimationFrame
 * 职责单一：只管理动画状态，不负责渲染
 * 使用原生requestAnimationFrame，彻底解决setTimeout内存泄漏问题
 */
class AnimationLoop {
  constructor(pixelStore, frameRenderer) {
    this.pixelStore = pixelStore
    this.frameRenderer = frameRenderer

    // 动画状态
    this.isRunning = false
    this.isDestroyed = false
    this.animationId = null

    // 帧间隔控制
    this.frameInterval = 60 // 60ms间隔，约16fps
    this.lastFrameTime = 0

    makeAutoObservable(this)
  }

  /**
   * 检查是否需要启动动画（外部调用）
   * 当有新像素添加时调用此方法
   */
  checkAndStartAnimation() {
    if (this.isDestroyed) return

    const currentCount = this.pixelStore.activePixels.size

    if (currentCount > 0 && !this.isRunning) {
      this.start()
    } else if (currentCount === 0 && this.isRunning) {
      this.stop()
    }
  }
  
  /**
   * 启动动画循环 - 使用Canvas原生requestAnimationFrame
   */
  start() {
    if (this.isRunning || this.isDestroyed) return

    this.isRunning = true
    this.lastFrameTime = Date.now()
    this.animate()

    console.log('3帧抖动动画已启动')
  }

  /**
   * 停止动画循环 - 使用Canvas原生cancelAnimationFrame
   */
  stop() {
    if (!this.isRunning) return

    this.isRunning = false
    this.clearAnimationFrame()

    console.log('3帧抖动动画已停止')
  }

  /**
   * 清理动画帧
   */
  clearAnimationFrame() {
    if (this.animationId && this.frameRenderer.canvas) {
      this.frameRenderer.canvas.cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }
  
  /**
   * 动画循环主方法 - 使用Canvas原生requestAnimationFrame
   */
  animate() {
    if (!this.isRunning || this.isDestroyed) {
      this.clearAnimationFrame()
      return
    }

    try {
      const currentTime = Date.now()
      const timeSinceLastFrame = currentTime - this.lastFrameTime
      const activePixelCount = this.pixelStore.activePixels.size

      // 检查像素数量变化，决定是否需要停止动画
      if (activePixelCount === 0) {
        this.stop()
        return
      }

      // 检查是否到了更新帧的时间
      if (timeSinceLastFrame >= this.frameInterval) {
        // 更新所有像素到下一帧
        this.pixelStore.updateActivePixels()

        // 渲染当前帧
        this.frameRenderer.renderFrame(this.pixelStore)

        // 更新时间戳
        this.lastFrameTime = currentTime
      }

      // 使用Canvas原生requestAnimationFrame调度下一帧
      this.scheduleNextFrame()

    } catch (error) {
      console.error('动画循环错误:', error)
      this.stop()
    }
  }

  /**
   * 调度下一帧 - 使用Canvas原生requestAnimationFrame
   */
  scheduleNextFrame() {
    if (!this.isRunning || this.isDestroyed || !this.frameRenderer.canvas) {
      return
    }

    this.animationId = this.frameRenderer.canvas.requestAnimationFrame(() => {
      this.animate()
    })
  }

  /**
   * 销毁动画循环 - 彻底清理所有资源，防止内存泄漏
   */
  destroy() {
    // 设置销毁标志，防止后续操作
    this.isDestroyed = true

    // 停止动画并清理
    this.stop()

    // 清理所有引用，帮助垃圾回收
    this.pixelStore = null
    this.frameRenderer = null
    this.lastFrameTime = 0

    console.log('动画循环已销毁')
  }

  /**
   * 暂停动画（页面隐藏时使用）
   */
  pause() {
    if (this.isRunning) {
      this.clearAnimationFrame()
      console.log('动画已暂停')
    }
  }

  /**
   * 恢复动画（页面显示时使用）
   */
  resume() {
    if (this.isRunning && !this.isDestroyed && this.pixelStore.activePixels.size > 0) {
      this.lastFrameTime = Date.now()
      this.animate()
      console.log('动画已恢复')
    }
  }
}

module.exports = { AnimationLoop }
