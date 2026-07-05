# 后端架构重构 — 完成概览

## 任务

ServiceHub Pro 移动端无法注册账号，报错 `cannot find the table 'public.users' in the schema.cache`。需要对后端系统进行重构，提升扩展性和稳定性。

## 根因

项目从未创建数据库 schema —— 没有 SQL 迁移文件、没有表定义。`AuthScreen.tsx` 直接查询一个不存在的 `users` 表。同时发现多个严重安全问题和架构缺陷（明文密码、无 RLS、绕过 Supabase Auth、幻影 REST API）。

## 交付物

1. **`supabase/migrations/00001_initial_schema.sql`** — 完整数据库 schema：9 张表 (profiles, services, jobs, job_checklists, job_materials, messages, payments, reviews, technician_availability)、性能索引、全表 RLS 策略、自动创建 profile 触发器、自动更新 rating 触发器
2. **`supabase/migrations/00002_seed_data.sql`** — 服务目录种子数据
3. **`src/lib/supabase.ts`** — 重构客户端：AsyncStorage session 持久化、schema 显式配置、环境变量支持
4. **`src/services/auth.service.ts`** — 新认证服务：使用 Supabase Auth (JWT + bcrypt)，替代明文密码方案
5. **`src/services/database.service.ts`** — 数据访问层：统一通过 Supabase SDK 查询，含 Realtime 订阅
6. **`src/screens/AuthScreen.tsx`** — 重构认证页面：接入新 auth service
7. **`docs/BACKEND_ARCHITECTURE.md`** — 完整架构文档（诊断、设计、RLS 矩阵、迁移步骤）

## 关键决策

- 用 `profiles` 表（FK → auth.users）替代自建 `users` 表，密码由 Supabase Auth 管理
- 全表 RLS，最小权限原则
- 统一数据源（删除幻影 REST API），Service 层封装
- SQL 迁移文件版本化管理

## 下一步

执行 `00001_initial_schema.sql` + `00002_seed_data.sql` 到 Supabase，然后渐进式迁移各页面使用新 Service 层。
