# 架构说明

纯静态浏览器游戏：无后端、无打包器、无构建步骤。多个普通 `<script>` 按序加载，共享全局作用域。

## 加载顺序（`web/index.html`）

```
sys.js → config.js → render.js → emma.js → game.js
```

各模块顶层只做定义（不触碰其他模块的运行期全局），`game.js` 末尾装配并启动主循环。因此前置模块即使引用 `game.js` 的全局，也只在运行期（被主循环调用时）解析，不会因加载顺序报错。

## 模块职责

| 模块 | 提供 | 运行期依赖 |
|---|---|---|
| `sys.js` | `SYS` 中央开关注册表（features/failures/env/panels）+ register/get/set/toggle + localStorage | 无（最先加载，自含） |
| `config.js` | `DIFF` 难度预设 / `STARTS` 起始 / `CONFIG` / `WIND` 解算 / 持久化 | `WIND`/`cfg`（game.js） |
| `render.js` | 3D 投影 `project` + 世界外景 + PFD/HUD + 时段系统 + 画布变量 | `S`/`RWY`/`cfg` 等 |
| `emma.js` | `ap` 分轴接管状态机 + 自驾 `autopilot` | `S`/`AC`/物理 UI 同步函数 |
| `game.js` | 状态 `S` / 飞机 `AC` / 输入 / 物理 / 讲评 / 设备三屏 / 主循环 | 调用上述各模块 |

## 中央 SYS 开关注册表（"一切皆可开关"）

`SYS` 把每个功能 / 故障 / 环境 / 面板登记为一项 `{on,label,desc}`，统一 `get/set/toggle` + localStorage 持久化。新增任何功能/故障时先 `SYS.register(...)`，再在逻辑里 `SYS.get(...)` 取开关。FA 组15 将建「系统总控面板」遍历 `SYS.list(cat)` 自动生成所有开关 UI。

## 面板框架（规划中，FA 组11 Tick4 起）

`SYS.panels` 为面板注册表槽位。面板框架将提供：

- **面板注册**：每个驾驶舱面板登记一项，注册即可被切换 → 支持数十种面板
- **面板选择器**：驾驶舱式在面板间切换（飞行 ⇄ 引擎 ⇄ MCDU ⇄ …）
- **MCDU 旗舰件**：屏幕四周 bezel 实体键（1L–6L / 1R–6R 行选键 + 字母数字键盘 + 功能键），多页 CDU

## 接入 Vega Arcade

`web/` 目录即 arcade 所服务的游戏根（arcade `games/final-approach` 为指向 `web/` 的 symlink）。`game.json` 的 `entry` 指向 `/games/final-approach/index.html`，`type:external + launch:link` 全屏直跳。`web/` 之外的 `README/LICENSE/docs/.git` 不被 arcade 暴露。
