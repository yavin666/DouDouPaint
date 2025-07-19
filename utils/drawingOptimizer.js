/**
 * 绘制优化管理器
 * 解决双重线条问题和内存泄漏问题的核心优化模块
 * 提供防抖、节流、内存管理等功能
 */
class DrawingOptimizer {
  constructor(options = {}) {
    // 防重复绘制配置
    this.lastDrawPosition = { x: -1, y: -1 }
    this.minDrawDistance = options.minDrawDistance || 3 // 最小绘制距离
    this.drawingState = {
      isActive: false,
      lastDrawTime: 0,
      drawCount: 0
    }

    // 防抖配置
    this.debounceDelay = options.debounceDelay || 16 // 约60fps
    this.debounceTimer = null
    this.pendingDraws = new Map() // 待处理的绘制请求

    // 节流配置
    this.throttleInterval = options.throttleInterval || 20 // 50fps限制
    this.lastThrottleTime = 0

    // 内存管理配置
    this.memoryCleanupInterval = options.memoryCleanupInterval || 5000 // 5秒清理一次
    this.maxPendingDraws = options.maxPendingDraws || 50 // 最大待处理绘制数
    this.memoryCleanupTimer = null

    // 性能监控
    this.performanceStats = {
      totalDraws: 0,
      skippedDraws: 0,
      memoryCleanups: 0,
      averageDrawTime: 0
    }

    this.startMemoryCleanup()
  }

  /**
   * 优化的绘制方法 - 核心优化逻辑
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Function} drawCallback - 实际绘制回调函数
   * @param {Object} options - 绘制选项
   * @returns {Object} 绘制结果信息
   */
  optimizedDraw(x, y, drawCallback, options = {}) {
    const currentTime = Date.now()
    const drawKey = `${Math.round(x)},${Math.round(y)}`
    
    const result = {
      executed: false,
      duplicate: false,
      throttled: false,
      debounced: false,
      timestamp: currentTime
    }
    
    // 1. 防重复绘制检查
    if (this.isDuplicateDraw(x, y, currentTime)) {
      this.performanceStats.duplicateDrawsPrevented++
      result.duplicate = true
      return result
    }

    // 2. 节流检查
    if (!this.passThrottleCheck(currentTime)) {
      this.performanceStats.throttledDraws++
      result.throttled = true
      return result
    }

    // 3. 防抖处理（可选）
    if (options.useDebounce) {
      result.debounced = true
      result.executed = this.debouncedDraw(x, y, drawCallback, options)
      return result
    }

    // 4. 直接执行绘制
    result.executed = this.executeDraw(x, y, drawCallback, options)
    return result
  }

  /**
   * 检查是否为重复绘制
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @returns {boolean} 是否为重复绘制
   */
  isDuplicateDraw(x, y) {
    const distance = Math.sqrt(
      Math.pow(x - this.lastDrawPosition.x, 2) + 
      Math.pow(y - this.lastDrawPosition.y, 2)
    )
    
    return distance < this.minDrawDistance
  }

  /**
   * 节流检查
   * @param {number} currentTime - 当前时间
   * @returns {boolean} 是否通过节流检查
   */
  passThrottleCheck(currentTime) {
    if (currentTime - this.lastThrottleTime < this.throttleInterval) {
      return false
    }
    this.lastThrottleTime = currentTime
    return true
  }

  /**
   * 防抖绘制
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Function} drawCallback - 绘制回调
   * @param {Object} options - 选项
   * @returns {boolean} 是否添加到防抖队列
   */
  debouncedDraw(x, y, drawCallback, options) {
    // 清除之前的防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // 添加到待处理队列
    const drawId = `${x}_${y}_${Date.now()}`
    this.pendingDraws.set(drawId, { x, y, drawCallback, options, timestamp: Date.now() })

    // 检查队列大小，防止内存泄漏
    if (this.pendingDraws.size > this.maxPendingDraws) {
      this.cleanupOldPendingDraws()
    }

    // 设置新的防抖定时器
    this.debounceTimer = setTimeout(() => {
      this.executePendingDraws()
      this.debounceTimer = null
    }, this.debounceDelay)

    return true
  }

