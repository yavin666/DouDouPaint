const { makeAutoObservable } = require('mobx-miniprogram')
const { BRUSH_TYPES, DEFAULT_BRUSH_CONFIG, BRUSH_SIZES } = require('../utils/brushes/brushConstants')
const { PencilBrush } = require('../utils/brushes/PencilBrush')
const { MarkerBrush } = require('../utils/brushes/MarkerBrush')
const { SprayBrush } = require('../utils/brushes/SprayBrush')
const { EraserBrush } = require('../utils/brushes/EraserBrush')

/**
 * 简化的画笔状态管理Store
 * 集成了原 BrushManager 的功能，作为画笔系统的统一入口
 * 职责：状态管理 + 业务逻辑 + 画笔实例管理
 */
class PenStore {
  constructor() {
    // 使用 BrushConstants 中的配置，确保一致性
    this.penTypes = DEFAULT_BRUSH_CONFIG
    this.brushSizes = BRUSH_SIZES

    // 当前状态（响应式）
    this.currentPenType = BRUSH_TYPES.PENCIL
    this.currentBrushSize = 'medium'
    this.customColor = null // 自定义颜色，如果设置则覆盖默认颜色

    // 画笔实例存储（集成原 BrushManager 功能）
    this.brushes = new Map()
    this.currentBrush = null

    // 初始化所有画笔实例
    this.initializeBrushes()

    // 设置默认画笔
    this.setCurrentBrush(this.currentPenType)

    // 使用 makeAutoObservable 让整个对象变为响应式
    makeAutoObservable(this)
  }

  /**
   * 初始化所有画笔实例（集成自 BrushManager）
   */
  initializeBrushes() {
    // 创建铅笔
    this.brushes.set(BRUSH_TYPES.PENCIL, new PencilBrush({
      ...DEFAULT_BRUSH_CONFIG[BRUSH_TYPES.PENCIL]
    }))

    // 创建马克笔
    this.brushes.set(BRUSH_TYPES.MARKER, new MarkerBrush({
      ...DEFAULT_BRUSH_CONFIG[BRUSH_TYPES.MARKER]
    }))

    // 创建喷漆
    this.brushes.set(BRUSH_TYPES.SPRAY, new SprayBrush({
      ...DEFAULT_BRUSH_CONFIG[BRUSH_TYPES.SPRAY]
    }))

    // 创建橡皮擦
    this.brushes.set(BRUSH_TYPES.ERASER, new EraserBrush({
      ...DEFAULT_BRUSH_CONFIG[BRUSH_TYPES.ERASER]
    }))

    console.log('PenStore: 画笔实例初始化完成，创建了', this.brushes.size, '个画笔')
  }

  /**
   * 设置当前画笔实例
   * @param {string} brushType - 画笔类型
   * @returns {boolean} 是否设置成功
   */
  setCurrentBrush(brushType) {
    if (this.brushes.has(brushType)) {
      this.currentBrush = this.brushes.get(brushType)
      console.log(`PenStore: 切换到画笔 ${this.currentBrush.name}`)
      return true
    } else {
      console.warn(`PenStore: 未找到画笔类型 ${brushType}`)
      return false
    }
  }

  /**
   * 切换画笔类型
   * @param {string} penType - 画笔类型 (使用 BRUSH_TYPES 常量)
   * @returns {boolean} 是否切换成功
   */
  changePenType(penType) {
    // 验证画笔类型是否有效
    const validTypes = Object.values(BRUSH_TYPES)
    if (validTypes.includes(penType) && this.penTypes[penType]) {
      this.currentPenType = penType
      // 同步画笔实例
      this.setCurrentBrush(penType)
      console.log(`PenStore: 画笔切换为 ${this.penTypes[penType].name}`)
      return true
    }
    console.warn(`PenStore: 无效的画笔类型 ${penType}，有效类型: ${validTypes.join(', ')}`)
    return false
  }

  /**
   * 切换画笔大小
   * @param {string} brushSize - 画笔大小 (small, medium, large)
   * @returns {boolean} 是否切换成功
   */
  changeBrushSize(brushSize) {
    if (this.brushSizes[brushSize]) {
      this.currentBrushSize = brushSize
      console.log(`PenStore: 画笔大小切换为 ${this.brushSizes[brushSize].label}`)
      return true
    }
    console.warn(`PenStore: 无效的画笔大小 ${brushSize}`)
    return false
  }

  /**
   * 设置自定义颜色
   * @param {string} color - 颜色值
   */
  setCustomColor(color) {
    this.customColor = color
    console.log(`设置自定义颜色: ${color}`)
  }

