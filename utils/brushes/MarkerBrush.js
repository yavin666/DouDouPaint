const { BaseBrush } = require('./BaseBrush')
const { BRUSH_TYPES, BRUSH_LAYERS } = require('./brushConstants')

/**
 * 马克笔画笔类
 * 特点：80%透明度，中间层级，半透明效果
 */
class MarkerBrush extends BaseBrush {
  /**
   * 构造函数
   * @param {Object} config - 画笔配置
   */
  constructor(config = {}) {
    super({
      ...config,
      brushType: BRUSH_TYPES.MARKER,
      layer: BRUSH_LAYERS.MARKER,
      opacity: 0.8,  // 马克笔80%透明度
      name: '马克笔'
    })
  }

  /**
   * 创建像素
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Array} frameData - 帧数据
   * @param {Object} brushSize - 画笔大小配置
   * @param {Object} pixelStore - 像素存储对象
   * @returns {string} 像素ID
   */
  createPixel(x, y, frameData, brushSize, pixelStore) {
    // 创建WigglePixel实例
    const pixel = this.createWigglePixel(x, y, frameData, brushSize)
    
    // 添加到像素存储
    return pixelStore.addPixel(
      x, 
      y, 
      this.getEffectiveColor(brushSize), 
      frameData, 
      brushSize, 
      this.getEffectiveOpacity(brushSize), 
      this.brushType
    )
  }

  /**
   * 获取有效透明度（马克笔80%透明度）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {number} 有效透明度
   */
  getEffectiveOpacity(brushSize) {
    return 0.8  // 马克笔80%透明度
  }

  /**
   * 获取有效颜色
   * @param {Object} brushSize - 画笔大小配置
   * @returns {string} 有效颜色
   */
  getEffectiveColor(brushSize) {
    return this.color
  }

  /**
   * 马克笔特有的绘制效果处理
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Object} brushSize - 画笔大小配置
   */
  applyBrushEffect(ctx, x, y, brushSize) {
    // 马克笔使用半透明效果
    ctx.globalAlpha = this.getEffectiveOpacity(brushSize)
    ctx.fillStyle = this.getEffectiveColor(brushSize)
    
    // 可以在这里添加马克笔特有的混合模式
    // ctx.globalCompositeOperation = 'multiply'  // 正片叠底效果
  }

  /**
   * 获取画笔描述
   * @returns {string} 画笔描述
   */
  getDescription() {
    return '马克笔 - 半透明绘制，80%透明度，中间层级'
  }

  /**
   * 马克笔特有的颜色混合效果
   * @param {string} baseColor - 基础颜色
   * @param {number} alpha - 透明度
   * @returns {string} 混合后的颜色
   */
  blendColor(baseColor, alpha = 0.8) {
    // 可以实现更复杂的颜色混合逻辑
    return baseColor
  }
}

module.exports = { MarkerBrush }
