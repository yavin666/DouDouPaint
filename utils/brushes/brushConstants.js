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
  [BRUSH_TYPES.SPRAY]: {
    color: '#666666',
    opacity: 0.7,
    layer: BRUSH_LAYERS.SPRAY,
    audio: '/static/sounds/clip.mp3',
    name: '喷漆'
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
    size: 6,
    spacing: 6,
    label: '中',
    eraserMultiplier: 2.5
  },
  large: {
    size: 10,
    spacing: 8,
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

module.exports = {
  BRUSH_LAYERS,
  BRUSH_TYPES,
  DEFAULT_BRUSH_CONFIG,
  BRUSH_SIZES,
  RENDER_ORDER
}
