// pages/canvas/canvas.js
const { createStoreBindings } = require('mobx-miniprogram-bindings')
const { rootStore } = require('../../stores/rootStore')
const { gifExportManager } = require('../../utils/exportManager')
const { TouchInteractionManager } = require('../../utils/touchInteractionManager')


Page({
  data: {
    // 移除冗余的画笔状态，统一由 PenStore 管理
    canvasBackground: '#FFFFFF'
  },
  onLoad: function () {
    console.log('=== 使用MobX优化版本启动 ===')

    // 使用新的 MobX 6.x 绑定方式，集成 PenStore
    this.storeBindings = createStoreBindings(this, {
      store: rootStore,
      fields: {
        totalPixels: () => rootStore.pixelStore.totalPixelCount,
        activePixels: () => rootStore.pixelStore.activePixels.size,
        // 从 PenStore 获取画笔状态
        currentPen: () => rootStore.penStore.getCurrentPenType(),
        currentBrushSize: () => rootStore.penStore.getCurrentBrushSize(),
        currentColor: () => rootStore.penStore.getCurrentColor(),
        brushSizes: () => rootStore.penStore.brushSizes,
        penTypes: () => rootStore.penStore.penTypes,
        isCurrentPenEraser: () => rootStore.penStore.isCurrentPenEraser(),
        // 其他状态
        isTransparentBackground: () => rootStore.canvasConfig.isTransparent,
        canvasInitialized: () => rootStore.canvasStore.canvasState.isInitialized,
        canvasPerformance: () => rootStore.canvasStore.getPerformanceReport()
      },
      actions: {
        addPixel: 'addPixel',
        clearAllPixels: 'clearAllPixels',
        setTransparentBackground: 'setTransparentBackground'
        // 画笔相关的 actions 移除，直接调用 penStore 的方法
      }
    });

    // PenStore 已经有默认的画笔类型，无需额外初始化

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
  
  // 切换画笔 - 使用 PenStore
  changePen: function (e) {
    const pen = e.currentTarget.dataset.pen;

    // 直接调用 PenStore 的方法，PenStore 内部会处理与 BrushManager 的同步
    const success = rootStore.penStore.changePenType(pen);

    if (success) {
      console.log(`画笔切换成功: ${pen}`);
    }

  },

  // 切换画笔大小 - 使用 PenStore
  changeBrushSize: function (e) {
    const size = e.currentTarget.dataset.size;

    // 直接调用 PenStore 的方法，PenStore 内部会处理与 BrushManager 的同步
    const success = rootStore.penStore.changeBrushSize(size);

    if (success) {
      console.log(`画笔大小切换成功: ${size}`);
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
  


  /**
   * 导出GIF动画
   */
  exportAnimation: async function() {
    if (!this.canvas) {
      wx.showToast({ title: '画布未初始化', icon: 'none' })
      return
    }

    // 检查是否有绘制内容
    if (!this.animationStore || this.animationStore.pixelStore.activePixels.size === 0) {
      wx.showToast({ title: '画布为空，请先绘制内容', icon: 'none' })
      return
    }

    try {
      // 显示确认对话框
      const confirmed = await gifExportManager.showConfirmDialog()

      if (!confirmed) {
        return // 用户取消
      }

      // 执行GIF导出
      wx.showLoading({ title: '正在导出...' })

      const result = await gifExportManager.exportGif(this, {
        delay: 200,    // 固定延迟200ms
        repeat: 0,     // 无限循环
        quality: 10    // 固定质量
      }, (progress) => {
        wx.showLoading({
          title: progress.message || `${progress.stage} ${progress.progress}%`
        })
      })

      wx.hideLoading()

      if (result.success) {
        // GIF生成成功，显示结果
        this.handleGifExportSuccess(result.data)
      } else {
        throw new Error(result.message || '导出失败')
      }

    } catch (error) {
      wx.hideLoading()
      console.error('GIF导出失败:', error)
      wx.showToast({
        title: error.message || 'GIF导出失败',
        icon: 'none',
        duration: 3000
      })
    }
  },

  /**
   * 处理GIF导出成功
   */
  handleGifExportSuccess: function(gifData) {
    console.log('GIF导出成功:', gifData)

    // 保存当前GIF路径供其他方法使用
    this.currentGifPath = gifData.localPath

    // 检查是否有本地路径（测试版本可能没有）
    const hasLocalPath = gifData.localPath && gifData.localPath !== null

    wx.showModal({
      title: 'GIF生成成功',
      content: hasLocalPath
        ? `您的动画GIF已生成并下载到本地！\n文件大小: ${gifData.fileSize} 字节`
        : '您的动画GIF已生成到云端！（测试版本）',
      confirmText: hasLocalPath ? '分享文件' : '知道了',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm && hasLocalPath) {
          // 保存到相册
          this.saveGifToAlbum(gifData.localPath)
        }
      }
    })
  },

  /**
   * 保存GIF到相册（简化版本：只支持分享）
   */
  saveGifToAlbum: function(localPath) {
    console.log('尝试分享GIF文件，路径:', localPath)

    try {
      // 首先验证文件是否存在
      const fileManager = wx.getFileSystemManager()
      try {
        const stats = fileManager.statSync(localPath)
        console.log('文件存在，大小:', stats.size, 'bytes')
      } catch (statError) {
        console.error('文件不存在或无法访问:', statError)
        wx.showModal({
          title: '文件错误',
          content: '无法找到GIF文件，可能下载失败。',
          showCancel: false,
          confirmText: '知道了'
        })
        return
      }

      // 直接分享文件
      this.shareGifFile(localPath)

    } catch (error) {
      console.error('分享GIF失败:', error)
      wx.showToast({
        title: '分享失败',
        icon: 'none'
      })
    }
  },



  /**
   * 分享GIF文件
   */
  shareGifFile: function(localPath) {
    wx.shareFileMessage({
      filePath: localPath,
      success: () => {
        wx.showToast({
          title: '分享成功',
          icon: 'success'
        })
      },
      fail: (error) => {
        console.error('分享失败:', error)
        wx.showModal({
          title: '分享提示',
          content: '无法直接分享GIF文件，建议通过其他方式保存。',
          showCancel: false,
          confirmText: '知道了'
        })
      }
    })
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
