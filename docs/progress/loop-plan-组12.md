# Loop Plan · 组12 — 故障系统

> FA 飞行模拟器独立 betterloop 轨道。接组11(引擎/面板框架/燃油 v0.6-0.9 收官)。
> 停止条件 D 永续仅用户令停;用户要"勤快点"。

## 组11 复盘(收官)
Tick2建仓+SYS注册表(v0.6) / Tick3多发引擎(v0.7) / Tick4面板框架(v0.8) / Tick5燃油系统(v0.9)。面板框架已托管引擎+燃油2面板,证明"数十面板"可扩。

## 组12 主题:故障系统(一切故障可开关 + 真连锁影响飞行非纯显示)
betterloop-auditor opus 4/4 PASS,连锁挂点全核实真实(操纵增益pitchIn*9/rollIn*36、e.fire、tanks.qty、drawAttitude、gearDown/spoilerOut、地面S.x)。依赖链 2→3→4→5。

### Tick 2 — 故障核心 failures.js + ECAM面板 + 主警告灯 + 警告音 (A+B, ~330行) → v0.10.0.0
- failures.js:FAILURES注册表(每故障{id,sys,active,msg,trigger,clear,level})+step+activeList+SYS.failures联动
- ECAM故障面板(PANELS第3面板):各系统故障触发按钮+滚动告警列表(按level着色)
- master caution(琥珀)/warning(红)灯+警告音(Sound.warnTone),有active故障即亮

### Tick 3 — 引擎故障连锁 起火/失效/燃油泄漏 (C, ~260行) → v0.11.0.0
- engineFire→e.fire+EGT飙升(>900危险)+不灭火则蔓延;灭火手柄拉→灭+断油
- engineFail→停车+不对称偏航(已有);fuelLeak→对应tank持续漏→饥饿熄火(接fuel.js)
- ECAM "ENG n FIRE"/"FUEL LEAK"+master warning;先验引擎面板fire按钮(无则建)

### Tick 4 — 液压系统 hyd.js 连锁操纵/扰流板/起落架 (A+C, ~260行) → v0.12.0.0
- hyd.js HYD{sysA,B,C}压力+泵+step;hydFail→压力降
- 操纵增益乘HYD.ctrlGain()(液压低→操纵沉重迟钝)、扰流板/起落架/刹车受液压gate
- cascade:发动机失效→对应液压泵失压;ECAM "HYD LO PR";液压synoptic

### Tick 5 — 电气系统 elec.js + PFD失效 + 爆胎 + MTBF随机注入 (A+C, ~280行) → v0.13.0.0
- elec.js ELEC{bat,gen1,gen2,busAC/DC}+step;elecFail→drawPFD/drawAttitude变暗/失效/红X
- tireBurst→地面S.x偏移拉偏;FAILURES.randomInject(dt)泊松MTBF随机故障(难度相关,新手关硬核开)
- cascade:发动机→发电机失电;SYS.env登记randomFailures开关

## Auditor 必守
1. 依赖序锁2→3→4→5(Tick2 FAILURES核心是3/4/5基础)
2. 连锁真实性铁律:故障真影响操纵/推力/油量/PFD/地面,非纯数字显示
3. Tick3先验引擎面板fire按钮;Tick5集成度最高(电气/PFD/爆胎/随机)50min偏紧

## 进度
- [x] Tick1 计划(本文件+auditor 4/4 PASS+连锁挂点核查) — 2026-06-06
- [ ] Tick2 v0.10.0.0 故障核心+ECAM面板+警告灯
- [ ] Tick3 v0.11.0.0 引擎故障连锁
- [ ] Tick4 v0.12.0.0 液压系统
- [ ] Tick5 v0.13.0.0 电气+PFD失效+爆胎+随机注入
