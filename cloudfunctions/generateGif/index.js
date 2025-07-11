/**
 * 云函数：GIF合成
 * 从云存储读取图片并合成GIF
 */

const cloud = require('wx-server-sdk')
const sharp = require('sharp')
const GIFEncoder = require('gifencoder')
const { createCanvas, loadImage } = require('canvas')

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 云函数入口
 */
exports.main = async (event, context) => {
  const { fileIds, options = {} } = event
  const { delay = 200, repeat = 0, quality = 10 } = options

  // 参数验证
  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    return {
      success: false,
      error: '无效的文件ID列表'
    }
  }

  if (fileIds.length > 10) {
    return {
      success: false,
      error: '文件数量过多，最多支持10个文件'
    }
  }

  console.log('开始GIF合成，文件数量:', fileIds.length)

  try {
    // 1. 从云存储下载图片
    const imageBuffers = await downloadImages(fileIds)

    if (imageBuffers.length === 0) {
      throw new Error('未能下载到任何图片')
    }

    // 2. 获取图片尺寸并验证
    const firstImage = await sharp(imageBuffers[0]).metadata()
    const width = firstImage.width
    const height = firstImage.height

    if (!width || !height || width > 2000 || height > 2000) {
      throw new Error(`图片尺寸无效或过大: ${width}x${height}`)
    }

    console.log(`图片尺寸: ${width}x${height}`)

    // 验证所有图片尺寸一致
    for (let i = 1; i < imageBuffers.length; i++) {
      const metadata = await sharp(imageBuffers[i]).metadata()
      if (metadata.width !== width || metadata.height !== height) {
        console.warn(`图片 ${i} 尺寸不一致: ${metadata.width}x${metadata.height}`)
      }
    }

    // 3. 创建GIF编码器
    const encoder = new GIFEncoder(width, height)
    const chunks = []

    encoder.createReadStream().on('data', chunk => {
      chunks.push(chunk)
    })

    encoder.createReadStream().on('error', error => {
      console.error('GIF编码器错误:', error)
    })

    // 配置GIF参数
    encoder.start()
    encoder.setRepeat(repeat) // 0表示无限循环
    encoder.setDelay(Math.max(50, Math.min(5000, delay))) // 限制延迟范围
    encoder.setQuality(Math.max(1, Math.min(20, quality))) // 限制质量范围

    // 4. 添加每一帧
    for (let i = 0; i < imageBuffers.length; i++) {
      try {
        const canvas = createCanvas(width, height)
        const ctx = canvas.getContext('2d')

        // 加载图片到canvas
        const img = await loadImage(imageBuffers[i])
        ctx.drawImage(img, 0, 0, width, height)

        // 添加帧到GIF
        encoder.addFrame(ctx)

        console.log(`已添加第 ${i + 1}/${imageBuffers.length} 帧`)
      } catch (error) {
        console.error(`处理第 ${i + 1} 帧失败:`, error)
        throw new Error(`处理第 ${i + 1} 帧失败: ${error.message}`)
      }
    }

    // 5. 完成GIF编码
    encoder.finish()

    // 等待所有数据块
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('GIF编码超时'))
      }, 60000) // 60秒超时

      encoder.createReadStream().on('end', () => {
        clearTimeout(timeout)
        resolve()
      })

      encoder.createReadStream().on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })

    // 6. 合并数据块
    const gifBuffer = Buffer.concat(chunks)

    if (gifBuffer.length === 0) {
      throw new Error('GIF编码失败：生成的文件为空')
    }

    if (gifBuffer.length > 10 * 1024 * 1024) { // 10MB限制
      throw new Error('生成的GIF文件过大，请减少帧数或降低质量')
    }

    // 7. 上传GIF到云存储
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const gifFileName = `doudou_paint_${timestamp}_${randomStr}.gif`
    const gifCloudPath = `gif-output/${gifFileName}`

    const uploadResult = await cloud.uploadFile({
      cloudPath: gifCloudPath,
      fileContent: gifBuffer
    })

    if (!uploadResult.fileID) {
      throw new Error('GIF上传失败：未获取到文件ID')
    }

    console.log('GIF合成完成，文件ID:', uploadResult.fileID)

    // 8. 清理临时图片文件
    try {
      const deletePromises = fileIds.map(fileId =>
        cloud.deleteFile({ fileList: [fileId] }).catch(error => {
          console.warn(`删除临时文件失败 ${fileId}:`, error)
        })
      )
      await Promise.all(deletePromises)
      console.log('临时图片文件已清理')
    } catch (error) {
      console.warn('清理临时文件失败:', error)
    }

    // 9. 获取临时下载链接
    const tempUrlResult = await cloud.getTempFileURL({
      fileList: [uploadResult.fileID]
    })

    if (!tempUrlResult.fileList || tempUrlResult.fileList.length === 0) {
      console.warn('获取临时链接失败，但GIF已生成')
    }

    return {
      success: true,
      gifFileId: uploadResult.fileID,
      gifUrl: tempUrlResult.fileList?.[0]?.tempFileURL || '',
      frameCount: imageBuffers.length,
      fileSize: gifBuffer.length,
      fileName: gifFileName
    }

  } catch (error) {
    console.error('GIF合成失败:', error)

    // 尝试清理已上传的临时文件
    try {
      await Promise.all(fileIds.map(fileId =>
        cloud.deleteFile({ fileList: [fileId] }).catch(() => {})
      ))
    } catch (cleanupError) {
      console.warn('清理失败文件时出错:', cleanupError)
    }

    return {
      success: false,
      error: error.message || '未知错误',
      errorType: error.name || 'UnknownError'
    }
  }
}

/**
 * 从云存储下载图片
 */
async function downloadImages(fileIds) {
  const imageBuffers = []
  
  for (const fileId of fileIds) {
    try {
      const downloadResult = await cloud.downloadFile({
        fileID: fileId
      })
      
      imageBuffers.push(downloadResult.fileContent)
      console.log(`已下载图片: ${fileId}`)
      
    } catch (error) {
      console.error(`下载图片失败 ${fileId}:`, error)
      throw error
    }
  }
  
  return imageBuffers
}
