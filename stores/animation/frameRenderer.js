const { makeAutoObservable } = require('mobx-miniprogram')

/**
 * 帧渲染器 - 专门负责将像素数据渲染到Canvas
 * 职责单一：只负责渲染，不管理动画循环
 */
class FrameRenderer {
  constructor() {
    this.canvas = null
    this.ctx = null
    this.canvasWidth = 0
    this.canvasHeight = 0
    this.backgroundColor = '#FFFFFF'
    
    makeAutoObservable(this)
  }
  
  /**
   * 设置Canvas引用
   */
  setupCanvas(canvas, ctx, width, height) {
    this.canvas = canvas
    this.ctx = ctx
    this.canvasWidth = width
    this.canvasHeight = height
  }
  
  /**
   * 设置背景色
   */
  setBackgroundColor(color) {
    this.backgroundColor = color
  }
  
  /**
   * 清除画布
   */
  clearCanvas() {
    if (!this.ctx) return
    
    if (this.backgroundColor === 'transparent') {
      this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
    } else {
      this.ctx.fillStyle = this.backgroundColor
      this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
    }
  }
  
  /**
   * 渲染单帧 - 优化的核心渲染方法
   */
  renderFrame(pixelStore) {
    if (!this.ctx) return

    // 清除画布
    this.clearCanvas()

    // 按层级批量渲染像素（marker -> spray -> pencil）
    const renderOrder = ['marker', 'spray', 'pencil']

    for (const layerType of renderOrder) {
      this.renderLayer(pixelStore, layerType)
    }
  }

  /**
   * 渲染单个层级（批量优化）
   * @param {Object} pixelStore - 像素存储对象
   * @param {string} layerType - 层级类型
   */
  renderLayer(pixelStore, layerType) {
    const layerPixels = pixelStore.getPixelsByLayer(layerType)

    if (!layerPixels || layerPixels.size === 0) return

    // 批量渲染，减少上下文切换
    const pixelArray = Array.from(layerPixels.values())

    // 按颜色分组，减少fillStyle切换
    const colorGroups = this.groupPixelsByColor(pixelArray)

    for (const [color, pixels] of colorGroups) {
      this.ctx.fillStyle = color

      // 批量绘制相同颜色的像素
      for (const pixel of pixels) {
        this.drawPixelOptimized(pixel)
      }
    }
  }

  /**
   * 按颜色分组像素
   * @param {Array} pixels - 像素数组
   * @returns {Map} 颜色分组的像素
   */
  groupPixelsByColor(pixels) {
    const colorGroups = new Map()

    for (const pixel of pixels) {
      const color = pixel.color
      if (!colorGroups.has(color)) {
        colorGroups.set(color, [])
      }
      colorGroups.get(color).push(pixel)
    }

    return colorGroups
  }

  /**
   * 优化的像素绘制方法
   * @param {Object} pixel - 像素对象
   */
  drawPixelOptimized(pixel) {
    // 保存当前透明度
    const originalAlpha = this.ctx.globalAlpha

    // 设置像素透明度
    this.ctx.globalAlpha = pixel.opacity

    // 绘制当前帧的像素点
    const currentFrame = pixel.frameData[pixel.currentFrame]
    if (currentFrame) {
      for (const [dx, dy] of currentFrame) {
        this.ctx.fillRect(
          pixel.x + dx * pixel.size,
          pixel.y + dy * pixel.size,
          pixel.size,
          pixel.size
        )
      }
    }

    // 恢复透明度
    this.ctx.globalAlpha = originalAlpha
  }
}

module.exports = { FrameRenderer }
