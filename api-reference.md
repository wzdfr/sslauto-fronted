# SSL 证书管理平台 全量后端接口文档

> 面向前端开发人员，基于 `src/main/java/com/sslauto/controller/` 下 7 个控制器的真实实现编写。
> 资产中心 3 个接口的更详细说明另见 [asset-center-api.md](asset-center-api.md)。

## 接口总览

| 模块 | 前缀 | 接口数 | 权限键 |
|---|---|---|---|
| 认证 | `/api/auth` | 4 | 无（登录）/ 登录态 |
| 首页概览 | `/api/dashboard` | 2 | `dashboard:view` |
| 云服务授权 | `/api/cloud/auth` | 4 | `auth:*` |
| 证书管理 | `/api/cert` | 14 | `cert:*` |
| 自动部署 | `/api/deploy` | 3 | `deploy:*` |
| 服务器 Agent（UI） | `/api/agent` | 10 | `agent:*` |
| 服务器 Agent（协议，供 Agent 调用） | `/api/agent` | 7 | token/agentKey |
| Agent 脚本下载 | `/api/agent` | 5 | 无 |
| 系统管理 | `/api/system` | 9 | `system:*` |

---

# 1. 通用约定

## 1.1 基础信息

| 项 | 说明 |
|---|---|
| Base URL | `/api` |
| 传输格式 | JSON（`Content-Type: application/json`），文件下载除外 |
| 字符编码 | UTF-8 |
| 时间格式 | 实体类时间字段返回**毫秒时间戳**（number）；`queryMaps` 原生查询的时间字段为数据库字符串（`yyyy-MM-dd HH:mm:ss`）。前端统一格式化为 `YYYY-MM-DD HH:mm:ss` |

## 1.2 认证方式

登录后所有接口通过请求头携带 Token：

```
X-Token: <登录返回的 token>
```

例外：
- 文件下载接口（`/api/cert/download`、`/api/agent/certPackage`）浏览器直链无法带自定义头，通过查询参数 `?token=xxx` 认证。
- Agent 协议接口使用 `token`（注册时）或 `serverId + agentKey`（其余）认证，不走用户会话。

## 1.3 统一响应结构（JsonResult）

```json
{
  "code": 200,
  "message": "success",
  "data": { }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| code | int | `200` 成功；`401` 未登录/凭证无效；`403` 无权限；`400` 参数错误；`404` 资源不存在；`500` 服务异常 |
| message | string | 提示信息，失败时可直接用于 `ElMessage.error()` 展示 |
| data | any | 业务数据，失败时为 `null` |

前端 `api()` 封装：`code !== 200` 抛错，`code === 401` 清除 token 跳转登录页。

## 1.4 权限键总表

| 模块 | 权限键 | 说明 |
|---|---|---|
| dashboard | `dashboard:view` | 查看首页概览 |
| auth | `auth:view` / `auth:save` / `auth:test` / `auth:delete` | 云授权查看/编辑/测试/删除 |
| cert | `cert:view` / `cert:apply` / `cert:verify` / `cert:renew` / `cert:upload` / `cert:download` / `cert:delete` | 证书查看/申请/DNS验证/续期/上传/下载/删除 |
| deploy | `deploy:view` / `deploy:save` / `deploy:delete` | 部署任务查看/编辑/删除 |
| agent | `agent:view` / `agent:token` / `agent:delete` / `agent:takeover` / `agent:config` / `agent:action` | 服务器查看/令牌/删除/接管/配置读写/站点操作 |
| system | `system:user` / `system:role` / `system:log` | 用户/角色权限/日志审计 |

未登录返回 `code=401`；权限不足返回 `code=403, message="无权限执行该操作"`。

---

# 2. 认证模块 `/api/auth`

## 2.1 登录

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/auth/login` |
| 权限 | 无需登录 |
| 审计 | 写入（匿名，模块 `auth`，动作 `LOGIN`） |

**入参**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| username | string | 是 | 用户名，两端自动 trim |
| password | string | 是 | 密码明文（HTTPS 下传输） |

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| token | string | 会话令牌，有效期 2 小时，后续所有请求放入 `X-Token` 头 |

**错误码**：`400` 用户名和密码不能为空；`code=500` 用户名或密码错误 / 账号已禁用 / 已锁定（message 直接展示）。

**示例**

```json
// 请求
{ "username": "admin", "password": "123456" }
// 响应
{ "code": 200, "message": "登录成功", "data": { "token": "a1b2c3..." } }
```

