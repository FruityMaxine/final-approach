# Loop Plan · 组13 — 程序化世界 + 渲染优化 + 修裁剪bug

> FA 飞行模拟器独立 betterloop。接组12(故障系统 v0.10-0.13 收官)。停止条件 D 永续仅用户令停;用户要"勤快点"。

## 组12 复盘(收官)
Tick2故障核心+ECAM+主警告灯(v0.10)/Tick3引擎故障连锁(v0.11)/Tick4液压(v0.12)/Tick5电气+PFD失效+爆胎+随机注入(v0.13)。6面板,完整故障系统真连锁。

## 组13 主题:程序化世界+渲染优化+修裁剪bug(回应用户最早报的渲染问题)
betterloop-auditor opus 4/4 PASS。bug已核实:render.js:35 camZ<=1返null + :77 quad任一点null整体丢弃 + :90 worldBox同 → 贴近时近跑道段在视野内消失。依赖链 2→3→4→5。

### Tick 2 — 修近平面裁剪bug 多边形裁剪 (D+C, ~220行) → v0.14.0.0
- project拆 toCamera+projectCam,clipQuadNear(Sutherland-Hodgman近平面裁剪)
- quad/worldBox/runway/terrain改走裁剪(跨近平面切割非整体丢弃)
- **硬约束**:真消除近跑道段消失(Playwright贴近入口截图验),非调camZ阈值蒙混

### Tick 3 — 程序化世界 worldgen.js (A, ~220行) → v0.15.0.0
- WORLDGEN.cellsAround(camX,camZ)网格+per-cell hash(cellX,cellZ)独立seed生成建筑/地块
- 城市/郊区/田野分带+道路网+距离淡出;drawScenery改遍历worldgen非固定46对象
- **硬约束**:per-cell独立hash(非render.js:54全局序列),同cell逐帧一致不抖

### Tick 4 — 渲染优化 视锥剔除+LOD+FPS (E+C, ~200行) → v0.16.0.0
- 视锥剔除(屏外跳过)+按距离LOD(远简化)+FPS计数(滑动平均)+绘制对象计数
- **硬约束**:before/after帧率在Tick3大量对象前提下给具体FPS+对象数对比

### Tick 5 — 多跑道+滑行道网+机场扩展 (A+B, ~200行) → v0.17.0.0
- 机场布局数组{跑道朝向/位置/号码}+滑行道网+停机坪;多跑道(平行/交叉)
- config可选起降跑道(影响进近朝向/侧风);建议外置airport.js避render.js膨胀

## Auditor 三硬约束
1. Tick2真裁剪非调阈值;2. Tick3 per-cell hash非全局序列;3. Tick4量化FPS在大量对象下。
render.js 3个tick改+1接入,Tick3/5建议外置worldgen/airport.js避巨型文件。

## 进度
- [x] Tick1 计划(本文件+auditor 4/4 PASS+bug核实) — 2026-06-06
- [ ] Tick2 v0.14 修近平面裁剪
- [ ] Tick3 v0.15 程序化世界
- [ ] Tick4 v0.16 渲染优化
- [ ] Tick5 v0.17 多跑道机场
