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

    // 马克笔预设颜色选项
    this.presetColors = [
      '#FFEB3B',  // 黄色 - 对应图片中的黄色色块
      '#2196F3',  // 蓝色 - 对应图片中的蓝色色块
      '#E91E63'   // 粉红色 - 对应图片中的粉红色色块
    ]

    // 当前选中的颜色索引
    this.currentColorIndex = 0

    // 设置默认颜色为第一个预设颜色
    this.color = this.presetColors[this.currentColorIndex]
  }

  /**
   * 创建像素 - 马克笔椭圆形大色块效果
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Array} frameData - 帧数据（将被替换为椭圆色块抖动数据）
   * @param {Object} brushSize - 画笔大小配置
   * @param {Object} pixelStore - 像素存储对象
   * @returns {string} 像素ID
   */
  createPixel(x, y, frameData, brushSize, pixelStore) {
    // 创建椭圆形色块的抖动帧数据
    const markerFrameData = this.generateSingleBlockFrames(brushSize)

    // 使用较小的像素尺寸，因为我们通过多个像素点组成椭圆形
    const pixelSize = Math.max(2, Math.floor(brushSize.size / 2))
    const adjustedBrushSize = {
      ...brushSize,
      size: pixelSize // 单个像素点的尺寸
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
   * 生成椭圆形大色块的抖动帧数据
   * 创建椭圆形状的像素点组合来模拟马克笔效果
   * @param {Object} brushSize - 画笔大小配置
   * @returns {Array} 椭圆形色块的抖动帧数据
   */
  generateSingleBlockFrames(brushSize) {
    const blockSize = this.calculateBlockSize(brushSize)

    // 生成椭圆形色块的像素点
    const ellipsePixels = this.generateEllipsePixels(blockSize)

    // 3帧抖动效果，每帧都是完整的椭圆形，但位置略有偏移
    const frames = [
      // 第0帧 - 基础位置的椭圆
      ellipsePixels,
      // 第1帧 - 向左上偏移的椭圆
      ellipsePixels.map(([x, y]) => [x - 1, y - 1]),
      // 第2帧 - 向右下偏移的椭圆
      ellipsePixels.map(([x, y]) => [x + 1, y + 1])
    ]

    return frames
  }

  /**
   * 生成椭圆形像素点
   * @param {number} size - 色块大小
   * @returns {Array} 椭圆形像素点坐标数组
   */
  generateEllipsePixels(size) {
    const pixels = []

    // 椭圆参数：横向更长，模拟马克笔的扁平效果
    const radiusX = Math.max(3, Math.floor(size * 0.8)) // 横向半径
    const radiusY = Math.max(2, Math.floor(size * 0.4)) // 纵向半径，更扁

    // 生成椭圆形像素点
    for (let x = -radiusX; x <= radiusX; x++) {
      for (let y = -radiusY; y <= radiusY; y++) {
        // 椭圆方程：(x/a)² + (y/b)² <= 1
        const ellipseValue = (x * x) / (radiusX * radiusX) + (y * y) / (radiusY * radiusY)

        if (ellipseValue <= 1) {
          pixels.push([x, y])
        }
      }
    }

    // 添加一些随机边缘点，增加马克笔的自然感
    this.addRandomEdgePixels(pixels, radiusX, radiusY)

    return pixels
  }

  /**
   * 添加随机边缘像素，增加马克笔的自然毛边效果
   * @param {Array} pixels - 现有像素点数组
   * @param {number} radiusX - 横向半径
   * @param {number} radiusY - 纵向半径
   */
  addRandomEdgePixels(pixels, radiusX, radiusY) {
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
  }

  /**
   * 计算椭圆色块的基础尺寸
   * @param {Object} brushSize - 画笔大小配置
   * @returns {number} 色块基础尺寸
   */
  calculateBlockSize(brushSize) {
    const baseSize = brushSize.size || 6
    // 马克笔色块比普通画笔更大，模拟厚重感
    // 增加尺寸倍数，让色块更明显
    return Math.max(12, baseSize * 3)
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
    const colorNames = ['黄色', '蓝色', '粉红色']
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
    return `马克笔 - ${colorName}椭圆形色块抖动效果，100%不透明，厚重扁平质感`
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
