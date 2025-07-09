import { observable, action, computed, runInAction } from 'mobx-miniprogram'

/**
 * 像素生命周期状态
 */
const PixelState = {
  ACTIVE: 'active',     // 活跃状态，参与动画
  STATIC: 'static',     // 静态状态，不再动画
  MERGED: 'merged'      // 已合并状态
}

/**
 * 脏区域类
 */
class DirtyRegion {
  constructor(x, y, width, height) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.timestamp = Date.now()
  }

  // 检查点是否在区域内
  contains(x, y) {
    return x >= this.x && x <= this.x + this.width &&
           y >= this.y && y <= this.y + this.height
  }

  // 合并区域
  merge(other) {
    const minX = Math.min(this.x, other.x)
    const minY = Math.min(this.y, other.y)
    const maxX = Math.max(this.x + this.width, other.x + other.width)
    const maxY = Math.max(this.y + this.height, other.y + other.height)
    
    return new DirtyRegion(minX, minY, maxX - minX, maxY - minY)
  }
}

/**
 * 增强的像素类
 */
class EnhancedPixel {
  constructor(x, y, color, frameData, id) {
    this.id = id
    this.x = x
    this.y = y
    this.color = color
    this.frameData = frameData
    this.currentFrame = 0
    this.state = PixelState.ACTIVE
    this.createdAt = Date.now()
    this.lastUpdateAt = Date.now()
    this.animationDuration = 3000 // 3秒后转为静态
  }

  update() {
    if (this.state === PixelState.ACTIVE) {
      this.currentFrame = (this.currentFrame + 1) % this.frameData.length
      this.lastUpdateAt = Date.now()

      // 永远保持活跃状态，持续抖动！
      // 不再检查animationDuration，像素将一直动画
    }
  }

  draw(ctx) {
    ctx.fillStyle = this.color
    this.frameData[this.currentFrame].forEach(([dx, dy]) => {
      ctx.fillRect(this.x + dx, this.y + dy, 1, 1)
    })
  }

  // 获取像素的边界框
  getBounds() {
    let minX = this.x, maxX = this.x
    let minY = this.y, maxY = this.y
    
    this.frameData[this.currentFrame].forEach(([dx, dy]) => {
      minX = Math.min(minX, this.x + dx)
      maxX = Math.max(maxX, this.x + dx)
      minY = Math.min(minY, this.y + dy)
      maxY = Math.max(maxY, this.y + dy)
    })
    
    return { minX, minY, maxX, maxY }
  }
}

/**
 * 像素存储和管理Store
 */
export class PixelStore {
  constructor() {
    // 活跃像素（正在动画）
    this.activePixels = observable.map()
    
    // 静态像素（不再动画）
    this.staticPixels = observable.map()
    
    // 脏区域列表
    this.dirtyRegions = observable.array()
    
    // 配置参数
    this.config = observable({
      maxActivePixels: 1500,   // 大幅增加活跃像素上限，支持更多抖动
      maxStaticPixels: 500,    // 减少静态像素，优先保持动画
      animationDuration: Infinity, // 永不停止动画！
      mergeDistance: 8,        // 像素合并距离阈值
      dirtyRegionPadding: 10   // 脏区域边距
    })
    
    // 性能统计
    this.stats = observable({
      totalPixels: 0,
      activeCount: 0,
      staticCount: 0,
      lastFrameTime: 0,
      fps: 0
    })
    
    this.pixelIdCounter = 0
  }

  // 计算当前总像素数
  get totalPixelCount() {
    return this.activePixels.size + this.staticPixels.size
  }

  // 计算需要重绘的脏区域
  get optimizedDirtyRegions() {
    if (this.dirtyRegions.length === 0) return []
    
    // 合并相邻的脏区域
    const merged = []
    const regions = this.dirtyRegions.slice()
    
    while (regions.length > 0) {
      let current = regions.pop()
      let hasChanged = true
      
      while (hasChanged) {
        hasChanged = false
        for (let i = regions.length - 1; i >= 0; i--) {
          const other = regions[i]
          // 检查是否应该合并
          if (this.shouldMergeRegions(current, other)) {
            current = current.merge(other)
            regions.splice(i, 1)
            hasChanged = true
          }
        }
      }
      merged.push(current)
    }
    
    return merged
  }

  // 判断两个区域是否应该合并
  shouldMergeRegions(region1, region2) {
    const distance = Math.sqrt(
      Math.pow(region1.x - region2.x, 2) +
      Math.pow(region1.y - region2.y, 2)
    )
    return distance < this.config.mergeDistance * 2
  }

