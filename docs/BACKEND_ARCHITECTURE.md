# ServiceHub Pro — 后端架构重构方案

> **文档版本**: v1.0  
> **日期**: 2026-07-05  
> **架构师**: Backend Architect  
> **状态**: 已交付，待执行

---

## 1. 问题诊断

### 1.1 报错根因

```
cannot find the table 'public.users' in the schema.cache
```

**直接原因**: Supabase 数据库中不存在 `public.users` 表。

**根本原因**: 项目从未创建数据库 schema —— 没有 SQL 迁移文件，没有表定义，没有 RLS 策略。`AuthScreen.tsx` 直接调用 `supabase.from('users').select(...)` / `.insert(...)`，但目标表在数据库中不存在，Supabase 的 schema 缓存中自然找不到它。

### 1.2 现有架构审计 — 发现的问题

| 严重级别 | 问题 | 位置 | 影响 |
|---------|------|------|------|
| **P0 阻断** | 数据库无 schema，`users` 表不存在 | 全局 | 注册/登录完全不可用 |
| **P0 安全** | 明文存储密码 | `AuthScreen.tsx:66` (insert password) | 密码泄露风险 |
| **P0 安全** | 明文比对密码 | `AuthScreen.tsx:42` (.eq('password', password)) | 密码泄露风险 |
| **P1 架构** | 绕过 Supabase Auth，自建认证 | `AuthScreen.tsx:38-96` | 无 JWT、无会话管理、无邮箱验证、无密码重置 |
| **P1 安全** | 无 RLS (行级安全) | 全局 | anon key 可访问所有数据 |
| **P1 安全** | 凭据硬编码在源码中 | `supabase.ts:5-6` | 密钥泄露风险 |
| **P2 架构** | 双数据源冲突 | `api/client.ts` (REST) vs `supabase.ts` | REST 指向 `192.168.1.100:3000`（可能不存在），静默回退到 mock 数据 |
| **P2 可靠性** | 静默吞掉错误 | `.catch(() => {})` 多处 | 问题无法被发现和排查 |
| **P2 数据** | 数据模型未归一化 | `Job` 类型包含 customerPhone/customerAvatar 等 | 数据冗余、更新异常 |

---

## 2. 重构架构总览

### 2.1 架构模式

