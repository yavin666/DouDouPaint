/**
 * 抖动像素形状配置文件
 * 定义了各种像素的3帧动画形状数据
 * 每个形状包含多个帧，每帧由多个坐标点组成
 */

/**
 * 加号形状的像素动画帧数据
 * 每个数组代表一帧，每帧包含多个[dx,dy]坐标偏移
 */
const PLUS_PIXEL = [
  [
    // 第0帧
    [0, 0],
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
    [1, 1],
    [-1, 1],
    [0, 2],
  ],
  [
    // 第1帧
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [-1, 2],
    [1, 2],
    [-1, 3],
    [1, 3],
  ],
  [
    // 第2帧
    [0, 1],
    [0, 2],
    [0, 3],
    [-1, 2],
    [1, 2],
  ],
];

/**
 * 对角线形状的像素动画帧数据
 */
const DIAG_PIXEL = [
  [
    // 第0帧
    [-1, 0],
    [-1, 1],
    [-1, 2],
    [-2, 1],
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2]
  ],
  [
    // 第1帧
    [0, 1],
    [0, 2],
    [0, 3],
    [-1, 2],
    [1, 2],
    [1, 3],
    [1, 4],
    [2, 3]
  ],
  [
    // 第2帧
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [-1, 2],
    [-1, 3],
    [-1, 4],
    [-2, 3]
  ]
];

/**
 * 反对角线形状的像素动画帧数据
 */
const REVERSE_DIAG_PIXEL = [
  [
    // 第0帧
    [2, 1],
    [1, 0],
    [1, 1],
    [1, 2],
    [0, 1],
    [0, 2],
    [0, 3],
    [-1, 2]
  ],
  [
    // 第1帧
    [1, 2],
    [0, 1],
    [0, 2],
    [0, 3],
    [-1, 2],
    [-1, 3],
    [-1, 4],
    [-2, 3]
  ],
  [
    // 第2帧
    [2, 2],
    [1, 1],
    [1, 2],
    [1, 3],
    [0, 1],
    [0, 2],
    [0, 3],
    [-1, 2]
  ]
];

/**
 * 所有可用的形状数组
 */
const AVAILABLE_SHAPES = [PLUS_PIXEL, DIAG_PIXEL, REVERSE_DIAG_PIXEL];

/**
 * 随机获取一个形状
 * @returns {Array} 随机选择的形状数据
 */
function getRandomShape() {
  return AVAILABLE_SHAPES[Math.floor(Math.random() * AVAILABLE_SHAPES.length)];
}

/**
 * 根据索引获取指定形状
 * @param {number} index - 形状索引 (0-2)
 * @returns {Array} 指定的形状数据
 */
function getShapeByIndex(index) {
  if (index < 0 || index >= AVAILABLE_SHAPES.length) {
    console.warn(`形状索引 ${index} 超出范围，返回默认形状`);
    return PLUS_PIXEL;
  }
  return AVAILABLE_SHAPES[index];
}

/**
 * 获取所有可用形状的数量
 * @returns {number} 形状数量
 */
function getShapeCount() {
  return AVAILABLE_SHAPES.length;
}

module.exports = {
  // 形状常量
  PLUS_PIXEL,
  DIAG_PIXEL,
  REVERSE_DIAG_PIXEL,
  AVAILABLE_SHAPES,
  
  // 工具函数
  getRandomShape,
  getShapeByIndex,
  getShapeCount
};