  /**
   * 添加新像素
   */
  addPixel = action((x, y, color, frameData) => {
    const pixelId = ++this.pixelIdCounter
    const pixel = new EnhancedPixel(x, y, color, frameData, pixelId)

    // 检查是否需要合并相近的像素
    const nearbyPixel = this.findNearbyPixel(x, y)
    if (nearbyPixel && this.shouldMergePixels(pixel, nearbyPixel)) {
      // 更新现有像素而不是添加新像素
      this.updatePixel(nearbyPixel.id, pixel)
      return nearbyPixel.id
    }

    // 检查活跃像素数量限制
    if (this.activePixels.size >= this.config.maxActivePixels) {
      this.promoteOldestActivePixel()
    }

    // 添加到活跃像素
    this.activePixels.set(pixelId, pixel)

    // 添加脏区域
    this.addDirtyRegion(pixel.getBounds())

    // 更新统计
    this.updateStats()

    return pixelId
  })

  /**
   * 查找附近的像素
   */
  findNearbyPixel(x, y) {
    const searchRadius = this.config.mergeDistance

    // 先在活跃像素中查找
    for (const [id, pixel] of this.activePixels) {
      const distance = Math.sqrt(
        Math.pow(pixel.x - x, 2) + Math.pow(pixel.y - y, 2)
      )
      if (distance < searchRadius) {
        return pixel
      }
    }

    return null
  }

  /**
   * 判断是否应该合并像素
   */
  shouldMergePixels(pixel1, pixel2) {
    const distance = Math.sqrt(
      Math.pow(pixel1.x - pixel2.x, 2) +
      Math.pow(pixel1.y - pixel2.y, 2)
    )
    return distance < this.config.mergeDistance &&
           pixel1.color === pixel2.color
  }

  /**
   * 更新像素
   */
  updatePixel = action((pixelId, newPixelData) => {
    const pixel = this.activePixels.get(pixelId)
    if (pixel) {
      const oldBounds = pixel.getBounds()

      // 更新像素数据
      pixel.lastUpdateAt = Date.now()
      pixel.createdAt = Date.now() // 重置创建时间，延长动画

      // 添加脏区域
      this.addDirtyRegion(oldBounds)
      this.addDirtyRegion(pixel.getBounds())
    }
  })

  /**
   * 将最老的活跃像素转为静态
   */
  promoteOldestActivePixel = action(() => {
    let oldestPixel = null
    let oldestTime = Date.now()

    for (const [id, pixel] of this.activePixels) {
      if (pixel.createdAt < oldestTime) {
        oldestTime = pixel.createdAt
        oldestPixel = { id, pixel }
      }
    }

    if (oldestPixel) {
      this.promoteToStatic(oldestPixel.id)
    }
  })

  /**
   * 将活跃像素转为静态像素
   */
  promoteToStatic = action((pixelId) => {
    const pixel = this.activePixels.get(pixelId)
    if (!pixel) return

    // 检查静态像素数量限制
    if (this.staticPixels.size >= this.config.maxStaticPixels) {
      this.removeOldestStaticPixel()
    }

    // 转换状态
    pixel.state = PixelState.STATIC
    pixel.currentFrame = 0 // 静态像素使用第一帧

    // 移动到静态像素集合
    this.activePixels.delete(pixelId)
    this.staticPixels.set(pixelId, pixel)

    // 添加脏区域（需要重绘以移除动画效果）
    this.addDirtyRegion(pixel.getBounds())

    this.updateStats()
  })

  /**
   * 移除最老的静态像素
   */
  removeOldestStaticPixel = action(() => {
    let oldestPixel = null
    let oldestTime = Date.now()

    for (const [id, pixel] of this.staticPixels) {
      if (pixel.createdAt < oldestTime) {
        oldestTime = pixel.createdAt
        oldestPixel = { id, pixel }
      }
    }

    if (oldestPixel) {
      this.addDirtyRegion(oldestPixel.pixel.getBounds())
      this.staticPixels.delete(oldestPixel.id)
      this.updateStats()
    }
  })

