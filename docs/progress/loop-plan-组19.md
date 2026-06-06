# Loop Plan · 组19 — 履历成就 + 幽灵轨迹 + 载重平衡 + SID/STAR 程序进近

> FA 飞行模拟器独立 betterloop。接组18(SD/PERF/ECL/情景收官,b20e0ae)。停止条件 D 永续仅用户令停;用户要"勤快点"。组19 补齐重玩/进阶拟真:着陆履历、幽灵对比、载重平衡、程序进近。全程守 UI 铁律 4 条。

## 组18 复盘(收官)
Tick2 SD(v0.35)/Tick3 PERF(v0.36)/Tick4 ECL(v0.37)/Tick5 情景训练(v0.38)。28 模块 18 面板。详见 loop-plan-组18-final.md。

## 组19 主题:重玩与进阶四件
betterloop-auditor(opus)审 **4/4 全 PASS**。现状全核实无重叠(幽灵实时 3D 叠加 vs 回放静态复盘图表正交;履历/W&B/程序进近全新)。每 tick 必含手机零横滚 + 高密度小控件。

### Tick 2 — 着陆履历 + 成就系统 (A+B, ~190行) → v0.39.0.0
- 新建 history.js:PANELS"履历"(sys.js panels.hist)。showReport 时 HISTORY.record({score,grade,fpm,tdz,xoff,aircraft,airport,time})存 localStorage(fa.hist 环形 50)。面板:历史列表(时间/机型/机场/分/等级)+统计(总数/均分/最佳/丝滑率)+成就解锁(首次/A级/丝滑<150fpm/全机型/全机场/连续3次A)。
- 文件:history.js(新)、game.js(showReport 钩子)、sys.js、index.html、game.css、game.json。验收:着陆→记录持久化+reload 保持+统计/成就更新(Playwright)。

### Tick 3 — 幽灵轨迹对比 (A+E, ~190行) → v0.40.0.0
- 新建 ghost.js:着陆评分超该机场历史最佳→序列化 REPLAY.buf 存 localStorage(per 机场最佳)。下次同机场进近:render drawWorld 末叠加半透明幽灵机标记+幽灵下滑道线(本次 vs 最佳)。PANELS"幽灵"开关(开关叠加+最佳分+清除)。
- 文件:ghost.js(新)、render.js(drawWorld 调 GHOST.draw)、replay.js或game.js(存最佳)、sys.js、index.html、game.css、game.json。验收:存幽灵→下次进近世界视图叠加幽灵标记(Playwright 像素/状态)。
- **auditor 强制**:幽灵投影复用 render 既有 world-to-screen 投影(project),避免与真实世界投影不一致。

### Tick 4 — 载重平衡 W&B 页 (C, ~190行) → v0.39.0.0
- 新建 wb.js:PANELS"载重 W&B"(sys.js panels.wb)。5 站位(前货舱/后货舱/客舱前/客舱后/燃油)± 步进调载重;算总重+CG%MAC(力矩和/总重,站位臂预设)+配平 TRIM;CG 包线绿区/红区可视化条;写 AC.m 联动 PERF。
- 文件:wb.js(新)、game.js或aircraft.js(写 AC.m)、**mcdu.js(:164 死值 CG 27.0% 改读 WB.cg(),auditor 强制纳入)**、sys.js、index.html、game.css、game.json。验收:调载重→CG/总重真变+包线变色+MCDU CG 同步+PERF 联动(Playwright)。

### Tick 5 — SID/STAR 程序进近 + ND 显示 (A+B, ~195行) → v0.39.0.0
- 新建 procedures.js:PROC 多机场程序库(每机场 STAR 进场+进近过渡,程序点{id,z,altLim,spdLim})。MCDU F-PLN 可选 STAR→并入 WPTS(splice,注意 WPTS 原 {id,z} 需扩展或旁挂限制表不破坏 FPLN 渲染);ND 叠加程序航段(虚线+限制标签)。PANELS"程序/PROC"选择面板。
- 文件:procedures.js(新)、mcdu.js(F-PLN 接 PROC)、nd.js(画程序航段)、sys.js、index.html、game.css、game.json。验收:选 STAR→WPTS 并入程序点+ND 显示航段(Playwright)。

## Auditor 落地强制项(实现期必处理)
1. Tick4:mcdu.js:164 写死 CG 27.0% 必须改读 WB.cg(),否则 W&B 与 MCDU 的 CG 打架(已纳入 Tick4 文件清单)。
2. Tick3:幽灵投影复用 render world-to-screen 投影,避免不一致。
3. Tick5:程序点 alt/spd 限制并入 WPTS 时不破坏现有 FPLN() 渲染。
4. 各 tick 守 UI 铁律(手机零横滚+高密度),实现后 Playwright 截图核验。

## 进度
- [x] Tick1 计划(本文件 + auditor 4/4 PASS + 挂接点核实) — 2026-06-06
- [ ] Tick2 v0.39 着陆履历 + 成就
- [ ] Tick3 v0.40 幽灵轨迹对比
- [ ] Tick4 载重平衡 W&B
- [ ] Tick5 SID/STAR 程序进近
