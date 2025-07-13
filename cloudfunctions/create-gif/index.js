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
  const { delay = 500, repeat = 0, maxSize = 300, transparent = false } = options

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

        // 如果是透明背景模式，确保透明像素保持透明
        if (transparent) {
          // 遍历像素，将白色背景转换为透明
          image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (_, __, idx) {
            const red = this.bitmap.data[idx + 0]
            const green = this.bitmap.data[idx + 1]
            const blue = this.bitmap.data[idx + 2]
            const alpha = this.bitmap.data[idx + 3]

            // 如果是白色或接近白色的像素，设为透明
            if (red > 250 && green > 250 && blue > 250 && alpha > 250) {
              this.bitmap.data[idx + 3] = 0 // 设置为透明
            }
          })
        }

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

    // 颜色量化处理 - 解决256色限制问题
    console.log('开始颜色量化处理...')
    try {
      // 使用 Wu 量化算法，限制为 200 色（给透明色和渐变留空间）
      GifUtil.quantizeWu(frames, 200, 4)
      console.log('颜色量化完成 - Wu算法')
    } catch (quantizeError) {
      console.warn('Wu量化失败，尝试 Dekker 算法:', quantizeError.message)
      try {
        GifUtil.quantizeDekker(frames, 180)
        console.log('颜色量化完成 - Dekker算法')
      } catch (dekkerError) {
        console.warn('Dekker量化失败，尝试 Sorokin 算法:', dekkerError.message)
        GifUtil.quantizeSorokin(frames, 150, 'min-pop')
        console.log('颜色量化完成 - Sorokin算法')
      }
    }

    // 使用 GifCodec 编码 GIF
    console.log('开始编码GIF...')
    console.log(`透明背景模式: ${transparent ? '开启' : '关闭'}`)

    // 配置 GifCodec，支持透明度
    const codecOptions = transparent ? { transparentRGB: 0x000000 } : {}
    const codec = new GifCodec(codecOptions)

    const gif = await codec.encodeGif(frames, {
      loops: repeat // 0 表示无限循环
    })

    const gifBuffer = gif.buffer

    console.log(`GIF创建完成！`)
    console.log(`- 尺寸: ${width}x${height}`)
    console.log(`- 帧数: ${frames.length}`)
    console.log(`- 大小: ${gifBuffer.length} bytes`)
    console.log(`- 延迟: ${delay}ms`)
    console.log(`- 颜色处理: 已优化，确保256色兼容`)
    console.log(`- 透明背景: ${transparent ? '支持' : '不支持'}`)

    return gifBuffer

  } catch (error) {
    console.error('GIF创建过程中出错:', error)
    throw error
  }
}


