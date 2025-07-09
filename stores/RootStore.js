import { PixelStore } from './PixelStore'
import { OptimizedAnimationController } from './OptimizedAnimationController'

/**
 * 根Store，管理所有子Store
 */
export class RootStore {
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
    
    // 绘制配置（持续动画优化）
    this.drawingConfig = {
      currentPen: 'pencil',
      pens: {
        pencil: { color: '#000000', width: 2 },
        marker: { color: '#333333', width: 4 },
        glow: { color: '#ffffff', width: 3 }
      },
      pixelSpacing: 4, // 增加像素间距，减少像素密度，提高性能
      isDrawing: false,
      lastX: 0,
      lastY: 0
    }
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
   * 添加像素
   */
  addPixel(x, y, color, frameData) {
    return this.pixelStore.addPixel(x, y, color, frameData)
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
export const rootStore = new RootStore()
