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
   * 渲染单帧 - 核心渲染方法
   */
  renderFrame(pixelStore) {
    if (!this.ctx) return

    // 清除画布
    this.clearCanvas()

    // 按层级渲染像素（spray -> marker -> pencil）
    const renderOrder = ['spray', 'marker', 'pencil']

    for (const layerType of renderOrder) {
      const layerPixels = pixelStore.getPixelsByLayer(layerType)

      if (layerType === 'spray') {
        // 喷漆层使用数组，按顺序渲染（新像素在后面，渲染在上层）
        if (layerPixels && layerPixels.length > 0) {
          for (const item of layerPixels) {
            if (item && item.pixel) {
              item.pixel.draw(this.ctx)
            }
          }
        }
      } else {
        // 其他层使用Map
        if (layerPixels && layerPixels.size > 0) {
          for (const [, pixel] of layerPixels) {
            pixel.draw(this.ctx)
          }
        }
      }
    }
  }
}

module.exports = { FrameRenderer }
