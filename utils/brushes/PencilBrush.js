const { BaseBrush } = require('./BaseBrush')
const { BRUSH_TYPES, BRUSH_LAYERS, DEFAULT_BRUSH_CONFIG } = require('./brushConstants')

/**
 * 铅笔画笔类（简化重构版）
 * 特点：圆形像素，复古质感，使用BaseBrush统一的createPixel和动画生成逻辑
 * 简化：移除重复的帧生成逻辑，只保留圆形像素生成方法
 */
class PencilBrush extends BaseBrush {
  /**
   * 构造函数
   * @param {Object} config - 画笔配置
   */
  constructor(config = {}) {
    // 使用DEFAULT_BRUSH_CONFIG中的铅笔配置
    const pencilConfig = DEFAULT_BRUSH_CONFIG[BRUSH_TYPES.PENCIL]
    
    super({
      ...pencilConfig,
      ...config,
      brushType: BRUSH_TYPES.PENCIL,
      layer: BRUSH_LAYERS.PENCIL
    })
  }

  /**
   * 生成圆形形状（实现BaseBrush的抽象方法）
   * @param {number} size - 有效尺寸
   * @returns {Array} 圆形像素点数组 [[x, y], ...]
   */
  generateShape(size) {
    return this.generateCircularPixels(size)
  }

  /**
   * 生成基础圆形像素点
   * @param {number} size - 画笔大小
   * @returns {Array} 圆形像素点坐标数组
   */
  generateCircularPixels(size) {
    const pixels = []
    const radius = Math.max(1, Math.floor(size / 2))

    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        const distance = Math.sqrt(x * x + y * y)
        if (distance <= radius) {
          pixels.push([x, y])
        }
      }
    }

    return pixels
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
    return '铅笔 - 简洁复古质感，轻微抖动动画'
  }
}

module.exports = { PencilBrush }
