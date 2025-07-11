const { makeAutoObservable } = require('mobx-miniprogram')
const { pixelStore } = require('./pixelStore')
const { AnimationStore } = require('./animation/animationStore')
const { BrushManager } = require('../utils/brushes/BrushManager')
const { CanvasStore } = require('./canvasStore')

/**
 * 根Store，管理所有子Store
 */
class RootStore {
  constructor() {
    // 初始化子Store
    this.pixelStore = new pixelStore()

    // 新的简化动画架构
    this.animationStore = new AnimationStore(this.pixelStore)

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
        spray: { color: '#666666', width: 3, opacity: 0.7 },
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

    // 画布状态管理Store
    this.canvasStore = new CanvasStore(this)

    // 使用 makeAutoObservable 让整个对象变为响应式
    makeAutoObservable(this)
  }

  /**
   * 初始化动画系统
   */
  initAnimationSystem(canvasWidth, canvasHeight, backgroundColor) {
    this.animationStore.setupCanvas(null, null, canvasWidth, canvasHeight, backgroundColor)
    console.log('简化动画系统初始化完成')
    return this.animationStore
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
   * 检查当前画笔是否为橡皮擦
   */
  isCurrentBrushEraser() {
    return this.brushManager.isCurrentBrushEraser()
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

    // 更新动画系统的背景色
    this.animationStore.setBackgroundColor(this.canvasConfig.backgroundColor)

    console.log(`背景设置为: ${isTransparent ? '透明' : '白色'}`)
  }



  /**
   * 获取透明背景状态
   */
  getTransparentBackground() {
    return this.canvasConfig.isTransparent
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
   * 新的简化接口 - 捕获帧数据用于后端GIF生成
   */
  async captureFramesForBackend() {
    return await this.animationStore.captureFramesForBackend()
  }

  /**
   * 设置动画背景色
   */
  setAnimationBackgroundColor(color) {
    this.animationStore.setBackgroundColor(color)
  }

  /**
   * 销毁Store
   */
  destroy() {
    this.animationStore.destroy()
    console.log('rootStore已销毁')
  }
}

// 创建全局Store实例
const rootStore = new RootStore()

module.exports = { rootStore }
