/**
 * 性能监控工具
 * 用于监控绘制优化器和动画帧管理器的性能
 * 提供实时性能统计和内存使用情况
 */
class PerformanceMonitor {
  constructor() {
    this.isEnabled = false
    this.startTime = 0
    this.sessionStats = {
      totalDrawCalls: 0,
      optimizedDrawCalls: 0,
      duplicateDrawsPrevented: 0,
      throttledDraws: 0,
      debouncedDraws: 0,
      memoryCleanups: 0,
      sessionDuration: 0
    }
    
    this.performanceLog = []
    this.maxLogEntries = 100
    
    // 性能监控定时器
    this.monitorTimer = null
    this.monitorInterval = 5000 // 5秒监控一次
  }

  /**
   * 启动性能监控
   */
  startMonitoring() {
    if (this.isEnabled) {
      return
    }

    this.isEnabled = true
    this.startTime = Date.now()
    this.resetSessionStats()
    
    console.log('PerformanceMonitor: 性能监控已启动')
    
    // 启动定期监控
    this.startPeriodicMonitoring()
  }

  /**
   * 停止性能监控
   */
  stopMonitoring() {
    if (!this.isEnabled) {
      return
    }

    this.isEnabled = false
    this.sessionStats.sessionDuration = Date.now() - this.startTime
    
    // 停止定期监控
    this.stopPeriodicMonitoring()
    
    // 输出最终统计
    this.logFinalStats()
    
    console.log('PerformanceMonitor: 性能监控已停止')
  }

  /**
   * 启动定期监控
   */
  startPeriodicMonitoring() {
    if (this.monitorTimer) {
      return
    }

    this.monitorTimer = setInterval(() => {
      this.collectPerformanceData()
    }, this.monitorInterval)
  }

