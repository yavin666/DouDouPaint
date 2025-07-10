/**
 * 画笔系统测试文件
 * 用于验证画笔系统的基本功能
 */

const { BrushManager } = require('./BrushManager')
const { BRUSH_TYPES } = require('./brushConstants')

/**
 * 模拟pixelStore用于测试
 */
class MockPixelStore {
  constructor() {
    this.pixels = new Map()
    this.layers = {
      glow: new Map(),
      marker: new Map(),
      pencil: new Map()
    }
  }

  addPixel(x, y, color, frameData, brushConfig, opacity, penType) {
    const pixelId = `test_pixel_${Date.now()}_${Math.random()}`
    const pixel = {
      id: pixelId,
      x, y, color, frameData, brushConfig, opacity, penType,
      createdAt: Date.now()
    }
    
    this.pixels.set(pixelId, pixel)
    if (this.layers[penType]) {
      this.layers[penType].set(pixelId, pixel)
    }
    
    console.log(`添加像素: ${penType} at (${x}, ${y}) color: ${color} opacity: ${opacity}`)
    return pixelId
  }

  erasePixelsInArea(centerX, centerY, radius) {
    let erasedCount = 0
    for (const [pixelId, pixel] of this.pixels) {
      const dx = pixel.x - centerX
      const dy = pixel.y - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance <= radius) {
        this.pixels.delete(pixelId)
        // 从层级中删除
        for (const layer of Object.values(this.layers)) {
          layer.delete(pixelId)
        }
        erasedCount++
      }
    }
    console.log(`橡皮擦删除了 ${erasedCount} 个像素`)
    return erasedCount
  }

  getPixelsByRenderOrder() {
    return [
      { layer: 'glow', pixels: this.layers.glow },
      { layer: 'marker', pixels: this.layers.marker },
      { layer: 'pencil', pixels: this.layers.pencil }
    ]
  }
}

/**
 * 测试画笔系统
 */
function testBrushSystem() {
  console.log('=== 开始测试画笔系统 ===')
  
  // 创建画笔管理器
  const brushManager = new BrushManager()
  const mockPixelStore = new MockPixelStore()
  
  console.log('1. 测试画笔管理器初始化')
  console.log('画笔管理器状态:', brushManager.getStatus())
  
  console.log('\n2. 测试铅笔绘制')
  brushManager.setBrush(BRUSH_TYPES.PENCIL)
  brushManager.draw(10, 10, [[0, 0], [1, 0]], mockPixelStore)
  
  console.log('\n3. 测试马克笔绘制')
  brushManager.setBrush(BRUSH_TYPES.MARKER)
  brushManager.draw(20, 20, [[0, 0], [1, 0]], mockPixelStore)
  
  console.log('\n4. 测试荧光笔绘制')
  brushManager.setBrush(BRUSH_TYPES.GLOW)
  brushManager.draw(30, 30, [[0, 0], [1, 0]], mockPixelStore)
  
  console.log('\n5. 测试橡皮擦')
  brushManager.setBrush(BRUSH_TYPES.ERASER)
  brushManager.draw(15, 15, [[0, 0], [1, 0]], mockPixelStore)
  
  console.log('\n6. 测试画笔大小切换')
  brushManager.setBrushSize('large')
  console.log('当前画笔大小:', brushManager.getCurrentBrushSizeConfig())
  
  console.log('\n7. 测试分层渲染数据')
  const renderOrder = mockPixelStore.getPixelsByRenderOrder()
  renderOrder.forEach(({ layer, pixels }) => {
    console.log(`${layer}层有 ${pixels.size} 个像素`)
  })
  
  console.log('\n8. 测试画笔信息')
  const allBrushInfo = brushManager.getAllBrushInfo()
  allBrushInfo.forEach(info => {
    console.log(`画笔: ${info.name}, 类型: ${info.type}, 透明度: ${info.opacity}`)
  })
  
  console.log('\n=== 画笔系统测试完成 ===')
  return true
}

// 如果直接运行此文件，执行测试
if (typeof module !== 'undefined' && require.main === module) {
  testBrushSystem()
}

module.exports = { testBrushSystem, MockPixelStore }
