const { makeAutoObservable } = require('mobx-miniprogram')
const { PixelStore } = require('./pixelStore')
const { OptimizedAnimationController } = require('./optimizedAnimationController')

/**
 * 根Store，管理所有子Store
 */
class RootStore {
  constructor() {
    // 初始化子Store
    this.pixelStore = new PixelStore()
    this.animationController = null
    
    // 画布配置
    this.canvasConfig = {
      width: 375,
      height: 500,
      backgroundColor: '#FFFFFF'
    }
    
    // 绘制配置（持续动画优化 + 画笔大小）
    this.drawingConfig = {
      currentPen: 'pencil',
      currentBrushSize: 'medium', // 当前画笔大小
      pens: {
        pencil: { color: '#000000', width: 2 },
        marker: { color: '#333333', width: 4 },
        glow: { color: '#ffffff', width: 3 }
      },
      brushSizes: {
        small: { size: 2, spacing: 4, label: '小' },
        medium: { size: 4, spacing: 6, label: '中' },
        large: { size: 6, spacing: 8, label: '大' }
      },
      isDrawing: false,
      lastX: 0,
      lastY: 0
    }

    // 使用 makeAutoObservable 让整个对象变为响应式
    makeAutoObservable(this)
  }

  /**
   * 初始化动画控制器
   */
  initAnimationController(canvasWidth, canvasHeight, backgroundColor) {
    this.canvasConfig.width = canvasWidth
    this.canvasConfig.height = canvasHeight
    this.canvasConfig.backgroundColor = backgroundColor
    
    this.animationController = new OptimizedAnimationController(
      this.pixelStore,
      canvasWidth,
      canvasHeight,
      backgroundColor
    )
    
    return this.animationController
  }

  /**
   * 设置画布层
   */
  setupCanvasLayers(displayCanvas, displayCtx) {
    if (this.animationController) {
      this.animationController.setupCanvasLayers(displayCanvas, displayCtx)
    }
  }

  /**
   * 添加像素（支持画笔大小）
   */
  addPixel(x, y, color, frameData, size) {
    return this.pixelStore.addPixel(x, y, color, frameData, size)
  }

  /**
   * 获取当前画笔大小
   */
  getCurrentBrushSize() {
    return this.drawingConfig.brushSizes[this.drawingConfig.currentBrushSize].size
  }

  /**
   * 获取当前像素间距
   */
  getCurrentPixelSpacing() {
    return this.drawingConfig.brushSizes[this.drawingConfig.currentBrushSize].spacing
  }

  /**
   * 设置画笔大小
   */
  setBrushSize(sizeKey) {
    if (this.drawingConfig.brushSizes[sizeKey]) {
      this.drawingConfig.currentBrushSize = sizeKey
    }
  }

  /**
   * 清除所有像素
   */
  clearAllPixels() {
    if (this.animationController) {
      this.animationController.clearAllPixels()
    }
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport() {
    const pixelReport = this.pixelStore.getPerformanceReport()
    const animationReport = this.animationController ? 
      this.animationController.getPerformanceReport() : {}
    
    return {
      ...pixelReport,
      ...animationReport,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 销毁Store
   */
  destroy() {
    if (this.animationController) {
      this.animationController.destroy()
    }
  }
}

// 创建全局Store实例
const rootStore = new RootStore()

module.exports = { RootStore, rootStore }
