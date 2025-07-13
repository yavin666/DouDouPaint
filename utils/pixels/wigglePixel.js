/**
 * 抖动像素类 - 负责单个像素的绘制和动画
 * 从 utils/animation.js 中提取出来，职责更加单一
 */
class WigglePixel {
  /**
   * 创建一个抖动像素
   * @param {number} x - 像素x坐标
   * @param {number} y - 像素y坐标
   * @param {string} color - 像素颜色
   * @param {Array} frameData - 帧动画数据
   * @param {number} size - 画笔大小（像素块尺寸）
   * @param {number} opacity - 透明度 (0-1)
   * @param {string} penType - 画笔类型 (pencil/marker/glow)
   */
  constructor(x, y, color, frameData, size = 2, opacity = 1, penType = 'pencil') {
    this.x = x;
    this.y = y;
    this.color = color;
    this.frameData = frameData;
    this.currentFrame = 0;
    this.size = size; // 画笔大小，默认2x2像素
    this.opacity = opacity; // 透明度
    this.penType = penType; // 画笔类型

    // 不同画笔类型的抖动频率配置
    this.animationConfig = this.getAnimationConfig(penType);
    this.lastUpdateTime = Date.now();
  }
  
  /**
   * 绘制当前帧的像素（支持不同大小和透明度）
   * @param {CanvasContext} ctx - 画布上下文
   */
  draw(ctx) {
    // 保存当前的globalAlpha
    const originalAlpha = ctx.globalAlpha;

    // 设置透明度
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;

    this.frameData[this.currentFrame].forEach(([dx, dy]) => {
      // 根据画笔大小绘制像素块
      ctx.fillRect(
        this.x + dx * this.size,
        this.y + dy * this.size,
        this.size,
        this.size
      );
    });

    // 恢复原始的globalAlpha
    ctx.globalAlpha = originalAlpha;
  }
  
  /**
   * 获取不同画笔类型的动画配置
   * @param {string} penType - 画笔类型
   * @returns {Object} 动画配置
   */
  getAnimationConfig(penType) {
    const configs = {
      'pencil': {
        frameInterval: 120,  // 铅笔快速抖动：120ms
        name: '铅笔'
      },
      'marker': {
        frameInterval: 250,  // 马克笔慢速抖动：250ms
        name: '马克笔'
      },
      'spray': {
        frameInterval: 180,  // 喷漆中等抖动：180ms
        name: '喷漆'
      }
    };

    return configs[penType] || configs['pencil']; // 默认使用铅笔配置
  }

  /**
   * 更新到下一帧（基于画笔类型的频率）
   */
  update() {
    const currentTime = Date.now();
    const timeSinceLastUpdate = currentTime - this.lastUpdateTime;

    // 检查是否到了该画笔类型的更新时间
    if (timeSinceLastUpdate >= this.animationConfig.frameInterval) {
      this.currentFrame = (this.currentFrame + 1) % this.frameData.length;
      this.lastUpdateTime = currentTime;
    }
  }
}

module.exports = { WigglePixel };