# azy4dsh

爱职业（[azy.ohhub.net](https://azy.ohhub.net)）的 DeepSeek Harness Desktop 插件，
包名 `dsh-aizhiye`。在左侧栏加一条「爱职业」，点开后不跳远端登录页，而是在插件
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
| 会话 Cookie | `~/.dsh/storages/aizhiye-entry/state.json` | 只是会话；退出登录即清空 |
| 算力密钥 | harness 凭据存储（`ctx.credentials`，退回 `~/.dsh/.credentials.yaml` 的 `refs`） | 引用名 `AIZHIYE_KEY`；页面上只显示首尾各四位 |
| provider 路由 | `~/.dsh/profiles/<profile>/cordis.patch.yml` 的 `llm-pi-ai.config.providers.aizhiye` | 只写 `apiKeyEnv: AIZHIYE_KEY`，不写密钥 |

第三点不是洁癖：`dsh-llm-pi-ai` 的约定是「配置文件绝不包含密钥」，密钥按请求经
凭据 seam 解析。所以插件写配置时永远只写引用名——密钥本身进了凭据存储，改一次
密钥不用改配置。

## 实现分工

| 文件 | 职责 |
| --- | --- |
| `index.js` | host 半边：`/aizhiye-entry-api/*` 四个接口——读状态、登录、配置、退出 |
| `lib/yaml-edit.js` | 两段行级改写的纯函数（写 `refs`、写 `providers`），单独成文件以便脱离运行时测试 |
| `client.js` | 浏览器半边：`sidebar.panellist` 一行 + `main` 页面（登录表单、额度、配置按钮） |
| `cordis.patch.yml` | 按包名挂一行 host 模块（`id: aizhiye-entry`） |
| `test/yaml-edit.test.mjs` | 12 条回归：别的 provider/注释不被吃掉、`refs: {}` 被正确展开、重复执行等价 |

算力接口按角色分流：教师走 `/api/v1/compute/tokens`，学员走
`/api/v1/learner/compute/tokens`，两侧 handler 各自校验 role，走错门只会得到
403 `Permission denied`。字段与 reveal 语义相同（reveal 共用同一个 handler，按当前
会话用户取自己的 token），所以差别只在路径前缀——见 `index.js` 的 `computeEndpoints`。

路径之外还有一层归属：教师接口按 `teacher_id` 取数，返回的列表里混着
`kind='teacher'`（他自己那把）和 `kind='student'`（他分配给学生、密钥归学生的那些）。
后者不是给教师用的——reveal 按 `learner_id` 校验，取只会失败，所以只保留
`kind='teacher'`，与页面上「我的Token密钥」页签同一口径（`pickOwnTokens`）。

为什么登录必须走 host：浏览器里直接打 `azy.ohhub.net` 会被 CORS 与 SameSite 拦，
而且取回的密钥不该在页面里出现第二遍。host 用 Node `fetch` 直连，Cookie 自己管。

## 装到一台新的 DSH

### 前置

| 项 | 要求 | 怎么确认 |
| --- | --- | --- |
| DSH 版本 | `0.2.x`（`package.json` 声明 `>=0.2.0-rc.1 <0.3.0-0`） | 应用「关于」；实测 0.2.2-rc.5 |
| profile 目录 | 至少启动过一次 DSH，才会有 `~/.dsh/profiles/desktop` | `ls ~/.dsh/profiles/desktop` |
| 模型插件项 | profile 的 `cordis.patch.yml` 里有 `@deepseek-ai/dsh-llm-pi-ai` | `grep dsh-llm-pi-ai ~/.dsh/profiles/desktop/cordis.patch.yml` |

最后一项是硬条件：配置写入的是 `llm-pi-ai` 的 `providers` 段，缺这一项会在点
「配置到 Harness」时报「补丁文件里没有 llm-pi-ai 项」。官方 base bundle 自带，只有
被手工精简过的 profile 才会缺。

### 三步

**1. 取代码**

```bash
git clone git@github.com:OraSight/aizhiye-dsh.git ~/aizhiye-dsh
```

没有这台机器的 SSH key 时，从能访问的机器整目录拷过去也行——插件没有构建步骤，
`index.js` / `client.js` 就是可运行的源文件。

**2. 放进 profile 的 `node_modules`**

目录名必须是 `dsh-aizhiye`：加载器拿 `cordis.patch.yml` 里的 `name` 当模块说明符，
从 profile 的 `node_modules` 解析，写错就是 `ERR_MODULE_NOT_FOUND`。

推荐做成目录联结 / 软链，以后 `git pull` 直接生效：

```powershell
# Windows：junction 不需要管理员权限（符号链接才需要）
New-Item -ItemType Junction -Path "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-aizhiye" -Target "$env:USERPROFILE\aizhiye-dsh"
```

```bash
# macOS / Linux
ln -s ~/aizhiye-dsh ~/.dsh/profiles/desktop/node_modules/dsh-aizhiye
```

不想留链接也可以整目录复制，代价是每次更新都要重新复制一次。

**3. 在 profile 清单里登记**

编辑 `~/.dsh/profiles/desktop/package.json`，两处各加一项：

```json
{
  "dependencies": { "dsh-aizhiye": "file:D:/Users/you/aizhiye-dsh" },
  "dsh": { "profile": { "bundles": ["...", "dsh-aizhiye"] } }
}
```

`dependencies` 记包的来源，`dsh.profile.bundles` 才是「启动时加载它」的开关——两处都要有。
前者若与第 2 步的实际路径不一致，将来跑一次 `npm install` 会把 `node_modules` 里那份
换成旧路径的内容。

然后**完全退出 DSH 再启动**（托盘图标也要退，只关窗口不算）。模块在应用启动时加载，
热重载不覆盖 host 半边。

### 装好后的验收

1. 左侧栏出现「爱职业」（彩色魔方图标）；
2. 点开是插件自己的登录表单，不是远端登录页；
3. 用教师或学员账号登录，能看到姓名、学校、以及**自己名下**的算力额度；
4. 点「配置到 Harness」，出现「已配置 N 个模型 · 密钥 XXXX••••XXXX」；
5. 「设置 → 模型」里出现「爱职业（算力）」分组，选一个模型能正常对话。

### 没装上时查什么

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 左栏没有「爱职业」 | `bundles` 没加，或目录名不是 `dsh-aizhiye` | 对照清单逐项核对，重启 |
| 启动报 `ERR_MODULE_NOT_FOUND: dsh-aizhiye` | `cordis.patch.yml` 的 `name` 与目录名不一致 | 包名、目录名、patch 的 `name` 必须一致 |
| 点开是一块空白 | 浏览器半边没加载（`dsh.client` 声明缺失） | 用仓库原样的 `package.json`，别删 `dsh.client` |
| 登录报「连不上 azy.ohhub.net」 | 网络或代理拦截 | 先用浏览器打开一次 azy 确认可达 |
| 提示「补丁文件里没有 llm-pi-ai 项」 | profile 缺模型插件 | 见上文前置条件 |
| 提示「角色不在算力白名单」 | 用的是平台管理员等非教师/学员账号 | 换教师或学员账号 |

启动日志在 `%APPDATA%\@deepseek-ai\dsh-desktop\logs`（macOS 在
`~/Library/Application Support/@deepseek-ai/dsh-desktop/logs`），插件加载失败会在这里留原始堆栈。

## 发布到 npm

发布之后，别人在 DSH 的「安装插件」里填 `dsh-aizhiye`、选对应安装源即可，不必手改
`node_modules` 与 profile 清单。

### 发布前清单

| 项 | 现状 | 说明 |
| --- | --- | --- |
| `private` | 已移除 | 官方类型定义写明它专门用来阻止发布，留着 `npm publish` 直接报错 |
| `name` / `version` | `dsh-aizhiye` / `0.2.0` | 公共 npm 上该名字未被占用（2026-11-23 查为 404） |
| `dsh.manifestVersion` | `1` | 清单格式标识，与包版本无关 |
| `dsh.bundle.patch` | `./cordis.patch.yml` | 加载器按它挂 host 模块 |
| `dsh.client` | `platform: web`、`immediately: true` | 没有它侧栏不会出现，点开是空白 |
| `engines.dsh` | `>=0.2.0-rc.1 <0.3.0-0` | 兼容范围写在这里；非官方字段 `dsh.compatibility` 已删 |
| `icon` | `icon.svg` | 清单可解析的包根图标，上限 256 KiB |
| `files` | 7 个文件、21 kB | `npm pack --dry-run` 可复核；`test/` 不随包发布 |

`dshhub` 段是照插件市场的示例元数据写的，本机 0.2.2 的读取方不看它；是否必需取决于
市场索引仓库的 schema，不影响安装。

### 发到公共 npm

```bash
npm login                      # 一次性
npm publish                    # 无 scope 的公共包，免费，无需 --access
git tag v0.2.0 && git push --tags
```

同名包已存在时 `publish` 会 403。改用 scope 需要同时改三处，且三处必须一字不差：
`package.json` 的 `name`、`cordis.patch.yml` 的 `name`、`node_modules` 下的目录名
（scoped 包是被装成 `node_modules/@你的scope/dsh-aizhiye`）。

### 发到私有源

私有源适合内网：包不进公共 npm，但安装体验一样。

```bash
# GitHub Packages（scope 必须是仓库所属 org）
npm login --registry=https://npm.pkg.github.com
npm publish --registry=https://npm.pkg.github.com

# Verdaccio / Nexus / 阿里云私有 npm 等，换成自建地址即可
npm publish --registry=https://npm.example.com/
```

长期项目建议把地址写进 `package.json`，免得每次带参数：

```json
"publishConfig": { "registry": "https://npm.example.com/" }
```

凭据不要进仓库。令牌放**本机** `~/.npmrc`（DSH 的提示原文也是这么说的）：

```
//npm.example.com/:_authToken=${NPM_TOKEN}
```

也可以直接写死令牌，但那样任何能读你家目录的进程都能拿到它。

### 在 DSH 里装

1. 打开插件管理 → 安装；
2. 包名填 `dsh-aizhiye`；
3. 安装源：公共包选「npm 官方源」或「中国大陆镜像源」；私有包选「自定义地址」并填
   `https://npm.example.com/`（需登录的源，凭据已在 `~/.npmrc`）；
4. 装完重启 DSH。

非官方插件**没有增量更新**：DSH 的提示原文是「其他插件请先卸载再安装新版」，所以发布
新版本后要在插件管理里卸载再装，不能指望它自己升。版本号按 SemVer 递增即可。

### 不发布也能装

安装框同样接受 Git 地址与本地路径。内部几个人用、不打算维护 registry 时，直接把仓库
地址或本地目录填进去更省事；代价是每台机器要能访问那个地址，且升级得重新装一次。

## 验证

```bash
# 配置改写与接口分工（不需要 DSH 在跑）
npm test

# 服务注入契约：凭据服务存在时走 service、缺失时退回文件。
# 需要真实账号，且会用临时 DSH_HOME，不碰你的真实配置，所以不在 npm test 里。
QA_STUDENT_PASSWORD=... node test/manual/inject-check.mjs --with-credentials
QA_STUDENT_PASSWORD=... node test/manual/inject-check.mjs --without-credentials
```

`inject-check` 把假 ctx 做成了「未声明的服务一读就抛」——这正是 Cordis 的真实行为。
早先版本的脚本直接放行 `ctx.credentials`，于是真实环境里点「配置到 Harness」才炸
`cannot get property "credentials" without inject`，而测试是绿的。

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
      aizhiye:
        displayName: 爱职业（算力）
        apiKeyEnv: AIZHIYE_KEY
        api: openai-completions
        baseURL: https://ohhub.net/v1
        defaultContextWindow: 131072
        defaultMaxTokens: 8192
        models:
          - id: deepseek-v4.1-flash
            name: deepseek-v4.1-flash
```

改写是幂等的：重复点「配置到 Harness」只替换 `aizhiye:` 这一段，别的 provider 与
文件里的注释一个字都不动。每次改动前会把原文件留一份 `cordis.patch.yml.aizhiye-bak`。

## 卸载与回滚

- 回滚配置：把 `cordis.patch.yml.aizhiye-bak` 复制回 `cordis.patch.yml`，或手工删掉
  `providers.aizhiye` 那一段。
- 移除密钥：删掉 `.credentials.yaml` 里 `refs.AIZHIYE_KEY` 那一行（文件热重载）。
- 移除插件：从 profile 的 `dependencies` 与 `dsh.profile.bundles` 里删掉
  `dsh-aizhiye`，再删 `node_modules/dsh-aizhiye`，重启应用。

## 已知边界

- 教师与学员各走一条接口（`/api/v1/compute/tokens` 与 `/api/v1/learner/compute/tokens`），
  按会话里的角色自动选；平台管理员角色不在这两条之内，会提示读不到。
- 密钥有效期以爱职业返回的 `expires_at` 为准；到期后重新点一次「配置到 Harness」
  即可换新密钥，不需要改配置。
- 一个 DSH profile 里只应装一份；同时装两份会抢同一个 `providers.aizhiye` 键。
- 企业网里若有反代或证书拦截导致直连失败，页面会显示具体错误（连不上哪台主机）。
