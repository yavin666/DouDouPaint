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
   */
  constructor(config) {
    this.color = config.color || '#000000'
    this.opacity = config.opacity || 1.0
    this.layer = config.layer || BRUSH_LAYERS.PENCIL
    this.audio = config.audio || ''
    this.name = config.name || '画笔'
    this.isEraser = config.isEraser || false
    this.brushType = config.brushType || BRUSH_TYPES.PENCIL
  }

  /**
   * 创建像素（抽象方法，子类必须实现）
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Array} frameData - 帧数据
   * @param {Object} brushSize - 画笔大小配置
   * @param {Object} pixelStore - 像素存储对象
   * @returns {string|null} 像素ID或null
   */
  createPixel(x, y, frameData, brushSize, pixelStore) {
    throw new Error('createPixel方法必须在子类中实现')
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
}

module.exports = { BaseBrush }
