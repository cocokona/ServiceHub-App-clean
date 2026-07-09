# ServiceHub-App 项目记忆

## 项目概述
- ServiceHub Pro — 家政服务平台移动端 (React Native + Expo + Supabase)
- 连接客户与技师，提供清洁、维修、电气、美容等上门服务
- Supabase 项目: dusugfdsuzeutjnkhtug

## 技术栈
- 前端: React Native 0.86 + Expo 57 + TypeScript + NativeWind (Tailwind)
- 后端: Supabase (PostgreSQL + Auth + Realtime + Storage)
- 导航: React Navigation 7 (Native Stack + Bottom Tabs)
- 状态: React Context (AppContext)

## 2026-07-05 后端架构重构
- **根因**: 数据库无 schema，`users` 表不存在导致 `schema.cache` 报错；明文密码存储；绕过 Supabase Auth；幻影 REST API
- **方案**: 用 `profiles` 表 (FK→auth.users) 替代自建 users 表；全表 RLS；统一走 Supabase SDK；SQL 迁移版本化
- **交付**: 2个SQL迁移 + auth.service.ts + database.service.ts + 重构supabase.ts/AuthScreen.tsx + 架构文档
- **下一步**: 执行迁移到 Supabase，渐进式迁移各页面使用新 Service 层

## 架构约定
- 数据库表用复数 (profiles, jobs, messages)
- 认证走 Supabase Auth (JWT+bcrypt)，不自建密码存储
- 所有表启用 RLS，按 auth.uid() 做行级隔离
- 前端数据访问统一通过 src/services/ 层，不直接在组件中写 Supabase 查询
- SQL 迁移文件放 supabase/migrations/，序号前缀
- 统一日志走 `src/services/logger`；统一数据库错误走 `src/services/errors` 的 `logAndThrow`（保持对外 `Error.message` 契约不变）；重构服务层时不得改变既有导出函数的签名/返回/抛出 message
- 单测用 Vitest（`npm test`，配置 `vitest.config.ts` + `vitest.setup.ts`），测试放 `src/**/*.test.ts`，AsyncStorage 与 `lib/supabase` 在 setup 中全局 mock

## 2026-07-06 离线同步系统
- 基于 OFFLINE_SYNC_DESIGN.md 构建完整离线缓存+同步系统
- 三层缓存: L1 Memory → L2 AsyncStorage → L3 Supabase
- 6 种数据类型缓存策略: services(24h)/jobs(5min)/profiles(30min)/technicians(15min)/messages(实时)/reviews(1h)
- 同步: 增量拉取(updated_at) + 离线队列(指数退避 max 3 次) + 冲突解决(last_write_wins)
- 存储: 200MB 配额 + LRU 淘汰 + 三级阈值预警
- 新增 useOfflineData Hook，统一数据获取入口
- 通用组件: OfflineBanner / SyncIndicator / LoadingSkeleton

## 2026-07-06 数据与逻辑分离重构
- 所有硬编码数据提取到 `src/data/files/*.json`（18 个 JSON 文件）
- `src/data/loader.ts` 统一加载：safeGet/safeArray 安全访问 + resolveAvatar(avatarKey→URL) + 诊断 API
- `src/data/index.ts` Barrel 导出，所有组件 `import { xxx } from '../data'`
- `src/data/constants.ts` 向后兼容 shim（deprecated）
- 13 个屏幕 + 3 个配置文件全部迁移到数据驱动
- cacheConfig.ts / syncConfig.ts 直接 import JSON（服务层配置）
- 修复 nativewind-env.d.ts（添加 `declare module '*.css'`）
- tsc --noEmit 零错误通过

## 2026-07-08 order_in_progress 表找不到 + 配置集中化
- **根因**: 迁移 00004 缺少 `NOTIFY pgrst, 'reload schema'`，PostgREST schema cache 未刷新
- **修复**: 迁移末尾添加 NOTIFY；新建 `src/config/env.ts` 集中管理环境变量；`.env`/`.env.example` 文件；supabase.ts 移除硬编码凭据；app-config.json 修正幻影 IP
- **验证**: 10 张表名全部一致；tsc --noEmit 零错误
- **约定**: 所有连接信息走 `EXPO_PUBLIC_*` 环境变量，通过 `src/config/env.ts` 统一读取，禁止硬编码

## 2026-07-09 服务层可靠性重构
- 新增 `logger.ts`/`errors.ts`；删除幻影 REST 客户端 `src/api/client.ts`，`AppNavigator`/`CustomerHome` 改用 Supabase 服务层
- `createOrderInProgress` 改单条原子 INSERT（依赖 FK，23503→友好消息）
- 修复 bug：`enqueueSyncOperation` 优先级被忽略；`flushSyncQueue` 重试耗尽未出队
- 引入 Vitest，`src/services/__tests__/*.test.ts` 44 用例全过，`tsc --noEmit` 零错误
- 详见 `BACKEND_REFACTOR.md`