## 2.2 退出登录

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/auth/logout` |
| 权限 | 登录即可（未登录也返回成功） |

**入参**：无（Token 从 `X-Token` 头读取）。
**出参**：`data: null`，`message="已退出"`。

## 2.3 当前用户信息

| 项 | 说明 |
|---|---|
| 路径 | `GET /api/auth/info` |
| 权限 | 登录即可（未登录返回 401） |

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| username | string | 登录名 |
| nickname | string | 显示名 |
| roleCode | string | 角色编码，如 `super` |
| roleName | string | 角色名称 |
| permissions | string[] | 权限键列表，如 `["cert:view","cert:apply"]`，前端据此控制菜单与按钮显隐 |

## 2.4 修改密码

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/auth/password` |
| 权限 | 登录即可 |

**入参**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| oldPassword | string | 是 | 原密码 |
| newPassword | string | 是 | 新密码，**最少 6 位** |

**出参**：`data: null`。错误：`400` 新密码至少 6 位；`code=500` 原密码错误。

---

# 3. 首页概览 `/api/dashboard`

## 3.1 统计汇总

| 项 | 说明 |
|---|---|
| 路径 | `GET /api/dashboard/summary` |
| 权限 | `dashboard:view` |

**出参 data（全部为 long 计数）**

| 字段 | 说明 |
|---|---|
| certTotal | 证书总数 |
| certIssued | 已签发（ISSUED）证书数 |
| certExpiring | 30 天内到期的已签发证书数 |
| authTotal | 云服务授权总数 |
| serverTotal | Agent 服务器总数 |
| serverOnline | 在线（ONLINE）服务器数 |
| siteTotal | 已发现站点总数 |
| deployTotal | 部署任务总数 |
| deploySuccess | 部署成功任务数 |

## 3.2 最近任务日志

| 项 | 说明 |
|---|---|
| 路径 | `GET /api/dashboard/logs` |
| 权限 | `dashboard:view` |

**出参 data**：`task_log` 表最近 20 条的 Map 数组，**键为大写数据库列名**：

| 字段 | 类型 | 说明 |
|---|---|---|
| ID | long | 日志 ID |
| BIZTYPE | string | 业务类型（如 `DEPLOY`、`CERT`） |
| BIZID | long | 业务对象 ID |
| ACTION | string | 动作（如 `CREATE`、`UPDATE`、`ISSUE`） |
| MESSAGE | string | 日志内容 |
| LOGLEVEL | string | 级别，默认 `INFO` |
| CREATEDAT | string | 时间字符串 `yyyy-MM-dd HH:mm:ss` |

---

# 4. 云服务授权 `/api/cloud/auth`

云 DNS 自动验证所用的厂商凭证（AccessKey/SecretKey）。

## 4.1 授权列表

| 项 | 说明 |
|---|---|
| 路径 | `GET /api/cloud/auth/list` |
| 权限 | `auth:view` |

**出参 data**：CloudAuth 数组（SecretKey 已脱敏）：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | long | 授权 ID |
| name | string | 授权名称 |
| provider | string | DNS 厂商（小写），如 `aliyun` / `dnspod` / `cloudflare` |
| accesskey | string | AccessKey 明文 |
| secretkey | string | SecretKey **脱敏**，形如 `****ab12`（仅显示末 4 位） |
| status | string | 授权状态 |
| lasttesttime | number/null | 最近连通性测试时间，毫秒时间戳 |
| remark | string/null | 备注 |
| createdat | number | 创建时间，毫秒时间戳 |

## 4.2 新增/编辑授权

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/cloud/auth/save` |
| 权限 | `auth:save` |

**入参**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | long | 编辑时必填 | 有值=更新，无值=新建 |
| name | string | 是 | 授权名称 |
| provider | string | 是 | DNS 厂商，后端统一转小写 |
| accessKey | string | 是 | AccessKey（注意大小写） |
| secretKey | string | 是 | SecretKey（注意大小写） |

**出参**：新建返回 `data=新ID`，`message="保存成功"`；更新返回 `data=id`，`message="更新成功"`。
错误：`400` 授权名称、厂商、AccessKey、SecretKey 均不能为空。

## 4.3 测试连通性

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/cloud/auth/test` |
| 权限 | `auth:test` |

**入参**：`{ "id": 1 }`（必填）。
**出参**：`data` 为测试结果描述字符串（如账户信息/错误原因）。失败时 `message` 为异常信息。

## 4.4 删除授权

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/cloud/auth/delete` |
| 权限 | `auth:delete` |

**入参**：`{ "id": 1 }`（必填）。**出参**：`data=id`；证书不存在时 `404`。

---

# 5. 证书管理 `/api/cert`

## 5.1 证书简单列表（不分页）

| 项 | 说明 |
|---|---|
| 路径 | `GET /api/cert/list?keyword=` |
| 权限 | `cert:view` |

**入参（Query）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| keyword | string | 否 | 模糊匹配名称/域名/备注 |

**出参**：Certificate 数组（字段见 5.3），按 ID 倒序，全量返回。主要用于下拉选择场景。

## 5.2 证书分页列表

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/cert/page` |
| 权限 | `cert:view` |

