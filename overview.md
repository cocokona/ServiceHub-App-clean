# ServiceHub 数据与逻辑分离重构 — 完成报告

**日期**: 2026-07-06
**工程师**: Frontend Developer

---

## 概览

将项目中所有硬编码数据从组件/配置文件中提取到独立的 JSON 数据文件，通过运行时 loader 统一加载。实现了数据与逻辑的彻底分离，修改数据无需触碰源码。

---

## 架构设计

### 数据层结构

```
src/data/
├── files/                          # 16 个 JSON 数据文件
│   ├── image-urls.json             # 远程图片/头像 URL 注册表
│   ├── categories.json             # 服务分类 + 技师筛选列表
│   ├── service-config.json         # 房间选项/时长/焦点区域/定价/时间段
│   ├── payment-methods.json        # 支付方式 + 默认清单
│   ├── mock-technicians.json       # 推荐技师 (avatarKey 间接引用)
│   ├── mock-jobs.json              # 初始工单 (avatarKey 间接引用)
│   ├── mock-messages.json          # 初始客服消息 (avatarKey 间接引用)
│   ├── mock-notifications.json     # 首页通知
│   ├── tracking-steps.json         # 追踪步骤/状态信息/ETA
│   ├── status-colors.json          # 状态色板 (customer/technician)
│   ├── locations.json              # 城市/地址/星期/排班时段
│   ├── review-tags.json            # 评价标签/默认评分/连续消息
│   ├── support-responses.json      # 客服自动回复关键词模式
│   ├── app-config.json             # API/收益/附加费/评分/前缀/存储键
│   ├── role-descriptions.json      # 角色标题/描述/应用名/标语
│   ├── active-service-options.json # 活跃服务菜单选项
│   ├── cache-config.json           # 缓存注册表/TTL/存储限制
│   └── sync-config.json            # 同步注册表/重试配置/队列键
├── loader.ts                       # 运行时数据加载器 (typed + fallback)
├── index.ts                        # Barrel 导出
└── constants.ts                    # 向后兼容 shim (deprecated)
```

### 核心机制

1. **Metro JSON 导入** — JSON 文件在构建时打包，零网络请求
2. **`safeGet<T>()` / `safeArray<T>()`** — 安全访问器，数据缺失时返回 fallback 并记录警告
3. **`resolveAvatar(key)`** — avatarKey 间接引用机制，将短键名解析为完整 URL
4. **`getImageUrl(key)`** — 按 key 获取图片 URL
5. **诊断 API** — `getLoadWarnings()` / `isDataHealthy()` 用于开发调试

---

## 迁移的文件 (18 个源文件)

### 屏幕组件 (13 个)
| 文件 | 移除的内联数据 | 替换为 |
|------|---------------|--------|
| `CustomerHome.tsx` | CATEGORIES, 通知数组, 城市列表, IMAGE_URLS, RECOMMENDED_TECHNICIANS, 状态色 | `categories`, `mockNotifications`, `cities`, `getImageUrl()`, `recommendedTechnicians`, `getStatusColor()` |
| `ServiceDetails.tsx` | ROOMS, DURATIONS, FOCUS_AREAS, 基础费率三元式, 服务类型三元式 | `rooms`, `durations`, `focusAreas`, `getBaseRate()`, `getServiceTypeLabel()` |
| `ScheduleDetails.tsx` | TIME_SLOTS, 硬编码地址 | `timeSlots`, `currentLocationDemo` |
| `Checkout.tsx` | PAYMENT_METHODS, 调色板, travelFee, jobId 前缀, 清单 | `paymentMethods`, `defaultChecklist`, `defaultTravelFee`, `jobIdPrefix` |
| `Tracking.tsx` | STEPS, 状态色, getStatusIndex/getStatusInfo switch, ETA 三元式, 评分 | `trackingSteps`, `getStatusInfo()`, `getStatusIndex()`, `getEta()`, `defaultTechnicianRating` |
| `SupportChat.tsx` | getMockSupportResponse 函数, 'Sarah', 1500ms | `getMockSupportResponse()`, `supportAgentName`, `supportResponseDelayMs` |
| `TechnicianDashboard.tsx` | days 数组, 排班时段, 筛选列表, 状态色 switch, 评分 | `daysOfWeek`, `scheduleSlots`, `technicianFilters`, `getStatusColor()`, `defaultTechnicianRating` |
| `JobDetails.tsx` | `* 0.7` 收益分成 | `technicianSharePercent` |
| `ActiveService.tsx` | $15.00 附加费, 菜单选项数组 | `addOnStandardRate`, `activeServiceMenuOptions` |
| `ServiceCompletion.tsx` | QUICK_TAGS, 调色板, 评分/标签/连续消息/收益 | `reviewTags`, `defaultRating`, `defaultSelectedTags`, `streakMessage`, `technicianSharePercent` |
| `SelectRole.tsx` | 应用名/标语/角色标题描述/帮助文本/颜色 | `roleDescriptions`, theme colors |
| `AppNavigator.tsx` | 'sh_user' 字符串, tab tint 色值 | `storageKeys.user`, theme tokens |

### 配置/服务层 (4 个)
| 文件 | 移除的内联数据 | 替换为 |
|------|---------------|--------|
| `src/api/client.ts` | DEFAULT_BASE_URL, TIMEOUT_MS, 'api_base_url' | `apiBaseUrl`, `apiTimeoutMs`, `storageKeys` |
| `src/services/cacheConfig.ts` | DEFAULT_CACHE_TTL, cacheRegistry, STORAGE_LIMITS, defaultConfig | 从 `cache-config.json` 加载 |
| `src/services/syncConfig.ts` | DEFAULT_RETRY_CONFIG, syncRegistry, SYNC_QUEUE_KEY, LAST_SYNC_KEY | 从 `sync-config.json` 加载 |
| `src/data/constants.ts` | 原 IMAGE_URLS/RECOMMENDED_TECHNICIANS 等硬编码 | 向后兼容 shim，re-export from loader |

### 类型声明 (1 个)
| 文件 | 修复 |
|------|------|
| `nativewind-env.d.ts` | 添加 `declare module '*.css'` 修复 TS2882 |

---

## 验证结果

- ✅ **TypeScript 编译通过** — `tsc --noEmit` 零错误
- ✅ **18 个 JSON 数据文件** 覆盖所有硬编码数据
- ✅ **13 个屏幕组件** 全部迁移到数据驱动导入
- ✅ **2 个服务配置** (cache/sync) 从 JSON 加载
- ✅ **向后兼容** — `constants.ts` shim 确保未迁移的导入仍可工作
- ✅ **错误处理** — `safeGet`/`safeArray` 提供优雅降级 + 警告日志
- ✅ **avatarKey 间接引用** — 消除 URL 重复，集中管理头像

---

## 数据驱动开发示例

修改服务分类只需编辑 JSON，无需触碰源码：

```json
// src/data/files/categories.json
{
  "categories": [
    { "key": "cleaning", "label": "Cleaning", "icon": "sparkles", "color": "#FF4F8B" },
    { "key": "repair", "label": "Repair", "icon": "build", "color": "#3B82F6" }
  ]
}
```

组件中统一导入：
```typescript
import { categories, getImageUrl } from '../data';
```
