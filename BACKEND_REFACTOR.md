# ServiceHub 后端架构重构 — 概览

> 目标：在不改变任何对外接口行为的前提下，消除冗余/错误、统一异常处理、补全单测、增强日志。

## 1. 接口兼容性（要求 1 & 6）

- 所有 `src/services/*.ts` 导出函数的 **签名、返回类型、抛出的 `Error.message` 全部保持不变**。
- `AppNavigator` 的 `AppContext` 方法（含 `updateJobStatus`）名称与参数不变；仅把内部持久化从“已失效的幻影 REST 调用”换成 Supabase 服务层调用，保持 fire-and-forget 语义。
- 新增模块（`logger.ts` / `errors.ts`）为纯增量，不修改任何既有导出契约。

## 2. 模块依赖梳理与冗余消除（要求 2）

### 依赖图（无循环依赖）

```
config/env  ──►  lib/supabase
                       ▲
database.service ─────┤   auth.service ────────┤
cache.service ──► cacheConfig / storage.service / logger
storage.service ─► cacheConfig / logger
sync.service ──► cache.service / network.service / syncConfig / syncQueue.service / lib/supabase / logger
syncQueue.service ─► syncConfig / logger
UI (screens, navigator) ──► services/*   (单向，无回边)
```

### 已消除的冗余 / 死代码

| 项 | 说明 |
|----|------|
| `src/api/client.ts` | 删除。指向不存在的 `localhost:3000` / `192.168.1.100:3000`，所有调用静默失败。 |
| `AppNavigator.apiGet('/api/jobs')` | 移除死回退分支，改为记录日志（UI 行为不变：jobs 列表保持原样）。 |
| `AppNavigator.apiPut(...)` | 改为 `persistJobStatus(jobId, updates)`（Supabase 持久化）。别名避免与 AppContext 同名方法冲突。 |
| `CustomerHome` 未用 `apiGet` 导入 | 移除。 |
| `env.ts` 遗留 `apiBaseUrl` / `apiTimeoutMs` | 移除（仅 `api/client.ts` 使用，现已删除）。 |
| `cache.service` 动态 `import('./storage.service')` | 改为静态导入 `clearAllCache`，消除冗余动态导入。 |

## 3. 数据层异常处理 / 原子性 / 一致性（要求 3）

- **`errors.ts`**：`logAndThrow(operation, error)` 统一记录结构化错误并**原样再抛出 `Error(message)`** —— 对外错误契约不变；`isForeignKeyViolation()` 识别 SQLSTATE `23503`。
- `database.service` 所有方法改用 `logAndThrow`；错误 message 与重构前逐字一致。
- **原子性改进（关键）**：`createOrderInProgress` 由“先 `SELECT` 校验 profile，再 `INSERT`”（两步、存在竞态窗口）改为 **单条 `INSERT`**，由 `order_in_progress.customer_id` 的 FK 约束在数据库层保证引用完整性；profile 缺失时映射为友好的 `Your profile was not found…` 消息。少一次往返、消除竞态。
- `acceptOrderInProgress` 走 DB 函数 `accept_order_in_progress`（PL/pgSQL 事务内 SELECT→INSERT→DELETE），原子性由数据库保证；`reviews` 评分经 `trg_reviews_update_rating` 触发器自动保持一致。

## 4. 单元测试（要求 4）

- 引入 **Vitest**（Node 环境；全局 mock `AsyncStorage` 和 `lib/supabase`）。
- **44 个用例全部通过**，`tsc --noEmit` **零错误**。
- 覆盖正常流程 + 边界条件：

| 文件 | 覆盖点 | 用例 |
|------|--------|------|
| `cacheConfig.test.ts` | TTL 过期 / 软过期(>80%) / 未知 key 回退默认 / 运行时注册 | 9 |
| `syncConfig.test.ts` | 三种冲突策略 + 优先级排序 | 8 |
| `storage.service.test.ts` | 读写往返 / 过期项自动剔除 / 清除 | 5 |
| `syncQueue.service.test.ts` | 入队出队 / **优先级排序（修复 bug）** / 成功刷写 / **指数退避重试并在超出 maxRetries 后放弃并出队（修复 bug）** | 4 |
| `database.service.test.ts` | 作业映射(含嵌套集合) / 错误 message 一致 / **原子订单创建(成功 + FK 23503 友好消息 + 其他错误)** / RPC / 技师默认费率 | 10 |
| `auth.service.test.ts` | 注册登录成功映射 / 错误透传 / 无会话返回 null / 未认证更新报错 / 登出委托 | 8 |

## 5. 日志改进（要求 5）

- **`logger.ts`**：分级（debug/info/warn/error）、附上下文与 `traceId`、`child()` 关联同一逻辑操作、可替换 sink（测试可注入内存 sink）。
- 接入点：认证成败、DB 失败与 FK 友好映射、缓存后台刷新失败、存储损坏条目、同步拉取失败、队列执行崩溃、`AppNavigator` 刷新失败等 —— 均可追溯。

## 重构中暴露并修复的潜在 Bug

1. **`enqueueSyncOperation` 优先级被静默忽略**：`priority` 参数从未写入队列项，且排序比较器比较的是常量参数 → 队列实际仅按入队时间排序。已改为按每项 `priority` 排序。
2. **`flushSyncQueue` 重试耗尽后未出队**：`delay < 0` 分支仅计失败但**未移除队列项** → 项永久滞留、无限重试。已在放弃分支显式出队。

## 验证

```bash
npm test            # 44 passed
npx tsc --noEmit    # 0 errors
```

## 关键新增/修改文件

- 新增：`src/services/logger.ts`、`src/services/errors.ts`、`vitest.config.ts`、`vitest.setup.ts`、`src/services/__tests__/*.test.ts`
- 修改：`database.service.ts`、`auth.service.ts`、`cache.service.ts`、`storage.service.ts`、`sync.service.ts`、`syncQueue.service.ts`、`syncConfig.ts`、`services/index.ts`、`config/env.ts`、`navigation/AppNavigator.tsx`、`screens/customer/CustomerHome.tsx`
- 删除：`src/api/client.ts`
