const { PencilBrush } = require('./PencilBrush')
const { MarkerBrush } = require('./MarkerBrush')
const { SprayBrush } = require('./SprayBrush')
const { EraserBrush } = require('./EraserBrush')
const { BRUSH_TYPES, DEFAULT_BRUSH_CONFIG, BRUSH_SIZES } = require('./brushConstants')

/**
 * 画笔管理器
 * 统一管理所有画笔实例，提供画笔切换和绘制接口
 */
class BrushManager {
  /**
   * 构造函数
   * @param {Object} config - 初始配置（来自rootStore.drawingConfig）
   */
  constructor(config = {}) {
    // 画笔实例存储
    this.brushes = new Map()
    
    // 当前画笔
    this.currentBrush = null
    this.currentBrushType = BRUSH_TYPES.PENCIL
    
    // 画笔大小配置
    this.brushSizes = config.brushSizes || BRUSH_SIZES
    this.currentBrushSize = config.currentBrushSize || 'medium'
    
    // 初始化所有画笔
    this.initializeBrushes(config)
    
    // 设置默认画笔
    this.setBrush(this.currentBrushType)
  }

  /**
   * 初始化所有画笔实例
   * @param {Object} config - 配置对象
   */
  initializeBrushes(config) {
    const pens = config.pens || DEFAULT_BRUSH_CONFIG
    
    // 创建铅笔
    this.brushes.set(BRUSH_TYPES.PENCIL, new PencilBrush({
      ...DEFAULT_BRUSH_CONFIG[BRUSH_TYPES.PENCIL],
      ...pens[BRUSH_TYPES.PENCIL]
    }))
    
    // 创建马克笔
    this.brushes.set(BRUSH_TYPES.MARKER, new MarkerBrush({
      ...DEFAULT_BRUSH_CONFIG[BRUSH_TYPES.MARKER],
      ...pens[BRUSH_TYPES.MARKER]
    }))
    
    // 创建喷漆
    this.brushes.set(BRUSH_TYPES.SPRAY, new SprayBrush({
      ...DEFAULT_BRUSH_CONFIG[BRUSH_TYPES.SPRAY],
      ...pens[BRUSH_TYPES.SPRAY]
    }))
    
    // 创建橡皮擦
    this.brushes.set(BRUSH_TYPES.ERASER, new EraserBrush({
      ...DEFAULT_BRUSH_CONFIG[BRUSH_TYPES.ERASER],
      ...pens[BRUSH_TYPES.ERASER]
    }))
    
    console.log('画笔管理器初始化完成，创建了', this.brushes.size, '个画笔')
  }

  /**
   * 设置当前画笔
   * @param {string} brushType - 画笔类型
   * @returns {boolean} 是否设置成功
   */
  setBrush(brushType) {
    if (this.brushes.has(brushType)) {
      this.currentBrush = this.brushes.get(brushType)
      this.currentBrushType = brushType
      console.log(`切换到画笔: ${this.currentBrush.name}`)
      return true
    } else {
      console.warn(`未找到画笔类型: ${brushType}`)
      return false
    }
  }

  /**
   * 获取当前画笔
   * @returns {BaseBrush} 当前画笔实例
   */
  getCurrentBrush() {
    return this.currentBrush
  }

  /**
   * 获取当前画笔类型
   * @returns {string} 当前画笔类型
   */
  getCurrentBrushType() {
    return this.currentBrushType
  }

  /**
   * 获取指定类型的画笔
   * @param {string} brushType - 画笔类型
   * @returns {BaseBrush|null} 画笔实例
   */
  getBrush(brushType) {
    return this.brushes.get(brushType) || null
  }

  /**
   * 绘制像素（统一入口）- 支持普通画笔和橡皮擦
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Array} frameData - 帧数据
   * @param {Object} pixelStore - 像素存储对象
   * @returns {string|number} 像素ID或删除的像素数量
   */
  draw(x, y, frameData, pixelStore) {
    if (!this.currentBrush) {
      console.warn('没有选择画笔')
      return null
    }

    // 判断是否为橡皮擦
    if (this.isCurrentBrushEraser()) {
      return this.handleEraserDraw(x, y, pixelStore)
    } else {
      // 普通画笔绘制
      const brushSize = this.getCurrentBrushSizeConfig()
      return this.currentBrush.createPixel(x, y, frameData, brushSize, pixelStore)
    }
  }

  /**
   * 处理橡皮擦绘制逻辑
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Object} pixelStore - 像素存储对象
   * @returns {number} 删除的像素数量
   */
  handleEraserDraw(x, y, pixelStore) {
    const currentBrushSize = this.getCurrentBrushSizeConfig()
    const eraserRadius = currentBrushSize.size * (currentBrushSize.eraserMultiplier || 2.5)

    // 调用 pixelStore 的橡皮擦方法
    const deletedCount = pixelStore.erasePixelsInArea(x, y, eraserRadius)
    console.log(`橡皮擦删除了 ${deletedCount} 个像素`)

    return deletedCount
  }