  /**
   * 添加脏区域（优化版本，减少重复区域）
   */
  addDirtyRegion = action((bounds) => {
    // 限制脏区域数量，避免过多
    if (this.dirtyRegions.length > 50) {
      this.dirtyRegions.clear()
      // 添加一个全屏脏区域
      this.dirtyRegions.push(new DirtyRegion(0, 0, 800, 600))
      return
    }

    const region = new DirtyRegion(
      Math.max(0, bounds.minX - this.config.dirtyRegionPadding),
      Math.max(0, bounds.minY - this.config.dirtyRegionPadding),
      Math.min(800, (bounds.maxX - bounds.minX) + this.config.dirtyRegionPadding * 2),
      Math.min(600, (bounds.maxY - bounds.minY) + this.config.dirtyRegionPadding * 2)
    )

    // 检查是否与现有区域重叠，如果重叠则合并
    let merged = false
    for (let i = 0; i < this.dirtyRegions.length; i++) {
      const existing = this.dirtyRegions[i]
      if (this.shouldMergeRegions(region, existing)) {
        this.dirtyRegions[i] = region.merge(existing)
        merged = true
        break
      }
    }

    if (!merged) {
      this.dirtyRegions.push(region)
    }
  })

  /**
   * 清除脏区域
   */
  clearDirtyRegions = action(() => {
    this.dirtyRegions.clear()
  })

  /**
   * 更新所有活跃像素（持续动画版本）
   */
  updateActivePixels = action(() => {
    // 批量处理像素更新，减少脏区域数量
    const batchBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    let hasChanges = false

    for (const [, pixel] of this.activePixels) {
      const oldFrame = pixel.currentFrame
      pixel.update()

      // 只有当帧发生变化时才添加脏区域
      if (pixel.currentFrame !== oldFrame) {
        const bounds = pixel.getBounds()
        batchBounds.minX = Math.min(batchBounds.minX, bounds.minX)
        batchBounds.minY = Math.min(batchBounds.minY, bounds.minY)
        batchBounds.maxX = Math.max(batchBounds.maxX, bounds.maxX)
        batchBounds.maxY = Math.max(batchBounds.maxY, bounds.maxY)
        hasChanges = true
      }

      // 不再转换为静态像素，所有像素保持活跃状态！
    }

    // 只有在有变化时才添加脏区域
    if (hasChanges && batchBounds.minX !== Infinity) {
      this.addDirtyRegion(batchBounds)
    }
  })

  /**
   * 清除所有像素
   */
  clearAllPixels = action(() => {
    // 添加所有像素的脏区域
    for (const [id, pixel] of this.activePixels) {
      this.addDirtyRegion(pixel.getBounds())
    }
    for (const [id, pixel] of this.staticPixels) {
      this.addDirtyRegion(pixel.getBounds())
    }

    this.activePixels.clear()
    this.staticPixels.clear()
    this.updateStats()
  })

  /**
   * 更新性能统计
   */
  updateStats = action(() => {
    this.stats.activeCount = this.activePixels.size
    this.stats.staticCount = this.staticPixels.size
    this.stats.totalPixels = this.totalPixelCount

    // 计算FPS（修复Infinity问题）
    const now = Date.now()
    if (this.stats.lastFrameTime > 0) {
      const deltaTime = now - this.stats.lastFrameTime
      if (deltaTime > 0) {
        this.stats.fps = Math.round(1000 / deltaTime)
      } else {
        this.stats.fps = 60 // 默认值
      }
    } else {
      this.stats.fps = 0 // 首次调用
    }
    this.stats.lastFrameTime = now
  })

  /**
   * 获取性能报告
   */
  getPerformanceReport() {
    return {
      totalPixels: this.stats.totalPixels,
      activePixels: this.stats.activeCount,
      staticPixels: this.stats.staticCount,
      fps: this.stats.fps,
      dirtyRegions: this.dirtyRegions.length,
      memoryUsage: {
        activePixelsMB: (this.activePixels.size * 200) / 1024 / 1024, // 估算
        staticPixelsMB: (this.staticPixels.size * 100) / 1024 / 1024   // 估算
      }
    }
  }

  /**
   * 获取指定区域内的所有像素
   */
  getPixelsInRegion(x, y, width, height) {
    const pixels = []

    // 检查活跃像素
    for (const [id, pixel] of this.activePixels) {
      if (pixel.x >= x && pixel.x <= x + width &&
          pixel.y >= y && pixel.y <= y + height) {
        pixels.push(pixel)
      }
    }

    // 检查静态像素
    for (const [id, pixel] of this.staticPixels) {
      if (pixel.x >= x && pixel.x <= x + width &&
          pixel.y >= y && pixel.y <= y + height) {
        pixels.push(pixel)
      }
    }

    return pixels
  }
}