**入参**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| page | int | 否 | 1 | 页码 |
| size | int | 否 | 10 | 每页条数，**最大 100** |
| keyword | string | 否 | - | 模糊匹配名称/域名/备注 |
| brand | string | 否 | - | 签发机构精确匹配：`INTERNAL`/`LETSENCRYPT`/`ZEROSSL`/`GOOGLE`/`LITESSL`/`UPLOAD` |
| status | string | 否 | - | `ISSUED`/`WAIT_DNS`/`FAILED` |
| expiry | string | 否 | - | 到期筛选：`EXPIRED`（已过期）/ `MONTH`（30 天内到期）/ `QUARTER`（90 天内到期） |

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| total | int | 总记录数 |
| page | int | 当前页 |
| size | int | 每页条数 |
| rows | Certificate[] | 证书列表，字段见 5.3 |

## 5.3 Certificate 实体字段（列表/详情/申请等接口通用）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | long | 证书 ID |
| name | string | 证书名称（网站中文名） |
| domains | string | 域名集合，**JSON 数组字符串**，需 `JSON.parse` |
| keytype | string | 密钥类型：`RSA` / `ECC` |
| brand | string | 签发机构：`INTERNAL` / `LETSENCRYPT` / `ZEROSSL` / `GOOGLE` / `LITESSL` / `UPLOAD` |
| validation | string | 验证方式：`AUTO` / `MANUAL_DNS` / `CLOUD_DNS` |
| cloudauthid | long/null | 云 DNS 授权 ID |
| status | string | `ISSUED`（已签发）/ `WAIT_DNS`（等待DNS验证）/ `FAILED`（失败）/ `PENDING`（处理中） |
| notbefore | number/null | 生效时间，毫秒时间戳 |
| notafter | number/null | 到期时间，毫秒时间戳（前端计算剩余天数着色） |
| fingerprint | string/null | 证书指纹 |
| serialno | string/null | 序列号 |
| certpath | string/null | 服务端存储路径（内部使用） |
| acmeorderurl | string/null | ACME 订单 URL |
| acmeaccounturl | string/null | ACME 账户 URL |
| version | int | 当前版本号（续期/重传自增） |
| renewcount | int | 续期次数 |
| remark | string/null | 备注 |
| orgName | string/null | 组织 (O)，内置 CA 自定义 |
| orgUnit | string/null | 组织单位 (OU)，内置 CA 自定义 |
| project | string/null | 资产归属：项目 |
| env | string/null | 资产归属：环境 |
| owner | string/null | 资产归属：负责人 |
| createdat | number | 创建时间，毫秒时间戳 |
| updatedat | number/null | 更新时间，毫秒时间戳 |

> `dnsrecords` 默认序列化为字符串；仅在 `apply`/`detail`/`retry` 接口中被替换为 **对象**（结构见 5.6）。

## 5.4 申请证书

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/cert/apply` |
| 权限 | `cert:apply` |
| 审计 | action=`APPLY` |

**入参**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| domains | string[] | 是 | 域名数组，支持通配符 `*.example.com` |
| name | string | 否 | 证书名称 |
| keyType | string | 否 | `RSA` / `ECC` |
| brand | string | 是 | `INTERNAL`（内置CA）/ `LETSENCRYPT` / `ZEROSSL` / `GOOGLE` / `LITESSL` |
| validation | string | 是 | `AUTO` / `MANUAL_DNS` / `CLOUD_DNS` |
| cloudAuthId | long | validation=CLOUD_DNS 时必填 | 云 DNS 授权 ID |
| mainDomain | string | 否 | 主域名 |
| remark | string | 否 | 备注 |
| orgName | string | 否 | 组织（内置 CA 自定义） |
| orgUnit | string | 否 | 组织单位（内置 CA 自定义） |

**出参 data**：Certificate 实体。当 `status=WAIT_DNS` 时额外携带 `dnsrecords` 对象：

| dnsrecords 字段 | 说明 |
|---|---|
| orderUrl / finalizeUrl / accountUrl | ACME 会话 URL（内部恢复用） |
| challenges | 数组，每域名一项 |

challenges 元素：

| 字段 | 说明 |
|---|---|
| domain | 域名 |
| recordName | 需配置的 TXT 主机记录名 |
| txtValue | 需配置的 TXT 记录值 |
| authzUrl / challengeUrl | ACME 授权/挑战 URL（内部用） |

**message**：`证书签发成功`（自动验证通过）或 `订单已创建，请配置 DNS 记录`。

## 5.5 证书详情

| 项 | 说明 |
|---|---|
| 路径 | `GET /api/cert/detail?id=` |
| 权限 | `cert:view` |

**入参（Query）**：`id`（long，必填）。
**出参**：Certificate 全字段 + `dnsrecords` 对象（含 TXT 记录，供 DNS 配置引导展示）。
**注意**：与 `assetDetail` 不同，本接口**未剥离 dnsrecords**。

## 5.6 DNS 状态检查

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/cert/checkDns` |
| 权限 | `cert:verify` |
| 审计 | action=`CHECK_DNS` |

