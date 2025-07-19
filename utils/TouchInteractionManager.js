/**
 * 触摸交互管理器
 * 统一处理画布的触摸事件，包括触摸开始、移动、结束等
 * 将触摸事件处理逻辑从页面组件中抽离，提高代码的可维护性和复用性
 * 集成绘制优化器，解决双重线条问题和性能优化
 */

const { DrawingOptimizer } = require('./drawingOptimizer')
const { performanceMonitor } = require('./performanceMonitor')

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

    // 绘制配置（高密度设置）
    this.pixelSpacing = options.pixelSpacing || 1; // 最小间距，实现极致连续性
    this.maxPixelsPerMove = options.maxPixelsPerMove || 16; // 大幅增加单次移动像素数
    this.densityControl = options.densityControl || false; // 关闭密度控制，实现最大密度

    // 初始化绘制优化器 - 高密度绘制配置
    this.drawingOptimizer = new DrawingOptimizer({
      minDrawDistance: options.minDrawDistance || 0.5, // 降低最小绘制距离，提高密度
      debounceDelay: options.debounceDelay || 8, // 减少防抖延迟，提高响应速度
      throttleInterval: options.throttleInterval || 8, // 减少节流间隔，提高绘制频率
      maxPendingDraws: options.maxPendingDraws || 100 // 增加待处理绘制数量上限
    })
    
    // 启动性能监控（开发模式下）
    // if (process.env.NODE_ENV === 'development') { // 小程序环境不支持 process.env
    //   performanceMonitor.startMonitoring()
    // }

    // 回调函数
    this.callbacks = {
      onDrawStart: options.onDrawStart || (() => {}),
      onDrawMove: options.onDrawMove || (() => {}),
      onDrawEnd: options.onDrawEnd || (() => {}),
      onPlayAudio: options.onPlayAudio || (() => {}),
      onVibrate: options.onVibrate || (() => {}),
      onPlacePixel: options.onPlacePixel || (() => {})
    };

    console.log('TouchInteractionManager 初始化完成（集成绘制优化器）');
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
    
    // 启动绘制会话
    this.drawingOptimizer.startDrawingSession()
    
    // 触发振动
    this.callbacks.onVibrate();

    // 触摸开始时强制播放音效
    this.forcePlayAudio();

    // 使用优化器放置起始像素 - 解决双重线条问题
    const executed = this.optimizedPlacePixel(x, y, false)
    
    // 记录性能数据
    performanceMonitor.recordDrawCall(executed, false, false, false)
    
    // 触发开始绘制回调
    this.callbacks.onDrawStart(x, y);
  }
  
  /**
   * 处理触摸移动事件
   * @param {Object} e - 触摸事件对象
   */
  handleTouchMove(e) {
    this.safePreventEvent(e);

    if (!this.isDrawing) {
      return;
    }

    const touch = this.preprocessTouchEvent(e);
    if (!touch) {
      return;
    }

    // 使用优化的路径插值绘制
    this.optimizedInterpolateAndDraw(this.lastX, this.lastY, touch.x, touch.y);
    
    // 更新最后位置
    this.lastX = touch.x;
    this.lastY = touch.y;
  }

  /**
   * 优化的路径插值算法（集成绘制优化器）
   * 使用绘制优化器解决双重线条问题和性能优化
   * @param {number} x0 - 起始点X坐标
   * @param {number} y0 - 起始点Y坐标
   * @param {number} x1 - 结束点X坐标
   * @param {number} y1 - 结束点Y坐标
   */
  optimizedInterpolateAndDraw(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 即使距离很小也进行绘制，确保最大密度
    if (distance < 0.1) {
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
      
      // 使用优化器放置像素，解决双重线条问题
      this.optimizedPlacePixel(px, py, shouldPlayAudio);
    }
  }

  /**
   * 优化的像素放置方法 - 解决双重线条问题
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {boolean} checkAudio - 是否检查音频
   */
  optimizedPlacePixel(x, y, checkAudio) {
    // 使用绘制优化器执行绘制，自动处理防重复、节流等
    const result = this.drawingOptimizer.optimizedDraw(x, y, (px, py) => {
      // 实际的绘制回调
      this.callbacks.onPlacePixel(px, py, checkAudio);
      return true; // 表示绘制成功
    }, {
      useDebounce: false, // 移动绘制时不使用防抖，保持流畅性
      checkAudio: checkAudio
    });

    // 记录性能数据
    if (result) {
      performanceMonitor.recordDrawCall(
        result.executed, 
        result.duplicate, 
        result.throttled, 
        result.debounced
      )
    }

    return result ? result.executed : false;
  }

  /**
   * 优化的自适应像素间距计算
   * 根据移动速度动态调整像素间距，保持笔画连续性
   * @param {number} distance - 移动距离
   * @returns {number} 优化的自适应间距
   */
  calculateOptimizedSpacing(distance) {
    const baseSpacing = this.pixelSpacing;

    // 根据移动距离调整间距，保持笔画连续性
    let spacing = baseSpacing;

    if (distance > 50) {
      // 快速移动时轻微增加间距
      spacing = baseSpacing * 1.2;
    } else if (distance > 20) {
      // 中速移动时保持基础间距
      spacing = baseSpacing;
    } else if (distance < 2) {
      // 极慢速移动时使用最小间距
      spacing = baseSpacing * 0.5;
    } else {
      // 慢速移动时略微减小间距
      spacing = baseSpacing * 0.8;
    }

    return Math.max(0.5, spacing); // 允许更小的间距，实现极致密度
  }




  
  /**
   * 处理触摸结束事件
   * @param {Event} e - 触摸事件对象
   */
  handleTouchEnd(e) {
    this.preprocessTouchEvent(e); // 统一处理事件阻止
    
    this.isDrawing = false;
    
    // 结束绘制会话
    this.drawingOptimizer.endDrawingSession()
    
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
    
    // 销毁绘制优化器
    if (this.drawingOptimizer) {
      this.drawingOptimizer.destroy();
      this.drawingOptimizer = null;
    }
    
    // 停止性能监控
    performanceMonitor.stopMonitoring();
    
    console.log('TouchInteractionManager 已销毁');
  }
}

module.exports = {
  TouchInteractionManager
};
