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

    // 帧间隔控制 - 激进优化：大幅降低帧率
    this.frameInterval = 60 // 200ms间隔，约5fps（进一步降低重绘频率）
    this.lastFrameTime = 0

    // 性能优化：跳帧机制
    this.frameSkipCounter = 0
    this.frameSkipThreshold = 2 // 每3帧只渲染1帧

    // 内存管理：定期清理
    this.memoryCleanupCounter = 0
    this.memoryCleanupThreshold = 50 // 每50帧进行一次内存清理

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
   * 停止动画循环 - 使用Canvas原生cancelAnimationFrame，修复内存泄漏
   */
  stop() {
    if (!this.isRunning) return

    this.isRunning = false

    // 确保清理动画帧，防止内存泄漏
    this.clearAnimationFrame()

    console.log('3帧抖动动画已停止，动画帧已清理')
  }

  /**
   * 清理动画帧 - 修复内存泄漏问题（增强版）
   */
  clearAnimationFrame() {
    if (this.animationId) {
      try {
        // 优先使用 canvas 的 cancelAnimationFrame，如果 canvas 不存在则使用全局方法
        if (this.frameRenderer?.canvas?.cancelAnimationFrame) {
          this.frameRenderer.canvas.cancelAnimationFrame(this.animationId)
        } else if (typeof cancelAnimationFrame !== 'undefined') {
          // 备用方案：使用全局 cancelAnimationFrame（如果存在）
          cancelAnimationFrame(this.animationId)
        }
      } catch (error) {
        console.warn('清理动画帧失败:', error)
      } finally {
        this.animationId = null
      }
    }
  }
  
  /**
   * 动画循环主方法 - 使用Canvas原生requestAnimationFrame，修复内存泄漏
   */
  animate() {
    // 严格的状态检查，防止内存泄漏
    if (!this.isRunning || this.isDestroyed || !this.frameRenderer.canvas) {
      // 状态异常时停止动画，不需要清理 animationId（已经在 scheduleNextFrame 中处理）
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
        // 总是更新像素状态（保持动画连续性）
        this.pixelStore.updateActivePixels()

        // 跳帧优化：不是每帧都渲染
        this.frameSkipCounter++
        const shouldRender = this.frameSkipCounter >= this.frameSkipThreshold

        if (shouldRender) {
          // 渲染当前帧（添加性能监控）
          const renderStart = Date.now()
          this.frameRenderer.renderFrame(this.pixelStore)
          const renderTime = Date.now() - renderStart

          // 动态调整跳帧阈值
          if (renderTime > 30) { // 如果渲染超过30ms
            this.frameSkipThreshold = Math.min(4, this.frameSkipThreshold + 1) // 增加跳帧
          } else if (renderTime < 15 && this.frameSkipThreshold > 1) {
            this.frameSkipThreshold = Math.max(1, this.frameSkipThreshold - 1) // 减少跳帧
          }

          // 重置跳帧计数器
          this.frameSkipCounter = 0
        }

        // 内存管理：定期清理
        this.memoryCleanupCounter++
        if (this.memoryCleanupCounter >= this.memoryCleanupThreshold) {
          this.performMemoryCleanup()
          this.memoryCleanupCounter = 0
        }

        // 更新时间戳
        this.lastFrameTime = currentTime
      }

      // 使用Canvas原生requestAnimationFrame调度下一帧
      this.scheduleNextFrame()

    } catch (error) {
      console.error('动画循环错误:', error)
      // 发生错误时停止动画
      this.stop()
    }
  }

  /**
   * 调度下一帧 - 使用Canvas原生requestAnimationFrame，修复内存泄漏
   */
  scheduleNextFrame() {
    if (!this.isRunning || this.isDestroyed || !this.frameRenderer.canvas) {
      return
    }

    // 正常情况下不需要清理，因为上一帧已经执行完毕
    // 只在创建新的动画帧时设置 animationId
    this.animationId = this.frameRenderer.canvas.requestAnimationFrame(() => {
      // 动画帧执行时，先清空 animationId，表示当前帧已开始执行
      this.animationId = null
      this.animate()
    })
  }

  /**
   * 销毁动画循环 - 彻底清理所有资源，防止内存泄漏
   */
  destroy() {
    // 设置销毁标志，防止后续操作
    this.isDestroyed = true

    // 强制清理动画帧
    this.clearAnimationFrame()

    // 停止动画并清理
    this.stop()

    // 再次确保动画帧被清理（双重保险）
    this.clearAnimationFrame()

    // 清理所有引用，帮助垃圾回收
    this.pixelStore = null
    this.frameRenderer = null
    this.lastFrameTime = 0

    console.log('动画循环已销毁，所有资源已清理')
  }

  /**
   * 暂停动画（页面隐藏时使用）- 保持运行状态，只停止动画帧
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
      // 只有在动画应该运行且有活跃像素时才恢复
      this.lastFrameTime = Date.now()
      this.scheduleNextFrame()
      console.log('动画已恢复')
    }
  }

  /**
   * 执行内存清理 - 防止内存泄漏
   */
  performMemoryCleanup() {
    try {
      // 清理过期的像素（如果有的话）
      if (this.pixelStore && typeof this.pixelStore.cleanupExpiredPixels === 'function') {
        this.pixelStore.cleanupExpiredPixels()
      }

      // 强制垃圾回收（如果支持）
      if (typeof wx !== 'undefined' && wx.triggerGC) {
        wx.triggerGC()
      }
    } catch (error) {
      console.warn('内存清理失败:', error)
    }
  }
}

module.exports = { AnimationLoop }