**入参**：`{ "id": 12 }`（必填）。

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| certId | long | 证书 ID |
| status | string | 证书状态 |
| challenges | array | 每域名一条：`domain`、`recordName`、`txtValue`、`valid`（boolean，TXT 是否已生效） |
| allValid | boolean | 是否全部域名验证通过 |

## 5.7 手动 DNS 验证并签发

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/cert/verifyDns` |
| 权限 | `cert:verify` |
| 审计 | action=`VERIFY_DNS` |

**入参**：`{ "id": 12 }`。**出参**：`data` = Certificate 实体，`message="签发成功"`；验证未生效/ACME 校验失败时返回错误 message（直接展示）。

## 5.8 重试申请

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/cert/retry` |
| 权限 | `cert:verify` |
| 审计 | action=`RETRY` |

**入参**：`{ "id": 12 }`。**出参**：Certificate + dnsrecords（WAIT_DNS 时），message 同 5.4。用于 FAILED 证书重新发起申请。

## 5.9 手动续期

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/cert/renew` |
| 权限 | `cert:renew` |
| 审计 | action=`RENEW` |

**入参**：`{ "id": 12 }`。**出参**：`data` = Certificate（版本号已 +1），`message="续期成功"`。

## 5.10 上传证书（PEM / PFX）

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/cert/upload` |
| 权限 | `cert:upload` |
| 审计 | action=`UPLOAD`（新建）/ `REUPLOAD`（更新） |

**入参**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | long | 否 | 有值=覆盖更新已有证书，无值=新建 |
| name | string | 新建时必填 | 证书名称 |
| remark | string | 否 | 备注 |
| cert | string | PEM 模式 | 证书 PEM 文本（BEGIN CERTIFICATE） |
| key | string | PEM 模式 | 私钥 PEM 文本，后端自动做证书-私钥配对校验 |
| chain | string | 否 | 中间证书链 PEM（可选） |
| pfx | string | PFX 模式 | PFX/P12 文件 base64 |
| pfxPassword | string | PFX 模式 | PFX 解压密码 |

> PEM 与 PFX 二选一；后端自动提取域名与有效期。

**出参**：`data` = Certificate 实体。失败时 message 为具体原因（如私钥不匹配、无法解析）。

## 5.11 删除证书

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/cert/delete` |
| 权限 | `cert:delete` |
| 审计 | action=`DELETE` |

**入参**：`{ "id": 12 }`。**出参**：`data=id`；同时级联删除关联部署任务；`404` 证书不存在。

## 5.12 下载证书文件

| 项 | 说明 |
|---|---|
| 路径 | `GET /api/cert/download?id=&type=&password=&token=` |
| 权限 | `cert:download`（`token` 通过查询参数传递，浏览器直链下载） |
| 响应 | 文件流（zip / pfx / pem / crt），非 JSON |

**入参（Query）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | long | 是 | 证书 ID |
| type | string | 是 | 见下表 |
| password | string | 否 | 仅 `pfx`/`tomcat`/`iis`/`jks` 使用，自定义密码 |
| token | string | 是 | 会话 token |

**type 枚举**

| 值 | 返回内容 |
|---|---|
| nginx | zip：`server.pem`（fullchain）+ `server.key` |
| apache | zip：`server.crt` + `ca_bundle.crt` + `server.key` |
| tomcat | PFX 文件（自定义密码） |
| iis | PFX 文件（自定义密码） |
| jks | JKS 文件 |
| root | 内置根 CA 证书 `root-ca.crt` |
| pfx | PFX 文件（自定义密码） |
| zip | 全量：cert/chain/fullchain/privkey 四个 pem |
| fullchain | fullchain.pem（默认） |
| cert | cert.pem |
| privkey | privkey.pem |
| chain | chain.pem |

**错误**：HTTP 401（未登录）/ 403（无权限）/ 404（证书或文件不存在），前端用 blob 模式时按 `resp.ok` 判断。

## 5.13 资产分页列表 / 5.14 资产详情 / 5.15 资产归属编辑

证书资产中心三个接口（`POST /api/cert/assets`、`GET /api/cert/assetDetail`、`POST /api/cert/assetSave`）的完整字段说明见 **[asset-center-api.md](asset-center-api.md)**，此处不再重复。

---

# 6. 自动部署 `/api/deploy`

## 6.1 部署任务列表

| 项 | 说明 |
|---|---|
| 路径 | `GET /api/deploy/list` |
| 权限 | `deploy:view` |

**出参**：DeployTask 数组（按 ID 倒序）：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | long | 任务 ID |
| name | string | 任务名称 |
| certid | long | 证书 ID |
| serverid | long | 目标服务器 ID |
| targetpath | string | 部署目标目录，默认 `/etc/sslauto/certs` |
| reloadcmd | string | 预定义动作：`reload_nginx` / `restart_nginx` / `stop_nginx` / `start_nginx` / `none` |
| status | string | `PENDING`（待部署）/ `SUCCESS`（成功）/ `FAILED`（失败） |
| deployedversion | int | 已部署的证书版本号（失败时不更新，等待下次心跳重试） |
| lastdeploytime | number/null | 最近部署时间，毫秒时间戳 |
| lastmessage | string/null | 最近部署结果消息 |
| createdat | number | 创建时间，毫秒时间戳 |

## 6.2 新增/编辑部署任务

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/deploy/save` |
| 权限 | `deploy:save` |
| 审计 | action=`CREATE` / `UPDATE` |

