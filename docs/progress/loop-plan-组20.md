# Loop Plan · 组20 — 航图 + 降水污染跑道 + ATIS/CPDLC + 任务关卡链

> FA 飞行模拟器独立 betterloop。接组19(履历/幽灵/W&B/SID·STAR 收官,34e58db)。停止条件 D 永续仅用户令停;用户要"勤快点"。组20 补齐:航图参考、恶劣天气物理、数据链通信、任务进度系统。全程守 UI 铁律 4 条。

## 组19 复盘(收官)
Tick2 履历(v0.39)/Tick3 幽灵(v0.40)/Tick4 W&B(v0.41)/Tick5 SID·STAR(v0.42)。31 模块 22 面板。详见 loop-plan-组19-final.md。

## 组20 主题:航图/天气物理/通信/任务四件
betterloop-auditor(opus)审 **4/4 全 PASS**。三个区别全实证(航图静态参考 vs ND 实时;CPDLC 文本 vs ATC 语音;关卡链跨飞行 vs tutorial 分步)。挂接点全核实(game.js:441 摩擦点、:515 评分点、procedures altLim、PANELS 框架)。每 tick 必含手机零横滚 + 高密度小控件。

### Tick 2 — 进近图/航图显示页 (B, ~185行) → v0.43.0.0
- 新建 chart.js:PANELS"航图/CHART"(sys.js panels.chart)。canvas 静态进近图(区别 ND 实时):①平面图(跑道+进近航道+航路点 WPTS/PROC+定位点+方位距离环+MDA 框)②垂直剖面图(3° 下滑道+各点高度限制 altLim+入口标高)。机场切换更新。高密度小字,手机零横滚。
- 文件:chart.js(新)、sys.js、index.html、game.css、game.json。验收:开航图→平面+剖面双图绘制+读 WPTS/altLim(Playwright)。区别:静态参考图非 ND 实时投影。

### Tick 3 — 降水天气 + 湿滑/污染跑道 (A+E, ~195行) → v0.44.0.0
- 新建 precip.js:①降水渲染(render drawWorld 末叠加雨丝斜线/雪花飘落粒子+风挡雨痕,强度随天气)②跑道污染 dry/wet/snow→runwayMu 摩擦;**game.js:441 刹车 fric 接乘 runwayMu**(湿→刹车距离增/易冲出)③PANELS"降水/PRECIP"开关(雨/雪/强度+跑道状态)。
- 文件:precip.js(新)、render.js(drawWorld 调 PRECIP.draw)、game.js(:441 接 runwayMu)、sys.js、index.html、game.css、game.json。验收:开雨→render 粒子+湿跑道 runwayMu 降→刹车距离增(Playwright)。

### Tick 4 — ATIS 自动通播 + CPDLC 数据链 (A+B, ~185行) → v0.45.0.0
- 新建 datalink.js:①ATIS(按机场/天气/风/跑道生成通播文本+信息字母 A-Z 轮替+METAR 串,Sound.say 播报)②CPDLC(塔台文本数据链:放行/高度/移交报文+玩家 WILCO/UNABLE 应答,区别 ATC 语音)。PANELS"数据链/DCDU"(ATIS 区+CPDLC 报文列表+应答)。
- 文件:datalink.js(新)、game.js(phase 触发 CPDLC)、sys.js、index.html、game.css、game.json。验收:ATIS 文本生成+CPDLC 报文+应答(Playwright)。区别:文本上下行非语音。

### Tick 5 — 任务关卡链 + 挑战解锁 (A+C, ~200行) → v0.46.0.0(组20收尾)
- 新建 missions.js:6 关挑战链(标准着陆→侧风→低能见 IMC→单发进近→风切变复飞→满载短跑道),每关目标条件(评分阈值+天气/机型/机场/故障配置)+完成解锁下一关(localStorage 进度)。选关→注入 CONFIG+开始;showReport 评分达标→通关。PANELS"任务/MISSION"(关卡链已解锁/锁定/通关+目标+开始)。
- 文件:missions.js(新)、game.js(showReport 判通关)、sys.js、index.html、game.css、game.json。验收:选关→配置注入+评分达标解锁下关+进度持久化(Playwright)。区别:跨飞行关卡链非 tutorial 分步/scenario 故障。

## Auditor 落地提醒
1. 三个区别须落地:Tick2 静态参考图(非第二个 ND);Tick4 CPDLC 文本(非 ATC 语音翻版);Tick5 跨飞行关卡链(非 tutorial/scenario 翻版)。
2. Tick3 接 game.js:441 摩擦点;Tick5 接 game.js:515 评分点,代码位不同无冲突。
3. 各 tick 守 UI 铁律(手机零横滚+高密度),实现后 Playwright 截图核验。

## 进度
- [x] Tick1 计划(本文件 + auditor 4/4 PASS + 挂接点核实) — 2026-06-06
- [ ] Tick2 v0.43 进近图/航图
- [ ] Tick3 v0.44 降水+污染跑道
- [ ] Tick4 v0.45 ATIS/CPDLC 数据链
- [ ] Tick5 v0.46 任务关卡链
