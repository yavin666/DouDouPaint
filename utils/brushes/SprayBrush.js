const { BaseBrush } = require('./BaseBrush')
const { BRUSH_TYPES, BRUSH_LAYERS } = require('./brushConstants')

/**
 * 喷漆画笔类
 * 特点：稀疏像素分布，大范围喷涂，随机散点效果
 * 层级：底层（但新像素临时显示在上层）
 */
class SprayBrush extends BaseBrush {
  /**
   * 构造函数
   * @param {Object} config - 画笔配置
   */
  constructor(config = {}) {
    super({
      ...config,
      brushType: BRUSH_TYPES.SPRAY,
      layer: BRUSH_LAYERS.SPRAY,
      opacity: 0.7,  // 喷漆70%透明度
      name: '喷漆'
    })
    
    // 喷漆特有配置 - 调整为更稀疏的像素点效果
    this.sprayConfig = {
      density: 0.3,        // 像素密度（提高到0.3，确保足够可见）
      radiusMultiplier: 10, // 喷涂半径倍数（适中范围）
      scatterRange: 15,     // 随机散点范围（适中散点范围）
      minPixels: 15,        // 每次喷涂最少像素数（适中数量）
      maxPixels: 30,       // 每次喷涂最多像素数（适中数量）
      pixelSize: 2         // 像素点大小（2x2方块的子像素大小）
    }

    // 用于避免像素重叠的位置记录
    this.recentPixels = new Set()
  }

  /**
   * 创建喷漆像素（多个随机散点）
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Array} frameData - 帧数据
   * @param {Object} brushSize - 画笔大小配置
   * @param {Object} pixelStore - 像素存储对象
   * @returns {string} 主像素ID（返回第一个创建的像素ID）
   */
  createPixel(x, y, frameData, brushSize, pixelStore) {
    let mainPixelId = null

    // 计算喷涂范围
    const sprayRadius = brushSize.size * this.sprayConfig.radiusMultiplier

    // 计算本次喷涂的像素数量
    const pixelCount = Math.floor(
      Math.random() * (this.sprayConfig.maxPixels - this.sprayConfig.minPixels + 1)
    ) + this.sprayConfig.minPixels

    // 生成随机散点 - 使用更自然的分布算法
    for (let i = 0; i < pixelCount; i++) {
      // 随机决定是否创建这个像素（控制密度）
      if (Math.random() > this.sprayConfig.density) {
        continue
      }

      // 使用高斯分布生成更自然的喷漆效果
      const angle = Math.random() * Math.PI * 2

      // 使用平方根分布使像素更集中在中心，边缘更稀疏
      const normalizedDistance = Math.sqrt(Math.random())
      const distance = normalizedDistance * sprayRadius

      const offsetX = Math.cos(angle) * distance
      const offsetY = Math.sin(angle) * distance

      // 添加额外的随机散点效果，模拟真实喷漆的不规则性
      const scatterX = (Math.random() - 0.5) * this.sprayConfig.scatterRange
      const scatterY = (Math.random() - 0.5) * this.sprayConfig.scatterRange

      const finalX = Math.round(x + offsetX + scatterX)
      const finalY = Math.round(y + offsetY + scatterY)

      // 避免像素重叠（检查是否已有像素在相同位置）
      const pixelKey = `${finalX},${finalY}`
      if (this.recentPixels && this.recentPixels.has(pixelKey)) {
        continue
      }

      // 创建单个像素
      const pixelId = this.createSingleSprayPixel(
        finalX,
        finalY,
        frameData,
        brushSize,
        pixelStore
      )

      if (pixelId) {
        // 记录最近创建的像素位置，避免重叠
        if (!this.recentPixels) {
          this.recentPixels = new Set()
        }
        this.recentPixels.add(pixelKey)

        // 清理旧的像素位置记录（避免内存泄漏）
        if (this.recentPixels.size > 100) {
          const firstKey = this.recentPixels.values().next().value
          this.recentPixels.delete(firstKey)
        }

        if (!mainPixelId) {
          mainPixelId = pixelId  // 记录第一个创建的像素ID
        }
      }
    }

    return mainPixelId
  }

  /**
   * 创建单个喷漆像素
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Array} frameData - 帧数据
   * @param {Object} brushSize - 画笔大小配置
   * @param {Object} pixelStore - 像素存储对象
   * @returns {string} 像素ID
   */
  createSingleSprayPixel(x, y, frameData, brushSize, pixelStore) {
    // 创建喷漆像素点的动画帧数据（2x2方块整体抖动效果）
    const sprayPixelFrames = [
      // 第0帧 - 基础2x2方块位置
      [[0, 0], [1, 0], [0, 1], [1, 1]],
      // 第1帧 - 整个方块向左上移动
      [[-1, -1], [0, -1], [-1, 0], [0, 0]],
      // 第2帧 - 整个方块向右下移动
      [[1, 1], [2, 1], [1, 2], [2, 2]],
      // 第3帧 - 整个方块向右移动
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      // 第4帧 - 回到基础位置
      [[0, 0], [1, 0], [0, 1], [1, 1]]
    ]

    // 创建合适尺寸的画笔配置（2x2方块，每个子像素大小为2）
    const sprayBrushConfig = {
      size: this.sprayConfig.pixelSize || 2
    }

    // 添加到像素存储（使用特殊的喷漆层级逻辑）
    return pixelStore.addSprayPixel(
      x,
      y,
      this.getEffectiveColor(brushSize),
      sprayPixelFrames,
      sprayBrushConfig,
      this.getEffectiveOpacity(brushSize),
      this.brushType
    )
  }

  /**
   * 获取有效透明度
   * @param {Object} brushSize - 画笔大小配置
   * @returns {number} 有效透明度
   */
  getEffectiveOpacity(brushSize) {
    // 喷漆透明度有随机变化，模拟真实喷漆效果
    // 提高基础透明度，确保像素点清晰可见
    const baseOpacity = 0.6  // 提高基础透明度
    const variation = 0.3    // 适度的变化范围
    const randomOpacity = baseOpacity + (Math.random() - 0.5) * variation

    // 确保透明度在合理范围内，最低0.3确保可见性
    return Math.max(0.3, Math.min(0.9, randomOpacity))
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
    return { ...this.sprayConfig }
  }

  /**
   * 设置喷漆密度
   * @param {number} density - 密度值 (0-1)
   */
  setDensity(density) {
    this.sprayConfig.density = Math.max(0, Math.min(1, density))
  }

  /**
   * 设置喷涂半径倍数
   * @param {number} multiplier - 半径倍数
   */
  setRadiusMultiplier(multiplier) {
    this.sprayConfig.radiusMultiplier = Math.max(1, multiplier)
  }

  /**
   * 清理像素位置记录（防止内存泄漏）
   */
  clearPixelHistory() {
    this.recentPixels.clear()
  }
}

module.exports = { SprayBrush }
