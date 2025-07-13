// app.js
App({
  onLaunch() {
    // 初始化云开发
    this.initCloudDevelopment()
  },

  /**
   * 初始化云开发
   */
  initCloudDevelopment() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return false
    }

    try {
      wx.cloud.init({
        env: 'cloud1-7gk3tqj6c1e40f81', // 您的云环境ID
        traceUser: true
      })
      console.log('云开发初始化成功')
      return true
    } catch (error) {
      console.error('云开发初始化失败:', error)
      return false
    }
  },

  globalData: {
    // 全局数据
    cloudInitialized: false
  }
})
