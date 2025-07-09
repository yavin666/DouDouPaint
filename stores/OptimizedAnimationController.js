const { reaction, autorun } = require('mobx-miniprogram')

/**
 * 优化的动画控制器
 * 使用MobX响应式更新和分层渲染
 */
class optimizedAnimationController {
  constructor(pixelStore, canvasWidth, canvasHeight, backgroundColor = '#FFFFFF') {
    this.pixelStore = pixelStore
    this.canvasWidth = canvasWidth
    this.canvasHeight = canvasHeight
    this.backgroundColor = backgroundColor
    
    // Canvas层
    this.staticCanvas = null    // 静态层Canvas
    this.staticCtx = null       // 静态层上下文
    this.animationCanvas = null // 动画层Canvas
    this.animationCtx = null    // 动画层上下文
    this.displayCanvas = null   // 显示层Canvas
    this.displayCtx = null      // 显示层上下文
    
    // 动画控制
    this.animationTimer = null
    this.isAnimating = false
    this.frameRate = 100 // 毫秒
    
    // 性能优化
    this.lastStaticRender = 0
    this.staticRenderInterval = 1000 // 静态层1秒更新一次
    this.enableDirtyRegionOptimization = true
    
    // 初始化MobX响应
    this.setupReactions()
  }

  /**
   * 设置Canvas层（简化版本，兼容性更好）
   */
  setupCanvasLayers(displayCanvas, displayCtx) {
    this.displayCanvas = displayCanvas
    this.displayCtx = displayCtx

    // 暂时禁用离屏Canvas，直接使用主Canvas
    // 在小程序环境中，离屏Canvas可能有兼容性问题
    console.log('Canvas层设置完成（简化模式）')

    // 初始化背景
    this.clearMainCanvas()
  }

  /**
   * 清除主Canvas
   */
  clearMainCanvas() {
    if (!this.displayCtx) return
    this.displayCtx.fillStyle = this.backgroundColor
    this.displayCtx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
  }

  /**
   * 设置 MobX 6.x 响应式监听
   */
  setupReactions() {
    console.log('设置 MobX 6.x 响应式监听')

    // 监听活跃像素变化，自动启动/停止动画
    this.activePixelsReaction = reaction(
      () => this.pixelStore.activePixels.size,
      (activePixelCount) => {
        console.log(`活跃像素数量变化: ${activePixelCount}`)
        if (activePixelCount > 0 && !this.isAnimating) {
          this.startAnimation()
        }
        // 保持持续动画，不在像素为0时停止
      }
    )

    // 监听静态像素变化，触发静态层重绘
    this.staticPixelsReaction = reaction(
      () => this.pixelStore.staticPixels.size,
      (staticPixelCount) => {
        console.log(`静态像素数量变化: ${staticPixelCount}`)
        // 可以在这里触发静态层重绘
      }
    )

    // 使用 autorun 监听配置变化
    this.configReaction = autorun(() => {
      const config = this.pixelStore.config
      console.log(`配置更新: 最大活跃像素 ${config.maxActivePixels}`)
    })
  }

  /**
   * 清除静态层
   */
  clearStaticLayer() {
    if (!this.staticCtx) return
    this.staticCtx.fillStyle = this.backgroundColor
    this.staticCtx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
  }

  /**
   * 清除动画层
   */
  clearAnimationLayer() {
    if (!this.animationCtx) return
    this.animationCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
  }

  /**
   * 渲染静态层
   */
  renderStaticLayer() {
    if (!this.staticCtx) return
    
    const now = Date.now()
    if (now - this.lastStaticRender < this.staticRenderInterval) {
      return // 限制静态层更新频率
    }
    
    console.log('重新渲染静态层')
    this.clearStaticLayer()
    
    // 绘制所有静态像素
    for (const [, pixel] of this.pixelStore.staticPixels) {
      pixel.draw(this.staticCtx)
    }
    
    this.lastStaticRender = now
    this.composeLayers()
  }

  /**
   * 渲染所有像素（简化版本）
   */
  renderAllPixels() {
    if (!this.displayCtx) return

    // 清除画布
    this.clearMainCanvas()

    // 先绘制静态像素
    for (const [, pixel] of this.pixelStore.staticPixels) {
      pixel.draw(this.displayCtx)
    }

    // 再绘制活跃像素
    for (const [, pixel] of this.pixelStore.activePixels) {
      pixel.draw(this.displayCtx)
    }
  }

  /**
   * 渲染脏区域（优化版本）
   */
  renderDirtyRegions(dirtyRegions) {
    if (!this.enableDirtyRegionOptimization) return
    
    dirtyRegions.forEach(region => {
      // 清除脏区域
      this.displayCtx.clearRect(region.x, region.y, region.width, region.height)
      
      // 重绘静态层的脏区域
      if (this.staticCanvas) {
        this.displayCtx.drawImage(
          this.staticCanvas,
          region.x, region.y, region.width, region.height,
          region.x, region.y, region.width, region.height
        )
      }
      
      // 重绘动画层的脏区域
      if (this.animationCanvas) {
        this.displayCtx.drawImage(
          this.animationCanvas,
          region.x, region.y, region.width, region.height,
          region.x, region.y, region.width, region.height
        )
      }
    })
    
    // 清除已处理的脏区域
    this.pixelStore.clearDirtyRegions()
  }

  /**
   * 启动动画循环
   */
  startAnimation() {
    if (this.isAnimating) return
    
    console.log('启动 MobX 6.x 优化动画循环')
    this.isAnimating = true
    
    const animate = () => {
      if (!this.isAnimating) return

      try {
        // 更新活跃像素（MobX 6.x 会自动跟踪变化）
        this.pixelStore.updateActivePixels()

        // 渲染所有像素
        this.renderAllPixels()

        // 更新性能统计
        this.pixelStore.updateStats()

      } catch (error) {
        console.error('动画循环错误:', error)
      }

      // 持续动画循环，保持抖动效果
      this.animationTimer = setTimeout(animate, this.frameRate)
    }
    
    animate()
  }

  /**
   * 停止动画循环
   */
  stopAnimation() {
    console.log('停止动画循环')
    this.isAnimating = false
    if (this.animationTimer) {
      clearTimeout(this.animationTimer)
      this.animationTimer = null
    }
  }

  /**
   * 清除所有像素
   */
  clearAllPixels() {
    this.pixelStore.clearAllPixels()
    this.clearMainCanvas()
  }

  /**
   * 销毁控制器
   */
  destroy() {
    this.stopAnimation()

    // 清理 MobX 6.x reactions
    if (this.activePixelsReaction) {
      this.activePixelsReaction() // 调用返回的 disposer 函数
      this.activePixelsReaction = null
    }

    if (this.staticPixelsReaction) {
      this.staticPixelsReaction()
      this.staticPixelsReaction = null
    }

    if (this.configReaction) {
      this.configReaction()
      this.configReaction = null
    }

    console.log('动画控制器已销毁，MobX reactions 已清理')
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport() {
    return {
      ...this.pixelStore.getPerformanceReport(),
      isAnimating: this.isAnimating,
      frameRate: this.frameRate,
      layerOptimization: true,
      dirtyRegionOptimization: this.enableDirtyRegionOptimization
    }
  }
}

module.exports = { optimizedAnimationController }
