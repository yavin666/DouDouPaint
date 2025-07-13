const { BaseBrush } = require('./BaseBrush')
const { BRUSH_TYPES, BRUSH_LAYERS } = require('./brushConstants')

/**
 * 铅笔画笔类
 * 特点：100%透明度，最高层级，粗糙复古质感
 * 新增：边缘不规则效果、纸张纹理模拟、抖动动画
 */
class PencilBrush extends BaseBrush {
  /**
   * 构造函数
   * @param {Object} config - 画笔配置
   */
  constructor(config = {}) {
    super({
      ...config,
      brushType: BRUSH_TYPES.PENCIL,
      layer: BRUSH_LAYERS.PENCIL,
      opacity: 1.0,  // 铅笔始终100%透明度
      name: '铅笔'
    })

    // 简化的粗糙质感配置
    this.roughnessConfig = {
      shakeIntensity: 0.8,     // 抖动强度
      randomSeed: Math.random() // 随机种子
    }
  }

  /**
   * 创建像素（简化版）
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Array} frameData - 帧数据
   * @param {Object} brushSize - 画笔大小配置
   * @param {Object} pixelStore - 像素存储对象
   * @returns {string} 像素ID
   */
  createPixel(x, y, frameData, brushSize, pixelStore) {
    // 生成简化的抖动帧数据
    const pencilFrameData = this.generateSimplePencilFrames(brushSize)

    // 添加到像素存储
    return pixelStore.addPixel(
      x,
      y,
      this.getEffectiveColor(brushSize),
      pencilFrameData,
      brushSize,
      this.getEffectiveOpacity(brushSize),
      this.brushType
    )
  }

  /**
   * 获取有效透明度（简化版）
   * @param {Object} brushSize - 画笔大小配置
   * @returns {number} 有效透明度
   */
  getEffectiveOpacity(brushSize) {
    return 0.9  // 铅笔稍微透明，营造复古感
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
   * 生成简化的铅笔帧数据
   * @param {Object} brushSize - 画笔大小配置
   * @returns {Array} 简化的帧数据
   */
  generateSimplePencilFrames(brushSize) {
    const size = brushSize.size || 2

    // 生成基础圆形像素点
    const basePixels = this.generateCircularPixels(size)

    // 生成3帧简单抖动动画
    const shakeIntensity = this.roughnessConfig.shakeIntensity
    const frames = [
      basePixels,  // 第0帧 - 基础位置
      basePixels.map(([x, y]) => [x - shakeIntensity, y - 0.2]),  // 第1帧 - 左下抖动
      basePixels.map(([x, y]) => [x + shakeIntensity, y + 0.2])   // 第2帧 - 右上抖动
    ]

    return frames
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
   * 获取画笔描述
   * @returns {string} 画笔描述
   */
  getDescription() {
    return '铅笔 - 简洁复古质感，轻微抖动动画'
  }
}

module.exports = { PencilBrush }
