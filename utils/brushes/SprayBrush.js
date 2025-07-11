const { BaseBrush } = require('./BaseBrush')
const { BRUSH_TYPES, BRUSH_LAYERS } = require('./brushConstants')

/**
 * 喷漆画笔类
 * 特点：稀疏像素分布，大范围喷涂，随机散点效果
 * 层级：中间层（在马克笔上层，铅笔下层）
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
      opacity: 1,  // 喷漆70%透明度
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
   * 创建喷漆像素（优化版 - 使用预定义图案）
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Array} frameData - 帧数据
   * @param {Object} brushSize - 画笔大小配置
   * @param {Object} pixelStore - 像素存储对象
   * @returns {string} 主像素ID
   */
  createPixel(x, y, frameData, brushSize, pixelStore) {
    // 使用预定义的喷漆图案，通过旋转实现随机效果
    const sprayPattern = this.getOptimizedSprayPattern(brushSize)

    // 随机旋转角度
    const rotationAngle = Math.random() * Math.PI * 2

    // 应用旋转变换到图案
    const rotatedPattern = this.rotateSprayPattern(sprayPattern, rotationAngle)

    // 创建单个整体喷漆像素，包含完整的图案数据
    return this.createSprayPatternPixel(x, y, rotatedPattern, brushSize, pixelStore)
  }

  /**
   * 获取优化的喷漆图案（使用缓存）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {Array} 喷漆图案坐标数组
   */
  getOptimizedSprayPattern(brushSize) {
    const sizeKey = `spray_${brushSize.size}_${brushSize.label || 'default'}`

    // 使用缓存避免重复计算
    if (!this.patternCache) {
      this.patternCache = new Map()
    }

    if (this.patternCache.has(sizeKey)) {
      return this.patternCache.get(sizeKey)
    }

    // 生成基础喷漆图案
    const pattern = this.generateBaseSprayPattern(brushSize)
    this.patternCache.set(sizeKey, pattern)

    return pattern
  }

  /**
   * 生成基础喷漆图案
   * @param {Object} brushSize - 画笔大小配置
   * @returns {Array} 基础图案坐标数组
   */
  generateBaseSprayPattern(brushSize) {
    const pattern = []
    const sprayRadius = brushSize.size * this.sprayConfig.radiusMultiplier

    // 生成固定数量的像素点，避免随机数计算
    const pixelCount = Math.floor(this.sprayConfig.minPixels +
      (this.sprayConfig.maxPixels - this.sprayConfig.minPixels) * 0.7)

    // 使用预定义的角度分布，避免随机计算
    const angleStep = (Math.PI * 2) / pixelCount

    for (let i = 0; i < pixelCount; i++) {
      const angle = i * angleStep + (i % 3) * 0.3 // 添加轻微变化
      const distance = (0.3 + (i % 4) * 0.2) * sprayRadius // 分层分布

      const offsetX = Math.cos(angle) * distance
      const offsetY = Math.sin(angle) * distance

      pattern.push([Math.round(offsetX), Math.round(offsetY)])
    }

    return pattern
  }

  /**
   * 旋转喷漆图案
   * @param {Array} pattern - 原始图案
   * @param {number} angle - 旋转角度
   * @returns {Array} 旋转后的图案
   */
  rotateSprayPattern(pattern, angle) {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    return pattern.map(([x, y]) => [
      Math.round(x * cos - y * sin),
      Math.round(x * sin + y * cos)
    ])
  }

  /**
   * 创建喷漆图案像素
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Array} pattern - 图案数据
   * @param {Object} brushSize - 画笔大小配置
   * @param {Object} pixelStore - 像素存储对象
   * @returns {string} 像素ID
   */
  createSprayPatternPixel(x, y, pattern, brushSize, pixelStore) {
    // 将图案转换为帧数据格式
    const sprayFrameData = this.convertPatternToFrames(pattern)

    // 创建画笔配置
    const sprayBrushConfig = {
      size: this.sprayConfig.pixelSize || 2
    }

    // 添加到像素存储
    return pixelStore.addPixel(
      x,
      y,
      this.getEffectiveColor(brushSize),
      sprayFrameData,
      sprayBrushConfig,
      this.getEffectiveOpacity(brushSize),
      this.brushType
    )
  }

  /**
   * 将图案转换为帧数据格式
   * @param {Array} pattern - 图案坐标数组
   * @returns {Array} 帧数据数组
   */
  convertPatternToFrames(pattern) {
    // 生成3帧轻微抖动的图案
    return [
      pattern,                                                    // 第0帧 - 基础图案
      pattern.map(([x, y]) => [x - 0.5, y]),                    // 第1帧 - 轻微左移
      pattern.map(([x, y]) => [x + 0.5, y])                     // 第2帧 - 轻微右移
    ]
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

    // 添加到像素存储（使用普通层级逻辑）
    return pixelStore.addPixel(
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
