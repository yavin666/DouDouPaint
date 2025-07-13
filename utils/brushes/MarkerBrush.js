const { BaseBrush } = require('./BaseBrush')
const { BRUSH_TYPES, BRUSH_LAYERS } = require('./brushConstants')

/**
 * 马克笔画笔类
 * 特点：椭圆形大色块抖动效果，三种预设颜色，100%不透明，中间层级
 * 形状优化：使用椭圆形像素组合，模拟真实马克笔的扁平厚重效果
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
      opacity: 1,  // 马克笔80%透明度
      name: '马克笔'
    })

    // 马克笔预设颜色选项 - 优化为GIF友好的256色调色板
    this.presetColors = [
      '#FFFF00',  // 纯黄色 - 简化的黄色，减少颜色变化
      '#0000FF',  // 纯蓝色 - 简化的蓝色，减少颜色变化
      '#FF0080'   // 简化的粉红色 - 减少颜色变化
    ]

    // 当前选中的颜色索引
    this.currentColorIndex = 0

    // 设置默认颜色为第一个预设颜色
    this.color = this.presetColors[this.currentColorIndex]
  }

  /**
   * 创建像素 - 优化的马克笔整体色块效果
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Array} frameData - 帧数据（将被替换为优化的色块抖动数据）
   * @param {Object} brushSize - 画笔大小配置
   * @param {Object} pixelStore - 像素存储对象
   * @returns {string} 像素ID
   */
  createPixel(x, y, frameData, brushSize, pixelStore) {
    // 使用预计算的椭圆形色块帧数据，避免每次重新计算
    const markerFrameData = this.getOptimizedMarkerFrames(brushSize)

    // 使用更大的像素尺寸来绘制厚重的色块效果
    const pixelSize = Math.max(3, Math.floor(brushSize.size * 0.8))
    const adjustedBrushSize = {
      ...brushSize,
      size: pixelSize // 增大像素点尺寸，创建厚重色块
    }

    // 添加到像素存储
    return pixelStore.addPixel(
      x,
      y,
      this.getEffectiveColor(brushSize),
      markerFrameData,
      adjustedBrushSize,
      this.getEffectiveOpacity(brushSize),
      this.brushType
    )
  }

  /**
   * 获取优化的马克笔帧数据（使用缓存避免重复计算）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {Array} 优化的椭圆形色块抖动帧数据
   */
  getOptimizedMarkerFrames(brushSize) {
    const sizeKey = `${brushSize.size}_${brushSize.label || 'default'}`

    // 使用缓存避免重复计算
    if (!this.frameCache) {
      this.frameCache = new Map()
    }

    if (this.frameCache.has(sizeKey)) {
      return this.frameCache.get(sizeKey)
    }

    // 生成简化的椭圆色块帧数据
    const optimizedFrames = this.generateOptimizedMarkerFrames(brushSize)
    this.frameCache.set(sizeKey, optimizedFrames)

    return optimizedFrames
  }

  /**
   * 生成优化的马克笔帧数据（减少像素点数量）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {Array} 优化的帧数据
   */
  generateOptimizedMarkerFrames(brushSize) {
    // 增大马克笔色块尺寸，使其更明显
    const baseSize = Math.max(6, brushSize.size * 1.5)

    // 生成更大的椭圆形像素点，确保色块效果
    const ellipsePixels = this.generateSmoothEllipse(baseSize)

    // 简化的3帧抖动动画
    const frames = [
      ellipsePixels,                                           // 第0帧 - 基础位置
      ellipsePixels.map(([x, y]) => [x - 0.2, y]),           // 第1帧 - 轻微左移
      ellipsePixels.map(([x, y]) => [x + 0.2, y])            // 第2帧 - 轻微右移
    ]

    return frames
  }

  /**
   * 生成平滑的椭圆形像素点（大色块，边缘平滑）
   * @param {number} size - 色块大小
   * @returns {Array} 平滑椭圆形像素点坐标数组
   */
  generateSmoothEllipse(size) {
    const pixels = []

    // 增大椭圆参数，创建更大的色块
    const radiusX = Math.max(5, Math.floor(size * 1.2)) // 更大的横向半径
    const radiusY = Math.max(3, Math.floor(size * 0.7)) // 更大的纵向半径

    // 使用更宽松的椭圆方程，创建更饱满的色块
    for (let x = -radiusX; x <= radiusX; x += 1) {
      for (let y = -radiusY; y <= radiusY; y += 1) {
        // 椭圆方程：(x/a)² + (y/b)² <= 1
        // 使用更宽松的阈值(1.2)来创建更饱满的边缘
        const ellipseValue = (x * x) / (radiusX * radiusX) + (y * y) / (radiusY * radiusY)

        if (ellipseValue <= 1.2) {
          pixels.push([x, y])
        }
      }
    }

    return pixels
  }

  /**
   * 生成简化的椭圆形像素点（性能优化版，保持色块效果）
   * @param {number} size - 色块大小
   * @returns {Array} 简化的椭圆形像素点坐标数组
   */
  generateSimplifiedEllipse(size) {
    // 现在直接调用平滑版本
    return this.generateSmoothEllipse(size)
  }

  /**
   * 生成椭圆形像素点（保留原方法用于兼容）
   * @param {number} size - 色块大小
   * @returns {Array} 椭圆形像素点坐标数组
   */
  generateEllipsePixels(size) {
    // 现在直接调用简化版本
    return this.generateSimplifiedEllipse(size)
  }

  /**
   * 添加随机边缘像素，增加马克笔的自然毛边效果
   * 注释掉此方法以获得干净的大色块效果
   * @param {Array} pixels - 现有像素点数组
   * @param {number} radiusX - 横向半径
   * @param {number} radiusY - 纵向半径
   */
  addRandomEdgePixels(pixels, radiusX, radiusY) {
    // 为了获得干净的大色块效果，暂时禁用随机边缘处理
    // 如果需要恢复毛边效果，可以取消下面代码的注释

    /*
    // 在椭圆边缘添加一些随机点
    const edgePoints = [
      // 左右边缘延伸
      [-radiusX - 1, 0], [radiusX + 1, 0],
      [-radiusX - 1, -1], [radiusX + 1, -1],
      [-radiusX - 1, 1], [radiusX + 1, 1],
      // 上下边缘延伸
      [0, -radiusY - 1], [0, radiusY + 1],
      [-1, -radiusY - 1], [1, radiusY + 1],
      [1, -radiusY - 1], [-1, radiusY + 1],
    ]

    edgePoints.forEach(point => {
      if (Math.random() > 0.4) { // 60%概率添加边缘点
        pixels.push(point)
      }
    })
    */
  }

  /**
   * 计算椭圆色块的基础尺寸
   * @param {Object} brushSize - 画笔大小配置
   * @returns {number} 色块基础尺寸
   */
  calculateBlockSize(brushSize) {
    const baseSize = brushSize.size || 6
    // 马克笔色块比普通画笔更大，模拟厚重感
    // 进一步增加尺寸倍数，让色块更饱满更明显
    return Math.max(16, baseSize * 4)
  }

  /**
   * 获取有效透明度（马克笔100%不透明）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {number} 有效透明度
   */
  getEffectiveOpacity(brushSize) {
    return 1.0  // 马克笔100%不透明，色块厚重感
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
   * 切换到下一个预设颜色
   * @returns {string} 新的颜色值
   */
  switchToNextColor() {
    this.currentColorIndex = (this.currentColorIndex + 1) % this.presetColors.length
    this.color = this.presetColors[this.currentColorIndex]
    return this.color
  }

  /**
   * 设置指定索引的预设颜色
   * @param {number} index - 颜色索引 (0-2)
   * @returns {string} 设置的颜色值
   */
  setPresetColor(index) {
    if (index >= 0 && index < this.presetColors.length) {
      this.currentColorIndex = index
      this.color = this.presetColors[this.currentColorIndex]
    }
    return this.color
  }

  /**
   * 获取所有预设颜色
   * @returns {Array<string>} 预设颜色数组
   */
  getPresetColors() {
    return [...this.presetColors]
  }

  /**
   * 获取当前颜色索引
   * @returns {number} 当前颜色索引
   */
  getCurrentColorIndex() {
    return this.currentColorIndex
  }

  /**
   * 获取当前颜色名称（用于UI显示）
   * @returns {string} 颜色名称
   */
  getCurrentColorName() {
    const colorNames = ['纯黄色', '纯蓝色', '粉红色']
    return colorNames[this.currentColorIndex] || '未知'
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
    const colorName = this.getCurrentColorName()
    return `马克笔 - ${colorName}椭圆形大色块，100%不透明，GIF优化调色板`
  }

  /**
   * 马克笔特有的颜色混合效果
   * @param {string} baseColor - 基础颜色
   * @param {number} alpha - 透明度
   * @returns {string} 混合后的颜色
   */
  blendColor(baseColor, alpha = 0.8) {
    // 马克笔色块效果的颜色混合逻辑
    // 可以根据需要实现更复杂的颜色叠加效果
    return baseColor
  }

  /**
   * 获取马克笔配置信息（扩展基类方法）
   * @returns {Object} 马克笔配置信息
   */
  getBrushInfo() {
    const baseInfo = super.getBrushInfo()
    return {
      ...baseInfo,
      presetColors: this.presetColors,
      currentColorIndex: this.currentColorIndex,
      currentColorName: this.getCurrentColorName(),
      effectType: 'ellipseBlockShake', // 椭圆形色块抖动效果标识
      shapeType: 'ellipse' // 椭圆形状标识
    }
  }
}

module.exports = { MarkerBrush }
