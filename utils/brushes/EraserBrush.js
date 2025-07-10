const { BaseBrush } = require('./BaseBrush')
const { BRUSH_TYPES, BRUSH_LAYERS } = require('./brushConstants')

/**
 * 橡皮擦画笔类
 * 特点：删除像素而不是创建像素，特殊处理逻辑
 */
class EraserBrush extends BaseBrush {
  /**
   * 构造函数
   * @param {Object} config - 画笔配置
   */
  constructor(config = {}) {
    super({
      ...config,
      brushType: BRUSH_TYPES.ERASER,
      layer: BRUSH_LAYERS.ERASER,
      opacity: 1.0,
      color: 'transparent',
      name: '橡皮擦',
      isEraser: true
    })
  }

  /**
   * 创建像素（橡皮擦不创建像素，而是删除像素）
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Array} frameData - 帧数据
   * @param {Object} brushSize - 画笔大小配置
   * @param {Object} pixelStore - 像素存储对象
   * @returns {number} 删除的像素数量
   */
  createPixel(x, y, frameData, brushSize, pixelStore) {
    // 橡皮擦不创建像素，而是删除指定区域的像素
    const eraserRadius = this.getEraserRadius(brushSize)
    return this.erasePixels(x, y, eraserRadius, pixelStore)
  }

  /**
   * 删除指定区域的像素
   * @param {number} centerX - 橡皮擦中心x坐标
   * @param {number} centerY - 橡皮擦中心y坐标
   * @param {number} radius - 橡皮擦半径
   * @param {Object} pixelStore - 像素存储对象
   * @returns {number} 删除的像素数量
   */
  erasePixels(centerX, centerY, radius, pixelStore) {
    return pixelStore.erasePixelsInArea(centerX, centerY, radius)
  }

  /**
   * 获取橡皮擦半径
   * @param {Object} brushSize - 画笔大小配置
   * @returns {number} 橡皮擦半径
   */
  getEraserRadius(brushSize) {
    // 橡皮擦半径比普通画笔大一些
    const multiplier = brushSize.eraserMultiplier || 2.5
    return brushSize.size * multiplier
  }

  /**
   * 橡皮擦不创建像素
   * @returns {boolean} 始终返回false
   */
  shouldCreatePixel() {
    return false
  }

  /**
   * 获取有效透明度（橡皮擦不需要透明度）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {number} 透明度
   */
  getEffectiveOpacity(brushSize) {
    return 1.0
  }

  /**
   * 获取有效颜色（橡皮擦不需要颜色）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {string} 透明色
   */
  getEffectiveColor(brushSize) {
    return 'transparent'
  }

  /**
   * 橡皮擦特有的效果处理
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Object} brushSize - 画笔大小配置
   */
  applyBrushEffect(ctx, x, y, brushSize) {
    // 橡皮擦使用clearRect来清除区域
    const radius = this.getEraserRadius(brushSize)
    ctx.clearRect(
      x - radius,
      y - radius,
      radius * 2,
      radius * 2
    )
  }

  /**
   * 获取画笔描述
   * @returns {string} 画笔描述
   */
  getDescription() {
    return '橡皮擦 - 删除像素，清除绘制内容'
  }

  /**
   * 预览橡皮擦区域（可选功能）
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Object} brushSize - 画笔大小配置
   */
  previewEraseArea(ctx, x, y, brushSize) {
    const radius = this.getEraserRadius(brushSize)
    
    // 保存当前状态
    ctx.save()
    
    // 绘制橡皮擦预览圆圈
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])  // 虚线
    
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, 2 * Math.PI)
    ctx.stroke()
    
    // 恢复状态
    ctx.restore()
  }

  /**
   * 检查指定点是否在橡皮擦范围内
   * @param {number} pointX - 点的x坐标
   * @param {number} pointY - 点的y坐标
   * @param {number} centerX - 橡皮擦中心x坐标
   * @param {number} centerY - 橡皮擦中心y坐标
   * @param {Object} brushSize - 画笔大小配置
   * @returns {boolean} 是否在范围内
   */
  isPointInEraseArea(pointX, pointY, centerX, centerY, brushSize) {
    const radius = this.getEraserRadius(brushSize)
    const dx = pointX - centerX
    const dy = pointY - centerY
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance <= radius
  }
}

module.exports = { EraserBrush }
