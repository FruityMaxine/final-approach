# Loop Plan · 组21 — HUD增强 + 多跑道盘旋进近 + 飞行计划存档 + 连续昼夜系统

> FA 飞行模拟器独立 betterloop。停止条件 D 永续仅用户令停;用户要"勤快点"。全程守 UI 铁律 4 条。
> 起点:组20 收官(34 模块 26 面板 v0.46.0.0)。本组四 tick 各为独立可发版 ≥MINOR 升级。

## 上组(组20)总结

| Tick | 版本 | 交付 | 状态 |
|---|---|---|---|
| Tick2 | v0.43.0.0 | 进近图/航图(平面+剖面) | ✅ 实测 PASS |
| Tick3 | v0.44.0.0 | 降水+污染跑道(雨雪+μ摩擦) | ✅ 实测 PASS |
| Tick4 | v0.45.0.0 | ATIS+CPDLC 数据链 | ✅ 实测 PASS |
| Tick5 | v0.46.0.0 | 任务关卡链(6关) | ✅ 实测 PASS,组20收官 |

组20 累计:模块 31→34,面板 22→26。

## 本组(组21)规划 — auditor 4/4 全 PASS

| Tick | 版本 | 任务 | 命中模式 | 行数 | layer |
|---|---|---|---|---|---|
| Tick2 | v0.47.0.0 | 二维平显 HUD 增强(FPV航迹矢量+能量管理环+速度趋势带) | A 新模块+B 新面板 | ~230 | 渲染+UI+配置 |
| Tick3 | v0.48.0.0 | 多跑道选择+盘旋进近(circle-to-land) | A 新模块+C 新逻辑 | ~260 | 数据+域+UI+循环 |
| Tick4 | v0.49.0.0 | 飞行计划保存/导入导出(分享码+多存档槽) | A 新模块 | ~240 | 持久化+域+UI |
| Tick5 | v0.50.0.0 | 连续昼夜系统(离散三档→连续todMin+太阳高度角+时间加速) | D 跨层重构+A 新能力 | ~280 | 配置+渲染+光照+循环+UI ≥4 |

## auditor 审查结论(opus · 2026-06-06 16:05 北京)

**全 PASS(4/4)**,4 tick 互不重叠(HUD渲染/跑道域逻辑/计划持久化/昼夜时间,四独立子系统)。
附 3 处方案瑕疵,落地时主 Opus 自纠(不改 tick 范围与价值):

1. **Tick2 & Tick4**:project()、applyConfig() 均已是经典 `<script>` 共享作用域裸全局函数,新模块直调即可——方案中"暴露 project / 暴露 applyConfig"两处改动冗余,**省**。
2. **Tick3**:既有 airport.js(单数)含纯视觉装饰副跑道(drawRunwayAt,固定 vega 场景不可降落),Tick3 的 runways[] 是可选择可降落写 RWY 的域数据,维度不同不冲突;落地**复用 airport.js 的 rwPt 坐标变换**避免重造,命名避免混淆。
3. **Tick5(最重要)**:cfg.tod 与 setTod() 实际在 **game.js**(cfg@103/setTod@867,**非 config.js**);下游消费点除 render.js:76/lights.js:130 外还有 **spatial.js:19**(夜间空间迷向判定 `cfg.tod==='night'`,方案漏列);兼容映射须提供 `DAYNIGHT.isNight()` 替换所有散落的 `cfg.tod==='night'` 判定,否则连续模式下 spatial 夜间判定失效。

## 关键接入点(已 Grep 实证)

- render.js:42 `project(px,py,pz)` 裸全局投影;drawWorld@146;drawHUD@328;drawWorld 末序列 drawScenery/LIGHTS/drawRunway/drawPAPI/PRECIP/drawHUD。
- airports.js:4 机场各单跑道,applyAirport(id) 逐字段写 RWY+WPTS 原地改。
- game.js:cfg@103/setTod@867/doReset@582/loop dt 累加@793-795(STEP=1/120 定步)。
- lights.js:27 night=clamp((T.lightBoost-0.55)/1.25,0,1);tod 消费@130。
- config.js:56 applyConfig() 裸全局(含 applyAircraft/applyAirport/applyWind/WEATHER.preset/saveConfig)。
- spatial.js:19 `cfg.tod==='night'` 夜间判定(Tick5 下游)。

## 执行红线(每 tick)

1. 先 check_quota(5h≥95% 才跳 reset)。
2. 新 .js 同时加 index.html 两处 `<script>` + game.json modules.scripts。
3. 新面板 PANELS.register + SYS.register('panels',id,...),sync() 用签名缓存(_sig)防每帧重建 innerHTML 导致 Playwright 点击目标 detach。
4. UI 铁律:飞行视野永不被盖;面板入下方仪表区;手机 390×844 panelHost 零横滚(grid 列 minmax(0,1fr));信息密度极高+控件小(chip 9-10px)。
5. Playwright 手机视口实测(arcade venv;URL http://127.0.0.1:28800/games/final-approach/index.html;裸名 S/CONFIG/MISSIONS/applyConfig)+截图 Read 验证。
6. commit+push(2844164110@qq.com/FruityMaxine,无 Co-Authored-By)+bump 版本+追加 docs/progress/修改记录_2026-06-06.md。

## 进度

- [x] Tick2 v0.47 平显 HUD 增强(FPV航迹矢量/能量管理E/速度趋势,27面板零横滚+toggle实测PASS) — 2026-06-06
- [ ] Tick3 v0.48 多跑道+盘旋进近
- [ ] Tick4 v0.49 飞行计划存档
- [ ] Tick5 v0.50 连续昼夜系统(组21收官)
