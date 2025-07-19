/**
 * 动画帧管理器
 * 专门解决3帧抖动动画的内存泄漏和性能问题
 * 提供帧池复用、智能垃圾回收、性能监控等功能
 */
class AnimationFrameManager {
  constructor(options = {}) {
    // 帧池配置
    this.framePool = new Map() // 帧数据复用池
    this.maxPoolSize = options.maxPoolSize || 100 // 最大池大小
    this.poolHitCount = 0 // 池命中次数
    this.poolMissCount = 0 // 池未命中次数

    // 动画配置
    this.frameCount = 3 // 固定3帧动画
    this.defaultShakeIntensity = options.shakeIntensity || 2.0 // 增加默认抖动强度
    
    // 内存管理
    this.activeFrames = new Set() // 活跃的帧引用
    this.frameCreationCount = 0 // 帧创建计数
    this.frameDestructionCount = 0 // 帧销毁计数
    
    // 垃圾回收配置
    this.gcInterval = options.gcInterval || 10000 // 10秒执行一次GC
    this.gcTimer = null
    this.lastGcTime = Date.now()
    
    // 性能监控
    this.performanceMetrics = {
      frameGenerationTime: 0,
      memoryUsage: 0,
      poolEfficiency: 0,
      gcCount: 0
    }

    this.startGarbageCollection()
  }

  /**
   * 生成优化的3帧动画数据
   * @param {Array} baseShape - 基础形状像素点数组 [[x, y], ...]
   * @param {number} shakeIntensity - 抖动强度
   * @returns {Array} 3帧动画数据
   */
  generate3FrameAnimation(baseShape, shakeIntensity = this.defaultShakeIntensity) {
    const startTime = Date.now()
    
    // 生成缓存键
    const cacheKey = this.generateCacheKey(baseShape, shakeIntensity)
    
    // 尝试从帧池获取
    if (this.framePool.has(cacheKey)) {
      this.poolHitCount++
      const cachedFrames = this.framePool.get(cacheKey)
      // 返回深拷贝，避免引用污染
      const clonedFrames = this.deepCloneFrames(cachedFrames)
      this.updatePerformanceMetrics(Date.now() - startTime, true)
      return clonedFrames
    }
    
    this.poolMissCount++
    
    // 生成新的帧数据
    const frames = this.createNewFrameData(baseShape, shakeIntensity)
    
    // 添加到帧池（如果池未满）
    if (this.framePool.size < this.maxPoolSize) {
      this.framePool.set(cacheKey, this.deepCloneFrames(frames))
    } else {
      // 池满时，清理最旧的条目
      this.cleanupOldestPoolEntry()
      this.framePool.set(cacheKey, this.deepCloneFrames(frames))
    }
    
    // 注册活跃帧
    this.registerActiveFrame(frames)
    
    this.updatePerformanceMetrics(Date.now() - startTime, false)
    return frames
  }

  /**
   * 创建新的帧数据
   * @param {Array} baseShape - 基础形状
   * @param {number} shakeIntensity - 抖动强度
   * @returns {Array} 3帧数据
   */
  createNewFrameData(baseShape, shakeIntensity) {
    if (!baseShape || baseShape.length === 0) {
      return [[], [], []]
    }

    // 优化的抖动算法，减少计算量
    const frames = [
      baseShape, // 第0帧 - 基础位置
      baseShape.map(([x, y]) => [
        x + this.optimizedShake(shakeIntensity, -1), 
        y + this.optimizedShake(shakeIntensity * 0.3, -1)
      ]), // 第1帧 - 左下抖动
      baseShape.map(([x, y]) => [
        x + this.optimizedShake(shakeIntensity, 1), 
        y + this.optimizedShake(shakeIntensity * 0.3, 1)
      ])  // 第2帧 - 右上抖动
    ]

    this.frameCreationCount++
    return frames
  }

  /**
   * 优化的抖动计算
   * @param {number} intensity - 抖动强度
   * @param {number} direction - 方向 (-1 或 1)
   * @returns {number} 抖动值
   */
  optimizedShake(intensity, direction) {
    // 使用预计算的抖动值，避免重复计算
    return intensity * direction
  }

  /**
   * 生成缓存键
   * @param {Array} baseShape - 基础形状
   * @param {number} shakeIntensity - 抖动强度
   * @returns {string} 缓存键
   */
  generateCacheKey(baseShape, shakeIntensity) {
    // 使用形状长度和抖动强度生成简单的缓存键
    // 避免序列化整个数组，提高性能
    const shapeHash = baseShape.length + '_' + 
      (baseShape.length > 0 ? `${baseShape[0][0]}_${baseShape[0][1]}` : '0_0')
    return `${shapeHash}_${shakeIntensity.toFixed(2)}`
  }

