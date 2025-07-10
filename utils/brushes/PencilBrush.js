const { BaseBrush } = require('./BaseBrush')
const { BRUSH_TYPES, BRUSH_LAYERS } = require('./brushConstants')

/**
 * 铅笔画笔类
 * 特点：100%透明度，最高层级，实线效果
 */
class PencilBrush extends BaseBrush {
  /**
   * 构造函数
   * @param {Object} config - 画笔配置
   */
  constructor(config = {}) {
    super({
      ...config,
      brushType: BRUSH_TYPES.PENCIL,
      layer: BRUSH_LAYERS.PENCIL,
      opacity: 1.0,  // 铅笔始终100%透明度
      name: '铅笔'
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
   * 获取有效透明度（铅笔始终100%）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {number} 有效透明度
   */
  getEffectiveOpacity(brushSize) {
    return 1.0  // 铅笔始终100%透明度
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
   * 铅笔特有的绘制效果处理
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Object} brushSize - 画笔大小配置
   */
  applyBrushEffect(ctx, x, y, brushSize) {
    // 铅笔使用标准绘制，无特殊效果
    ctx.globalAlpha = this.getEffectiveOpacity(brushSize)
    ctx.fillStyle = this.getEffectiveColor(brushSize)
  }

  /**
   * 获取画笔描述
   * @returns {string} 画笔描述
   */
  getDescription() {
    return '铅笔 - 实线绘制，100%透明度，最高层级'
  }
}

module.exports = { PencilBrush }