**入参**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | long | 编辑时必填 | 有值=更新 |
| name | string | 是 | 任务名称 |
| certId | long | 是 | 证书 ID |
| serverId | long | 是 | 目标服务器 ID |
| targetPath | string | 否 | 部署目录，默认 `/etc/sslauto/certs` |
| reloadCmd | string | 否 | 预定义动作，默认 `reload_nginx`；仅接受 `reload_nginx`/`restart_nginx`/`stop_nginx`/`start_nginx`/`none` |

**出参**：新建返回 `data=新任务ID`，`message="创建成功"`；更新返回 `data=id`，`message="更新成功"`。
**业务规则**：编辑时修改证书/服务器/目标路径任一项，任务状态重置为 `PENDING` 且版本号清零，下次 Agent 心跳自动重新部署。

**错误**：`400` 任务名称、证书、目标服务器均不能为空；`404` 任务不存在。

## 6.3 删除部署任务

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/deploy/delete` |
| 权限 | `deploy:delete` |

**入参**：`{ "id": 1 }`。**出参**：`data=id`；`404` 任务不存在。

---

# 7. 服务器 Agent（UI 管理接口）`/api/agent`

## 7.1 服务器列表

| 项 | 说明 |
|---|---|
| 路径 | `GET /api/agent/servers` |
| 权限 | `agent:view` |

**出参**：AgentServer 数组：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | long | 服务器 ID |
| name | string | 服务器名称（注册令牌指定的名称） |
| hostname | string | 主机名（Agent 上报） |
| ip | string | IP 地址 |
| os | string | 操作系统（`LINUX` / `WINDOWS`） |
| agentversion | string | Agent 脚本版本，如 `2.5` |
| agentkey | string | Agent 通信密钥（内部凭证） |
| status | string | `ONLINE` / `OFFLINE`（按心跳判定） |
| lastheartbeat | number/null | 最近心跳时间，毫秒时间戳 |
| createdat | number | 注册时间，毫秒时间戳 |

## 7.2 站点列表

| 项 | 说明 |
|---|---|
| 路径 | `GET /api/agent/sites?serverId=` |
| 权限 | `agent:view` |

**入参（Query）**：`serverId`（可选，不传返回全部服务器站点）。

**出参**：AgentSite 数组：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | long | 站点 ID |
| serverid | long | 所属服务器 ID |
| name | string | 站点名称（配置文件名/站点标识） |
| domains | string | 域名（Agent 上报原文） |
| webserver | string | Web 服务类型（`nginx` / `IIS` 等） |
| configpath | string | 配置文件路径（IIS 站点为 `IIS:` 前缀的标识） |
| certpath | string | 站点当前证书路径 |
| takenover | int | 是否已接管：`0` 未接管 / `1` 已接管 |
| updatedat | number/null | 最近扫描上报时间，毫秒时间戳 |

## 7.3 删除服务器

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/agent/deleteServer` |
| 权限 | `agent:delete` |
| 审计 | action=`DELETE_SERVER` |

**入参**：`{ "id": 2 }`。**出参**：`data=id`；级联删除该服务器的站点与部署任务；`404` 服务器不存在。

