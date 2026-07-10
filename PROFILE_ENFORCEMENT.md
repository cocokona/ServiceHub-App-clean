# 强制资料校验 + 订单拨号按钮 — 实施总结

## 变更目标
1. 客户下单前，个人资料必须填 **地址 + 电话**。
2. 技师接单前，个人资料必须填 **电话**。
3. 客户订单视图增加 **直接拨打技师电话** 的按钮。

## 改动文件

### 新增
- `src/services/validation.ts`
  - `validateCustomerOrderProfile({address, phone})` → `{isValid, missing, errors}`
  - `validateTechnicianAcceptProfile({phone})` → `{isValid, missing, errors}`
  - `normalizePhoneForDial(phone)` → 清除括号/空格/短横线，保留 `+` 与数字，用于 `tel:` 链接
- `src/services/__tests__/validation.test.ts`（9 个用例，全部通过）

### 修改
- `src/services/database.service.ts`
  - 新增 `fetchTechnicianPhone(technicianId)`：从 `profiles` 读取电话（RLS `profiles_select_authenticated` 允许已登录用户读取）。
- `src/screens/customer/Checkout.tsx`
  - `handlePay` 下单前校验 `user.address` 与 `user.phone`；缺失则弹出 Alert（可选「去资料页」）。
  - 顶部红色横幅提示缺失字段；Pay 按钮在资料不全时禁用。
- `src/screens/customer/CustomerHome.tsx`
  - Profile 编辑把 address、phone 标为必填（`*` + 红框），保存时强制校验。
  - 资料展示页对缺失的必填项显示红色「required」提示。
- `src/screens/technician/TechnicianDashboard.tsx`
  - `handleAcceptOrder` 接单前校验 `user.phone`；缺失则拦截并引导去 Profile。
  - 资料保存时技师 phone 为必填；展示页缺失时红字提示。
- `src/screens/customer/Tracking.tsx`
  - 按 `job.technicianId` 拉取技师电话，call 按钮用 `Linking.openURL('tel:...')` 直接拨打；无号码时按钮禁用并显示「Loading contact…」/ 无号码提示。

## 验证
- `tsc --noEmit`：零错误。
- `vitest run`：全量 **55** 用例通过（含新增 9 个校验用例）。

## 关键设计决策
- 校验规则集中在 `validation.ts`，下单（客户）与接单（技师）入口统一引用，避免规则散落多处。
- 技师电话通过 `technicianId` 实时查询（而非冗余存到订单），保证拿到最新号码；订单缺 `technicianId` 时按钮自动禁用，不报错。
- 必填校验同时覆盖「保存资料」与「下单/接单动作」两道防线，确保既有用户也无法绕过。
