# Loop Plan · 组22 — GPWS近地告警 + 多机型操纵差异化 + 空中交通TCAS + 着陆减速物理

> FA 飞行模拟器独立 betterloop。停止条件 D 永续仅用户令停;用户要"勤快点"。全程守 UI 铁律 4 条。
> 起点:组21 收官(38 模块 30 面板 v0.50.0.0)。本组四 tick 各为独立可发版 ≥MINOR 升级。

## 上组(组21)总结

| Tick | 版本 | commit | 交付 | 状态 |
|---|---|---|---|---|
| Tick2 | v0.47.0.0 | 11f637b | 平显 HUD 增强 | ✅ 实测 PASS |
| Tick3 | v0.48.0.0 | 88510e8 | 多跑道+盘旋进近 | ✅ 实测 PASS |
| Tick4 | v0.49.0.0 | 8e802bd | 飞行计划存档 | ✅ 实测 PASS |
| Tick5 | v0.50.0.0 | a2c879b | 连续昼夜系统 | ✅ 实测 PASS,组21收官 |

组21 累计:模块 34→38,面板 26→30。

## 本组(组22)规划 — auditor 4/4 全 PASS

| Tick | 版本 | 任务 | 命中模式 | 行数 | layer |
|---|---|---|---|---|---|
| Tick2 | v0.51.0.0 | GPWS/EGPWS 七模式近地告警+语音回报增强 | A 新模块 | ~240 | 域逻辑+音频+UI+循环 |
| Tick3 | v0.52.0.0 | 多机型操纵特性差异化(俯仰/滚转/惯性/配平按机型) | D 跨层重构+C 新逻辑 | ~270 | 数据+物理+控制+UI |
| Tick4 | v0.53.0.0 | 空中交通 AI+TCAS(进近序列可见 AI 飞机+防撞) | A 新模块 | ~270 | 域逻辑+渲染+UI+循环 |
| Tick5 | v0.54.0.0 | 着陆滑跑减速详细物理(ABS+反推分级+扰流板+刹车热) | C 新逻辑+E 物理优化 | ~240 | 物理+域逻辑+UI |

## auditor 审查结论(opus · 2026-06-06 08:50 北京)

**全 PASS(4/4)**,4 tick 领域无重叠(告警系统/操纵物理/空中交通/减速物理)。所有落地点已 Grep 实证。

### 实现期强制提醒(auditor 标注)

1. **Tick2 必做迁移(重要)**:game.js @185-201 已有简易内联 GPWS(`Sound.say('minimums')`/`'woop woop. pull up'`@-1100fpm/`'sink rate'`@-850fpm/`'too low. gear'`),覆盖 Mode1/4/6 一小部分。建 gpws.js 时**必须迁移并删除这段旧内联告警**,否则新旧双触发。按既有 `_xxWired` 守卫思路处理。
2. **Tick3/5 触碰物理核心**:updatePhysics 操纵系数 @381-382(`S.pitch+=S.pitchIn*9.0*dt`/`S.roll+=S.rollIn*36*dt`)、摩擦点 @442-443(`const rwMu=PRECIP.mu();const fric=(0.02+grass+(S.brake?0.35*bg*rwMu:0))*W`)均在定步 STEP=1/120 主循环内,改后必手机 390×844 Playwright 实测,确认无横滚+飞行视野不被盖。

## 关键接入点(auditor 已实证)

- game.js:@185-201 旧内联 GPWS(Tick2 迁移删除)、@381-382 操纵系数(Tick3 改)、@442-443 摩擦点(Tick5 改)、loop 每帧调各模块 .step。
- aircraft.js:4 机型档案(m/maxThrust/revFactor/spoilerCD/spoilerLiftLoss/vref...),无 handling 字段(Tick3 加);applyAircraft 逐字段写 AC。
- render.js:project()@42、drawWorld()@149(Tick4 末画 AI traffic)。
- 既有音频:Sound(WebAudio)+radioCallouts(SpeechSynthesis);S 状态含 reverse/brake/spoilerOut。
- 既有 nd.js ND 面板(Tick4 可叠加 AI 光点)。

## 执行红线(每 tick)

1. 先 check_quota(5h≥95% 才跳 reset)。
2. 新 .js 同时加 index.html `<script>` + game.json modules.scripts。
3. 新面板 PANELS.register + SYS.register('panels',id,...),sync() 签名缓存(_sig)+监听 host._xxWired 守卫防双触发。
4. UI 铁律:飞行视野永不被盖;面板入下方仪表区;手机 390×844 零横滚(grid 列 minmax(0,1fr));信息密度极高+控件小(chip 9-10px)。
5. Playwright 手机视口实测+截图 Read 验证。
6. commit+push(2844164110@qq.com/FruityMaxine,无 Co-Authored-By)+bump 版本+追加 docs/progress/修改记录_2026-06-06.md。

## 进度

- [ ] Tick2 v0.51 GPWS/EGPWS 七模式近地告警
- [ ] Tick3 v0.52 多机型操纵特性差异化
- [ ] Tick4 v0.53 空中交通 AI+TCAS
- [ ] Tick5 v0.54 着陆减速详细物理(组22收官)

## ⏸ loop 停止说明(2026-06-06 北京 17:00 后)

用户将停止条件由 D 永续改为 **C 主观授权停**("自主决定写的差不多就停")。主 Opus 判断:**组21 已干净收官**(38 模块 30 面板 v0.50.0.0,一个完整已发版里程碑),为最佳停止边界——遂在组21收官后自主停 loop。

**本组(组22)四 tick 已通过 auditor 审查但未执行**,计划完整保留于本文件。如日后用户要继续,直接 `/betterloop` 重入即从本组 Tick2(GPWS)接续,计划现成无须重审。
