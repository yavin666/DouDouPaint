/**
 * 云函数：GIF合成
 * 使用 gifwrap 库实现高质量的GIF合成
 * 基于实际画布图片生成动画GIF
 */

const cloud = require('wx-server-sdk')
const Jimp = require('jimp')
const { GifFrame, GifUtil, GifCodec } = require('gifwrap')

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

/**
 * 云函数入口 - 极简测试版本
 */
exports.main = async (event) => {
  console.log('云函数开始执行，接收参数:', JSON.stringify(event))

  try {
    const { fileIds, options = {} } = event

    // 参数验证
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      console.error('参数验证失败：无效的文件ID列表')
      return {
        success: false,
        error: '无效的文件ID列表'
      }
    }

    console.log('接收到文件ID列表:', fileIds)
    console.log('GIF选项:', options)

    // 下载实际的图片文件
    console.log('开始下载图片文件...')
    const imageBuffers = await downloadImages(fileIds)

    if (imageBuffers.length === 0) {
      throw new Error('未能下载到任何图片')
    }

    console.log(`成功下载 ${imageBuffers.length} 张图片`)

    // 使用 gifwrap 创建高质量的GIF动画
    const gifBuffer = await createGifWithGifwrap(imageBuffers, options)

    // 上传GIF到云存储
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const gifFileName = `doudou_paint_${timestamp}_${randomStr}.gif`
    const gifCloudPath = `gif-output/${gifFileName}`

    console.log('开始上传GIF到云存储...')
    const uploadResult = await cloud.uploadFile({
      cloudPath: gifCloudPath,
      fileContent: gifBuffer
    })

    if (!uploadResult.fileID) {
      throw new Error('GIF上传失败：未获取到文件ID')
    }

    console.log('GIF上传成功，文件ID:', uploadResult.fileID)

    // 返回与前端期望格式完全匹配的结果
    const result = {
      success: true,
      fileID: uploadResult.fileID,
      frameCount: imageBuffers.length,
      fileSize: gifBuffer.length,
      fileName: gifFileName,
      message: 'GIF生成成功'
    }

    console.log('准备返回结果:', JSON.stringify(result))
    return result

  } catch (error) {
    console.error('云函数执行失败:', error)
    console.error('错误堆栈:', error.stack)

    const errorResult = {
      success: false,
      error: error.message || '未知错误',
      errorType: error.name || 'UnknownError'
    }

    console.log('返回错误结果:', JSON.stringify(errorResult))
    return errorResult
  }
}

/**
 * 从云存储下载图片
 */
async function downloadImages(fileIds) {
  console.log('开始下载图片，数量:', fileIds.length)
  const imageBuffers = []

  for (let i = 0; i < fileIds.length; i++) {
    const fileId = fileIds[i]
    try {
      console.log(`正在下载第 ${i + 1}/${fileIds.length} 张图片: ${fileId}`)

      const downloadResult = await cloud.downloadFile({
        fileID: fileId
      })

      if (!downloadResult.fileContent) {
        throw new Error(`下载的文件内容为空: ${fileId}`)
      }

      imageBuffers.push(downloadResult.fileContent)
      console.log(`第 ${i + 1} 张图片下载成功，大小: ${downloadResult.fileContent.length} bytes`)

    } catch (error) {
      console.error(`下载第 ${i + 1} 张图片失败 ${fileId}:`, error)
      throw new Error(`下载第 ${i + 1} 张图片失败: ${error.message}`)
    }
  }

  console.log(`所有图片下载完成，共 ${imageBuffers.length} 张`)
  return imageBuffers
}

/**
 * 使用 gifwrap 库创建高质量的动画GIF
 * 提供更好的颜色处理和编码质量
 */
async function createGifWithGifwrap(imageBuffers, options = {}) {
  const { delay = 500, repeat = 0, maxSize = 300 } = options

  console.log('开始使用 gifwrap 创建动画GIF...')

  try {
    if (!imageBuffers || imageBuffers.length === 0) {
      throw new Error('没有图片数据')
    }

    console.log(`准备处理 ${imageBuffers.length} 帧图片`)

    // 处理第一张图片确定尺寸
    const firstImage = await Jimp.read(imageBuffers[0])
    let width = firstImage.bitmap.width
    let height = firstImage.bitmap.height

    // 限制尺寸，保持比例
    if (width > maxSize || height > maxSize) {
      const scale = Math.min(maxSize / width, maxSize / height)
      width = Math.floor(width * scale)
      height = Math.floor(height * scale)
    }

    console.log(`GIF尺寸: ${width}x${height}`)

    // 创建 GIF 帧数组
    const frames = []

    // 处理每一帧
    for (let i = 0; i < imageBuffers.length; i++) {
      try {
        console.log(`处理第 ${i + 1}/${imageBuffers.length} 帧`)

        const image = await Jimp.read(imageBuffers[i])

        // 调整尺寸
        image.resize(width, height)

        // 创建 GifFrame，延迟时间以百分之一秒为单位
        const frame = new GifFrame(image.bitmap, {
          delayCentisecs: Math.floor(delay / 10) // 将毫秒转换为百分之一秒
        })

        frames.push(frame)
        console.log(`第 ${i + 1} 帧添加成功`)

      } catch (frameError) {
        console.error(`处理第 ${i + 1} 帧失败:`, frameError)
        // 继续处理下一帧
      }
    }

    if (frames.length === 0) {
      throw new Error('没有成功处理的帧')
    }

    // 使用 GifCodec 编码 GIF
    console.log('开始编码GIF...')
    const codec = new GifCodec()
    const gif = await codec.encodeGif(frames, {
      loops: repeat // 0 表示无限循环
    })

    const gifBuffer = gif.buffer

    console.log(`GIF创建完成！`)
    console.log(`- 尺寸: ${width}x${height}`)
    console.log(`- 帧数: ${frames.length}`)
    console.log(`- 大小: ${gifBuffer.length} bytes`)
    console.log(`- 延迟: ${delay}ms`)

    return gifBuffer

  } catch (error) {
    console.error('GIF创建过程中出错:', error)
    throw error
  }
}