  /**
   * 设置画笔大小
   * @param {string} size - 画笔大小 (small/medium/large)
   */
  setBrushSize(size) {
    if (this.brushSizes[size]) {
      this.currentBrushSize = size
      console.log(`画笔大小切换为: ${this.brushSizes[size].label}`)
    } else {
      console.warn(`未找到画笔大小: ${size}`)
    }
  }

  /**
   * 获取当前画笔大小配置
   * @returns {Object} 画笔大小配置
   */
  getCurrentBrushSizeConfig() {
    return this.brushSizes[this.currentBrushSize] || this.brushSizes.medium
  }

  /**
   * 获取当前画笔大小
   * @returns {string} 当前画笔大小
   */
  getCurrentBrushSize() {
    return this.currentBrushSize
  }

  /**
   * 设置画笔颜色
   * @param {string} brushType - 画笔类型
   * @param {string} color - 新颜色
   */
  setBrushColor(brushType, color) {
    const brush = this.getBrush(brushType)
    if (brush) {
      brush.setColor(color)
      console.log(`${brush.name}颜色设置为: ${color}`)
    }
  }

  /**
   * 设置画笔透明度
   * @param {string} brushType - 画笔类型
   * @param {number} opacity - 新透明度 (0-1)
   */
  setBrushOpacity(brushType, opacity) {
    const brush = this.getBrush(brushType)
    if (brush && !brush.isEraser) {  // 橡皮擦不需要设置透明度
      brush.setOpacity(opacity)
      console.log(`${brush.name}透明度设置为: ${opacity}`)
    }
  }

  /**
   * 获取所有画笔信息
   * @returns {Array} 画笔信息数组
   */
  getAllBrushInfo() {
    const brushInfo = []
    for (const [type, brush] of this.brushes) {
      brushInfo.push({
        type,
        ...brush.getBrushInfo()
      })
    }
    return brushInfo
  }

  /**
   * 播放当前画笔音效
   * @param {Function} audioPlayer - 音频播放函数
   */
  playCurrentBrushAudio(audioPlayer) {
    if (this.currentBrush) {
      this.currentBrush.playAudio(audioPlayer)
    }
  }

  /**
   * 获取当前画笔是否为橡皮擦
   * @returns {boolean} 是否为橡皮擦
   */
  isCurrentBrushEraser() {
    return this.currentBrush ? this.currentBrush.isEraser : false
  }

  /**
   * 切换画笔类型（页面层调用的统一接口）
   * @param {string} penType - 画笔类型
   * @returns {boolean} 是否切换成功
   */
  changePen(penType) {
    if (this.currentBrushType === penType) {
      console.log(`画笔类型未改变: ${penType}`)
      return true
    }

    const success = this.setBrush(penType)
    if (success) {
      const brushInfo = this.getCurrentBrush()?.getBrushInfo()
      console.log(`切换到画笔: ${brushInfo?.name || penType}`)
    }
    return success
  }

  /**
   * 切换画笔大小（页面层调用的统一接口）
   * @param {string} size - 画笔大小
   * @returns {boolean} 是否切换成功
   */
  changeBrushSize(size) {
    if (this.currentBrushSize === size) {
      console.log(`画笔大小未改变: ${size}`)
      return true
    }

    this.setBrushSize(size)
    const sizeConfig = this.getCurrentBrushSizeConfig()
    console.log(`画笔大小切换为: ${size} (${sizeConfig.size}px)`)
    return true
  }

  /**
   * 放置像素的统一接口（页面层调用）
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Array} frameData - 帧数据
   * @param {Object} pixelStore - 像素存储对象
   * @param {Object} options - 额外选项
   * @param {boolean} options.checkAudio - 是否检查音频播放条件
   * @param {Function} options.audioPlayer - 音频播放函数
   * @param {Function} options.onRenderRequired - 需要重新渲染时的回调
   * @returns {string|number|null} 像素ID、删除数量或null
   */
  placePixel(x, y, frameData, pixelStore, options = {}) {
    const { checkAudio = true, audioPlayer, onRenderRequired } = options

    // 执行绘制
    const result = this.draw(x, y, frameData, pixelStore)

    // 如果有结果，触发重新渲染
    if (result !== null && onRenderRequired) {
      onRenderRequired()
    }

    // 播放音效
    if (checkAudio && audioPlayer) {
      this.playCurrentBrushAudio(audioPlayer)
    }

    return result
  }

  /**
   * 获取画笔管理器状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      currentBrushType: this.currentBrushType,
      currentBrushName: this.currentBrush ? this.currentBrush.name : '无',
      currentBrushSize: this.currentBrushSize,
      totalBrushes: this.brushes.size,
      isEraser: this.isCurrentBrushEraser()
    }
  }

  /**
   * 获取当前画笔的详细信息
   * @returns {Object|null} 画笔信息
   */
  getCurrentBrushInfo() {
    return this.currentBrush ? this.currentBrush.getBrushInfo() : null
  }

  /**
   * 获取当前画笔大小的像素值
   * @returns {number} 画笔大小像素值
   */
  getCurrentBrushSizePixels() {
    const sizeConfig = this.getCurrentBrushSizeConfig()
    return sizeConfig ? sizeConfig.size : 6
  }
}

module.exports = { BrushManager }
