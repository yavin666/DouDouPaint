/**
 * 画笔系统相关常量定义
 */

// 画笔层级定义（用于分层渲染）
const BRUSH_LAYERS = {
  MARKER: 0,    // 马克笔层（底层）
  SPRAY: 1,     // 喷漆层（中间层，在马克笔上层，铅笔下层）
  PENCIL: 2,    // 铅笔层（最顶层）
  ERASER: -1    // 橡皮擦（特殊层，不参与渲染）
}

// 画笔类型定义
const BRUSH_TYPES = {
  PENCIL: 'pencil',
  MARKER: 'marker',
  SPRAY: 'spray',
  ERASER: 'eraser'
}

// 默认画笔配置
const DEFAULT_BRUSH_CONFIG = {
  [BRUSH_TYPES.PENCIL]: {
    color: '#000000',  // 保持纯黑色，这是最基础的颜色
    opacity: 1.0,
    layer: BRUSH_LAYERS.PENCIL,
    audio: '/static/sounds/clip.mp3',
    name: '铅笔',
    sizeMultiplier: 1.0,  // 铅笔使用标准尺寸
    shakeIntensity: 0.8   // 铅笔标准抖动强度
  },
  [BRUSH_TYPES.MARKER]: {
    color: '#FFFF00',  // 使用纯黄色作为默认颜色，与预设颜色保持一致
    opacity: 1.0,      // 改为100%不透明，减少颜色变化
    layer: BRUSH_LAYERS.MARKER,
    audio: '/static/sounds/clip.mp3',
    name: '马克笔',
    sizeMultiplier: 2.0,  // 马克笔尺寸倍数，让色块更大
    shakeIntensity: 1.0   // 马克笔抖动强度稍大
  },
  [BRUSH_TYPES.SPRAY]: {
    color: '#666666',
    opacity: 1.0,
    layer: BRUSH_LAYERS.SPRAY,
    audio: '/static/sounds/clip.mp3',
    name: '喷漆',
    sizeMultiplier: 1.5,  // 喷漆中等尺寸倍数
    shakeIntensity: 0.6   // 喷漆抖动强度较小
  },
  [BRUSH_TYPES.ERASER]: {
    color: 'transparent',
    opacity: 1.0,
    layer: BRUSH_LAYERS.ERASER,
    audio: '/static/sounds/clip.mp3',
    name: '橡皮擦',
    isEraser: true,
    sizeMultiplier: 2.5,  // 橡皮擦尺寸倍数
    shakeIntensity: 0.0   // 橡皮擦不需要抖动
  }
}

// 画笔大小配置
const BRUSH_SIZES = {
  small: {
    size: 2,
    spacing: 4,
    label: '小',
    eraserMultiplier: 2.5  // 橡皮擦大小倍数
  },
  medium: {
    size: 4,  // 从6调整为4，让中号铅笔更细
    spacing: 5,
    label: '中',
    eraserMultiplier: 2.5
  },
  large: {
    size: 7,  // 从10调整为7，让大号铅笔更细
    spacing: 7,
    label: '大',
    eraserMultiplier: 2.5
  }
}

// 渲染层级顺序（从底层到顶层）
const RENDER_ORDER = [
  BRUSH_LAYERS.MARKER,
  BRUSH_LAYERS.SPRAY,
  BRUSH_LAYERS.PENCIL
]

// 马克笔专用尺寸映射（替代原来的getMarkerSpecificSize方法）
const MARKER_SIZE_MAPPING = {
  small: 6,   // 小号马克笔：6像素
  medium: 8,  // 中号马克笔：8像素
  large: 16   // 大号马克笔：16像素
}

module.exports = {
  BRUSH_LAYERS,
  BRUSH_TYPES,
  DEFAULT_BRUSH_CONFIG,
  BRUSH_SIZES,
  RENDER_ORDER,
  MARKER_SIZE_MAPPING
}
