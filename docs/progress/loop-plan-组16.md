# Loop Plan · 组16 — 机型库 + 机场库 + 回放 + ND 导航显示(路线图收官后第一组)

> FA 飞行模拟器独立 betterloop。接组15(路线图组11-15 收官,6da4205)。停止条件 D 永续仅用户令停;用户要"勤快点"。组16 是收官后的扩展组——把"单机型/单机场"扩成"可选机型/机场库"+ 补回放与 ND 两块民航核心拟真件。

## 组15 复盘(收官)
Tick2 系统总控(v0.22)/Tick3 MCDU 旗舰件(v0.23)/Tick4 MCDU 功能逻辑(v0.24)/Tick5 新手教学(v0.25)。18 模块 8 面板。原路线图组11-15 全完成。详见 loop-plan-组15-final.md。

## 组16 主题:从"一架飞机一个机场"到"可选库 + 复盘 + 导航全景"
betterloop-auditor(opus)审 **4/4 全 PASS**(2026-06-06 13:10)。挂接点全核实无虚构(AC/RWY/WPTS/ILS/CONFIG/PANELS/ENGINES.setCount/SYS.panels/touchdown/endGame 实测存在)。4 tick 主题正交无重叠。

### Tick 2 — 多机型性能库 + 选型 (A+C, ~200行) → v0.26.0.0
- 新建 aircraft.js:AIRCRAFT 注册表 4 机型(窄体 A320-like 当前/宽体 B777-like/支线 CRJ-like/货机),每档完整气动(m/dryMass/S/span/maxThrust/CLa/CL0/aoaStall/flapCL[]/flapCD[]/gearHeight/revFactor + Vref/Vapp/起降速度 + 名/描述)。
- applyAircraft(id) **逐字段写 AC 全局对象**(AC 是 const,逐字段赋值不可整体替换引用)+ 联动 FUEL 容量 + ENGINES.setCount(机型发动机数);CONFIG.aircraft 持久化。
- config modal 加机型 seg 选择器(显 Vref/重量);splash brief 显机型;PFD/EICAS 读 AC.* 自动适配。难度 stallMargin 与机型 Vref 叠加。
- 文件:aircraft.js(新)、config.js、game.js、index.html、game.css。验收:切机型→AC 各字段真变 + Vref/重量随之变 + 发动机数联动(Playwright 读 AC.maxThrust/ENGINES.count)。

### Tick 3 — 多机场航路库 + 目的地/进近选择 (A+B, ~230行) → v0.27.0.0
- 新建 airports.js:AIRPORTS 注册表 4 机场(各自跑道号/朝向 hdg/长宽/ILS 频率/标高 elevFt/PAPI 角/WPTS 航路点)。
- applyAirport(id) 写 RWY 各字段 + ILS 频率 + WPTS + PAPI/标高;CONFIG.airport 持久化;render drawRunway/drawHUD 读新跑道;**mcdu.js 解 3 处硬编码 ILS(:148/:153/:182,含 BRG/DIST 270° 航道方向勿漏)** 改读 AIRPORTS 当前频率。
- config modal 加机场 seg;splash 显目的地。验收:切机场→RWY.elevFt/ILS 频率真变 + MCDU RAD NAV 页显新频率(Playwright)。

### Tick 4 — 飞行轨迹回放系统 (A+B, ~230行) → v0.28.0.0
- 新建 replay.js:REPLAY 逐秒节流记录 S 关键态(x/z/alt/V/pitch/roll/hdg/gamma/phase/throttle)入环形缓冲(~300 点);touchdown/endGame 停录(S.touchdown 已封装可作事件标记)。
- PANELS 第 9 面板"回放"(SYS.panels.replay 登记):canvas 双图——俯视航迹(x vs 沿迹距离+中线容差带)+ 侧视下滑剖面(alt vs 距离+3° 参考线)+ 事件标记(接地/最大坡度/低速);时间轴 scrub 回看某时刻数值。report 加"看回放"按钮。
- 文件:replay.js(新)、game.js、index.html、game.css、game.json+sys.js。验收:落地后开回放→双图渲染轨迹 + scrub 滑动读数变(Playwright)。

### Tick 5 — 导航显示 ND 平面图面板 (B, ~190行) → v0.29.0.0
- 新建 nd.js:PANELS 面板"ND 导航显示"(SYS.panels.nd 登记):canvas ARC/ROSE 模式——本机符号 + 航向环(270+S.hdg)+ WPTS 平面投影(z 距离+x 横向)+ 跑道 + ILS 航道射线 + 风矢量(WIND.head/cross 合成)+ 量程圈 10/20/40NM 切换;逐帧 sync 实时刷新。
- 文件:nd.js(新)、game.json、index.html、sys.js、game.css。验收:开 ND→航迹环+WPTS+量程切换真改比例(Playwright)。auditor 提醒:nd.js 须真达 ~165 行实质投影/绘图(非注释凑行)。

## Auditor 落地提醒(非阻断)
1. Tick2:AC 是 const(game.js:60),applyAircraft 逐字段赋值,勿 `AC={...}` 整体替换(气动计算持旧引用会失效)。
2. Tick3:mcdu.js 3 处硬编码 ILS 全改,勿漏 BRG/DIST 的 270° 航道方向(应随跑道朝向动)。
3. Tick5:实质代码集中 nd.js 单文件,确保真投影/绘图逻辑达标(实现期 anti-slacking 复核点)。
4. 顺序 Tick2→3→4→5;Tick5 ND 读 Tick3 多机场 ILS 更完整但非强依赖,各自独立可发版。

## 进度
- [x] Tick1 计划(本文件 + auditor 4/4 PASS + 挂接点核实) — 2026-06-06
- [x] Tick2 v0.26 多机型性能库(aircraft.js 4机型档案/applyAircraft逐字段写AC+发动机数+燃油容量/起始速度按vref缩放/fuel.js reset按cap;切换真改气动+reload持久化实测PASS) — 2026-06-06
- [x] Tick3 v0.27 多机场航路库(airports.js 4机场/applyAirport写RWY+WPTS原地改+PAPI重算/mcdu解3处硬编码ILS/PFD罗盘基准随朝向;切换真改+MCDU真显+reload持久化实测PASS) — 2026-06-06
- [x] Tick4 v0.28 飞行轨迹回放(replay.js 环形缓冲节流记录/PANELS第9面板canvas双图下滑剖面+航迹+事件标记+scrub/report看回放按钮;真记录真绘图+scrub真变实测PASS) — 2026-06-06
- [ ] Tick5 v0.29 导航显示 ND