## 7.4 生成注册令牌（含一键安装命令）

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/agent/createToken` |
| 权限 | `agent:token` |
| 审计 | action=`CREATE_TOKEN` |

**入参**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| serverName | string | 否 | 预命名服务器（Agent 注册时采用） |
| os | string | 否 | `WINDOWS`（不区分大小写）时返回 PowerShell 安装命令，否则返回 Linux curl 命令 |

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| token | string | 注册令牌（一次性，Agent 注册时消费） |
| expiresAt | number/null | 令牌过期时间，毫秒时间戳 |
| command | string | 一键安装命令。Windows：PowerShell 多级下载回退 + 执行 `install.ps1`；Linux：`curl -fsSL {server}/api/agent/install.sh | sudo bash -s <token>` |

## 7.5 接管站点

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/agent/takeoverSite` |
| 权限 | `agent:takeover` |
| 审计 | action=`TAKEOVER_SITE` |

**入参**：`{ "siteId": 8 }`（必填）。**出参**：`message="已接管"`；`404` 站点不存在。接管后该站点纳入自动部署范围。

## 7.6 读取站点配置

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/agent/config/read` |
| 权限 | `agent:config` |
| 审计 | action=`READ_CONFIG` |

**入参**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| siteId | long | 二选一 | 站点 ID，后端自动换算 serverId 与 configpath |
| serverId | long | 二选一 | 服务器 ID（siteId 未传时必填） |
| path | string | 二选一 | 配置文件绝对路径（siteId 未传时必填） |

**出参**：`data` = 作业 ID（long），前端轮询 `GET /api/agent/job?id=` 获取配置内容。

**错误**：`404` 站点不存在；`400` serverId 与 path 不能为空 / IIS 站点暂不支持在线读写配置 / Agent 版本低于 2.2（message 提示升级）。

## 7.7 写入站点配置

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/agent/config/write` |
| 权限 | `agent:config` |
| 审计 | action=`WRITE_CONFIG` |

**入参**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| siteId | long | 二选一 | 站点 ID（path 不传时用站点默认配置路径） |
| serverId | long | 二选一 | 服务器 ID |
| path | string | 二选一 | 配置文件路径（仅允许 Nginx 配置目录内的 `.conf` 文件） |
| content | string | 是 | 配置文件全文（后端 base64 编码后下发） |
| reload | boolean | 否 | 默认 `true`，写完后执行 `reload_nginx`；`false` 则不重载 |

**出参**：`data` = 作业 ID，`message="保存任务已创建"`。
**业务规则**：Agent 端写前自动备份原配置，写入后执行 `nginx -t` 校验，校验失败回滚并报错。
**错误**：同 7.6，另加 `400` 配置内容不能为空。

## 7.8 手动扫描站点

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/agent/scanSites` |
| 权限 | `agent:view` |
| 审计 | action=`SCAN_SITES` |

**入参**：`{ "serverId": 2 }`（必填）。**出参**：`data` = 作业 ID，`message="扫描任务已创建"`。Agent 收到后立即扫描 Nginx/IIS 站点并上报（正常上报周期为 10 分钟）。

## 7.9 站点服务操作

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/agent/siteAction` |
| 权限 | `agent:action` |
| 审计 | action=`SITE_ACTION` |

**入参**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| siteId | long | 二选一 | 站点 ID（后端换算 serverId） |
| serverId | long | 二选一 | 服务器 ID |
| action | string | 是 | `reload`/`reload_nginx`、`restart`/`restart_nginx`、`stop`/`stop_nginx`、`start`/`start_nginx`（兼容两种写法，其余拒绝） |

> **作用域提示**：Nginx 操作对目标服务器上**全部站点**生效，前端按钮需置于服务器级菜单并二次确认。

**出参**：`data` = 作业 ID，`message="操作任务已创建"`。
**错误**：`400` 不支持的动作 / IIS 站点暂不支持该操作 / Agent 版本过低；`404` 站点或服务器不存在。

## 7.10 查询作业结果

| 项 | 说明 |
|---|---|
| 路径 | `GET /api/agent/job?id=` |
| 权限 | `agent:view` |

**入参（Query）**：`id`（long，必填，来自 7.6/7.7/7.8/7.9 的返回值）。

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | long | 作业 ID |
| type | string | `READ_CONFIG` / `WRITE_CONFIG` / `SITE_ACTION` / `SCAN_SITES` |
| path | string/null | 目标文件路径 |
| action | string | 执行动作 |
| status | string | `PENDING`（待领取）/ `PROCESSING`（执行中）/ `SUCCESS` / `FAILED`。前端轮询直到非 PENDING/PROCESSING |
| message | string/null | 执行结果消息（失败原因） |
| content | string | **仅** READ_CONFIG 且 SUCCESS 时返回：解码后的配置文件原文 |

**错误**：`400` id 不能为空；`404` 作业不存在。作业超过 5 分钟无响应视为超时失败。

---

# 8. Agent 协议接口（供 Agent 脚本调用，前端无需对接）

