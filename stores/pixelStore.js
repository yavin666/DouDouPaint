const { makeAutoObservable } = require('mobx-miniprogram')
const { WigglePixel } = require('../utils/pixels/wigglePixel')

/**
 * 像素存储Store
 * 管理所有抖动像素的状态和动画
 * 简化版本：移除静态层，所有像素永久抖动
 */
class pixelStore {
  constructor() {
    // 像素存储 - 按画笔类型分层存储，控制绘制顺序
    this.pixelLayers = {
      marker: new Map(),    // 马克笔层（底层）
      spray: new Map(),     // 喷漆层（中间层，在马克笔上层，铅笔下层）
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
   * 添加新像素（统一的像素添加方法）
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

    // 添加到对应的分层存储
    if (this.pixelLayers[penType]) {
      this.pixelLayers[penType].set(pixelId, pixel)
    }

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
      const pixel = this.activePixels.get(oldestId)

      // 从活跃像素中删除
      this.activePixels.delete(oldestId)

      // 从对应的分层存储中删除
      if (pixel && pixel.penType && this.pixelLayers[pixel.penType]) {
        // 所有层都使用Map存储
        this.pixelLayers[pixel.penType].delete(oldestId)
      }
    }
  }
  
  /**
   * 清空所有像素
   */
  clearAllPixels() {
    this.activePixels.clear()

    // 清空所有分层存储（统一使用 Map.clear()）
    this.pixelLayers.marker.clear()
    this.pixelLayers.spray.clear()
    this.pixelLayers.pencil.clear()

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
      const pixel = this.activePixels.get(pixelId)

      // 从活跃像素中删除
      this.activePixels.delete(pixelId)

      // 从对应的分层存储中删除
      if (pixel && pixel.penType && this.pixelLayers[pixel.penType]) {
        this.pixelLayers[pixel.penType].delete(pixelId)
      }
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
    // 批量更新所有活跃像素的帧，减少单独处理的开销
    const pixelArray = Array.from(this.activePixels.values())

    // 使用批量处理，每次处理一批像素
    const batchSize = 100
    for (let i = 0; i < pixelArray.length; i += batchSize) {
      const batch = pixelArray.slice(i, i + batchSize)
      batch.forEach(pixel => pixel.update())
    }
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

  /**
   * 按层级获取像素（用于分层渲染）
   * @param {string} layerType - 层级类型 (spray/marker/pencil)
   * @returns {Map} 该层级的像素集合
   */
  getPixelsByLayer(layerType) {
    return this.pixelLayers[layerType] || new Map()
  }

  /**
   * 获取所有层级的像素（按渲染顺序）
   * @returns {Array} 按渲染顺序排列的层级数组
   */
  getPixelsByRenderOrder() {
    return [
      { layer: 'marker', pixels: this.pixelLayers.marker },
      { layer: 'spray', pixels: this.pixelLayers.spray },
      { layer: 'pencil', pixels: this.pixelLayers.pencil }
    ]
  }
}

module.exports = { pixelStore }
