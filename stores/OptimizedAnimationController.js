const { reaction, autorun } = require('mobx-miniprogram')

/**
 * 优化的动画控制器
 * 简化版本：移除静态层实现，所有像素保持抖动
 */
class optimizedAnimationController {
  constructor(pixelStore, canvasWidth, canvasHeight, backgroundColor) {
    this.pixelStore = pixelStore
    this.canvasWidth = canvasWidth
    this.canvasHeight = canvasHeight
    this.backgroundColor = backgroundColor
    
    // Canvas 相关
    this.displayCanvas = null
    this.displayCtx = null
    
    // 动画状态
    this.isAnimating = false
    this.animationId = null
    this.lastFrameTime = 0
    this.targetFPS = 15 // 降低到15fps，减少CPU占用
    this.frameInterval = 1000 / this.targetFPS
    
    // 性能优化
    this.enableDirtyRegionOptimization = false // 简化版本暂时禁用
    this.lastRenderTime = 0
    this.renderThrottle = 16 // 约60fps
    
    // MobX 响应式监听
    this.setupReactions()
    
    console.log('优化动画控制器初始化完成')
  }
  
  /**
   * 设置 MobX 响应式监听
   */
  setupReactions() {
    // 监听活跃像素变化，自动启动动画（永不停止）
    this.activePixelsReaction = reaction(
      () => this.pixelStore.activePixels.size,
      (activePixelCount) => {
        if (activePixelCount > 0 && !this.isAnimating) {
          this.startAnimation()
        }
        // 保持持续动画，永不停止
      }
    )

    // 使用 autorun 监听配置变化
    this.configReaction = autorun(() => {
      const config = this.pixelStore.config
      console.log(`配置更新: 最大活跃像素 ${config.maxActivePixels}`)
    })
  }
  
  /**
   * 设置Canvas层（简化版本）
   */
  setupCanvasLayers(canvas, ctx) {
    this.displayCanvas = canvas
    this.displayCtx = ctx
    console.log('Canvas层设置完成（简化模式）')
  }
  
  /**
   * 清除主画布
   */
  clearMainCanvas() {
    if (!this.displayCtx) return

    // 透明背景模式下使用clearRect，非透明背景使用fillRect
    if (this.backgroundColor === 'transparent') {
      this.displayCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
    } else {
      this.displayCtx.fillStyle = this.backgroundColor
      this.displayCtx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
    }
  }
  
  /**
   * 渲染所有像素（分层渲染版本）
   */
  renderAllPixels() {
    if (!this.displayCtx) return

    // 清除画布
    this.clearMainCanvas()

    // 按层级顺序渲染像素（从底层到顶层）
    const layerOrder = this.pixelStore.getPixelsByRenderOrder()

    for (const { layer, pixels } of layerOrder) {
      // 只渲染有像素的层级
      if (pixels && pixels.size > 0) {
        for (const [, pixel] of pixels) {
          pixel.draw(this.displayCtx)
        }
      }
    }
  }
  
  /**
   * 动画循环（使用 setTimeout 适配微信小程序）
   */
  animate() {
    try {
      const now = Date.now()

      // 节流渲染
      if (now - this.lastRenderTime < this.renderThrottle) {
        if (this.isAnimating) {
          this.animationId = setTimeout(() => this.animate(), this.frameInterval)
        }
        return
      }

      this.lastRenderTime = now

      // 更新所有活跃像素
      this.pixelStore.updateActivePixels()

      // 渲染所有像素
      this.renderAllPixels()

      // 继续动画循环
      if (this.isAnimating) {
        this.animationId = setTimeout(() => this.animate(), this.frameInterval)
      }
    } catch (error) {
      console.error('动画循环错误:', error)
      this.stopAnimation()
    }
  }
  
  /**
   * 启动动画
   */
  startAnimation() {
    if (this.isAnimating) return
    
    this.isAnimating = true
    this.lastFrameTime = Date.now()
    this.animate()
    console.log('动画已启动')
  }
  
  /**
   * 停止动画
   */
  stopAnimation() {
    this.isAnimating = false
    if (this.animationId) {
      clearTimeout(this.animationId)
      this.animationId = null
    }
    console.log('动画已停止')
  }
  
  /**
   * 获取性能报告（简化版本）
   */
  getPerformanceReport() {
    return {
      isAnimating: this.isAnimating,
      activePixels: this.pixelStore.activePixels.size,
      totalPixels: this.pixelStore.totalPixelCount,
      lastRenderTime: this.lastRenderTime
    }
  }
  
  /**
   * 销毁控制器
   */
  destroy() {
    // 停止动画
    this.stopAnimation()
    
    // 清理 MobX 监听器
    if (this.activePixelsReaction) {
      this.activePixelsReaction() // 调用返回的 disposer 函数
      this.activePixelsReaction = null
    }

    if (this.configReaction) {
      this.configReaction()
      this.configReaction = null
    }
    
    // 清理引用
    this.displayCanvas = null
    this.displayCtx = null
    this.pixelStore = null
    
    console.log('动画控制器已销毁')
  }
}

module.exports = { optimizedAnimationController: optimizedAnimationController }
