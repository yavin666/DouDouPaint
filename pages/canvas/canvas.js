// pages/canvas/canvas.js
const { createStoreBindings } = require('mobx-miniprogram-bindings')
const { rootStore } = require('../../stores/rootStore')
const { getRandomShape } = require('../../utils/shapes')
const { showCloudGifOptions, callGifCloudFunction } = require('../../utils/gifExport')
const { exportFramesForBackend, showFrameExportOptions } = require('../../utils/frameExport')
const { TouchInteractionManager } = require('../../utils/TouchInteractionManager')


Page({
  data: {
    currentPen: 'pencil',
    pens: {
      pencil: { color: '#000000', width: 2, audio: '/static/sounds/clip.mp3' },
      marker: { color: '#39C5BB', width: 4, audio: '/static/sounds/clip.mp3' },
      spray: { color: '#666666', width: 6, audio: '/static/sounds/clip.mp3' },
      eraser: { color: 'transparent', width: 8, audio: '/static/sounds/clip.mp3', isEraser: true }
    },
    canvasBackground: '#FFFFFF'
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

    // 初始化画笔类型
    rootStore.setBrushType(this.data.currentPen || 'pencil');

    // 初始化触摸交互管理器
    this.initTouchManager();

    this.initCanvas();
  },

  /**
   * 初始化触摸交互管理器
   */
  initTouchManager() {
    this.touchManager = new TouchInteractionManager({
      audioInterval: 10,
      audioTimeInterval: 300,
      pixelSpacing: 6,
      onDrawStart: (x, y) => {
        console.log(`开始绘制: (${x.toFixed(1)}, ${y.toFixed(1)})`);
      },
      onDrawMove: (x, y) => {
        // 移动绘制时的回调，可以用于性能监控等
      },
      onDrawEnd: (x, y) => {
        console.log(`结束绘制: (${x.toFixed(1)}, ${y.toFixed(1)})`);
      },
      onPlayAudio: () => {
        this.playAudio();
      },
      onVibrate: () => {
        this.vibrate();
      },
      onPlacePixel: (x, y, checkAudio) => {
        this.placePixel(x, y, checkAudio);
      }
    });

    console.log('触摸交互管理器初始化完成');
  },

  /**
   * 初始化画布 - 简化版本
   */
  initCanvas() {
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

        // 获取画布位置和尺寸
        const canvasLeft = res[0].left || 0;
        const canvasTop = res[0].top || 0;
        const canvasWidth = res[0].width || 375;
        const canvasHeight = res[0].height || 500;

        // 直接设置画布尺寸，不使用高分辨率
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // 更新触摸管理器的画布位置
        if (this.touchManager) {
          this.touchManager.updateCanvasPosition(canvasLeft, canvasTop);
        }

        // 保存canvas和ctx引用
        this.canvas = canvas;
        this.ctx = ctx;

        // 初始化动画系统
        this.animationStore = rootStore.initAnimationSystem(
          canvasWidth,
          canvasHeight,
          rootStore.getCurrentBackgroundColor()
        );

        // 设置Canvas层
        this.animationStore.setupCanvas(canvas, ctx, canvasWidth, canvasHeight, rootStore.getCurrentBackgroundColor());

        // 初始渲染空白画布
        this.animationStore.frameRenderer.renderFrame(rootStore.pixelStore);

        console.log('画布初始化完成');
      });
  },
  

  
  /**
   * 开始绘画 - 使用触摸交互管理器
   */
  touchStart: function (e) {
    if (this.touchManager) {
      this.touchManager.handleTouchStart(e);
    }
  },
  
  /**
   * 绘画中 - 使用触摸交互管理器
   */
  touchMove: function (e) {
    if (this.touchManager) {
      this.touchManager.handleTouchMove(e);
    }
  },
  
  /**
   * 结束绘画 - 使用触摸交互管理器
   */
  touchEnd: function (e) {
    if (this.touchManager) {
      this.touchManager.handleTouchEnd(e);
    }
  },

  /**
   * 触摸取消事件处理 - 使用触摸交互管理器
   */
  touchCancel: function (e) {
    if (this.touchManager) {
      this.touchManager.handleTouchCancel(e);
    }
  },
  
  /**
   * 在指定位置放置一个抖动像素或使用橡皮擦（使用新的画笔系统）
   * @param {number} x - 像素x坐标
   * @param {number} y - 像素y坐标
   * @param {boolean} [checkAudio=true] - 是否检查音频播放条件
   */
  placePixel(x, y, checkAudio = true) {
    if (!this.ctx || !this.animationStore) return;

    // 获取当前画笔配置
    const pen = this.data.pens[this.data.currentPen];

    // 判断是否为橡皮擦
    if (pen.isEraser || this.data.currentPen === 'eraser') {
      // 使用橡皮擦功能
      const currentBrushSize = rootStore.drawingConfig.brushSizes[rootStore.drawingConfig.currentBrushSize];
      const eraserRadius = currentBrushSize.size * (currentBrushSize.eraserMultiplier || 2.5);
      const result = rootStore.erasePixelsInArea(x, y, eraserRadius);

      console.log(`橡皮擦删除了 ${result} 个像素`);

      // 重新渲染
      if (this.animationStore) {
        this.animationStore.frameRenderer.renderFrame(rootStore.pixelStore);
      }
    } else {
      // 使用画笔管理器绘制普通像素
      const result = rootStore.brushManager.draw(
        x,
        y,
        getRandomShape(),
        rootStore.pixelStore
      );

      // 重新渲染
      if (result !== null && this.animationStore) {
        this.animationStore.frameRenderer.renderFrame(rootStore.pixelStore);
      }
    }

    // 确保动画循环启动
    if (!this.animationStore.animationLoop.isRunning) {
      this.animationStore.startAnimation();
    }

    // 播放音效 - 由触摸管理器控制
    if (checkAudio && this.touchManager && this.touchManager.shouldPlayAudio()) {
      // 使用画笔管理器播放音效
      rootStore.brushManager.playCurrentBrushAudio((audioPath) => {
        this.playAudio(audioPath);
      });
    }
  },
  
  // 切换画笔
  changePen: function (e) {
    const pen = e.currentTarget.dataset.pen;

    // 只在画笔真正改变时才设置
    if (this.data.currentPen !== pen) {
      this.setData({ currentPen: pen });

      // 使用新的画笔系统设置画笔类型
      rootStore.setBrushType(pen);

      // 获取画笔信息并打印
      const brushInfo = rootStore.getCurrentBrushInfo();
      console.log(`切换到画笔: ${brushInfo?.name || pen}`);
    }
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
    if (this.animationStore) {
      this.animationStore.setBackgroundColor(rootStore.getCurrentBackgroundColor());
      this.animationStore.frameRenderer.renderFrame(rootStore.pixelStore);
    }

    console.log(`透明背景已${isTransparent ? '开启' : '关闭'}`);
  },
  
  // 清空画布
  clearCanvas: function () {
    rootStore.clearAllPixels();

    // 重新渲染画布以显示清空效果
    if (this.animationStore) {
      this.animationStore.frameRenderer.renderFrame(rootStore.pixelStore);
    }

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
  


  // 新的简化导出方法 - 导出帧数据给后端
  exportFramesToBackend: async function() {
    if (!this.canvas) {
      wx.showToast({ title: '画布未初始化', icon: 'none' });
      return;
    }

    // 使用新的简化导出功能
    showFrameExportOptions(this);
  },

  // 云开发GIF导出功能 - 固定3帧
  exportGifWithCloud: async function() {
    if (!this.canvas || !this.animationStore) {
      wx.showToast({ title: '画布未初始化', icon: 'none' });
      return;
    }

    // 检查是否有绘制内容
    if (this.animationStore.pixelStore.activePixels.size === 0) {
      wx.showToast({ title: '画布为空，请先绘制内容', icon: 'none' });
      return;
    }

    // 简化确认对话框
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '生成GIF动画',
        content: '将生成3帧抖动动画，大约需要10-30秒，是否继续？',
        confirmText: '开始生成',
        cancelText: '取消',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false)
      });
    });

    if (!confirmed) return;

    try {
      // 捕获3帧图片
      wx.showLoading({ title: '正在捕获帧...' });
      const imagePaths = await this.animationStore.capture3FramesAsImages();

      if (imagePaths.length === 0) {
        throw new Error('未能捕获到有效帧');
      }

      // 上传到云存储
      wx.showLoading({ title: '正在上传...' });
      const fileIds = await this.animationStore.frameCapture.uploadImagesToCloud(imagePaths);

      // 调用云函数合成GIF（固定参数）
      wx.showLoading({ title: '正在生成GIF...' });
      const result = await callGifCloudFunction(fileIds, {
        delay: 200,    // 固定延迟200ms
        repeat: 0,     // 无限循环
        quality: 10    // 固定质量
      });

      wx.hideLoading();

      // 清理临时文件
      try {
        const fm = wx.getFileSystemManager();
        imagePaths.forEach(path => fm.unlinkSync(path));
      } catch (error) {
        console.warn('清理临时文件失败:', error);
      }

      // 显示成功提示并展示操作选项
      wx.showToast({ title: 'GIF生成成功', icon: 'success' });
      await showCloudGifOptions(result);

    } catch (error) {
      wx.hideLoading();
      console.error('GIF导出失败:', error);

      wx.showToast({
        title: error.message || 'GIF生成失败',
        icon: 'none',
        duration: 2000
      });
    }
  },


  
  /**
   * 播放音效 - 简化版本，时间控制由触摸管理器处理
   */
  playAudio: function () {
    const audio = wx.createInnerAudioContext();
    // 统一使用clip.mp3音频文件
    audio.src = '/static/sounds/clip.mp3';
    audio.play();
  },
  
  // 触发振动
  vibrate: function () {
    wx.vibrateShort({
      type: 'light'
    });
  },

  // 页面分享配置
  onShareAppMessage: function() {
    // 检查是否有全局分享信息
    const app = getApp();
    if (app.globalData && app.globalData.shareInfo) {
      const shareInfo = app.globalData.shareInfo;
      // 清除全局分享信息
      app.globalData.shareInfo = null;
      return shareInfo;
    }

    // 默认分享信息
    return {
      title: '抖抖画 - 抖动线条复古画板',
      path: '/pages/canvas/canvas',
      imageUrl: '/static/share-image.png', // 需要添加分享图片
      success: () => {
        wx.showToast({
          title: '分享成功',
          icon: 'success'
        });
      },
      fail: (error) => {
        console.error('分享失败:', error);
        wx.showToast({
          title: '分享失败',
          icon: 'none'
        });
      }
    };
  },

  // 页面卸载时清理资源
  onUnload: function() {
    console.log('页面卸载，清理资源');

    // 清理触摸交互管理器
    if (this.touchManager) {
      this.touchManager.destroy();
      this.touchManager = null;
    }

    // 清理 MobX 绑定
    if (this.storeBindings) {
      this.storeBindings.destroyStoreBindings();
    }

    // 清理动画控制器
    rootStore.destroy();
  }
});
