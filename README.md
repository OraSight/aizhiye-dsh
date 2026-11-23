# azy4dsh

爱职业（[azy.ohhub.net](https://azy.ohhub.net)）的 DeepSeek Harness Desktop 插件，
包名 `dsh-azy-entry`。在左侧栏加一条「爱职业」，点开后不跳远端登录页，而是在插件
自己的页面里完成三件事：

1. 用爱职业账号登录；
2. 读取这个账号名下的**算力密钥**（教师与学员都支持）；
3. 把密钥与一组指向 `https://ohhub.net/v1` 的模型写进本机 Harness，
   之后在「设置 → 模型」里就能直接选用。

图标取自 <https://azy.ohhub.net/logo.svg>，已转成 data URI 内联进 `client.js`，
`icon.svg` 是同一份原始文件的副本。

## 三个落点

| 数据 | 落到哪里 | 说明 |
| --- | --- | --- |
| 会话 Cookie | `~/.dsh/storages/azy-entry/state.json` | 只是会话；退出登录即清空 |
| 算力密钥 | harness 凭据存储（`ctx.credentials`，退回 `~/.dsh/.credentials.yaml` 的 `refs`） | 引用名 `ITEDU_AZY_KEY`；页面上只显示首尾各四位 |
| provider 路由 | `~/.dsh/profiles/<profile>/cordis.patch.yml` 的 `llm-pi-ai.config.providers.itedu` | 只写 `apiKeyEnv: ITEDU_AZY_KEY`，不写密钥 |

第三点不是洁癖：`dsh-llm-pi-ai` 的约定是「配置文件绝不包含密钥」，密钥按请求经
凭据 seam 解析。所以插件写配置时永远只写引用名——密钥本身进了凭据存储，改一次
密钥不用改配置。

## 实现分工

| 文件 | 职责 |
| --- | --- |
| `index.js` | host 半边：`/azy-entry-api/*` 四个接口——读状态、登录、配置、退出 |
| `lib/yaml-edit.js` | 两段行级改写的纯函数（写 `refs`、写 `providers`），单独成文件以便脱离运行时测试 |
| `client.js` | 浏览器半边：`sidebar.panellist` 一行 + `main` 页面（登录表单、额度、配置按钮） |
| `cordis.patch.yml` | 按包名挂一行 host 模块（`id: azy-entry`） |
| `test/yaml-edit.test.mjs` | 12 条回归：别的 provider/注释不被吃掉、`refs: {}` 被正确展开、重复执行等价 |

算力接口按角色分流：教师走 `/api/v1/compute/tokens`，学员走
`/api/v1/learner/compute/tokens`，两侧 handler 各自校验 role，走错门只会得到
403 `Permission denied`。字段与 reveal 语义相同（reveal 共用同一个 handler，按当前
会话用户取自己的 token），所以差别只在路径前缀——见 `index.js` 的 `computeEndpoints`。

为什么登录必须走 host：浏览器里直接打 `azy.ohhub.net` 会被 CORS 与 SameSite 拦，
而且取回的密钥不该在页面里出现第二遍。host 用 Node `fetch` 直连，Cookie 自己管。

## 装到本机 profile

profile 用**包名**解析模块，所以目录名必须叫 `dsh-azy-entry`（与 `package.json` 的
`name`、`cordis.patch.yml` 的 `name` 三处一致），写成别的名字会 `ERR_MODULE_NOT_FOUND`。

```bash
# 1) 放进 profile 的 node_modules
git clone git@github.com:OraSight/aizhiye-dsh.git \
  "$HOME/.dsh/profiles/desktop/node_modules/dsh-azy-entry"

# 2) profile 清单里登记（~/.dsh/profiles/desktop/package.json）
#    "dependencies": { ..., "dsh-azy-entry": "file:D:/coding/aizhiye-dsh" }
#    "dsh": { "profile": { "bundles": [ ..., "dsh-azy-entry" ] } }

# 3) 重启 DeepSeek Harness Desktop
```

本地开发时更省事：把 `node_modules/dsh-azy-entry` 做成指向上面的克隆目录的软链，
改完重启即可，不用反复复制。

## 验证

```bash
# 配置改写逻辑（不需要 DSH 在跑）
npm test
```

装好之后：

1. 左侧栏出现「爱职业」；
2. 点开是登录表单（不是远端登录页）；
3. 登录后看到学员姓名、学校、算力额度与有效期；
4. 点「配置到 Harness」，提示已写入的模型数与密钥掩码；
5. 到「设置 → 模型」选「爱职业（算力）」下的模型。若列表没出现，重启一次。

## 配置的形态

写入后 `cordis.patch.yml` 里是这样一段（模型按网关实际返回的清单生成）：

```yaml
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      itedu:
        displayName: 爱职业（算力）
        apiKeyEnv: ITEDU_AZY_KEY
        api: openai-completions
        baseURL: https://ohhub.net/v1
        defaultContextWindow: 131072
        defaultMaxTokens: 8192
        models:
          - id: deepseek-v4.1-flash
            name: deepseek-v4.1-flash
```

改写是幂等的：重复点「配置到 Harness」只替换 `itedu:` 这一段，别的 provider 与
文件里的注释一个字都不动。每次改动前会把原文件留一份 `cordis.patch.yml.azy-bak`。

## 卸载与回滚

- 回滚配置：把 `cordis.patch.yml.azy-bak` 复制回 `cordis.patch.yml`，或手工删掉
  `providers.itedu` 那一段。
- 移除密钥：删掉 `.credentials.yaml` 里 `refs.ITEDU_AZY_KEY` 那一行（文件热重载）。
- 移除插件：从 profile 的 `dependencies` 与 `dsh.profile.bundles` 里删掉
  `dsh-azy-entry`，再删 `node_modules/dsh-azy-entry`，重启应用。

## 已知边界

- 教师与学员各走一条接口（`/api/v1/compute/tokens` 与 `/api/v1/learner/compute/tokens`），
  按会话里的角色自动选；平台管理员角色不在这两条之内，会提示读不到。
- 密钥有效期以爱职业返回的 `expires_at` 为准；到期后重新点一次「配置到 Harness」
  即可换新密钥，不需要改配置。
- 一个 DSH profile 里只应装一份；同时装两份会抢同一个 `providers.itedu` 键。
- 企业网里若有反代或证书拦截导致直连失败，页面会显示具体错误（连不上哪台主机）。
