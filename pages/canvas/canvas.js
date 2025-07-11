// pages/canvas/canvas.js
const { createStoreBindings } = require('mobx-miniprogram-bindings')
const { rootStore } = require('../../stores/rootStore')
const { showCloudGifOptions, callGifCloudFunction } = require('../../utils/gifExport')
const { exportFramesForBackend, showFrameExportOptions } = require('../../utils/frameExport')
const { TouchInteractionManager } = require('../../utils/TouchInteractionManager')


Page({
  data: {
    currentPen: 'pencil',
    // 移除冗余的画笔配置，统一由 BrushManager 管理
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
        isTransparentBackground: () => rootStore.canvasConfig.isTransparent,
        canvasInitialized: () => rootStore.canvasStore.canvasState.isInitialized,
        canvasPerformance: () => rootStore.canvasStore.getPerformanceReport()
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
   * 初始化画布 - 使用CanvasStore
   */
  async initCanvas() {
    try {
      const result = await rootStore.canvasStore.initCanvas((canvasLeft, canvasTop) => {
        // 更新触摸管理器的画布位置
        if (this.touchManager) {
          this.touchManager.updateCanvasPosition(canvasLeft, canvasTop);
        }
      });

      // 保存引用以兼容现有代码
      this.canvas = result.canvas;
      this.ctx = result.ctx;
      this.animationStore = result.animationStore;

      console.log('页面: 画布初始化完成');
    } catch (error) {
      console.error('页面: 画布初始化失败', error);
      wx.showToast({
        title: '画布初始化失败',
        icon: 'none'
      });
    }
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
   * 在指定位置放置一个抖动像素 - 使用CanvasStore
   * @param {number} x - 像素x坐标
   * @param {number} y - 像素y坐标
   * @param {boolean} [checkAudio=true] - 是否检查音频播放条件
   */
  placePixel(x, y, checkAudio = true) {
    return rootStore.canvasStore.placePixel(
      x,
      y,
      checkAudio,
      (audioPath) => this.playAudio(audioPath),
      () => this.vibrate(),
      this.touchManager
    );
  },
  
  // 切换画笔 - 使用画笔管理器
  changePen: function (e) {
    const pen = e.currentTarget.dataset.pen;

    // 使用画笔管理器处理画笔切换
    const success = rootStore.brushManager.changePen(pen);

    if (success && this.data.currentPen !== pen) {
      // 更新页面数据
      this.setData({ currentPen: pen });

      // 同步到 rootStore（保持兼容性）
      rootStore.setBrushType(pen);
    }
  },

  // 切换画笔大小 - 使用画笔管理器
  changeBrushSize: function (e) {
    const size = e.currentTarget.dataset.size;

    // 使用画笔管理器处理画笔大小切换
    const success = rootStore.brushManager.changeBrushSize(size);

    if (success) {
      // 同步到 rootStore（保持兼容性）
      rootStore.setBrushSize(size);
    }
  },

  // 切换透明背景 - 使用CanvasStore
  toggleTransparentBackground: function (e) {
    const isTransparent = e.detail.value;
    rootStore.canvasStore.toggleTransparentBackground(isTransparent);
  },
  
  // 清空画布 - 使用CanvasStore
  clearCanvas: function () {
    rootStore.canvasStore.clearCanvas();
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

    // 清理CanvasStore资源
    if (rootStore.canvasStore) {
      rootStore.canvasStore.destroy();
    }

    // 清理 MobX 绑定
    if (this.storeBindings) {
      this.storeBindings.destroyStoreBindings();
    }

    // 清理动画控制器
    rootStore.destroy();
  }
});
