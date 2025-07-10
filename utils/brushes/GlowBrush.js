const { BaseBrush } = require('./BaseBrush')
const { BRUSH_TYPES, BRUSH_LAYERS } = require('./brushConstants')

/**
 * 荧光笔画笔类
 * 特点：50%透明度，最底层级，高亮效果
 */
class GlowBrush extends BaseBrush {
  /**
   * 构造函数
   * @param {Object} config - 画笔配置
   */
  constructor(config = {}) {
    super({
      ...config,
      brushType: BRUSH_TYPES.GLOW,
      layer: BRUSH_LAYERS.GLOW,
      opacity: 0.5,  // 荧光笔50%透明度
      name: '荧光笔'
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
   * 获取有效透明度（荧光笔50%透明度）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {number} 有效透明度
   */
  getEffectiveOpacity(brushSize) {
    return 0.5  // 荧光笔50%透明度
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
   * 荧光笔特有的绘制效果处理
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Object} brushSize - 画笔大小配置
   */
  applyBrushEffect(ctx, x, y, brushSize) {
    // 荧光笔使用高亮效果
    ctx.globalAlpha = this.getEffectiveOpacity(brushSize)
    ctx.fillStyle = this.getEffectiveColor(brushSize)
    
    // 荧光笔可以使用特殊的混合模式来实现高亮效果
    // ctx.globalCompositeOperation = 'screen'  // 滤色模式
    // ctx.globalCompositeOperation = 'overlay'  // 叠加模式
  }

  /**
   * 获取画笔描述
   * @returns {string} 画笔描述
   */
  getDescription() {
    return '荧光笔 - 高亮绘制，50%透明度，最底层级'
  }

  /**
   * 荧光笔特有的发光效果
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Object} brushSize - 画笔大小配置
   */
  addGlowEffect(ctx, x, y, brushSize) {
    // 可以添加发光边缘效果
    const originalAlpha = ctx.globalAlpha
    const originalFillStyle = ctx.fillStyle
    
    // 创建发光效果（可选功能）
    ctx.globalAlpha = this.getEffectiveOpacity(brushSize) * 0.3
    ctx.fillStyle = this.getEffectiveColor(brushSize)
    
    // 绘制稍大一点的背景来模拟发光
    const glowSize = brushSize.size + 1
    ctx.fillRect(x - 0.5, y - 0.5, glowSize, glowSize)
    
    // 恢复原始设置
    ctx.globalAlpha = originalAlpha
    ctx.fillStyle = originalFillStyle
  }

  /**
   * 获取荧光笔的亮度调整后的颜色
   * @param {string} baseColor - 基础颜色
   * @returns {string} 调整后的颜色
   */
  getBrightenedColor(baseColor) {
    // 可以实现颜色亮度调整逻辑
    return baseColor
  }
}

module.exports = { GlowBrush }
