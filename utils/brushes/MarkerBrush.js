const { BaseBrush } = require('./BaseBrush')
const { BRUSH_TYPES, BRUSH_LAYERS } = require('./brushConstants')

/**
 * 马克笔画笔类
 * 特点：椭圆形大色块抖动效果，三种预设颜色，100%不透明，中间层级
 * 形状优化：使用椭圆形像素组合，模拟真实马克笔的扁平厚重效果
 * 性能优化：使用静态缓存和优化的椭圆计算算法
 */

// 静态缓存 - 所有MarkerBrush实例共享，避免重复计算
const STATIC_FRAME_CACHE = new Map()
const STATIC_ELLIPSE_CACHE = new Map()

// 预计算常用尺寸的椭圆形状（性能优化）- 包含马克笔专用尺寸
const COMMON_SIZES = [4, 6, 8, 10, 12, 16, 20, 24]

/**
 * 预计算常用尺寸的椭圆形状数据
 */
function precomputeCommonEllipses() {
  if (STATIC_ELLIPSE_CACHE.size > 0) return // 已经预计算过

  console.log('MarkerBrush: 开始预计算常用椭圆形状...')
  const startTime = Date.now()

  for (const size of COMMON_SIZES) {
    const ellipseKey = `ellipse_${size}`
    if (!STATIC_ELLIPSE_CACHE.has(ellipseKey)) {
      const pixels = generateOptimizedEllipse(size)
      STATIC_ELLIPSE_CACHE.set(ellipseKey, pixels)
    }
  }

  const endTime = Date.now()
  console.log(`MarkerBrush: 预计算完成，耗时 ${endTime - startTime}ms，缓存 ${STATIC_ELLIPSE_CACHE.size} 个椭圆形状`)
}

/**
 * 优化的椭圆生成算法（静态方法，性能优化）
 * @param {number} size - 椭圆大小
 * @returns {Array} 椭圆像素点坐标数组
 */
function generateOptimizedEllipse(size) {
  const pixels = []

  // 优化的椭圆参数计算 - 确保不同尺寸有明显区别且边缘平滑
  const radiusX = Math.max(2, Math.floor(size * 1.2)) // 增加横向半径，确保尺寸区别
  const radiusY = Math.max(1, Math.floor(size * 0.8)) // 增加纵向半径，保持椭圆比例

  // 预计算常用值，减少重复计算
  const radiusXSquared = radiusX * radiusX
  const radiusYSquared = radiusY * radiusY
  const threshold = 1.0 // 使用标准椭圆阈值，确保平滑边缘

  // 优化的椭圆扫描算法
  for (let x = -radiusX; x <= radiusX; x++) {
    const xSquaredTerm = (x * x) / radiusXSquared

    // 提前计算y的范围，减少不必要的计算
    const maxY = Math.floor(radiusY * Math.sqrt(Math.max(0, threshold - xSquaredTerm)))

    for (let y = -maxY; y <= maxY; y++) {
      const ellipseValue = xSquaredTerm + (y * y) / radiusYSquared

      if (ellipseValue <= threshold) {
        pixels.push([x, y])
      }
    }
  }

  return pixels
}

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
      opacity: 1,  // 马克笔100%不透明
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

    // 性能优化：在首次创建时预计算常用椭圆形状
    this.initializeOptimizations()
  }

  /**
   * 初始化性能优化（预计算常用形状）
   */
  initializeOptimizations() {
    // 预计算常用尺寸的椭圆形状
    precomputeCommonEllipses()
  }

  /**
   * 获取马克笔专用的尺寸映射
   * @param {Object} brushSize - 通用画笔大小配置
   * @returns {number} 马克笔专用尺寸
   */
  getMarkerSpecificSize(brushSize) {
    // 马克笔专用尺寸映射，确保小中大三个尺寸有明显区别
    const sizeMapping = {
      small: 6,   // 小号马克笔：6像素
      medium: 8, // 中号马克笔：12像素
      large: 16   // 大号马克笔：20像素
    }

    // 根据当前画笔大小标签获取对应的马克笔尺寸
    const markerSize = sizeMapping[brushSize.label] || sizeMapping.medium

    console.log(`马克笔尺寸映射: ${brushSize.label} -> ${markerSize}像素`)
    return markerSize
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
    // 使用马克笔专用的尺寸映射
    const markerSize = this.getMarkerSpecificSize(brushSize)

    // 创建马克笔专用的尺寸配置
    const markerBrushSize = {
      ...brushSize,
      size: markerSize // 使用马克笔专用尺寸
    }

    // 使用预计算的椭圆形色块帧数据，避免每次重新计算
    const markerFrameData = this.getOptimizedMarkerFrames(markerBrushSize)

    // 添加到像素存储
    return pixelStore.addPixel(
      x,
      y,
      this.getEffectiveColor(markerBrushSize),
      markerFrameData,
      markerBrushSize,
      this.getEffectiveOpacity(markerBrushSize),
      this.brushType
    )
  }

  /**
   * 获取优化的马克笔帧数据（使用静态缓存避免重复计算）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {Array} 优化的椭圆形色块抖动帧数据
   */
  getOptimizedMarkerFrames(brushSize) {
    const size = brushSize.size || 6
    const sizeKey = `frames_${size}`

    // 使用静态缓存避免重复计算
    if (STATIC_FRAME_CACHE.has(sizeKey)) {
      return STATIC_FRAME_CACHE.get(sizeKey)
    }

    // 生成简化的椭圆色块帧数据
    const optimizedFrames = this.generateOptimizedMarkerFrames(brushSize)
    STATIC_FRAME_CACHE.set(sizeKey, optimizedFrames)

    return optimizedFrames
  }

  /**
   * 生成优化的马克笔帧数据（减少像素点数量）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {Array} 优化的帧数据
   */
  generateOptimizedMarkerFrames(brushSize) {
    const size = brushSize.size || 6

    // 使用静态缓存的椭圆形状
    const ellipsePixels = this.getOptimizedEllipse(size)

    // 3帧抖动动画（增强复古粗糙质感）
    const frames = [
      ellipsePixels,                                           // 第0帧 - 基础位置
      ellipsePixels.map(([x, y]) => [x - 1.0, y - 0.2]),     // 第1帧 - 左下移动，增加垂直抖动
      ellipsePixels.map(([x, y]) => [x + 1.0, y + 0.2])      // 第2帧 - 右上移动，增加垂直抖动
    ]

    return frames
  }

  /**
   * 获取优化的椭圆形状（使用静态缓存）
   * @param {number} size - 椭圆大小
   * @returns {Array} 椭圆像素点坐标数组
   */
  getOptimizedEllipse(size) {
    const ellipseKey = `ellipse_${size}`

    // 检查静态缓存
    if (STATIC_ELLIPSE_CACHE.has(ellipseKey)) {
      return STATIC_ELLIPSE_CACHE.get(ellipseKey)
    }

    // 如果缓存中没有，使用优化算法生成
    const pixels = generateOptimizedEllipse(size)
    STATIC_ELLIPSE_CACHE.set(ellipseKey, pixels)

    return pixels
  }

  /**
   * 生成平滑的椭圆形像素点（保留兼容性，但使用优化版本）
   * @param {number} size - 色块大小
   * @returns {Array} 平滑椭圆形像素点坐标数组
   */
  generateSmoothEllipse(size) {
    return this.getOptimizedEllipse(size)
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
