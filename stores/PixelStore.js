const { makeAutoObservable } = require('mobx-miniprogram')
const { WigglePixel } = require('../utils/animation')

/**
 * 像素存储Store
 * 管理所有抖动像素的状态和动画
 * 简化版本：移除静态层，所有像素永久抖动
 */
class PixelStore {
  constructor() {
    // 像素存储 - 按画笔类型分层存储，控制绘制顺序
    this.pixelLayers = {
      glow: new Map(),      // 荧光笔层（最底层）
      marker: new Map(),    // 马克笔层（中间层）
      pencil: new Map()     // 铅笔层（最上层）
    }
    this.activePixels = new Map() // 所有活跃像素的引用（用于统一管理）
    this.totalPixelCount = 0 // 总像素计数器
    
    // 配置
    this.config = {
      maxActivePixels: 1500, // 最大活跃像素数
      maxTotalPixels: 3000,  // 最大总像素数
      pixelLifetime: Infinity // 像素永远不会过期，保持抖动
    }
    
    // 脏区域优化
    this.dirtyRegions = []
    
    // 使用 makeAutoObservable 让整个对象变为响应式
    makeAutoObservable(this)
  }
  
  /**
   * 添加新像素
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {string} color - 颜色
   * @param {Array} frameData - 帧数据
   * @param {Object} brushConfig - 画笔配置
   * @param {number} opacity - 透明度
   * @param {string} penType - 画笔类型
   */
  addPixel(x, y, color, frameData, brushConfig, opacity = 1, penType = 'pencil') {
    // 检查是否超过最大像素限制
    if (this.totalPixelCount >= this.config.maxTotalPixels) {
      this.removeOldestPixel()
    }
    
    // 创建像素ID
    const pixelId = `pixel_${this.totalPixelCount}_${Date.now()}`
    
    // 创建抖动像素
    const pixel = new WigglePixel(
      x,
      y,
      color,
      frameData,
      brushConfig.size || 2,
      opacity,
      penType
    )
    
    // 添加像素元数据
    pixel.id = pixelId
    pixel.createdAt = Date.now()
    pixel.isActive = true
    
    // 添加到活跃像素集合
    this.activePixels.set(pixelId, pixel)
    this.totalPixelCount++
    
    // 添加脏区域
    this.addDirtyRegion(x - 10, y - 10, 20, 20)
    
    return pixelId
  }
  
  /**
   * 移除最老的像素
   */
  removeOldestPixel() {
    // 移除最老的活跃像素
    if (this.activePixels.size > 0) {
      const oldestId = this.activePixels.keys().next().value
      this.activePixels.delete(oldestId)
    }
  }
  
  /**
   * 清空所有像素
   */
  clearAllPixels() {
    this.activePixels.clear()
    this.totalPixelCount = 0
    this.dirtyRegions = []
  }

  /**
   * 删除指定区域内的像素（橡皮擦功能）
   * @param {number} centerX - 橡皮擦中心x坐标
   * @param {number} centerY - 橡皮擦中心y坐标
   * @param {number} radius - 橡皮擦半径
   */
  erasePixelsInArea(centerX, centerY, radius) {
    const pixelsToRemove = []

    // 遍历所有活跃像素，找到在橡皮擦范围内的像素
    for (const [pixelId, pixel] of this.activePixels) {
      const dx = pixel.x - centerX
      const dy = pixel.y - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)

      // 如果像素在橡皮擦范围内，标记为删除
      if (distance <= radius) {
        pixelsToRemove.push(pixelId)
      }
    }

    // 删除标记的像素
    pixelsToRemove.forEach(pixelId => {
      this.activePixels.delete(pixelId)
    })

    // 如果删除了像素，添加脏区域
    if (pixelsToRemove.length > 0) {
      this.addDirtyRegion(
        centerX - radius - 10,
        centerY - radius - 10,
        (radius + 10) * 2,
        (radius + 10) * 2
      )
    }

    return pixelsToRemove.length
  }

  /**
   * 删除指定区域内的像素（橡皮擦功能）
   * @param {number} centerX - 橡皮擦中心x坐标
   * @param {number} centerY - 橡皮擦中心y坐标
   * @param {number} radius - 橡皮擦半径
   */
  erasePixelsInArea(centerX, centerY, radius) {
    const pixelsToRemove = []

    // 遍历所有活跃像素，找到在橡皮擦范围内的像素
    for (const [pixelId, pixel] of this.activePixels) {
      const dx = pixel.x - centerX
      const dy = pixel.y - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)

      // 如果像素在橡皮擦范围内，标记为删除
      if (distance <= radius) {
        pixelsToRemove.push(pixelId)
      }
    }

    // 删除标记的像素
    pixelsToRemove.forEach(pixelId => {
      this.activePixels.delete(pixelId)
    })

    // 如果删除了像素，添加脏区域
    if (pixelsToRemove.length > 0) {
      this.addDirtyRegion(
        centerX - radius - 10,
        centerY - radius - 10,
        (radius + 10) * 2,
        (radius + 10) * 2
      )
    }

    return pixelsToRemove.length
  }
  
  /**
   * 更新活跃像素（动画帧更新）
   */
  updateActivePixels() {
    // 更新所有活跃像素的帧，保持永久抖动
    for (const [, pixel] of this.activePixels) {
      pixel.update()
    }
    
    // 不再将像素移动到静态层，所有像素保持抖动
  }
  
  /**
   * 添加脏区域
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {number} width - 宽度
   * @param {number} height - 高度
   */
  addDirtyRegion(x, y, width, height) {
    this.dirtyRegions.push({ x, y, width, height })
  }
  
  /**
   * 清除脏区域
   */
  clearDirtyRegions() {
    this.dirtyRegions = []
  }
}

module.exports = { PixelStore: PixelStore, pixelStore: PixelStore }
