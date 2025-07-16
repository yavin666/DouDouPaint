const { BaseBrush } = require('./BaseBrush')
const { BRUSH_TYPES, BRUSH_LAYERS, DEFAULT_BRUSH_CONFIG } = require('./brushConstants')

/**
 * 喷漆画笔类（简化重构版）
 * 特点：稀疏像素分布，大范围喷涂，随机散点效果
 * 简化：使用BaseBrush统一的createPixel和动画生成逻辑，移除重复的帧数据处理
 */
class SprayBrush extends BaseBrush {
  /**
   * 构造函数
   * @param {Object} config - 画笔配置
   */
  constructor(config = {}) {
    // 使用DEFAULT_BRUSH_CONFIG中的喷漆配置
    const sprayConfig = DEFAULT_BRUSH_CONFIG[BRUSH_TYPES.SPRAY]
    
    super({
      ...sprayConfig,
      ...config,
      brushType: BRUSH_TYPES.SPRAY,
      layer: BRUSH_LAYERS.SPRAY
    })
    
    // 喷漆特有配置
    this.sprayConfig = {
      density: 0.3,        // 像素密度
      radiusMultiplier: 3, // 喷涂半径倍数（简化）
      minPixels: 8,        // 每次喷涂最少像素数（简化）
      maxPixels: 15        // 每次喷涂最多像素数（简化）
    }
  }

  /**
   * 生成喷漆散点形状（实现BaseBrush的抽象方法）
   * @param {number} size - 有效尺寸
   * @returns {Array} 散点像素点数组 [[x, y], ...]
   */
  generateShape(size) {
    return this.generateSprayPattern(size)
  }

  /**
   * 生成喷漆散点图案
   * @param {number} size - 画笔大小
   * @returns {Array} 散点坐标数组
   */
  generateSprayPattern(size) {
    const pattern = []
    const sprayRadius = size * this.sprayConfig.radiusMultiplier

    // 计算像素点数量
    const pixelCount = Math.floor(
      this.sprayConfig.minPixels + 
      Math.random() * (this.sprayConfig.maxPixels - this.sprayConfig.minPixels)
    )

    // 生成随机散点
    for (let i = 0; i < pixelCount; i++) {
      // 使用极坐标生成随机点
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * sprayRadius
      
      const x = Math.round(Math.cos(angle) * distance)
      const y = Math.round(Math.sin(angle) * distance)
      
      pattern.push([x, y])
    }

    return pattern
  }

  /**
   * 获取有效透明度（喷漆有随机变化）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {number} 有效透明度
   */
  getEffectiveOpacity(brushSize) {
    // 喷漆透明度有随机变化，模拟真实喷漆效果
    const baseOpacity = this.opacity
    const variation = 0.2    // 变化范围
    const randomOpacity = baseOpacity + (Math.random() - 0.5) * variation

    // 确保透明度在合理范围内
    return Math.max(0.3, Math.min(0.9, randomOpacity))
  }

  /**
   * 喷漆特有的绘制效果处理
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Object} brushSize - 画笔大小配置
   */
  applyBrushEffect(ctx, x, y, brushSize) {
    // 喷漆使用随机透明度
    ctx.globalAlpha = this.getEffectiveOpacity(brushSize)
    ctx.fillStyle = this.getEffectiveColor(brushSize)
    
    // 可以使用特殊的混合模式来实现喷漆效果
    // ctx.globalCompositeOperation = 'multiply'  // 正片叠底
    // ctx.globalCompositeOperation = 'darken'    // 变暗
  }

  /**
   * 获取画笔描述
   * @returns {string} 画笔描述
   */
  getDescription() {
    return '喷漆 - 稀疏散点，大范围喷涂，随机效果'
  }

  /**
   * 获取喷漆配置信息
   * @returns {Object} 喷漆配置
   */
  getSprayConfig() {
    return {
      ...this.sprayConfig,
      currentOpacity: this.opacity,
      currentColor: this.color
    }
  }
}

module.exports = { SprayBrush }
