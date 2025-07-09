// pages/canvas/canvas.js
const { createStoreBindings } = require('mobx-miniprogram-bindings')
const { rootStore } = require('../../stores/rootStore')
const { getRandomShape } = require('../../utils/shapes')
const { exportGif, saveGifToAlbum } = require('../../utils/gifExport')

Page({
  data: {
    currentPen: 'pencil',
    pens: {
      pencil: { color: '#000000', width: 2, audio: '/static/sounds/clip.mp3' },
      marker: { color: '#39C5BB', width: 4, audio: '/static/sounds/clip.mp3' },
      glow: { color: '#ffffff', width: 6, audio: '/static/sounds/clip.mp3' }
    },
    lastX: 0,
    lastY: 0,
    isDrawing: false,
    canvasBackground: '#FFFFFF',
    canvasLeft: 0,  // 画布左边距
    canvasTop: 0,   // 画布上边距
    audioCounter: 0,  // 音频播放计数器
    audioInterval: 10,  // 音频播放间隔
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
        activePixels: () => rootStore.pixelStore.activePixels.size,
        currentBrushSize: () => rootStore.drawingConfig.currentBrushSize,
        brushSizes: () => rootStore.drawingConfig.brushSizes,
        isTransparentBackground: () => rootStore.canvasConfig.isTransparent
      },
      actions: {
        addPixel: 'addPixel',
        clearAllPixels: 'clearAllPixels',
        setBrushSize: 'setBrushSize',
        setTransparentBackground: 'setTransparentBackground'
      }
    });

    this.initCanvas();
  },

  /**
   * 初始化画布
   * 简化版本，使用 rpx 单位实现响应式布局
   */
  initCanvas() {
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

        // 获取画布的实际显示尺寸
        const canvasWidth = res[0].width || 375;
        const canvasHeight = res[0].height || 500;

        // 设置画布内部尺寸（提高清晰度）
        canvas.width = canvasWidth * 2;
        canvas.height = canvasHeight * 2;

        // 缩放上下文以匹配高分辨率
        ctx.scale(2, 2);

        this.setData({
          canvasLeft: canvasLeft,
          canvasTop: canvasTop
        });

        // 保存canvas和ctx引用
        this.canvas = canvas;
        this.ctx = ctx;

        // 初始化MobX优化的动画控制器
        this.animationController = rootStore.initAnimationController(
          canvasWidth,
          canvasHeight,
          rootStore.getCurrentBackgroundColor()
        );

        // 设置Canvas层
        rootStore.setupCanvasLayers(canvas, ctx);

        // 设置背景色
        this.clearCanvas();

        console.log('画布初始化完成');
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
   * 处理触摸移动事件，简化版本
   */
  touchMove: function (e) {
    if (!this.data.isDrawing) return;

    const touch = e.touches[0];
    const x = touch.pageX - this.data.canvasLeft;
    const y = touch.pageY - this.data.canvasTop;

    const { lastX, lastY } = this.data;

    // 简化的距离计算，固定间距
    const dx = x - lastX;
    const dy = y - lastY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 使用固定间距，简化计算
    const pixelSpacing = 6;
    const steps = Math.max(1, Math.floor(distance / pixelSpacing));

    for (let i = 1; i <= steps; i++) {
      const ratio = i / steps;
      const px = lastX + dx * ratio;
      const py = lastY + dy * ratio;

      // 只在最后一个步骤播放音频
      const shouldPlayAudio = (i === steps);
      this.placePixel(px, py, shouldPlayAudio);
    }

    // 更新位置
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

  // 切换透明背景
  toggleTransparentBackground: function (e) {
    const isTransparent = e.detail.value;
    rootStore.setTransparentBackground(isTransparent);

    // 重新渲染画布以应用新的背景设置
    if (this.animationController) {
      this.animationController.renderAllPixels();
    }

    console.log(`透明背景已${isTransparent ? '开启' : '关闭'}`);
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

    // 检查是否有透明背景
    const isTransparent = rootStore.getTransparentBackground();

    wx.canvasToTempFilePath({
      canvas: this.canvas,
      fileType: 'png', // 使用PNG格式支持透明度
      quality: 1.0, // 最高质量
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            const message = isTransparent ? '透明PNG保存成功' : '图片保存成功';
            wx.showToast({ title: message, icon: 'success' });
          },
          fail: (err) => {
            console.error('保存失败', err);
            wx.showToast({ title: '保存失败', icon: 'none' });
          }
        });
      },
      fail: (err) => {
        console.error('生成图片失败', err);
        wx.showToast({ title: '生成图片失败', icon: 'none' });
      }
    });
  },
  
  // 导出GIF
  saveAsGif: async function() {
    if (!this.canvas || !this.animationController) {
      wx.showToast({ title: '画布未初始化', icon: 'none' });
      return;
    }

    // 检查是否有绘制内容 - 通过rootStore访问pixelStore
    if (!rootStore.pixelStore.activePixels || rootStore.pixelStore.activePixels.size === 0) {
      wx.showToast({ title: '请先绘制一些内容', icon: 'none' });
      return;
    }

    try {
      // 显示配置选择对话框
      const options = await this.showGifOptions();
      if (!options) return; // 用户取消

      // 导出GIF
      const gifPath = await exportGif(this, options);

      // 保存或分享GIF
      await saveGifToAlbum(gifPath);

    } catch (error) {
      console.error('GIF导出失败', error);
      wx.showToast({
        title: error.message || '导出失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 显示GIF配置选项
  showGifOptions: function() {
    return new Promise((resolve) => {
      wx.showActionSheet({
        itemList: ['快速导出(5帧)', '标准导出(10帧)', '高质量导出(15帧)', '自定义设置'],
        success: (res) => {
          const options = [
            { frames: 5, delay: 300, quality: 15 },   // 快速
            { frames: 10, delay: 200, quality: 10 },  // 标准
            { frames: 15, delay: 150, quality: 8 },   // 高质量
            null // 自定义
          ];

          if (res.tapIndex === 3) {
            // 自定义设置
            this.showCustomGifOptions().then(resolve);
          } else {
            resolve(options[res.tapIndex]);
          }
        },
        fail: () => resolve(null)
      });
    });
  },

  // 显示自定义GIF设置
  showCustomGifOptions: function() {
    return new Promise((resolve) => {
      // 简化版本，使用默认设置
      wx.showModal({
        title: '自定义GIF设置',
        content: '帧数: 12帧\n延迟: 180ms\n质量: 中等',
        confirmText: '确定',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            resolve({ frames: 12, delay: 180, quality: 10 });
          } else {
            resolve(null);
          }
        }
      });
    });
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
