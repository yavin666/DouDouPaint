/**
 * 触摸交互管理器
 * 统一处理画布的触摸事件，包括触摸开始、移动、结束等
 * 将触摸事件处理逻辑从页面组件中抽离，提高代码的可维护性和复用性
 */

class TouchInteractionManager {
  constructor(options = {}) {
    // 基础配置
    this.canvasLeft = 0;
    this.canvasTop = 0;
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;

    // 音频控制配置
    this.audioCounter = 0;
    this.audioInterval = options.audioInterval || 10;
    this.lastAudioTime = 0;
    this.audioTimeInterval = options.audioTimeInterval || 300;

    // 绘制配置（性能优化）
    this.pixelSpacing = options.pixelSpacing || 6;
    this.maxPixelsPerMove = options.maxPixelsPerMove || 8; // 单次移动最大像素数
    this.densityControl = options.densityControl || true; // 启用密度控制

    // 性能监控
    this.performanceStats = {
      pixelsCreated: 0,
      movesProcessed: 0,
      lastResetTime: Date.now()
    };

    // 回调函数
    this.callbacks = {
      onDrawStart: options.onDrawStart || (() => {}),
      onDrawMove: options.onDrawMove || (() => {}),
      onDrawEnd: options.onDrawEnd || (() => {}),
      onPlayAudio: options.onPlayAudio || (() => {}),
      onVibrate: options.onVibrate || (() => {}),
      onPlacePixel: options.onPlacePixel || (() => {})
    };

    console.log('TouchInteractionManager 初始化完成（性能优化版）');
  }

  /**
   * 安全地处理事件阻止 - 避免 cancelable=false 的错误
   * @param {Event} e - 事件对象
   * @param {boolean} preventDefault - 是否阻止默认行为
   * @param {boolean} stopPropagation - 是否阻止事件冒泡
   */
  safePreventEvent(e, preventDefault = true, stopPropagation = true) {
    if (!e) return;

    // 只在事件可取消时才调用 preventDefault()
    if (preventDefault && e.cancelable && typeof e.preventDefault === 'function') {
      try {
        e.preventDefault();
      } catch (error) {
        console.warn('preventDefault 调用失败:', error.message);
      }
    }

    // 阻止事件冒泡
    if (stopPropagation && typeof e.stopPropagation === 'function') {
      try {
        e.stopPropagation();
      } catch (error) {
        console.warn('stopPropagation 调用失败:', error.message);
      }
    }
  }
  
  /**
   * 更新画布位置信息
   * @param {number} left - 画布左边距
   * @param {number} top - 画布上边距
   */
  updateCanvasPosition(left, top) {
    this.canvasLeft = left;
    this.canvasTop = top;
  }
  
  /**
   * 预处理触摸事件 - 统一处理事件阻止和验证
   * @param {Event} e - 触摸事件对象
   * @returns {Object|null} 处理后的触摸信息，如果无效则返回null
   */
  preprocessTouchEvent(e) {
    // 使用安全的事件阻止方法
    this.safePreventEvent(e, true, true);

    // 验证触摸点
    if (!e.touches || e.touches.length === 0) {
      return null;
    }

    const touch = e.touches[0];
    const x = touch.pageX - this.canvasLeft;
    const y = touch.pageY - this.canvasTop;

    return { x, y, touch };
  }
  
  /**
   * 处理触摸开始事件
   * @param {Event} e - 触摸事件对象
   */
  handleTouchStart(e) {
    const touchInfo = this.preprocessTouchEvent(e);
    if (!touchInfo) return;
    
    const { x, y } = touchInfo;
    
    // 更新状态
    this.lastX = x;
    this.lastY = y;
    this.isDrawing = true;
    this.audioCounter = 0;
    
    // 初始化音频时间戳
    if (!this.lastAudioTime) {
      this.lastAudioTime = Date.now();
    }
    
    // 触发振动
    this.callbacks.onVibrate();

    // 触摸开始时强制播放音效
    this.forcePlayAudio();

    // 在起始位置放置像素
    this.callbacks.onPlacePixel(x, y, false); // 不检查音频，因为上面已经播放了
    
    // 触发开始绘制回调
    this.callbacks.onDrawStart(x, y);
    
  }
  
  /**
   * 处理触摸移动事件 - 优化版本
   * @param {Event} e - 触摸事件对象
   */
  handleTouchMove(e) {
    if (!this.isDrawing) return;

    const touchInfo = this.preprocessTouchEvent(e);
    if (!touchInfo) return;

    const { x, y } = touchInfo;

    // 使用优化的路径插值算法
    this.interpolateAndDraw(this.lastX, this.lastY, x, y);

    // 更新位置
    this.lastX = x;
    this.lastY = y;

    // 触发移动绘制回调
    this.callbacks.onDrawMove(x, y);
  }

  /**
   * 优化的路径插值算法（性能增强版）
   * 使用密度控制和自适应算法减少像素创建开销
   * @param {number} x0 - 起始点X坐标
   * @param {number} y0 - 起始点Y坐标
   * @param {number} x1 - 结束点X坐标
   * @param {number} y1 - 结束点Y坐标
   */
  interpolateAndDraw(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 如果距离太小，直接在终点绘制
    if (distance < 1) {
      this.callbacks.onPlacePixel(x1, y1, true);
      this.updatePerformanceStats(1);
      return;
    }

    // 计算步数，使用优化的自适应间距
    const adaptiveSpacing = this.calculateOptimizedSpacing(distance);
    let steps = Math.max(1, Math.ceil(distance / adaptiveSpacing));

    // 密度控制：限制单次移动的最大像素数
    if (this.densityControl && steps > this.maxPixelsPerMove) {
      steps = this.maxPixelsPerMove;
    }

    // 使用优化的插值算法
    const stepX = (x1 - x0) / steps;
    const stepY = (y1 - y0) / steps;

    for (let i = 1; i <= steps; i++) {
      const px = x0 + stepX * i;
      const py = y0 + stepY * i;

      // 只在最后一个步骤或满足音频条件时播放音频
      const shouldPlayAudio = (i === steps) && this.shouldPlayAudio();
      this.callbacks.onPlacePixel(px, py, shouldPlayAudio);
    }

    this.updatePerformanceStats(steps);
  }

