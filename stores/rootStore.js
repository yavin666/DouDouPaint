const { makeAutoObservable } = require('mobx-miniprogram')
const { pixelStore } = require('./pixelStore')
const { AnimationStore } = require('./animation/animationStore')
const { CanvasStore } = require('./canvasStore')
const { PenStore } = require('./penStore')

/**
 * 根Store，管理所有子Store
 * 简化版本：画笔相关逻辑由 PenStore 统一管理
 */
class RootStore {
  constructor() {
    // 初始化子Store
    this.pixelStore = new pixelStore()

    // 新的简化动画架构
    this.animationStore = new AnimationStore(this.pixelStore)

    // 画笔状态管理Store（包含 BrushManager）
    this.penStore = new PenStore()

    // 画布配置
    this.canvasConfig = {
      width: 375,
      height: 500,
      backgroundColor: '#FFFFFF',
      isTransparent: false // 透明背景开关
    }

    // 简化的绘制配置（保留兼容性）
    this.drawingConfig = {
      isDrawing: false,
      lastX: 0,
      lastY: 0
    }

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
    const penConfig = this.penStore.penTypes[penType] || this.penStore.penTypes.pencil
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
   * 获取当前背景颜色
   */
  getCurrentBackgroundColor() {
    return this.canvasConfig.isTransparent ? 'transparent' : this.canvasConfig.backgroundColor
  }

  /**
   * 获取当前画笔配置（代理到 penStore）
   */
  getCurrentBrushConfig() {
    return this.penStore.getCurrentBrushSizeConfig()
  }

  /**
   * 获取当前画笔大小（代理到 penStore）
   */
  getCurrentBrushSize() {
    return this.getCurrentBrushConfig()
  }

  /**
   * 获取当前像素间距（代理到 penStore）
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
