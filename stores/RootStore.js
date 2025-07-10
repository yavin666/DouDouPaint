const { makeAutoObservable } = require('mobx-miniprogram')
const { pixelStore } = require('./pixelStore')
const { optimizedAnimationController } = require('./optimizedAnimationController')
const { BrushManager } = require('../utils/brushes/BrushManager')

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
      backgroundColor: '#FFFFFF',
      isTransparent: false // 透明背景开关
    }

    // 绘制配置（持续动画优化 + 画笔大小）
    this.drawingConfig = {
      currentPen: 'pencil',
      currentBrushSize: 'medium', // 当前画笔大小
      pens: {
        pencil: { color: '#000000', width: 2, opacity: 1.0 },
        marker: { color: '#333333', width: 4, opacity: 0.8 },
        glow: { color: '#ffffff', width: 3, opacity: 0.5 },
        eraser: { color: 'transparent', width: 6, opacity: 1.0, isEraser: true }
      },
      brushSizes: {
        small: { size: 2, spacing: 4, label: '小', eraserMultiplier: 2.5 },
        medium: { size: 4, spacing: 6, label: '中', eraserMultiplier: 2.5 },
        large: { size: 6, spacing: 8, label: '大', eraserMultiplier: 2.5 }
      },
      isDrawing: false,
      lastX: 0,
      lastY: 0
    }

    // 初始化画笔管理器
    this.brushManager = new BrushManager(this.drawingConfig)

    // 使用 makeAutoObservable 让整个对象变为响应式
    makeAutoObservable(this)
  }

  /**
   * 初始化动画控制器
   */
  initAnimationController(canvasWidth, canvasHeight, backgroundColor) {
    this.animationController = new optimizedAnimationController(
      this.pixelStore,
      canvasWidth,
      canvasHeight,
      backgroundColor
    )
    console.log('MobX动画控制器初始化完成')
    return this.animationController
  }

  /**
   * 添加像素（代理到 pixelStore）
   */
  addPixel(x, y, color, frameData, size, penType = 'pencil') {
    const penConfig = this.drawingConfig.pens[penType] || this.drawingConfig.pens.pencil
    const brushConfig = { size: size }
    return this.pixelStore.addPixel(x, y, color, frameData, brushConfig, penConfig.opacity, penType)
  }

  /**
   * 清空所有像素（代理到 pixelStore）
   */
  clearAllPixels() {
    return this.pixelStore.clearAllPixels()
  }

  /**
   * 橡皮擦功能（代理到 pixelStore）
   */
  erasePixelsInArea(centerX, centerY, radius) {
    return this.pixelStore.erasePixelsInArea(centerX, centerY, radius)
  }

  /**
   * 设置画笔大小
   */
  setBrushSize(size) {
    if (this.drawingConfig.brushSizes[size]) {
      this.drawingConfig.currentBrushSize = size
      this.brushManager.setBrushSize(size)
      console.log(`画笔大小切换为: ${this.drawingConfig.brushSizes[size].label}`)
    }
  }

  /**
   * 设置当前画笔类型
   */
  setBrushType(brushType) {
    this.drawingConfig.currentPen = brushType
    this.brushManager.setBrush(brushType)
  }

  /**
   * 获取当前画笔信息
   */
  getCurrentBrushInfo() {
    return this.brushManager.getCurrentBrush()?.getBrushInfo() || null
  }

  /**
   * 获取画笔管理器状态
   */
  getBrushManagerStatus() {
    return this.brushManager.getStatus()
  }

  /**
   * 设置Canvas层（代理到动画控制器）
   */
  setupCanvasLayers(canvas, ctx) {
    if (this.animationController) {
      this.animationController.setupCanvasLayers(canvas, ctx)
    }
  }

  /**
   * 获取当前背景颜色
   */
  getCurrentBackgroundColor() {
    return this.canvasConfig.isTransparent ? 'transparent' : this.canvasConfig.backgroundColor
  }

  /**
   * 获取当前画笔配置
   */
  getCurrentBrushConfig() {
    return this.drawingConfig.brushSizes[this.drawingConfig.currentBrushSize]
  }

  /**
   * 获取当前画笔大小
   */
  getCurrentBrushSize() {
    return this.getCurrentBrushConfig()
  }

  /**
   * 获取当前像素间距
   */
  getCurrentPixelSpacing() {
    return this.getCurrentBrushConfig().spacing
  }

  /**
   * 切换透明背景
   * @param {boolean} isTransparent - 是否透明背景
   */
  setTransparentBackground(isTransparent) {
    this.canvasConfig.isTransparent = isTransparent
    this.canvasConfig.backgroundColor = isTransparent ? 'transparent' : '#FFFFFF'

    // 更新动画控制器的背景色
    if (this.animationController) {
      this.animationController.backgroundColor = this.canvasConfig.backgroundColor
    }

    console.log(`背景设置为: ${isTransparent ? '透明' : '白色'}`)
  }

  /**
   * 获取当前背景色
   */
  getCurrentBackgroundColor() {
    return this.canvasConfig.backgroundColor
  }

  /**
   * 获取透明背景状态
   */
  getTransparentBackground() {
    return this.canvasConfig.isTransparent
  }

  /**
   * 设置Canvas层
   */
  setupCanvasLayers(canvas, ctx) {
    if (this.animationController) {
      this.animationController.setupCanvasLayers(canvas, ctx)
    }
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport() {
    if (this.animationController) {
      return this.animationController.getPerformanceReport()
    }
    return this.pixelStore.getPerformanceReport()
  }

  /**
   * 销毁Store
   */
  destroy() {
    if (this.animationController) {
      this.animationController.destroy()
      this.animationController = null
    }
    console.log('rootStore已销毁')
  }
}

// 创建全局Store实例
const rootStore = new RootStore()

module.exports = { rootStore }
