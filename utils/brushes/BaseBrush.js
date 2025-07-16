const { WigglePixel } = require('../pixels/wigglePixel')
const { BRUSH_LAYERS, BRUSH_TYPES } = require('./brushConstants')

/**
 * 画笔基类
 * 定义所有画笔的通用属性和方法
 */
class BaseBrush {
  /**
   * 构造函数
   * @param {Object} config - 画笔配置
   * @param {string} config.color - 颜色
   * @param {number} config.opacity - 透明度 (0-1)
   * @param {number} config.layer - 渲染层级
   * @param {string} config.audio - 音效文件路径
   * @param {string} config.name - 画笔名称
   * @param {boolean} config.isEraser - 是否为橡皮擦
   * @param {number} config.sizeMultiplier - 尺寸倍数
   * @param {number} config.shakeIntensity - 抖动强度
   */
  constructor(config) {
    this.color = config.color || '#000000'
    this.opacity = config.opacity || 1.0
    this.layer = config.layer || BRUSH_LAYERS.PENCIL
    this.audio = config.audio || ''
    this.name = config.name || '画笔'
    this.isEraser = config.isEraser || false
    this.brushType = config.brushType || BRUSH_TYPES.PENCIL

    // 新增：统一的画笔参数配置
    this.sizeMultiplier = config.sizeMultiplier || 1.0  // 尺寸倍数
    this.shakeIntensity = config.shakeIntensity || 0.8  // 抖动强度
  }

  /**
   * 创建像素（统一实现，子类只需实现generateShape方法）
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Array} frameData - 帧数据（将被忽略，使用统一的3帧动画）
   * @param {Object} brushSize - 画笔大小配置
   * @param {Object} pixelStore - 像素存储对象
   * @returns {string|null} 像素ID或null
   */
  createPixel(x, y, frameData, brushSize, pixelStore) {
    // 计算有效尺寸
    const effectiveSize = this.calculateEffectiveSize(brushSize)

    // 生成画笔特定的形状（子类实现）
    const shape = this.generateShape(effectiveSize)

    // 生成统一的3帧抖动动画
    const frames = this.generate3FrameAnimation(shape)

    // 创建最终的画笔配置
    const finalBrushConfig = {
      ...brushSize,
      size: effectiveSize
    }

    // 添加到像素存储
    return pixelStore.addPixel(
      x,
      y,
      this.getEffectiveColor(brushSize),
      frames,
      finalBrushConfig,
      this.getEffectiveOpacity(brushSize),
      this.brushType
    )
  }

  /**
   * 获取有效透明度（子类可重写）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {number} 有效透明度
   */
  getEffectiveOpacity(brushSize) {
    return this.opacity
  }

  /**
   * 获取有效颜色（子类可重写）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {string} 有效颜色
   */
  getEffectiveColor(brushSize) {
    return this.color
  }

  /**
   * 获取层级顺序
   * @returns {number} 层级顺序
   */
  getLayerOrder() {
    return this.layer
  }

  /**
   * 是否应该创建像素（橡皮擦返回false）
   * @returns {boolean}
   */
  shouldCreatePixel() {
    return !this.isEraser
  }

  /**
   * 播放音效
   * @param {Function} audioPlayer - 音频播放函数
   */
  playAudio(audioPlayer) {
    if (this.audio && audioPlayer) {
      audioPlayer(this.audio)
    }
  }

  /**
   * 获取画笔信息
   * @returns {Object} 画笔信息
   */
  getBrushInfo() {
    return {
      name: this.name,
      color: this.color,
      opacity: this.opacity,
      layer: this.layer,
      brushType: this.brushType,
      isEraser: this.isEraser
    }
  }

  /**
   * 创建WigglePixel实例的通用方法
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Array} frameData - 帧数据
   * @param {Object} brushSize - 画笔大小配置
   * @returns {WigglePixel} WigglePixel实例
   */
  createWigglePixel(x, y, frameData, brushSize) {
    return new WigglePixel(
      x,
      y,
      this.getEffectiveColor(brushSize),
      frameData,
      brushSize.size,
      this.getEffectiveOpacity(brushSize),
      this.brushType
    )
  }

  /**
   * 设置画笔颜色
   * @param {string} color - 新颜色
   */
  setColor(color) {
    this.color = color
  }

  /**
   * 设置画笔透明度
   * @param {number} opacity - 新透明度 (0-1)
   */
  setOpacity(opacity) {
    this.opacity = Math.max(0, Math.min(1, opacity))
  }

  /**
   * 获取画笔类型
   * @returns {string} 画笔类型
   */
  getBrushType() {
    return this.brushType
  }

  /**
   * 计算有效尺寸（应用尺寸倍数）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {number} 有效尺寸
   */
  calculateEffectiveSize(brushSize) {
    const baseSize = brushSize.size || 2
    return Math.max(1, Math.round(baseSize * this.sizeMultiplier))
  }

  /**
   * 生成统一的3帧抖动动画
   * @param {Array} shape - 基础形状像素点数组 [[x, y], ...]
   * @returns {Array} 3帧动画数据
   */
  generate3FrameAnimation(shape) {
    if (!shape || shape.length === 0) {
      return [[], [], []]
    }

    return [
      shape,  // 第0帧 - 基础位置
      shape.map(([x, y]) => [x - this.shakeIntensity, y - 0.2]),  // 第1帧 - 左下抖动
      shape.map(([x, y]) => [x + this.shakeIntensity, y + 0.2])   // 第2帧 - 右上抖动
    ]
  }

  /**
   * 生成画笔形状（抽象方法，子类必须实现）
   * @param {number} size - 有效尺寸
   * @returns {Array} 形状像素点数组 [[x, y], ...]
   */
  generateShape(size) {
    throw new Error('generateShape方法必须在子类中实现')
  }
}

module.exports = { BaseBrush }
