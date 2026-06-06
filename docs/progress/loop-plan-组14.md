# Loop Plan · 组14 — 飞控电脑 + 仪表飞行 + 空间迷向 + 高级气象

> FA 飞行模拟器独立 betterloop。接组13(修裁剪bug/程序化世界/渲染优化/多跑道 v0.14-0.17 收官)。停止条件 D 永续仅用户令停;用户要"勤快点"。

## 组13 复盘(收官)
Tick2修近平面裁剪bug(v0.14,用户最早报)/Tick3程序化世界(v0.15)/Tick4渲染优化4.26x(v0.16)/Tick5多跑道(v0.17)。13模块6面板。

## 组14 主题:高级飞行(FBW/IMC/空间迷向/高级气象,真改手感/视觉/连锁非纯显示)
betterloop-auditor opus 4/4 PASS。接入点核实:操纵game.js:369-370、vStall:358、AC.m动态、WIND、drawWorld render.js:143、drawFMA:606、FAILURES ECAM接口。

### Tick 2 — 飞控电脑 FBW fbw.js (A+C, ~230行) → v0.18.0.0
- 正常法则(俯仰load factor需求/横滚rate需求,松杆1g/坡度保持)+包线保护(bank≤67/pitch/overspeed/α-floor)+自动配平
- FBW开经FBW.law改S.pitch/roll;关=直接法则;FMA显示NORMAL/DIRECT LAW;SYS.features.fbw开关

### Tick 3 — FMC航路点 + 仪表飞行IMC (B+C, ~250行) → v0.19.0.0
- FMC航路点序列+横向偏离指引;IMC能见度→render.js drawWorld外景渐隐入云,PFD仍清晰
- **新建weather.js只放visibility/ceiling基础态**(Tick5 append气象,勿覆盖);能见度可配

### Tick 4 — 空间迷向 spatial.js (C, ~200行) → v0.20.0.0
- 前庭错觉(leans倾斜/somatogravic躯体重力/黑洞进近),无外参照(夜+IMC+缺地标)触发
- **外景render吃错觉偏移δ,但drawPFD/drawAttitude用真实S.roll/pitch不偏**(信仪表才正,核心可测点);SYS.env.spatialD

### Tick 5 — 高级气象 weather.js append (A+C, ~250行) → v0.21.0.0
- **append到Tick3的weather.js**:microburst微下击暴流(先顶风增升后顺风掉高)+wake尾流滚转+icing积冰(增AC.m/升vStall/降ctrlGain/除冰)
- 接WIND/AC.m/vStall/ctrlGain;ECAM ICING/WINDSHEAR告警(FAILURES);可配可开关

## Auditor 边界提示
1. Tick3/5 共用weather.js:Tick3只visibility/ceiling,Tick5 append气象,勿覆盖。
2. Tick4命门:外景吃错觉δ但PFD drawAttitude用真姿态,Playwright截图验外景倾斜而PFD水平分叉。

## 进度
- [x] Tick1 计划(本文件+auditor 4/4 PASS+接入点核实) — 2026-06-06
- [ ] Tick2 v0.18 飞控电脑FBW
- [ ] Tick3 v0.19 FMC+IMC仪表飞行
- [ ] Tick4 v0.20 空间迷向
- [ ] Tick5 v0.21 高级气象