> 无用户会话；除 `register` 用注册令牌外，其余均需 `serverId + agentKey` 认证（无效返回 `401`）。列出仅供联调排查参考。

| 路径 | 方法 | 入参（JSON，除标注外） | 出参 data |
|---|---|---|---|
| `/api/agent/register` | POST | `token`、`hostname`、`ip`、`os`、`version` | `{serverId, agentKey}` |
| `/api/agent/heartbeat` | POST | `serverId`、`agentKey`、`version` | `"pong"`（心跳 60s 一次） |
| `/api/agent/reportSites` | POST | `serverId`、`agentKey`、`sites: [{name, domains, webserver, configpath, certpath}]` | 上报站点数（int） |
| `/api/agent/tasks` | POST | `serverId`、`agentKey` | 待部署任务数组：`[{taskId, taskName, certId, certVersion, domains[], targetPath, reloadCmd}]`（仅 certVersion > 已部署版本的任务） |
| `/api/agent/deployResult` | POST | `serverId`、`agentKey`、`taskId`、`success`、`message`、`certVersion` | `"ok"`（仅 success=true 才更新已部署版本号） |
| `/api/agent/jobs` | POST | `serverId`、`agentKey`、`version` | 作业数组：`[{jobId, type, path, action, content}]`（content 为 base64） |
| `/api/agent/jobResult` | POST | `serverId`、`agentKey`、`jobId`、`success`、`message`、`content`（READ 结果 base64） | `"ok"` |

**文件下载（Agent 用，GET）**：

| 路径 | 入参（Query） | 响应 |
|---|---|---|
| `/api/agent/certPackage` | `serverId`、`agentKey`、`certId` | zip（fullchain/privkey/cert/chain.pem） |
| `/api/agent/certFiles` | 同上 | JSON `data: {"fullchain.pem": "base64...", ...}`（供 PowerShell 2.0 使用） |

**脚本下载（无认证，GET）**：

| 路径 | 说明 |
|---|---|
| `/api/agent/install.sh` | Linux 一键安装脚本（text/plain） |
| `/api/agent/agent.sh` | Linux Agent 主循环脚本 |
| `/api/agent/install.ps1` | Windows PowerShell 安装脚本 |
| `/api/agent/installBat` | Windows 批处理安装脚本（`Content-Disposition: attachment; filename=sslauto-install.bat`，浏览器下载保存为 .bat） |
| `/api/agent/agent.ps1` | Windows Agent 主循环脚本 |

---

# 9. 系统管理 `/api/system`

## 9.1 用户列表

| 项 | 说明 |
|---|---|
| 路径 | `GET /api/system/users?keyword=` |
| 权限 | `system:user` |

**入参（Query）**：`keyword`（可选，模糊匹配用户名/昵称）。

**出参**：Map 数组（**不包含密码字段**）：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | long | 用户 ID |
| username | string | 登录名 |
| nickname | string | 显示名 |
| roleid | long/null | 角色 ID |
| roleName | string | 角色名称（无角色时为空字符串） |
| status | string | `ACTIVE`（启用）/ `DISABLED`（禁用） |
| createdat | number | 创建时间，毫秒时间戳 |
| updatedat | number/null | 更新时间，毫秒时间戳 |

## 9.2 新建/编辑用户

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/system/user/save` |
| 权限 | `system:user` |
| 审计 | action=`USER_CREATE` / `USER_UPDATE` |

**入参**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | long | 编辑时必填 | 有值=更新（更新时忽略 username/password） |
| username | string | 新建时必填 | 登录名 |
| password | string | 新建时必填 | 初始密码 |
| nickname | string | 否 | 显示名 |
| roleid | long | 是 | 角色 ID，未传返回 `400 请选择角色` |
| status | string | 否 | `ACTIVE` / `DISABLED`，默认 `ACTIVE` |

**出参**：`message="用户创建成功"` / `"用户已更新"`。
**业务规则**：超级管理员角色（code=`super`）的用户不可被禁用。

## 9.3 删除用户

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/system/user/delete` |
| 权限 | `system:user` |
| 审计 | action=`USER_DELETE` |

**入参**：`{ "id": 3 }`。**出参**：`message="用户已删除"`；不能删除自己（message 提示）；不存在返回 404 语义。