  /**
   * 停止定期监控
   */
  stopPeriodicMonitoring() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer)
      this.monitorTimer = null
    }
  }

  /**
   * 收集性能数据
   */
  collectPerformanceData() {
    if (!this.isEnabled) {
      return
    }

    const timestamp = Date.now()
    const performanceData = {
      timestamp,
      sessionStats: { ...this.sessionStats },
      drawingOptimizerStats: this.getDrawingOptimizerStats(),
      animationFrameStats: this.getAnimationFrameStats(),
      memoryUsage: this.getMemoryUsage()
    }

    // 添加到性能日志
    this.addToPerformanceLog(performanceData)
    
    // 检查性能警告
    this.checkPerformanceWarnings(performanceData)
  }

  /**
   * 获取绘制优化器统计
   */
  getDrawingOptimizerStats() {
    // 这里需要从TouchInteractionManager获取统计数据
    // 由于架构限制，这里返回模拟数据
    return {
      totalOptimizedCalls: this.sessionStats.optimizedDrawCalls,
      duplicatesPrevented: this.sessionStats.duplicateDrawsPrevented,
      throttledCalls: this.sessionStats.throttledDraws,
      debouncedCalls: this.sessionStats.debouncedDraws,
      optimizationRate: this.sessionStats.totalDrawCalls > 0 ? 
        (this.sessionStats.optimizedDrawCalls / this.sessionStats.totalDrawCalls * 100).toFixed(2) + '%' : '0%'
    }
  }

  /**
   * 获取动画帧统计
   */
  getAnimationFrameStats() {
    try {
      const { BaseBrush } = require('./brushes/BaseBrush')
      return BaseBrush.getAnimationPerformanceStats() || {
        cacheHits: 0,
        cacheMisses: 0,
        activeFrames: 0,
        poolSize: 0,
        memoryUsage: 0
      }
    } catch (error) {
      console.warn('PerformanceMonitor: 无法获取动画帧统计', error)
      return {
        cacheHits: 0,
        cacheMisses: 0,
        activeFrames: 0,
        poolSize: 0,
        memoryUsage: 0
      }
    }
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage() {
    // 微信小程序中获取内存信息
    try {
      if (wx.getPerformance && wx.getPerformance().memory) {
        const memory = wx.getPerformance().memory
        return {
          usedJSHeapSize: memory.usedJSHeapSize || 0,
          totalJSHeapSize: memory.totalJSHeapSize || 0,
          jsHeapSizeLimit: memory.jsHeapSizeLimit || 0
        }
      }
    } catch (error) {
      console.warn('PerformanceMonitor: 无法获取内存信息', error)
    }
    
    return {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0
    }
  }

  /**
   * 添加到性能日志
   */
  addToPerformanceLog(data) {
    this.performanceLog.push(data)
    
    // 限制日志条目数量
    if (this.performanceLog.length > this.maxLogEntries) {
      this.performanceLog.shift()
    }
  }

  /**
   * 检查性能警告
   */
  checkPerformanceWarnings(data) {
    const warnings = []
    
    // 检查优化率
    const optimizationRate = parseFloat(data.drawingOptimizerStats.optimizationRate)
    if (optimizationRate < 80) {
      warnings.push(`绘制优化率较低: ${data.drawingOptimizerStats.optimizationRate}`)
    }
    
    // 检查内存使用
    if (data.memoryUsage.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB
      warnings.push(`内存使用过高: ${(data.memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`)
    }
    
    // 检查动画帧缓存命中率
    const animStats = data.animationFrameStats
    if (animStats.cacheHits + animStats.cacheMisses > 0) {
      const hitRate = animStats.cacheHits / (animStats.cacheHits + animStats.cacheMisses)
      if (hitRate < 0.7) {
        warnings.push(`动画帧缓存命中率较低: ${(hitRate * 100).toFixed(2)}%`)
      }
    }
    
    // 输出警告
    if (warnings.length > 0) {
      console.warn('PerformanceMonitor: 性能警告', warnings)
    }
  }

  /**
   * 记录绘制调用
   */
  recordDrawCall(optimized = false, duplicate = false, throttled = false, debounced = false) {
    if (!this.isEnabled) {
      return
    }

    this.sessionStats.totalDrawCalls++
    
    if (optimized) {
      this.sessionStats.optimizedDrawCalls++
    }
    
    if (duplicate) {
      this.sessionStats.duplicateDrawsPrevented++
    }
    
    if (throttled) {
      this.sessionStats.throttledDraws++
    }
    
    if (debounced) {
      this.sessionStats.debouncedDraws++
    }
  }

  /**
   * 记录内存清理
   */
  recordMemoryCleanup() {
    if (!this.isEnabled) {
      return
    }

    this.sessionStats.memoryCleanups++
  }

  /**
   * 重置会话统计
   */
  resetSessionStats() {
    this.sessionStats = {
      totalDrawCalls: 0,
      optimizedDrawCalls: 0,
      duplicateDrawsPrevented: 0,
      throttledDraws: 0,
      debouncedDraws: 0,
      memoryCleanups: 0,
      sessionDuration: 0
    }
    
    this.performanceLog = []
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    if (!this.isEnabled) {
      return null
    }

    return {
      sessionStats: { ...this.sessionStats },
      drawingOptimizerStats: this.getDrawingOptimizerStats(),
      animationFrameStats: this.getAnimationFrameStats(),
      memoryUsage: this.getMemoryUsage(),
      performanceLog: [...this.performanceLog]
    }
  }

  /**
   * 输出最终统计
   */
  logFinalStats() {
    const stats = this.getPerformanceStats()
    if (!stats) {
      return
    }

    console.log('PerformanceMonitor: 最终性能统计', {
      会话时长: `${(stats.sessionStats.sessionDuration / 1000).toFixed(2)}秒`,
      总绘制调用: stats.sessionStats.totalDrawCalls,
      优化绘制调用: stats.sessionStats.optimizedDrawCalls,
      防重复绘制: stats.sessionStats.duplicateDrawsPrevented,
      节流绘制: stats.sessionStats.throttledDraws,
      防抖绘制: stats.sessionStats.debouncedDraws,
      内存清理次数: stats.sessionStats.memoryCleanups,
      优化率: stats.drawingOptimizerStats.optimizationRate,
      动画帧统计: stats.animationFrameStats,
      内存使用: `${(stats.memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`
    })
  }

  /**
   * 销毁监控器
   */
  destroy() {
    this.stopMonitoring()
    this.performanceLog = []
    this.sessionStats = null
    
    console.log('PerformanceMonitor: 监控器已销毁')
  }
}

// 创建全局单例
const performanceMonitor = new PerformanceMonitor()

module.exports = { PerformanceMonitor, performanceMonitor }