/**
 * 抖动像素动画相关功能
 */

/**
 * 抖动像素类，负责单个像素的绘制和动画
 */
class WigglePixel {
  /**
   * 创建一个抖动像素
   * @param {number} x - 像素x坐标
   * @param {number} y - 像素y坐标
   * @param {string} color - 像素颜色
   * @param {Array} frameData - 帧动画数据
   */
  constructor(x, y, color, frameData) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.frameData = frameData;
    this.currentFrame = 0;
  }
  
  /**
   * 绘制当前帧的像素
   * @param {CanvasContext} ctx - 画布上下文
   */
  draw(ctx) {
    ctx.fillStyle = this.color;
    this.frameData[this.currentFrame].forEach(([dx, dy]) => {
      ctx.fillRect(this.x + dx, this.y + dy, 1, 1);
    });
  }
  
  /**
   * 更新到下一帧
   */
  update() {
    this.currentFrame = (this.currentFrame + 1) % this.frameData.length;
  }
}

/**
 * 动画控制器
 */
export class AnimationController {
  /**
   * 创建动画控制器
   * @param {CanvasRenderingContext2D} ctx - Canvas上下文
   * @param {number} width - 画布宽度
   * @param {number} height - 画布高度
   * @param {string} backgroundColor - 背景颜色
   */
  constructor(ctx, width, height, backgroundColor = '#FFFFFF') {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.backgroundColor = backgroundColor;
    this.activePixels = [];
    this.animationTimer = null;
    this.frameRate = 100; // 毫秒
    this.maxPixels = 500; // 限制最大像素数量，防止卡死
  }

  /**
   * 添加一个抖动像素
   * @param {WigglePixel} pixel - 抖动像素对象
   */
  addPixel(pixel) {
    // 限制像素数量，防止内存溢出和性能问题
    if (this.activePixels.length >= this.maxPixels) {
      // 移除最老的像素（FIFO队列）
      this.activePixels.shift();
    }

    this.activePixels.push(pixel);
    if (this.activePixels.length === 1) {
      this.startAnimation();
    }
  }

  /**
   * 清空所有像素
   */
  clearPixels() {
    this.activePixels = [];
    this.stopAnimation();
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * 启动动画循环
   */
  startAnimation() {
    if (this.animationTimer) return;
    
    const animate = () => {
      // 清除画布
      this.ctx.fillStyle = this.backgroundColor;
      this.ctx.fillRect(0, 0, this.width, this.height);
      
      // 更新并绘制所有像素
      this.activePixels.forEach(pixel => {
        pixel.update();
        pixel.draw(this.ctx);
      });
      
      // 继续动画循环
      this.animationTimer = setTimeout(animate, this.frameRate);
    };
    
    animate();
  }

  /**
   * 停止动画循环
   */
  stopAnimation() {
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
  }

  /**
   * 捕获多帧画布内容用于GIF导出
   * @param {number} frames - 要捕获的帧数
   * @returns {Promise<Array>} 帧数据数组
   */
  async captureFrames(frames = 3) {
    const originalAnimationState = this.animationTimer !== null;
    this.stopAnimation();
    
    const frameData = [];
    
    for (let i = 0; i < frames; i++) {
      // 设置每个像素的当前帧
      this.activePixels.forEach(pixel => {
        pixel.currentFrame = i % pixel.frameData.length;
      });
      
      // 清除画布并绘制当前帧
      this.ctx.fillStyle = this.backgroundColor;
      this.ctx.fillRect(0, 0, this.width, this.height);
      
      this.activePixels.forEach(pixel => {
        pixel.draw(this.ctx);
      });
      
      // 获取当前帧的图像数据
      const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
      frameData.push(imageData);
    }
    
    // 恢复动画状态
    if (originalAnimationState) {
      this.startAnimation();
    }
    
    return frameData;
  }
}

export default WigglePixel;