const { makeAutoObservable } = require('mobx-miniprogram')
const { getRandomShape } = require('../config/pixelShapes')
const { BaseBrush } = require('../utils/brushes/BaseBrush')

/**
 * Canvas状态管理Store
 * 管理画布相关的所有状态和操作
 * 包括画布初始化、像素放置、背景切换、清空画布等核心功能
 */
class CanvasStore {
  constructor(rootStore) {
    this.rootStore = rootStore
    
    // 画布状态
    this.canvasState = {
      canvas: null,           // Canvas节点引用
      ctx: null,              // Canvas上下文引用
      animationStore: null,   // 动画系统引用
      isInitialized: false,   // 画布是否已初始化
      canvasLeft: 0,          // 画布左边距
      canvasTop: 0,           // 画布顶边距
      canvasWidth: 375,       // 画布宽度
      canvasHeight: 500       // 画布高度
    }
    
    // 渲染状态
    this.renderState = {
      isRendering: false,     // 是否正在渲染
      lastRenderTime: 0,      // 上次渲染时间
      renderQueue: [],        // 渲染队列
      frameRequestId: null    // 动画帧请求ID
    }
    

    
    // 使用 makeAutoObservable 让整个对象变为响应式
    makeAutoObservable(this)
  }

  /**
   * 初始化画布
   * 从页面层迁移的画布初始化逻辑
   * @param {Function} touchManagerUpdateCallback - 触摸管理器位置更新回调
   * @returns {Promise} 初始化结果
   */
  async initCanvas(touchManagerUpdateCallback) {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery()
      query.select('#myCanvas')
        .fields({ node: true, size: true, rect: true })
        .exec((res) => {
          try {
            if (!res[0]) {
              const error = new Error('未找到canvas节点')
              console.error(error.message)
              reject(error)
              return
            }

            const canvas = res[0].node
            const ctx = canvas.getContext('2d')

            // 获取画布位置和尺寸
            const canvasLeft = res[0].left || 0
            const canvasTop = res[0].top || 0
            const canvasWidth = res[0].width || 375
            const canvasHeight = res[0].height || 500

            // 直接设置画布尺寸，不使用缩放
            canvas.width = canvasWidth
            canvas.height = canvasHeight

            // 更新画布状态
            this.canvasState = {
              ...this.canvasState,
              canvas,
              ctx,
              canvasLeft,
              canvasTop,
              canvasWidth,
              canvasHeight,
              isInitialized: true
            }

            // 更新触摸管理器的画布位置
            if (touchManagerUpdateCallback) {
              touchManagerUpdateCallback(canvasLeft, canvasTop)
            }

            // 初始化动画系统
            this.canvasState.animationStore = this.rootStore.initAnimationSystem(
              canvasWidth,
              canvasHeight,
              this.rootStore.getCurrentBackgroundColor()
            )

            // 设置Canvas层
            this.canvasState.animationStore.setupCanvas(
              canvas,
              ctx,
              canvasWidth,
              canvasHeight,
              this.rootStore.getCurrentBackgroundColor()
            )

            // 初始渲染空白画布
            this.renderFrame()

            console.log('CanvasStore: 画布初始化完成')
            resolve({
              canvas,
              ctx,
              animationStore: this.canvasState.animationStore
            })
          } catch (error) {
            console.error('CanvasStore: 画布初始化失败', error)
            reject(error)
          }
        })
    })
  }

  /**
   * 在指定位置放置像素
   * 从页面层迁移的像素放置逻辑，优化性能
   * @param {number} x - 像素x坐标
   * @param {number} y - 像素y坐标
   * @param {boolean} checkAudio - 是否检查音频播放条件
   * @param {Function} audioCallback - 音频播放回调
   * @param {Function} vibrateCallback - 震动回调
   * @param {Object} touchManager - 触摸管理器引用
   */
  placePixel(x, y, checkAudio = true, audioCallback, vibrateCallback, touchManager) {
    if (!this.canvasState.ctx || !this.canvasState.animationStore || !this.canvasState.isInitialized) {
      console.warn('CanvasStore: 画布未初始化，无法放置像素')
      return null
    }



    // 使用 PenStore 统一处理像素放置（PenStore 内部管理 BrushManager）
    const result = this.rootStore.penStore.placePixel(
      x,
      y,
      getRandomShape(),
      this.rootStore.pixelStore,
      {
        checkAudio: checkAudio && touchManager && touchManager.shouldPlayAudio(),
        audioPlayer: (audioPath) => {
          if (audioCallback) audioCallback(audioPath)
        },
        onRenderRequired: () => {
          // 使用优化的渲染方法
          this.scheduleRender()
        }
      }
    )

    // 确保动画循环启动
    if (result !== null && !this.canvasState.animationStore.animationLoop.isRunning) {
      this.canvasState.animationStore.startAnimation()
    }

    return result
  }

  /**
   * 切换透明背景
   * 优化的背景切换逻辑，减少不必要的渲染
   * @param {boolean} isTransparent - 是否透明背景
   */
  toggleTransparentBackground(isTransparent) {
    if (!this.canvasState.isInitialized) {
      console.warn('CanvasStore: 画布未初始化，无法切换背景')
      return
    }

    // 更新根Store的背景设置
    this.rootStore.setTransparentBackground(isTransparent)

    // 更新动画系统的背景色
    if (this.canvasState.animationStore) {
      this.canvasState.animationStore.setBackgroundColor(this.rootStore.getCurrentBackgroundColor())
      this.scheduleRender()
    }

    console.log(`CanvasStore: 透明背景已${isTransparent ? '开启' : '关闭'}`)
  }

  /**
   * 清空画布
   * 优化的画布清空逻辑
   */
  clearCanvas() {
    if (!this.canvasState.isInitialized) {
      console.warn('CanvasStore: 画布未初始化，无法清空')
      return
    }

    // 清空所有像素数据
    this.rootStore.clearAllPixels()

    // 清理动画帧管理器缓存
    BaseBrush.clearAnimationCache()

    // 重新渲染画布以显示清空效果
    this.scheduleRender()

    console.log('CanvasStore: 画布已清空，动画缓存已清理')
  }

  /**
   * 优化的渲染调度（与动画帧同步）
   * 避免过度渲染，让渲染与3帧抖动动画同步
   */
  scheduleRender() {
    // 检查是否已有渲染任务在进行
    if (this.renderState.isRendering || this.renderState.frameRequestId) {
      return // 已有渲染任务在进行
    }

    // 立即调度渲染，不进行额外的频率限制
    // 因为动画循环已经控制了更新频率（300ms间隔）
    this.renderState.frameRequestId = wx.nextTick(() => {
      this.renderFrame()
      this.renderState.frameRequestId = null
    })
  }

  /**
   * 执行画布渲染
   */
  renderFrame() {
    if (!this.canvasState.animationStore || !this.canvasState.isInitialized) {
      return
    }

    this.renderState.isRendering = true
    this.renderState.lastRenderTime = Date.now()

    try {
      this.canvasState.animationStore.frameRenderer.renderFrame(this.rootStore.pixelStore)
    } catch (error) {
      console.error('CanvasStore: 渲染失败', error)
    } finally {
      this.renderState.isRendering = false
    }
  }

  /**
   * 获取画布状态
   */
  getCanvasState() {
    return {
      ...this.canvasState,
      isInitialized: this.canvasState.isInitialized
    }
  }



  /**
   * 销毁资源 - 彻底清理所有状态，防止内存泄漏
   */
  destroy() {
    // 1. 取消待执行的渲染任务
    if (this.renderState.frameRequestId) {
      this.renderState.frameRequestId = null
    }

    // 2. 销毁动画系统
    if (this.canvasState.animationStore) {
      this.canvasState.animationStore.destroy()
      this.canvasState.animationStore = null
    }

    // 3. 销毁动画帧管理器
    BaseBrush.destroyAnimationManager()

    // 4. 清理画布状态
    this.canvasState = {
      canvas: null,
      ctx: null,
      canvasLeft: 0,
      canvasTop: 0,
      canvasWidth: 0,
      canvasHeight: 0,
      isInitialized: false,
      animationStore: null
    }

    // 5. 清理渲染状态
    this.renderState = {
      isRendering: false,
      frameRequestId: null,
      lastRenderTime: 0
    }

    // 6. 清理根Store引用
    this.rootStore = null

    console.log('CanvasStore: 资源已销毁，动画管理器已清理')
  }
}

module.exports = { CanvasStore }
