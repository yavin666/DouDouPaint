import { reaction } from 'mobx-miniprogram'

/**
 * 优化的动画控制器
 * 使用MobX响应式更新和分层渲染
 */
export class OptimizedAnimationController {
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
   * 设置MobX响应式更新
   */
  setupReactions() {
    // 监听静态像素变化
    this.staticPixelsReaction = reaction(
      () => Array.from(this.pixelStore.staticPixels.values()),
      (staticPixels) => {
        console.log(`静态像素更新: ${staticPixels.length}个`)
        this.renderStaticLayer()
      }
    )
    
    // 监听活跃像素变化（持续动画版本）
    this.activePixelsReaction = reaction(
      () => Array.from(this.pixelStore.activePixels.values()),
      (activePixels) => {
        if (activePixels.length > 0 && !this.isAnimating) {
          this.startAnimation()
        }
        // 移除停止动画的逻辑，让动画持续运行
        // 即使没有像素也保持动画循环，为新像素做准备
      }
    )
    
    // 监听脏区域变化（用于优化重绘）
    if (this.enableDirtyRegionOptimization) {
      this.dirtyRegionsReaction = reaction(
        () => this.pixelStore.optimizedDirtyRegions.slice(),
        (dirtyRegions) => {
          if (dirtyRegions.length > 0) {
            this.renderDirtyRegions(dirtyRegions)
          }
        }
      )
    }
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
    for (const [id, pixel] of this.pixelStore.staticPixels) {
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
    
    console.log('启动优化动画循环')
    this.isAnimating = true
    
    const animate = () => {
      if (!this.isAnimating) return

      // 更新活跃像素
      this.pixelStore.updateActivePixels()

      // 渲染所有像素（即使没有像素也要保持循环）
      this.renderAllPixels()

      // 持续动画循环，不检查像素数量
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
    
    // 清理MobX reactions
    if (this.staticPixelsReaction) {
      this.staticPixelsReaction()
    }
    if (this.activePixelsReaction) {
      this.activePixelsReaction()
    }
    if (this.dirtyRegionsReaction) {
      this.dirtyRegionsReaction()
    }
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