  /**
   * 执行绘制
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Function} drawCallback - 绘制回调
   * @param {number} currentTime - 当前时间
   * @returns {boolean} 是否成功执行
   */
  executeDraw(x, y, drawCallback, currentTime) {
    try {
      const startTime = Date.now()
      
      // 更新绘制状态
      this.updateDrawingState(x, y, currentTime)
      
      // 执行实际绘制
      const result = drawCallback(x, y)
      
      // 更新性能统计
      const drawTime = Date.now() - startTime
      this.updatePerformanceStats(drawTime)
      
      return result !== null && result !== undefined
    } catch (error) {
      console.error('绘制执行失败:', error)
      return false
    }
  }

  /**
   * 执行待处理的绘制
   */
  executePendingDraws() {
    const currentTime = Date.now()
    
    for (const [drawId, drawData] of this.pendingDraws) {
      const { x, y, drawCallback } = drawData
      this.executeDraw(x, y, drawCallback, currentTime)
    }
    
    // 清空待处理队列
    this.pendingDraws.clear()
  }

  /**
   * 清理过期的待处理绘制
   */
  cleanupOldPendingDraws() {
    const currentTime = Date.now()
    const maxAge = 1000 // 1秒过期
    
    for (const [drawId, drawData] of this.pendingDraws) {
      if (currentTime - drawData.timestamp > maxAge) {
        this.pendingDraws.delete(drawId)
      }
    }
  }

  /**
   * 更新绘制状态
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {number} currentTime - 当前时间
   */
  updateDrawingState(x, y, currentTime) {
    this.lastDrawPosition = { x, y }
    this.drawingState.lastDrawTime = currentTime
    this.drawingState.drawCount++
    this.drawingState.isActive = true
  }

  /**
   * 更新性能统计
   * @param {number} drawTime - 绘制耗时
   */
  updatePerformanceStats(drawTime) {
    this.performanceStats.totalDraws++
    
    // 计算平均绘制时间
    const totalTime = this.performanceStats.averageDrawTime * (this.performanceStats.totalDraws - 1) + drawTime
    this.performanceStats.averageDrawTime = totalTime / this.performanceStats.totalDraws
  }

  /**
   * 开始绘制会话
   */
  startDrawingSession() {
    this.drawingState.isActive = true
    this.drawingState.drawCount = 0
    console.log('绘制会话开始')
  }

  /**
   * 结束绘制会话
   */
  endDrawingSession() {
    this.drawingState.isActive = false
    
    // 执行剩余的待处理绘制
    if (this.pendingDraws.size > 0) {
      this.executePendingDraws()
    }
    
    // 清理防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    
    console.log(`绘制会话结束，共绘制 ${this.drawingState.drawCount} 个像素`)
  }

  /**
   * 启动内存清理
   */
  startMemoryCleanup() {
    this.memoryCleanupTimer = setInterval(() => {
      this.performMemoryCleanup()
    }, this.memoryCleanupInterval)
  }

  /**
   * 执行内存清理
   */
  performMemoryCleanup() {
    // 清理过期的待处理绘制
    this.cleanupOldPendingDraws()
    
    // 重置性能统计（避免数据累积过多）
    if (this.performanceStats.totalDraws > 10000) {
      this.performanceStats = {
        totalDraws: 0,
        skippedDraws: 0,
        memoryCleanups: this.performanceStats.memoryCleanups + 1,
        averageDrawTime: 0
      }
    }
    
    console.log('内存清理完成，清理次数:', this.performanceStats.memoryCleanups)
  }

  /**
   * 获取性能统计
   * @returns {Object} 性能统计数据
   */
  getPerformanceStats() {
    return {
      ...this.performanceStats,
      pendingDrawsCount: this.pendingDraws.size,
      isActive: this.drawingState.isActive,
      efficiency: this.performanceStats.totalDraws > 0 
        ? (this.performanceStats.totalDraws / (this.performanceStats.totalDraws + this.performanceStats.skippedDraws) * 100).toFixed(2) + '%'
        : '0%'
    }
  }

  /**
   * 销毁优化器，清理所有资源
   */
  destroy() {
    // 清理定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    
    if (this.memoryCleanupTimer) {
      clearInterval(this.memoryCleanupTimer)
      this.memoryCleanupTimer = null
    }
    
    // 清理待处理队列
    this.pendingDraws.clear()
    
    // 重置状态
    this.drawingState.isActive = false
    
    console.log('DrawingOptimizer 已销毁')
  }
}

module.exports = { DrawingOptimizer }