# 画笔系统架构设计

## 组件职责划分

### 1. BrushConstants (配置层)
**职责：** 提供所有画笔相关的常量和默认配置
- 画笔类型常量 (`BRUSH_TYPES`)
- 画笔层级常量 (`BRUSH_LAYERS`)
- 默认画笔配置 (`DEFAULT_BRUSH_CONFIG`)
- 画笔大小配置 (`BRUSH_SIZES`)
- 渲染顺序配置 (`RENDER_ORDER`)

**特点：**
- 只读配置，不包含状态
- 作为唯一的配置源，避免重复定义
- 所有其他组件都应该引用这里的配置

### 2. PenStore (状态管理层)
**职责：** 管理画笔的当前状态，提供响应式更新
- 当前画笔类型状态 (`currentPenType`)
- 当前画笔大小状态 (`currentBrushSize`)
- 自定义颜色状态 (`customColor`)
- 状态切换方法 (`changePenType`, `changeBrushSize`)
- 状态查询方法 (`getCurrentPenConfig`, `isCurrentPenEraser`)

**特点：**
- 使用 MobX 实现响应式状态管理
- 引用 BrushConstants 的配置，不重复定义
- 只管理状态，不处理具体的绘制逻辑
- 为 UI 层提供响应式数据绑定

### 3. BrushManager (业务逻辑层)
**职责：** 管理画笔实例，处理具体的绘制业务逻辑
- 画笔实例管理 (`brushes` Map)
- 绘制逻辑处理 (`draw`, `placePixel`)
- 画笔切换逻辑 (`setBrush`, `changePen`)
- 橡皮擦特殊处理 (`handleEraserDraw`)
- 音效播放逻辑 (`playCurrentBrushAudio`)

**特点：**
- 管理具体的画笔实例 (PencilBrush, MarkerBrush 等)
- 处理复杂的绘制业务逻辑
- 与 PixelStore 交互，创建和删除像素
- 不直接管理状态，通过 PenStore 获取当前状态

### 4. BaseBrush 及其子类 (实现层)
**职责：** 具体的画笔实现，定义每种画笔的特殊行为
- 画笔特定的绘制逻辑
- 像素创建方法 (`createPixel`)
- 画笔信息获取 (`getBrushInfo`)
- 特殊效果实现 (如马克笔的椭圆形、喷漆的随机分布)

## 数据流向

```
UI Layer (canvas.js)
    ↓ 用户操作
PenStore (状态管理)
    ↓ 状态变化通知
BrushManager (业务逻辑)
    ↓ 调用具体画笔
BaseBrush 子类 (具体实现)
    ↓ 创建像素
PixelStore (像素管理)
```

## 配置统一性

所有画笔相关的配置都应该从 `BrushConstants` 获取：

```javascript
// ✅ 正确做法
const { BRUSH_TYPES, DEFAULT_BRUSH_CONFIG } = require('./brushConstants')
this.penTypes = DEFAULT_BRUSH_CONFIG

// ❌ 错误做法 - 重复定义配置
this.penTypes = {
  pencil: { color: '#000000', ... },
  // ...
}
```

## 状态同步

PenStore 和 BrushManager 之间的状态同步通过 RootStore 协调：

```javascript
// RootStore 中的同步逻辑
setBrushType(brushType) {
  const success = this.penStore.changePenType(brushType)
  if (success) {
    this.brushManager.setBrush(brushType)
  }
  return success
}
```

## 重构后的架构优化

### 1. 统一入口设计
- **PenStore 作为唯一入口**：页面层直接调用 `rootStore.penStore.changePenType()` 等方法
- **内部协调**：PenStore 内部管理 BrushManager，自动同步状态
- **简化调用链**：`UI → PenStore → BrushManager` 而不是 `UI → RootStore → PenStore + BrushManager`

### 2. 职责重新划分
```javascript
// 重构前：RootStore 包含画笔业务逻辑
rootStore.setBrushType(pen) // RootStore 需要协调 penStore 和 brushManager

// 重构后：PenStore 统一管理
rootStore.penStore.changePenType(pen) // PenStore 内部处理所有逻辑
```

### 3. 配置统一化
- **单一配置源**：所有配置来自 `BrushConstants`
- **消除重复**：移除 PenStore 中的重复配置定义
- **保证一致性**：画笔类型、大小、层级等配置完全一致

### 4. 简化的 RootStore
```javascript
// 重构前：RootStore 包含大量画笔逻辑
class RootStore {
  setBrushSize(size) { /* 复杂的同步逻辑 */ }
  setBrushType(type) { /* 复杂的同步逻辑 */ }
  getCurrentBrushInfo() { /* 代理方法 */ }
  // ... 更多画笔相关方法
}

// 重构后：RootStore 保持简洁
class RootStore {
  constructor() {
    this.penStore = new PenStore() // 只需要实例化
    // 其他核心 Store...
  }
}
```

## 优化效果

1. **消除重复配置**：所有配置统一在 BrushConstants 中定义
2. **明确职责边界**：每个组件有清晰的职责范围
3. **提高可维护性**：配置修改只需要在一个地方进行
4. **增强响应性**：PenStore 提供响应式状态管理
5. **简化集成**：UI 层只需要与 PenStore 交互即可
6. **减少耦合**：RootStore 不再包含画笔业务逻辑，保持简洁
7. **统一入口**：PenStore 成为画笔功能的唯一入口点
8. **自动同步**：状态变化自动同步到 BrushManager，无需手动协调
