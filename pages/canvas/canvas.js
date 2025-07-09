// pages/canvas/canvas.js
const { createStoreBindings } = require('mobx-miniprogram-bindings')
const { rootStore } = require('../../stores/rootStore')
const { getRandomShape } = require('../../utils/shapes')
const { captureFramesForGif, saveFrameImages } = require('../../utils/gifExport')

Page({
  data: {
    canvasWidth: 0,
    canvasHeight: 0,
    canvas: null,
    ctx: null,
    currentPen: 'pencil',
    pens: {
      pencil: { color: '#000000', width: 2, audio: '/static/sounds/clip.mp3' },
      marker: { color: '#333333', width: 4, audio: '/static/sounds/clip.mp3' },
      glow: { color: '#ffffff', width: 3, audio: '/static/sounds/clip.mp3' }
    },
    lastX: 0,
    lastY: 0,
    isDrawing: false,
    canvasBackground: '#FFFFFF',
    pixelSpacing: 4, // 像素间距（会根据画笔大小动态调整）
    canvasLeft: 0,  // 画布左边距
    canvasTop: 0,   // 画布上边距
    pixelRatio: 1,  // 设备像素比
    audioCounter: 0,  // 音频播放计数器
    audioInterval: 10,  // 音频播放间隔（增加间隔减少音频播放频率）
    lastAudioTime: 0,  // 上次播放音频的时间戳
    audioTimeInterval: 300  // 音频播放的最小时间间隔（毫秒）
  },
  onLoad: function () {
    console.log('=== 使用MobX优化版本启动 ===')

    // 使用新的 MobX 6.x 绑定方式
    this.storeBindings = createStoreBindings(this, {
      store: rootStore,
      fields: {
        totalPixels: () => rootStore.pixelStore.totalPixelCount,
        activePixels: () => rootStore.pixelStore.stats.activeCount,
        staticPixels: () => rootStore.pixelStore.stats.staticCount,
        fps: () => rootStore.pixelStore.stats.fps,
        currentBrushSize: () => rootStore.drawingConfig.currentBrushSize,
        brushSizes: () => rootStore.drawingConfig.brushSizes
      },
      actions: {
        addPixel: 'addPixel',
        clearAllPixels: 'clearAllPixels',
        setBrushSize: 'setBrushSize'
      }
    });

    this.initCanvas();
  },

  /**
   * 初始化画布
   * 获取设备信息，设置画布大小，创建上下文
   */
  initCanvas() {
    // 使用新API获取设备信息
    let pixelRatio = 1;
    let windowHeight = 667;
    let windowWidth = 375;

    try {
      if (typeof wx.getWindowInfo === 'function') {
        const windowInfo = wx.getWindowInfo();
        windowHeight = windowInfo.windowHeight || 667;
        windowWidth = windowInfo.windowWidth || 375;
      }

      if (typeof wx.getDeviceInfo === 'function') {
        const deviceInfo = wx.getDeviceInfo();
        pixelRatio = deviceInfo.pixelRatio || 1;
      }
    } catch (error) {
      console.warn('获取设备信息失败，使用默认值:', error);
    }
    
    // 计算画布高度（减去工具栏高度，工具栏现在是160px）
    const toolbarHeight = 160;
    const canvasHeight = Math.max(200, windowHeight - toolbarHeight);
    
    this.setData({
      canvasWidth: windowWidth,
      canvasHeight: canvasHeight,
      pixelRatio: pixelRatio
    });
    
    // 创建画布上下文
    const query = wx.createSelectorQuery();
    query.select('#myCanvas')
      .fields({ node: true, size: true, rect: true })
      .exec((res) => {
        if (!res[0]) {
          console.error('未找到canvas节点');
          return;
        }
        
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        
        // 获取画布在页面中的位置
        const canvasLeft = res[0].left || 0;
        const canvasTop = res[0].top || 0;
        
        // 设置画布大小（考虑设备像素比）
        canvas.width = this.data.canvasWidth * pixelRatio;
        canvas.height = this.data.canvasHeight * pixelRatio;
        
        // 缩放上下文以匹配设备像素比
        ctx.scale(pixelRatio, pixelRatio);
        
        this.setData({
          canvasLeft: canvasLeft,
          canvasTop: canvasTop
        });
        
        // 保存canvas和ctx引用
        this.canvas = canvas;
        this.ctx = ctx;

        // 初始化MobX优化的动画控制器
        this.animationController = rootStore.initAnimationController(
          this.data.canvasWidth,
          this.data.canvasHeight,
          this.data.canvasBackground
        );

        // 设置Canvas层
        rootStore.setupCanvasLayers(canvas, ctx);

        // 设置背景色
        this.clearCanvas();

        console.log('MobX动画控制器初始化完成');
      });
  },
  
  // 阻止页面滚动
  preventPageScroll() {
    return false;
  },
  
  /**
   * 开始绘画
   * 处理触摸开始事件，计算触摸点坐标并开始绘制
   */
  touchStart: function (e) {
    const touch = e.touches[0];
    // 计算触摸点相对于画布的坐标，考虑页面滚动
    const x = touch.pageX - this.data.canvasLeft;
    const y = touch.pageY - this.data.canvasTop;
    
    this.setData({
      lastX: x,
      lastY: y,
      isDrawing: true,
      audioCounter: 0 // 重置音频计数器
    });
    this.vibrate();
    
    // 初始化上次音频播放时间（如果未设置）
    if (!this.data.lastAudioTime) {
      this.data.lastAudioTime = Date.now();
    }
    
    // 触摸开始时总是播放音效
    const pen = this.data.pens[this.data.currentPen];
    this.playAudio(pen.audio);
    
    this.placePixel(x, y);
  },
  
  /**
   * 绘画中
   * 处理触摸移动事件，计算触摸点坐标并继续绘制
   */
  touchMove: function (e) {
    if (!this.data.isDrawing) return;
    
    const touch = e.touches[0];
    // 计算触摸点相对于画布的坐标，考虑页面滚动
    const x = touch.pageX - this.data.canvasLeft;
    const y = touch.pageY - this.data.canvasTop;
    
    // 根据当前画笔大小获取像素间距
    const pixelSpacing = rootStore.getCurrentPixelSpacing();
    const { lastX, lastY } = this.data;
    
    // 计算距离和步数，实现平滑绘制
    const dx = x - lastX;
    const dy = y - lastY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.floor(distance / pixelSpacing));
    
    // 在移动过程中控制音频播放频率
    // 只在特定步骤播放音频，而不是每个像素都播放
    let shouldPlayAudio = false;
    
    for (let i = 1; i <= steps; i++) {
      const ratio = i / steps;
      const px = lastX + dx * ratio;
      const py = lastY + dy * ratio;
      
      // 传递是否应该播放音频的标志
      // 只在最后一个步骤可能播放音频，进一步降低频率
      shouldPlayAudio = (i === steps);
      this.placePixel(px, py, shouldPlayAudio);
    }
    
    // 直接更新内部变量，避免频繁的 setData 调用
    this.data.lastX = x;
    this.data.lastY = y;
  },
  
  // 结束绘画
  touchEnd: function () {
    this.setData({ isDrawing: false });
  },
  
  /**
   * 在指定位置放置一个抖动像素
   * @param {number} x - 像素x坐标
   * @param {number} y - 像素y坐标
   * @param {boolean} [checkAudio=true] - 是否检查音频播放条件
   */
  placePixel(x, y, checkAudio = true) {
    if (!this.ctx || !this.animationController) return;

    const pen = this.data.pens[this.data.currentPen];
    const brushSize = rootStore.getCurrentBrushSize();

    // 使用MobX Store添加像素（包含画笔大小）
    rootStore.addPixel(x, y, pen.color, getRandomShape(), brushSize);

    // 确保动画循环启动
    if (!this.animationController.isAnimating) {
      this.animationController.startAnimation();
    }

    // 每100个像素输出一次性能信息
    if (rootStore.pixelStore.totalPixelCount % 100 === 0) {
      this.logPerformance();
    }
    
    // 只有在需要检查音频条件时才执行
    if (checkAudio) {
      // 控制音频播放频率
      this.data.audioCounter++;
      if (this.data.audioCounter >= this.data.audioInterval) {
        // 播放音效
        this.playAudio(pen.audio);
        this.data.audioCounter = 0; // 重置计数器
      }
    }
  },
  
  // 切换画笔
  changePen: function (e) {
    const pen = e.currentTarget.dataset.pen;
    this.setData({ currentPen: pen });
  },

  // 切换画笔大小
  changeBrushSize: function (e) {
    const size = e.currentTarget.dataset.size;
    rootStore.setBrushSize(size);
    console.log(`画笔大小切换为: ${size} (${rootStore.getCurrentBrushSize()}px)`);
  },
  
  // 清空画布
  clearCanvas: function () {
    rootStore.clearAllPixels();
    console.log('画布已清空');
  },
  
  // 保存图片
  saveImage: function () {
    if (!this.canvas) {
      wx.showToast({ title: '画布未初始化', icon: 'none' });
      return;
    }
    
    wx.canvasToTempFilePath({
      canvas: this.canvas,
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.showToast({ title: '保存成功', icon: 'success' });
          },
          fail: (err) => {
            console.error('保存失败', err);
            wx.showToast({ title: '保存失败', icon: 'none' });
          }
        });
      },
      fail: (err) => {
        console.error('生成图片失败', err);
      }
    });
  },
  
  // 导出GIF
  saveAsGif: async function() {
    if (!this.canvas || !this.animationController) {
      wx.showToast({ title: '画布未初始化', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '正在生成GIF...' });
    
    try {
      // 捕获多帧
      const frameFiles = await captureFramesForGif(this, 3);
      wx.hideLoading();
      
      // 保存帧图像
      await saveFrameImages(frameFiles);
    } catch (error) {
      wx.hideLoading();
      console.error('GIF导出失败', error);
      wx.showToast({ title: '导出失败', icon: 'none' });
    }
  },
  
  /**
   * 播放音效
   * 添加时间间隔控制，避免音频播放过于频繁
   */
  playAudio: function () {
    const currentTime = Date.now();
    const timeSinceLastAudio = currentTime - this.data.lastAudioTime;
    
    // 检查是否满足最小时间间隔要求
    if (timeSinceLastAudio >= this.data.audioTimeInterval) {
      const audio = wx.createInnerAudioContext();
      // 统一使用clip.mp3音频文件
      audio.src = '/static/sounds/clip.mp3';
      audio.play();
      
      // 更新上次播放时间
      this.data.lastAudioTime = currentTime;
    }
  },
  
  // 触发振动
  vibrate: function () {
    wx.vibrateShort({
      type: 'light'
    });
  },

  // 性能监控（调试用）
  logPerformance: function() {
    const report = rootStore.getPerformanceReport();
    console.log('=== 性能报告 ===');
    console.log(`总像素: ${report.totalPixels}`);
    console.log(`活跃像素: ${report.activePixels}`);
    console.log(`静态像素: ${report.staticPixels}`);
    console.log(`FPS: ${report.fps}`);
    console.log(`脏区域: ${report.dirtyRegions || 0}`);
    console.log('================');

    // 性能警告
    if (report.activePixels > 250) {
      console.warn('活跃像素数量较高，可能影响性能');
    }
    if (report.totalPixels > 1500) {
      console.warn('总像素数量较高，注意内存使用');
    }
  },

  // 页面卸载时清理资源
  onUnload: function() {
    console.log('页面卸载，清理MobX资源');

    // 清理 MobX 绑定
    if (this.storeBindings) {
      this.storeBindings.destroyStoreBindings();
    }

    // 清理动画控制器
    rootStore.destroy();
  }
});
