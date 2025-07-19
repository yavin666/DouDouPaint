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

    // 移除独立的时间跟踪，改为由全局动画循环控制
    // this.lastUpdateTime = Date.now(); // 注释掉，不再需要

    // 添加帧更新计数器，用于不同画笔类型的不同更新频率
    this.frameUpdateCounter = 0;
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
        updateFrequency: 1,  // 铅笔每1次全局更新执行一次帧切换（极快抖动）
        name: '铅笔'
      },
      'marker': {
        updateFrequency: 2,  // 马克笔每2次全局更新执行一次帧切换（快速抖动）
        name: '马克笔'
      },
      'spray': {
        updateFrequency: 1,  // 喷漆每1次全局更新执行一次帧切换（极快抖动）
        name: '喷漆'
      }
    };

    return configs[penType] || configs['pencil']; // 默认使用铅笔配置
  }

  /**
   * 更新到下一帧（优化版：基于计数器而非时间检查）
   * 由全局动画循环调用，避免每个像素都进行时间检查
   */
  update() {
    // 增加帧更新计数器
    this.frameUpdateCounter++;

    // 根据画笔类型的更新频率决定是否切换帧
    if (this.frameUpdateCounter >= this.animationConfig.updateFrequency) {
      this.currentFrame = (this.currentFrame + 1) % this.frameData.length;
      this.frameUpdateCounter = 0; // 重置计数器
    }
  }
}

module.exports = { WigglePixel };