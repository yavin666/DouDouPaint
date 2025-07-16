const { BaseBrush } = require('./BaseBrush')
const { BRUSH_TYPES, BRUSH_LAYERS, DEFAULT_BRUSH_CONFIG, MARKER_SIZE_MAPPING } = require('./brushConstants')

/**
 * 马克笔画笔类（简化重构版）
 * 特点：椭圆形大色块抖动效果，三种预设颜色，100%不透明
 * 简化：移除静态缓存，使用BaseBrush统一的createPixel和动画生成逻辑
 */
class MarkerBrush extends BaseBrush {
  /**
   * 构造函数
   * @param {Object} config - 画笔配置
   */
  constructor(config = {}) {
    // 使用DEFAULT_BRUSH_CONFIG中的马克笔配置
    const markerConfig = DEFAULT_BRUSH_CONFIG[BRUSH_TYPES.MARKER]
    
    super({
      ...markerConfig,
      ...config,
      brushType: BRUSH_TYPES.MARKER,
      layer: BRUSH_LAYERS.MARKER
    })

    // 马克笔预设颜色选项 - 优化为GIF友好的256色调色板
    this.presetColors = [
      '#FFFF00',  // 纯黄色
      '#0000FF',  // 纯蓝色
      '#FF0080'   // 简化的粉红色
    ]

    // 当前选中的颜色索引
    this.currentColorIndex = 0

    // 设置默认颜色为第一个预设颜色
    this.color = this.presetColors[this.currentColorIndex]
  }

  /**
   * 生成椭圆形状（实现BaseBrush的抽象方法）
   * @param {number} size - 有效尺寸
   * @returns {Array} 椭圆形像素点数组 [[x, y], ...]
   */
  generateShape(size) {
    // 使用马克笔专用尺寸映射
    const markerSize = this.getMarkerSpecificSize(size)
    return this.generateEllipsePixels(markerSize)
  }

  /**
   * 获取马克笔专用尺寸（简化版，使用配置映射）
   * @param {number} baseSize - 基础尺寸
   * @returns {number} 马克笔专用尺寸
   */
  getMarkerSpecificSize(baseSize) {
    // 根据基础尺寸范围映射到马克笔尺寸
    if (baseSize <= 3) {
      return MARKER_SIZE_MAPPING.small
    } else if (baseSize <= 6) {
      return MARKER_SIZE_MAPPING.medium
    } else {
      return MARKER_SIZE_MAPPING.large
    }
  }

  /**
   * 生成椭圆形像素点（简化版）
   * @param {number} size - 椭圆大小
   * @returns {Array} 椭圆像素点坐标数组
   */
  generateEllipsePixels(size) {
    const pixels = []
    
    // 椭圆参数计算
    const radiusX = Math.max(2, Math.floor(size * 1.2)) // 横向半径
    const radiusY = Math.max(1, Math.floor(size * 0.8)) // 纵向半径

    // 生成椭圆像素点
    for (let x = -radiusX; x <= radiusX; x++) {
      for (let y = -radiusY; y <= radiusY; y++) {
        // 椭圆方程：(x/radiusX)² + (y/radiusY)² <= 1
        const ellipseValue = (x * x) / (radiusX * radiusX) + (y * y) / (radiusY * radiusY)
        
        if (ellipseValue <= 1.0) {
          pixels.push([x, y])
        }
      }
    }

    return pixels
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
   * 获取当前颜色名称
   * @returns {string} 颜色名称
   */
  getCurrentColorName() {
    const colorNames = ['黄色', '蓝色', '粉红色']
    return colorNames[this.currentColorIndex] || '未知'
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
