const { makeAutoObservable } = require('mobx-miniprogram')
const { WigglePixel } = require('../utils/animation')

/**
 * 像素存储Store
 * 管理所有抖动像素的状态和动画
 */
class PixelStore {
  constructor() {
    // 像素存储
    this.activePixels = new Map() // 活跃像素（正在抖动）
    this.staticPixels = new Map() // 静态像素（不再抖动）
    this.totalPixelCount = 0 // 总像素计数器
    
    // 性能统计
    this.stats = {
      activeCount: 0,
      staticCount: 0,
      fps: 0,
      lastFrameTime: Date.now()
    }
    
    // 配置
    this.config = {
      maxActivePixels: 1500, // 最大活跃像素数
      maxTotalPixels: 3000,  // 最大总像素数
      pixelLifetime: 5000,   // 像素生命周期（毫秒）
      staticThreshold: 100   // 静态化阈值
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
   */
  addPixel(x, y, color, frameData, brushConfig) {
    console.log('=== addPixel 调用 ===')
    console.log('参数:', { x, y, color, frameData, brushConfig })

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
      brushConfig.size || 2
    )

    console.log('创建的像素:', pixel)

    // 添加像素元数据
    pixel.id = pixelId
    pixel.createdAt = Date.now()
    pixel.isActive = true

    // 添加到活跃像素集合
    this.activePixels.set(pixelId, pixel)
    this.totalPixelCount++

    // 更新统计
    this.updateStats()

    // 添加脏区域
    this.addDirtyRegion(x - 10, y - 10, 20, 20)

    console.log(`添加像素: ${pixelId}, 总数: ${this.totalPixelCount}, 活跃像素数: ${this.activePixels.size}`)
    return pixelId
  }
  
  /**
   * 移除最老的像素
   */
  removeOldestPixel() {
    // 优先移除静态像素
    if (this.staticPixels.size > 0) {
      const oldestId = this.staticPixels.keys().next().value
      this.staticPixels.delete(oldestId)
      console.log(`移除最老静态像素: ${oldestId}`)
      return
    }
    
    // 如果没有静态像素，移除最老的活跃像素
    if (this.activePixels.size > 0) {
      const oldestId = this.activePixels.keys().next().value
      this.activePixels.delete(oldestId)
      console.log(`移除最老活跃像素: ${oldestId}`)
    }
  }
  
  /**
   * 清空所有像素
   */
  clearAllPixels() {
    this.activePixels.clear()
    this.staticPixels.clear()
    this.totalPixelCount = 0
    this.dirtyRegions = []
    this.updateStats()
    console.log('所有像素已清空')
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
    this.updateStats()
  }
  
  /**
   * 将像素移动到静态层
   * @param {string} pixelId - 像素ID
   */
  moveToStatic(pixelId) {
    const pixel = this.activePixels.get(pixelId)
    if (pixel) {
      pixel.isActive = false
      this.staticPixels.set(pixelId, pixel)
      this.activePixels.delete(pixelId)
      console.log(`像素 ${pixelId} 移动到静态层`)
    }
  }
  
  /**
   * 更新性能统计
   */
  updateStats() {
    const now = Date.now()
    const deltaTime = now - this.stats.lastFrameTime
    
    this.stats.activeCount = this.activePixels.size
    this.stats.staticCount = this.staticPixels.size
    this.stats.fps = deltaTime > 0 ? Math.round(1000 / deltaTime) : 0
    this.stats.lastFrameTime = now
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
   * 获取性能报告
   */
  getPerformanceReport() {
    return {
      totalPixels: this.totalPixelCount,
      activePixels: this.stats.activeCount,
      staticPixels: this.stats.staticCount,
      fps: this.stats.fps,
      dirtyRegions: this.dirtyRegions.length,
      memoryUsage: {
        activePixelsMemory: this.activePixels.size * 100, // 估算
        staticPixelsMemory: this.staticPixels.size * 80   // 估算
      }
    }
  }
}

module.exports = { PixelStore: PixelStore, pixelStore: PixelStore }
