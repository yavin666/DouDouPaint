const { makeAutoObservable } = require('mobx-miniprogram')
const { pixelStore } = require('./pixelStore')
const { optimizedAnimationController } = require('./optimizedAnimationController')

/**
 * 根Store，管理所有子Store
 */
class RootStore {
  constructor() {
    // 初始化子Store
    this.pixelStore = new pixelStore()
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
  initAnimationController(canvas, ctx) {
    this.animationController = new optimizedAnimationController(
      this.pixelStore,
      canvas,
      ctx
    )
    console.log('MobX动画控制器初始化完成')
  }

  /**
   * 添加像素（代理到 pixelStore）
   */
  addPixel(x, y, color, frameData, size) {
    return this.pixelStore.addPixel(x, y, color, frameData, size)
  }

  /**
   * 清空所有像素（代理到 pixelStore）
   */
  clearAllPixels() {
    return this.pixelStore.clearAllPixels()
  }

  /**
   * 设置画笔大小
   */
  setBrushSize(size) {
    if (this.drawingConfig.brushSizes[size]) {
      this.drawingConfig.currentBrushSize = size
      console.log(`画笔大小切换为: ${this.drawingConfig.brushSizes[size].label}`)
    }
  }

  /**
   * 获取当前画笔配置
   */
  getCurrentBrushConfig() {
    return this.drawingConfig.brushSizes[this.drawingConfig.currentBrushSize]
  }

  /**
   * 销毁Store
   */
  destroy() {
    if (this.animationController) {
      this.animationController.destroy()
      this.animationController = null
    }
    console.log('RootStore已销毁')
  }
}

// 创建全局Store实例
const rootStore = new RootStore()

module.exports = { RootStore, rootStore }