  /**
   * 清除自定义颜色，恢复默认颜色
   */
  clearCustomColor() {
    this.customColor = null
    console.log('清除自定义颜色，恢复默认颜色')
  }

  /**
   * 获取当前画笔类型
   * @returns {string} 当前画笔类型
   */
  getCurrentPenType() {
    return this.currentPenType
  }

  /**
   * 获取当前画笔大小
   * @returns {string} 当前画笔大小
   */
  getCurrentBrushSize() {
    return this.currentBrushSize
  }

  /**
   * 获取当前画笔配置
   * @returns {Object} 当前画笔的完整配置
   */
  getCurrentPenConfig() {
    const penConfig = this.penTypes[this.currentPenType]
    const brushConfig = this.brushSizes[this.currentBrushSize]
    
    return {
      ...penConfig,
      ...brushConfig,
      // 如果有自定义颜色，使用自定义颜色
      color: this.customColor || penConfig.color,
      penType: this.currentPenType,
      brushSize: this.currentBrushSize
    }
  }

  /**
   * 获取当前有效颜色
   * @returns {string} 当前有效的颜色值
   */
  getCurrentColor() {
    return this.customColor || this.penTypes[this.currentPenType].color
  }

  /**
   * 获取当前画笔大小配置
   * @returns {Object} 当前画笔大小的配置
   */
  getCurrentBrushSizeConfig() {
    return this.brushSizes[this.currentBrushSize]
  }

  /**
   * 检查当前画笔是否为橡皮擦
   * @returns {boolean} 是否为橡皮擦
   */
  isCurrentPenEraser() {
    return this.currentBrush ? this.currentBrush.isEraser : false
  }

  /**
   * 获取当前画笔实例
   * @returns {BaseBrush|null} 当前画笔实例
   */
  getCurrentBrush() {
    return this.currentBrush
  }

  /**
   * 获取所有可用的画笔类型
   * @returns {Array} 画笔类型数组
   */
  getAvailablePenTypes() {
    return Object.keys(this.penTypes).map(key => ({
      key,
      ...this.penTypes[key]
    }))
  }

  /**
   * 获取所有可用的画笔大小
   * @returns {Array} 画笔大小数组
   */
  getAvailableBrushSizes() {
    return Object.keys(this.brushSizes).map(key => ({
      key,
      ...this.brushSizes[key]
    }))
  }

  /**
   * 获取画笔类型常量
   * @returns {Object} BRUSH_TYPES 常量
   */
  getBrushTypes() {
    return BRUSH_TYPES
  }

  /**
   * 绘制像素（集成自 BrushManager）
   * @param {number} x - x坐标
   * @param {number} y - y坐标
   * @param {Array} frameData - 帧数据
   * @param {Object} pixelStore - 像素存储对象
   * @returns {string|number|null} 像素ID或删除的像素数量
   */
  draw(x, y, frameData, pixelStore) {
    if (!this.currentBrush) {
      console.warn('PenStore: 没有选择画笔')
      return null
    }

    // 判断是否为橡皮擦
    if (this.isCurrentPenEraser()) {
      return this.handleEraserDraw(x, y, pixelStore)
    } else {
      // 普通画笔绘制
      const brushSize = this.getCurrentBrushSizeConfig()
      return this.currentBrush.createPixel(x, y, frameData, brushSize, pixelStore)
    }
  }

  /**
   * 处理橡皮擦绘制逻辑（集成自 BrushManager）
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
    console.log(`PenStore: 橡皮擦删除了 ${deletedCount} 个像素`)

    return deletedCount
  }

  /**
   * 放置像素 - 画笔功能的统一入口（集成自 BrushManager）
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
    if (checkAudio && audioPlayer && this.currentBrush) {
      this.currentBrush.playAudio(audioPlayer)
    }

    return result
  }

  /**
   * 获取当前画笔信息
   * @returns {Object|null} 当前画笔信息
   */
  getCurrentBrushInfo() {
    return this.currentBrush?.getBrushInfo() || null
  }

  /**
   * 获取画笔状态摘要（用于调试）
   * @returns {Object} 状态摘要
   */
  getStatusSummary() {
    return {
      currentPenType: this.currentPenType,
      currentBrushSize: this.currentBrushSize,
      currentColor: this.getCurrentColor(),
      isEraser: this.isCurrentPenEraser(),
      penName: this.penTypes[this.currentPenType].name,
      brushLabel: this.brushSizes[this.currentBrushSize].label,
      brushCount: this.brushes.size,
      currentBrushName: this.currentBrush?.name || 'None'
    }
  }
}

module.exports = { PenStore }