  /**
   * 深拷贝帧数据
   * @param {Array} frames - 原始帧数据
   * @returns {Array} 拷贝的帧数据
   */
  deepCloneFrames(frames) {
    return frames.map(frame => 
      frame.map(pixel => [pixel[0], pixel[1]])
    )
  }

  /**
   * 注册活跃帧
   * @param {Array} frames - 帧数据
   */
  registerActiveFrame(frames) {
    const frameId = `frame_${this.frameCreationCount}_${Date.now()}`
    this.activeFrames.add(frameId)
    
    // 为帧数据添加ID，便于后续清理
    frames._frameId = frameId
  }

  /**
   * 注销活跃帧
   * @param {Array} frames - 帧数据
   */
  unregisterActiveFrame(frames) {
    if (frames._frameId) {
      this.activeFrames.delete(frames._frameId)
      this.frameDestructionCount++
      delete frames._frameId
    }
  }

  /**
   * 清理最旧的池条目
   */
  cleanupOldestPoolEntry() {
    const firstKey = this.framePool.keys().next().value
    if (firstKey) {
      this.framePool.delete(firstKey)
    }
  }

  /**
   * 启动垃圾回收
   */
  startGarbageCollection() {
    this.gcTimer = setInterval(() => {
      this.performGarbageCollection()
    }, this.gcInterval)
  }

  /**
   * 执行垃圾回收
   */
  performGarbageCollection() {
    const startTime = Date.now()
    
    // 清理过期的帧池条目
    if (this.framePool.size > this.maxPoolSize * 0.8) {
      const keysToDelete = []
      let deleteCount = 0
      const maxDelete = Math.floor(this.framePool.size * 0.2) // 删除20%
      
      for (const key of this.framePool.keys()) {
        if (deleteCount >= maxDelete) break
        keysToDelete.push(key)
        deleteCount++
      }
      
      keysToDelete.forEach(key => this.framePool.delete(key))
    }
    
    // 更新性能指标
    this.performanceMetrics.gcCount++
    this.lastGcTime = Date.now()
    
    const gcTime = Date.now() - startTime
    console.log(`动画帧GC完成，耗时: ${gcTime}ms，池大小: ${this.framePool.size}`)
  }

  /**
   * 更新性能指标
   * @param {number} generationTime - 生成时间
   * @param {boolean} fromCache - 是否来自缓存
   */
  updatePerformanceMetrics(generationTime, fromCache) {
    if (!fromCache) {
      this.performanceMetrics.frameGenerationTime = 
        (this.performanceMetrics.frameGenerationTime + generationTime) / 2
    }
    
    // 计算池效率
    const totalRequests = this.poolHitCount + this.poolMissCount
    this.performanceMetrics.poolEfficiency = totalRequests > 0 
      ? (this.poolHitCount / totalRequests * 100).toFixed(2)
      : 0
    
    // 估算内存使用
    this.performanceMetrics.memoryUsage = this.framePool.size + this.activeFrames.size
  }

  /**
   * 强制清理所有缓存
   */
  clearAllCache() {
    this.framePool.clear()
    this.activeFrames.clear()
    this.poolHitCount = 0
    this.poolMissCount = 0
    console.log('动画帧缓存已清空')
  }

  /**
   * 获取性能统计
   * @returns {Object} 性能统计数据
   */
  getPerformanceStats() {
    return {
      ...this.performanceMetrics,
      poolSize: this.framePool.size,
      activeFrames: this.activeFrames.size,
      poolHitRate: this.performanceMetrics.poolEfficiency + '%',
      frameCreated: this.frameCreationCount,
      frameDestroyed: this.frameDestructionCount,
      memoryLeakRisk: this.frameCreationCount - this.frameDestructionCount > 100 ? 'HIGH' : 'LOW'
    }
  }

  /**
   * 获取内存使用情况
   * @returns {Object} 内存使用统计
   */
  getMemoryUsage() {
    return {
      poolMemory: this.framePool.size,
      activeMemory: this.activeFrames.size,
      totalMemory: this.framePool.size + this.activeFrames.size,
      estimatedBytes: (this.framePool.size + this.activeFrames.size) * 1024, // 粗略估算
      lastGcTime: this.lastGcTime,
      nextGcIn: this.gcInterval - (Date.now() - this.lastGcTime)
    }
  }

  /**
   * 销毁管理器，清理所有资源
   */
  destroy() {
    // 清理垃圾回收定时器
    if (this.gcTimer) {
      clearInterval(this.gcTimer)
      this.gcTimer = null
    }
    
    // 清理所有缓存
    this.clearAllCache()
    
    // 重置计数器
    this.frameCreationCount = 0
    this.frameDestructionCount = 0
    
    console.log('AnimationFrameManager 已销毁')
  }
}

module.exports = { AnimationFrameManager }