  /**
   * 优化的自适应像素间距计算
   * 根据移动速度和性能状况动态调整像素间距
   * @param {number} distance - 移动距离
   * @returns {number} 优化的自适应间距
   */
  calculateOptimizedSpacing(distance) {
    const baseSpacing = this.pixelSpacing;

    // 性能自适应：根据当前性能状况调整间距
    const performanceFactor = this.getPerformanceFactor();

    // 根据移动距离和性能状况调整间距
    let spacing = baseSpacing;

    if (distance > 80) {
      // 超快速移动时大幅增加间距
      spacing = baseSpacing * 2.0 * performanceFactor;
    } else if (distance > 50) {
      // 快速移动时增加间距，减少计算量
      spacing = baseSpacing * 1.5 * performanceFactor;
    } else if (distance < 10) {
      // 慢速移动时适度减少间距，但考虑性能因素
      spacing = baseSpacing * Math.max(0.8, performanceFactor);
    } else {
      // 中等速度时应用性能因子
      spacing = baseSpacing * performanceFactor;
    }

    return Math.max(2, spacing); // 确保最小间距
  }

  /**
   * 获取性能因子（用于动态调整绘制密度）
   * @returns {number} 性能因子（1.0为正常，>1.0为降低密度）
   */
  getPerformanceFactor() {
    const currentTime = Date.now();
    const timeSinceReset = currentTime - this.performanceStats.lastResetTime;

    // 每5秒重置一次统计
    if (timeSinceReset > 5000) {
      this.resetPerformanceStats();
      return 1.0;
    }

    // 根据像素创建频率调整性能因子
    const pixelsPerSecond = this.performanceStats.pixelsCreated / (timeSinceReset / 1000);

    if (pixelsPerSecond > 100) {
      return 1.5; // 高频率时降低密度
    } else if (pixelsPerSecond > 50) {
      return 1.2; // 中等频率时适度降低密度
    }

    return 1.0; // 正常密度
  }

  /**
   * 更新性能统计
   * @param {number} pixelCount - 本次创建的像素数量
   */
  updatePerformanceStats(pixelCount) {
    this.performanceStats.pixelsCreated += pixelCount;
    this.performanceStats.movesProcessed++;
  }

  /**
   * 重置性能统计
   */
  resetPerformanceStats() {
    this.performanceStats.pixelsCreated = 0;
    this.performanceStats.movesProcessed = 0;
    this.performanceStats.lastResetTime = Date.now();
  }
  
  /**
   * 处理触摸结束事件
   * @param {Event} e - 触摸事件对象
   */
  handleTouchEnd(e) {
    this.preprocessTouchEvent(e); // 统一处理事件阻止
    
    this.isDrawing = false;
    
    // 触发结束绘制回调
    this.callbacks.onDrawEnd(this.lastX, this.lastY);
    
  }
  
  /**
   * 处理触摸取消事件 - 极简版本
   * 当系统中断触摸时（如来电、通知等），简单重置绘制状态
   * @param {Event} e - 触摸事件对象
   */
  handleTouchCancel(e) {
    // 使用安全的事件处理方法，touchcancel 事件通常不可取消
    // 这里只尝试阻止事件冒泡，不强制阻止默认行为
    this.safePreventEvent(e, false, true);

    // 简单重置绘制状态，不触发任何回调
    this.isDrawing = false;

    console.log('TouchCancel: 绘制状态已重置');
  }
  
  /**
   * 优化的音频播放控制算法
   * 使用双重控制机制：计数器 + 时间间隔，避免音频播放过于频繁
   * @returns {boolean} 是否应该播放音频
   */
  shouldPlayAudio() {
    const currentTime = Date.now();
    const timeSinceLastAudio = currentTime - this.lastAudioTime;

    // 检查计数器间隔
    this.audioCounter++;
    const counterReady = this.audioCounter >= this.audioInterval;

    // 检查时间间隔
    const timeReady = timeSinceLastAudio >= this.audioTimeInterval;

    if (counterReady && timeReady) {
      this.audioCounter = 0; // 重置计数器
      this.lastAudioTime = currentTime; // 更新时间戳
      return true;
    }

    return false;
  }

  /**
   * 强制播放音频（用于触摸开始等特殊情况）
   * 绕过正常的音频控制逻辑
   */
  forcePlayAudio() {
    this.callbacks.onPlayAudio();
    this.lastAudioTime = Date.now();
    this.audioCounter = 0;
  }
  
  /**
   * 重置交互状态
   */
  reset() {
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    this.audioCounter = 0;
    this.lastAudioTime = 0;
  }
  
  /**
   * 获取当前交互状态
   * @returns {Object} 当前状态信息
   */
  getState() {
    return {
      isDrawing: this.isDrawing,
      lastX: this.lastX,
      lastY: this.lastY,
      canvasLeft: this.canvasLeft,
      canvasTop: this.canvasTop
    };
  }
  
  /**
   * 销毁管理器，清理资源
   */
  destroy() {
    this.reset();
    this.callbacks = {};
    console.log('TouchInteractionManager 已销毁');
  }
}

module.exports = {
  TouchInteractionManager
};
