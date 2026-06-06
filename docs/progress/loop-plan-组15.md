# Loop Plan · 组15 — 系统总控 + MCDU旗舰件 + 新手教学(路线图收官组)

> FA 飞行模拟器独立 betterloop。接组14(FBW/IMC/空间迷向/高级气象 v0.18-0.21 收官)。停止条件 D 永续仅用户令停;用户要"勤快点"。组15收官=原5组路线图(组11-15)全完成。

## 组14 复盘(收官)
Tick2 FBW(v0.18)/Tick3 FMC+IMC(v0.19)/Tick4空间迷向(v0.20)/Tick5高级气象(v0.21)。16模块6面板。

## 组15 主题:系统总控+MCDU旗舰件+新手教学(用户北极星核心:数十面板+MCDU超级拟真)
betterloop-auditor opus 4/4 PASS。SYS.list(cat)返[{id,on,label,desc}]、PANELS.register、WPTS极简。

### Tick 2 — 系统总控面板 systems.js (B, ~200行) → v0.22.0.0
- PANELS第7面板"系统",遍历SYS.list(features/failures/env/panels四类28项)自动生成分组开关UI,toggle绑SYS.set+持久化。**需在sys.js新增panels.systems登记**。
- 验收:点开关→SYS状态真变+localStorage持久化。

### Tick 3 — MCDU旗舰件 mcdu.js (B, ~400行) → v0.23.0.0 ★用户北极星核心
- PANELS第8面板"MCDU"(sys.js:62 panels.mcdu已占位,无需再登记):A320布局CDU屏(标题+6行×左右)+12 LSK(1L-6L/1R-6R)+QWERTY+数字+scratchpad+9功能键(INIT/RTE/PERF/FIX/PROG/DIR/F-PLN/MENU/PAGE)+多页框架。
- 验收:字母键→scratchpad真回显+翻页真切页(本tick交互可见,字段逻辑留Tick4)。

### Tick 4 — MCDU功能逻辑 (C, ~230行) → v0.24.0.0
- F-PLN(WPTS航路点+z差算距离)/INIT(风/温/CRZ FL)/PERF(V速度)页;scratchpad↔LSK双向+格式校验(280/8、FL350)+写入仿真(INIT风→WIND/WEATHER)。
- 验收:scratchpad→LSK→WIND/仿真参数真变(闭环可测,非纯显示)。

### Tick 5 — 新手分步交互教学 tutorial.js (B, ~220行) → v0.25.0.0(收官)
- TUTORIAL{step,steps[]}状态机+每步检测完成(如对中线|S.x|<5)+提示高亮+启动入口可跳过;7步(起手/对中线/守下滑道/速度/拉平/反推/停)。
- 验收:满足某步条件→自动进下一步(非点按钮)。

## Auditor 事实约束
1. sys.js:62 panels.mcdu已占位(Tick3不登记);panels.systems待登记(Tick2)。
2. WPTS极简{id,z},Tick4 F-PLN距离由z差算或扩结构。
3. 新.js须入game.json modules.scripts(否则不加载);版本v0.22→0.25.0.0。
4. 每tick验收红线非纯显示(见各tick验收)。

## 进度
- [x] Tick1 计划(本文件+auditor 4/4 PASS+接口核实) — 2026-06-06
- [ ] Tick2 v0.22 系统总控面板
- [x] Tick3 v0.23 MCDU旗舰件★(mcdu.js ~190行;12 LSK+QWERTY+数字+12功能键+12页CDU;字母→scratchpad回显+翻页真切页+LSK写行实测PASS) — 2026-06-06
- [x] Tick4 v0.24 MCDU功能逻辑(fmgc状态+MCDU_FIELDS校验注册表;INIT风→applyWind真改WIND.head;PERF VAPP;格式/越界拒收;F-PLN SPD/ALT列;闭环实测PASS) — 2026-06-06
- [ ] Tick5 v0.25 新手教学(收官)