## 9.4 重置用户密码

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/system/user/resetPassword` |
| 权限 | `system:user` |
| 审计 | action=`USER_RESET_PASSWORD` |

**入参**：`{ "id": 3, "password": "newpass" }`（新密码最少 6 位，否则 `400`）。**出参**：`message="密码已重置"`。

## 9.5 角色列表

| 项 | 说明 |
|---|---|
| 路径 | `GET /api/system/roles` |
| 权限 | `system:role` **或** `system:user`（任一即可，供用户表单的角色下拉） |

**出参**：SysRole 数组：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | long | 角色 ID |
| code | string | 角色编码（`super` 为超管，全权限） |
| name | string | 角色名称 |
| description | string/null | 描述 |
| permissions | string/null | 权限键逗号分隔串，如 `"cert:view,cert:apply"` |
| createdat | number | 创建时间，毫秒时间戳 |

## 9.6 保存角色

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/system/role/save` |
| 权限 | `system:role` |
| 审计 | action=`ROLE_SAVE` |

**入参**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | long | 编辑时必填 | 有值=更新 |
| code | string | 是 | 角色编码 |
| name | string | 是 | 角色名称 |
| description | string | 否 | 描述 |
| permissions | string[] | 否 | 权限键数组，后端拼接为逗号分隔串存储 |

**出参**：`message="角色已保存"`。

## 9.7 删除角色

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/system/role/delete` |
| 权限 | `system:role` |
| 审计 | action=`ROLE_DELETE` |

**入参**：`{ "id": 3 }`。**出参**：`message="角色已删除"`；角色下仍有用户时返回错误 message。

## 9.8 权限目录

| 项 | 说明 |
|---|---|
| 路径 | `GET /api/system/permissions` |
| 权限 | `system:role` |

**出参**：按模块分组的数组，供角色编辑页的权限勾选树：

| 字段 | 类型 | 说明 |
|---|---|---|
| module | string | 模块键（`dashboard`/`auth`/`cert`/`deploy`/`agent`/`system`） |
| label | string | 模块中文名 |
| items | array | 该模块下权限项：`{key, label}`，key 即权限键 |

## 9.9 操作日志分页

| 项 | 说明 |
|---|---|
| 路径 | `POST /api/system/logs` |
| 权限 | `system:log` |

**入参**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| page | int | 否 | 1 | 页码 |
| size | int | 否 | 20 | 每页条数，**最大 100** |
| module | string | 否 | - | 模块精确匹配：`auth`/`cert`/`deploy`/`agent`/`system`/`dashboard` |
| username | string | 否 | - | 操作人模糊匹配 |
| result | string | 否 | - | `SUCCESS` / `FAIL` |
| keyword | string | 否 | - | 模糊匹配对象/详情/消息 |
| start | string | 否 | - | 开始时间：`yyyy-MM-dd` 或 `yyyy-MM-dd HH:mm:ss` |
| end | string | 否 | - | 结束时间，格式同上 |

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| total | int | 总数 |
| page | int | 当前页 |
| size | int | 每页条数 |
| rows | SysLogger[] | 日志列表（按 ID 倒序），字段见下 |

**SysLogger 字段**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | long | 日志 ID |
| userid | long/null | 操作人 ID |
| username | string | 操作人用户名 |
| role | string/null | 操作人角色 |
| module | string | 模块键 |
| action | string | 动作（如 `APPLY`、`RENEW`、`LOGIN`、`ASSET_SAVE`） |
| method | string | HTTP 方法 |
| target | string | 操作对象 |
| detail | string/null | 详情描述 |
| ip | string | 客户端 IP（优先取 X-Forwarded-For） |
| result | string | `SUCCESS` / `FAIL` |
| message | string/null | 结果消息 |
| costms | long | 耗时（毫秒） |
| createdat | number | 操作时间，毫秒时间戳 |

---

# 10. 前端对接注意事项汇总

1. ** domains 是 JSON 字符串**：Certificate、AgentSite 的 `domains` 需 `JSON.parse` 后使用。
2. **键名大小写**：实体/Service 返回为小写驼峰；`queryMaps` 原生 SQL 结果（dashboard/logs、assetDetail 的 deploys/operations）为**大写数据库列名**。
3. **时间混合类型**：实体时间为毫秒时间戳；原生查询时间为字符串。统一格式化为 `YYYY-MM-DD HH:mm:ss`。
4. **作业类接口都是异步的**：`config/read`、`config/write`、`scanSites`、`siteAction` 只返回作业 ID，需轮询 `GET /api/agent/job?id=` 直至 `SUCCESS`/`FAILED`（建议 1~2 秒间隔，作业 5 分钟超时）。
5. **Agent 版本门槛**：配置读写与站点操作要求 Agent ≥ 2.2，手动扫描（SCAN_SITES）要求 ≥ 2.3（长轮询）；版本不足返回 `400` 且 message 含升级指引。
6. **下载接口**：认证走 `?token=` 查询参数而非 `X-Token` 头；返回文件流，错误为 HTTP 状态码而非 JSON。
7. **资产详情安全边界**：`assetDetail` 不含私钥与 `dnsrecords`；需要 TXT 记录展示时改用 `GET /api/cert/detail`。