```
┌─────────────────────────────────────────────────────────┐
│                    React Native App                      │
│                   (Expo + TypeScript)                    │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │  Screens    │→ │   Services   │→ │  Supabase JS   │ │
│  │  (UI Layer) │  │ (Data Layer) │  │  Client (SDK)  │ │
│  └─────────────┘  └──────────────┘  └───────┬────────┘ │
│                                            │            │
└────────────────────────────────────────────┼────────────┘
                                             │ HTTPS + JWT
                                             ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase Backend                      │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │  Auth    │  │  PostgreSQL  │  │  Realtime         │ │
│  │  (GoTrue)│  │  + RLS       │  │  (WebSocket)      │ │
│  └────┬─────┘  └──────┬───────┘  └───────────────────┘ │
│       │               │                                 │
│       ▼               ▼                                 │
│  ┌──────────┐  ┌──────────────────────────────────────┐│
│  │ auth.    │  │ public.profiles / jobs / services /  ││
│  │ users    │  │ messages / payments / reviews / ...  ││
│  │ (bcrypt) │  │ + Triggers + RLS Policies            ││
│  └──────────┘  └──────────────────────────────────────┘│
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Storage (S3-compatible) — before/after photos   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**关键决策**:

| 维度 | 原方案 | 重构方案 | 理由 |
|------|--------|----------|------|
| 认证 | 自建 users 表 + 明文密码 | Supabase Auth (JWT + bcrypt) | 安全、内置会话管理、邮箱验证、密码重置 |
| 数据访问 | Supabase 直查 + 幻影 REST API | 统一通过 Supabase SDK + Service 层 | 单一数据源，消除冲突 |
| 安全 | 无 RLS | 全表 RLS + 行级策略 | 最小权限原则，anon key 只能访问允许的数据 |
| 密码存储 | 明文 (users.password) | bcrypt hash (auth.users) | 密码不可逆向 |
| Schema 管理 | 无 | SQL 迁移文件 (版本化) | 可追溯、可回滚 |
| 配置管理 | 硬编码 | 环境变量 (EXPO_PUBLIC_*) | 安全、多环境支持 |

### 2.2 服务分层

```
Presentation Layer    →  src/screens/*.tsx       (UI 组件，不含数据逻辑)
     ↓
Service Layer         →  src/services/*.ts        (业务逻辑、数据映射、错误处理)
  ├─ auth.service.ts       (signUp, signIn, signOut, getCurrentUser, updateProfile)
  ├─ database.service.ts   (fetchJobs, createJob, updateJobStatus, fetchTechnicians...)
  └─ (future) payment.service.ts, notification.service.ts
     ↓
Infrastructure Layer  →  src/lib/supabase.ts      (Supabase 客户端单例)
     ↓
Backend               →  Supabase (PostgreSQL + Auth + Realtime + Storage)
```

---

## 3. 数据库架构

### 3.1 ER 关系图

```
auth.users (Supabase 内置)
    │ 1:1
    ▼ (trigger: on_auth_user_created)
public.profiles
    │ 1:N                    │ 1:N                    │ 1:N
    ▼                        ▼                        ▼
public.jobs            public.messages         public.technician_availability
    │ 1:N                    │
    ├── public.job_checklists │
    ├── public.job_materials  │
    ├── public.payments       │
    └── public.reviews ───────┘ (reviews also FK → profiles)

public.services (catalog, 独立表)
    │ 1:N
    └── public.jobs.service_id (可选 FK)
```

### 3.2 核心表说明

#### `public.profiles` (替代原 `users` 表)

```sql
CREATE TABLE public.profiles (
    id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email         VARCHAR(255) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'customer'
                  CHECK (role IN ('customer', 'technician')),
    work_category VARCHAR(30)  CHECK (work_category IN ('cleaning', 'repair', 'electrical', 'beauty', 'all')),
    phone         VARCHAR(30),
    bio           TEXT,
    avatar_url    TEXT,
    hourly_rate   DECIMAL(10,2) DEFAULT 0,
    rating        DECIMAL(3,1)  DEFAULT 0,
    reviews_count INTEGER       DEFAULT 0,
    is_online     BOOLEAN       DEFAULT false,
    created_at    TIMESTAMPTZ   DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ   -- 软删除
);
```

**为什么用 `profiles` 而不是 `users`?**
- Supabase 已有内置的 `auth.users` 表（存储邮箱、密码哈希等认证数据）
- 应用层业务数据放在 `public.profiles`，通过 `id` 与 `auth.users` 1:1 关联
- 注册时触发器自动创建 profile 行，无需手动插入
- 密码永远不进入 `profiles` 表

#### 自动创建 Profile 的触发器

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 3.3 索引策略

| 表 | 索引 | 查询场景 |
|----|------|----------|
| profiles | `idx_profiles_email_active` (UNIQUE, WHERE deleted_at IS NULL) | 登录时按邮箱查找 |
| profiles | `idx_profiles_role` (WHERE deleted_at IS NULL) | 按角色筛选用户 |
| profiles | `idx_profiles_work_category` (WHERE role='technician') | 客户端浏览技师 |
| jobs | `idx_jobs_customer` | 客户查看自己的订单 |
| jobs | `idx_jobs_technician` | 技师查看分配的订单 |
| jobs | `idx_jobs_status` | 按状态筛选 |
| jobs | `idx_jobs_scheduled_date` | 按日期排程 |
| messages | `idx_messages_job_id` (job_id, created_at) | 加载聊天记录 |
| services | `idx_services_name_search` (GIN to_tsvector) | 全文搜索服务 |

### 3.4 RLS 策略矩阵

| 表 | SELECT | INSERT | UPDATE | DELETE |
|----|--------|--------|--------|--------|
| profiles | 自己 + 公开浏览(deleted_at IS NULL) | 仅自己 (trigger 为主) | 仅自己 | — |
| services | 所有人 (is_active=true) | 认证用户 | 认证用户 | — |
| jobs | customer_id 或 technician_id = auth.uid() | customer_id = auth.uid() | 参与者 | — |
| job_checklists | 通过 job 关联验证 | 参与者 | 仅技师 | — |
| messages | 通过 job 关联验证 | sender_id = auth.uid() | — | — |
| payments | customer_id = auth.uid() | customer_id = auth.uid() | customer_id = auth.uid() | — |
| reviews | 所有人可读 | customer_id = auth.uid() (且 job 已完成) | — | — |
| technician_availability | 所有人可读 | technician_id = auth.uid() | technician_id = auth.uid() | technician_id = auth.uid() |

---

## 4. 认证流程重构

### 4.1 原流程 (有问题)

```
注册:
  App → supabase.from('users').insert({email, password, name, role})
  ↓ 密码明文存入 users 表 (表不存在 → 报错)

登录:
  App → supabase.from('users').select().eq('email').eq('password').single()
  ↓ 明文比对密码 (表不存在 → 报错)
```

### 4.2 重构后流程

```
注册:
  App → supabase.auth.signUp({email, password, options:{data:{name,role}}})
  ↓ Supabase Auth 用 bcrypt 哈希密码，存入 auth.users
  ↓ 触发器 on_auth_user_created 自动在 profiles 表插入一行
  ↓ 返回 JWT session (若关闭邮箱验证则立即登录)
  App → supabase.from('profiles').select().eq('id').single() → 获取完整 profile

登录:
  App → supabase.auth.signInWithPassword({email, password})
  ↓ Supabase Auth 验证 bcrypt 哈希
  ↓ 返回 JWT session
  App → supabase.from('profiles').select().eq('id').single() → 获取完整 profile

登出:
  App → supabase.auth.signOut() → 清除本地 session

会话恢复:
  App 启动 → supabase.auth.getSession() → 若有效则自动恢复
```

### 4.3 安全保障

| 威胁 | 防护措施 |
|------|----------|
| 密码泄露 | bcrypt 哈希 (由 Supabase Auth 处理，应用层永不接触明文密码) |
| 会话劫持 | JWT + 自动刷新 + HttpOnly cookie (Web) / AsyncStorage (RN) |
| 越权访问 | RLS 策略在数据库层强制执行，即使 anon key 泄露也无法越权 |
| 暴力破解 | Supabase Auth 内置速率限制 |
| SQL 注入 | Supabase SDK 使用参数化查询 |
| 密钥泄露 | anon key 设计为可公开 (受 RLS 保护); service_role key 仅用于服务端 |

---

## 5. 数据访问层重构

### 5.1 消除幻影 REST API

原 `src/api/client.ts` 指向 `http://192.168.1.100:3000` 的 REST API —— 该后端不存在，所有调用静默失败后回退到 mock 数据。

**重构方案**: 删除 `src/api/client.ts`，所有数据访问通过 `src/services/database.service.ts` 统一走 Supabase SDK。

### 5.2 Service 层职责

```typescript
// src/services/auth.service.ts
export async function signUp(params: SignUpParams): Promise<AuthResult>
export async function signIn(email, password): Promise<AuthResult>
export async function signOut(): Promise<void>
export async function getCurrentUser(): Promise<User | null>
export async function updateProfile(updates): Promise<AuthResult>

// src/services/database.service.ts
export async function fetchJobsByCustomer(customerId): Promise<Job[]>
export async function fetchJobsByTechnician(technicianId): Promise<Job[]>
export async function createJob(job): Promise<Job | null>
export async function updateJobStatus(jobId, updates): Promise<void>
export async function fetchTechnicians(category?): Promise<Technician[]>
export async function fetchMessages(jobId): Promise<Message[]>
export async function sendMessage(...): Promise<void>
export function subscribeToMessages(jobId, callback): () => void  // Realtime
export async function createReview(...): Promise<void>
```

### 5.3 错误处理策略

```typescript
// 原方案: 静默吞掉
apiGet('/api/jobs').catch(() => {});

// 重构方案: 抛出错误，由调用方决定处理方式
try {
  const jobs = await fetchJobsByCustomer(userId);
  setJobs(jobs);
} catch (err) {
  setError(err.message);  // 显示给用户
  // 或 logError(err);     // 上报到监控系统
}
```

---

## 6. 实时通信

利用 Supabase Realtime (基于 WebSocket) 替代轮询:

```typescript
// 订阅某 job 的新消息
const unsubscribe = subscribeToMessages(jobId, (message) => {
  setMessages(prev => [...prev, message]);
});

// 组件卸载时取消订阅
useEffect(() => {
  const unsub = subscribeToMessages(jobId, onNewMessage);
  return () => unsub();
}, [jobId]);
```

支持的场景:
- 聊天消息实时推送 (`messages` 表 INSERT 事件)
- 订单状态变更实时推送 (`jobs` 表 UPDATE 事件)
- 技师在线状态变更 (`profiles` 表 UPDATE 事件)

---

## 7. 性能优化

### 7.1 查询优化

| 场景 | 优化措施 | 目标延迟 |
|------|----------|----------|
| 登录 | profiles 按 PK (UUID) 查询 | < 20ms |
| 浏览技师 | 按 role + work_category 索引筛选 | < 50ms |
| 加载订单列表 | 按 customer_id / technician_id 索引 | < 50ms |
| 聊天记录 | 复合索引 (job_id, created_at) | < 30ms |
| 服务搜索 | GIN 全文搜索索引 | < 50ms |

### 7.2 缓存策略

```
┌────────────────────────────────────────────┐
│ Layer 1: AsyncStorage (设备本地)            │
│  - JWT session (自动管理)                   │
│  - 用户 profile (启动时快速恢复)             │
│  - TTL: 会话有效期                          │
├────────────────────────────────────────────┤
│ Layer 2: Supabase Query Cache (服务端)      │
│  - 服务目录 (services) — 变更少，可长缓存    │
│  - 技师列表 — 可加 5min 缓存                │
├────────────────────────────────────────────┤
│ Layer 3: PostgreSQL (数据源)               │
│  - 索引优化 + RLS 过滤                      │
└────────────────────────────────────────────┘
```

---

## 8. 监控与可观测性

### 8.1 Supabase Dashboard 内置监控
- API 请求量与延迟
- 数据库连接池使用率
- Auth 注册/登录事件
- Realtime 连接数

### 8.2 建议补充

| 维度 | 工具 | 指标 |
|------|------|------|
| 前端错误 | Sentry / Bugsnag | JS 异常、API 错误率 |
| 性能 | Supabase Logs | P95 响应时间、慢查询 |
| 业务 | 自定义日志表 / Analytics | 注册转化率、订单完成率 |
| 告警 | Supabase + Uptime monitor | 数据库 CPU > 80%、Auth 错误率 spike |

---

## 9. 灾备与恢复

| 策略 | 方案 |
|------|------|
| 数据库备份 | Supabase 自动每日备份 + PITR (Point-in-Time Recovery) |
| 代码版本控制 | Git (SQL 迁移文件纳入版本管理) |
| Schema 回滚 | 迁移文件支持 DOWN 脚本 (可回滚) |
| 服务降级 | Supabase 多区域部署 (Pro 计划); 客户端缓存兜底 |
| 密钥轮换 | 定期轮换 anon key; service_role key 仅服务端持有 |

---

## 10. 迁移执行步骤

### Step 1: 执行数据库迁移 (修复报错)

在 Supabase Dashboard → SQL Editor 中执行:

```bash
# 1. 执行 schema 创建
supabase/migrations/00001_initial_schema.sql

# 2. 执行种子数据
supabase/migrations/00002_seed_data.sql
```

或使用 Supabase CLI:
```bash
supabase db push
```

### Step 2: 配置 Supabase Auth

在 Supabase Dashboard → Authentication → Settings:
- 关闭 "Confirm email" (开发环境) 或开启 (生产环境)
- 设置密码最小长度: 6
- 配置邮件模板 (注册确认、密码重置)

### Step 3: 更新客户端代码

已完成的文件变更:
- `src/lib/supabase.ts` — 重构客户端 (AsyncStorage session + schema config)
- `src/services/auth.service.ts` — 新认证服务 (Supabase Auth)
- `src/services/database.service.ts` — 新数据访问层
- `src/screens/AuthScreen.tsx` — 重构认证页面

### Step 4: 后续迁移 (渐进式)

| 优先级 | 任务 | 涉及文件 |
|--------|------|----------|
| P0 | 验证注册/登录流程 | AuthScreen.tsx |
| P1 | 迁移 AppNavigator 使用 getCurrentUser() | AppNavigator.tsx |
| P1 | 迁移 CustomerHome 使用 fetchTechnicians() | CustomerHome.tsx |
| P1 | 迁移 Checkout 使用 createJob() | Checkout.tsx |
| P1 | 迁移 TechnicianDashboard 使用 fetchJobsByTechnician() | TechnicianDashboard.tsx |
| P2 | 迁移 SupportChat 使用 fetchMessages() + Realtime | SupportChat.tsx |
| P2 | 删除 src/api/client.ts (幻影 REST 客户端) | api/client.ts |
| P2 | 删除 src/data/constants.ts 中的 INITIAL_JOBS (改用 DB) | constants.ts |
| P3 | 添加环境变量配置 (.env) | 根目录 |
| P3 | 添加 Storage 上传 (before/after 照片) | 新建 storage.service.ts |

### Step 5: 环境变量配置

创建 `.env` 文件:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 11. 文件清单

本次重构交付的文件:

```
supabase/
├── migrations/
│   ├── 00001_initial_schema.sql    ← 完整数据库 schema (表+索引+RLS+触发器)
│   └── 00002_seed_data.sql         ← 服务目录种子数据

src/
├── lib/
│   └── supabase.ts                 ← 重构后的 Supabase 客户端
├── services/
│   ├── auth.service.ts             ← 认证服务 (Supabase Auth)
│   └── database.service.ts         ← 数据访问服务层
└── screens/
    └── AuthScreen.tsx              ← 重构后的认证页面

docs/
└── BACKEND_ARCHITECTURE.md         ← 本文档
```

---

## 12. 成功指标

| 指标 | 目标 | 测量方式 |
|------|------|----------|
| 注册成功率 | > 99.5% | Supabase Auth 日志 |
| 登录延迟 (P95) | < 200ms | Supabase API 日志 |
| 数据库查询 (P95) | < 100ms | Supabase 慢查询日志 |
| API 可用性 | > 99.9% | Uptime 监控 |
| 安全审计 | 0 个 P0/P1 漏洞 | 定期审计 |
| 峰值负载 | 10x 正常流量 | 压力测试 |
