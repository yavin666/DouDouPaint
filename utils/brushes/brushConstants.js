/**
 * 画笔系统相关常量定义
 */

// 画笔层级定义（用于分层渲染）
const BRUSH_LAYERS = {
  GLOW: 0,      // 荧光笔层（最底层）
  MARKER: 1,    // 马克笔层（中间层）
  PENCIL: 2,    // 铅笔层（最顶层）
  ERASER: -1    // 橡皮擦（特殊层，不参与渲染）
}

// 画笔类型定义
const BRUSH_TYPES = {
  PENCIL: 'pencil',
  MARKER: 'marker', 
  GLOW: 'glow',
  ERASER: 'eraser'
}

// 默认画笔配置
const DEFAULT_BRUSH_CONFIG = {
  [BRUSH_TYPES.PENCIL]: {
    color: '#000000',
    opacity: 1.0,
    layer: BRUSH_LAYERS.PENCIL,
    audio: '/static/sounds/clip.mp3',
    name: '铅笔'
  },
  [BRUSH_TYPES.MARKER]: {
    color: '#39C5BB',
    opacity: 0.8,
    layer: BRUSH_LAYERS.MARKER,
    audio: '/static/sounds/clip.mp3',
    name: '马克笔'
  },
  [BRUSH_TYPES.GLOW]: {
    color: '#ffffff',
    opacity: 0.5,
    layer: BRUSH_LAYERS.GLOW,
    audio: '/static/sounds/clip.mp3',
    name: '荧光笔'
  },
  [BRUSH_TYPES.ERASER]: {
    color: 'transparent',
    opacity: 1.0,
    layer: BRUSH_LAYERS.ERASER,
    audio: '/static/sounds/clip.mp3',
    name: '橡皮擦',
    isEraser: true
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
    size: 4,
    spacing: 6,
    label: '中',
    eraserMultiplier: 2.5
  },
  large: {
    size: 6,
    spacing: 8,
    label: '大',
    eraserMultiplier: 2.5
  }
}

// 渲染层级顺序（从底层到顶层）
const RENDER_ORDER = [
  BRUSH_LAYERS.GLOW,
  BRUSH_LAYERS.MARKER,
  BRUSH_LAYERS.PENCIL
]

module.exports = {
  BRUSH_LAYERS,
  BRUSH_TYPES,
  DEFAULT_BRUSH_CONFIG,
  BRUSH_SIZES,
  RENDER_ORDER
}
