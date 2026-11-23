/**
 * 验证 host 半边的服务注入：`ctx.credentials` 必须先声明 inject 才能读。
 *
 * 背景（2026-11-23）：真实 DSH 里点「配置到 Harness」报
 * `cannot get property "credentials" without inject`，而当时的端到端脚本是通过的
 * ——因为假 ctx 直接放行 `ctx.credentials`（返回 undefined），从没复现 Cordis 的
 * 访问守卫。所以这里把假 ctx 做严：未声明的服务一读就抛同一句话。
 *
 * 两个场景各跑一个进程（模块级凭证引用会被覆盖，不能同进程切换）：
 *   --with-credentials     服务存在 → 应走 service 通道，且不写凭据文件
 *   --without-credentials  服务缺失 → 应退回写 credentials.yaml 的 refs 段
 *
 * 用的是真实链路（登录 azy → 取密钥 → 写 provider），但 DSH_HOME 指向临时目录，
 * 不会碰用户的真实配置；patch 模板从 `~/.dsh/profiles/desktop/cordis.patch.yml`
 * 复制（可用 DSH_REAL_HOME 改）。需要真实账号，所以不在 `npm test` 里，手动跑：
 *
 *   QA_STUDENT_PASSWORD=... node test/manual/inject-check.mjs --with-credentials
 *   QA_STUDENT_PASSWORD=... node test/manual/inject-check.mjs --without-credentials
 */
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

const PLUGIN = new URL('../../index.js', import.meta.url).href
const REAL_HOME = process.env.DSH_REAL_HOME || path.join(os.homedir(), '.dsh')
const SANDBOX = path.join(os.tmpdir(), 'azy-verify-home')
const MODE = process.argv.includes('--without-credentials') ? 'without' : 'with'
const USERNAME = process.env.QA_STUDENT_USER || 's3c01s001'
const PASSWORD = process.env.QA_STUDENT_PASSWORD || ''

if (!PASSWORD) {
  console.error('缺少 QA_STUDENT_PASSWORD')
  process.exit(2)
}

// ---------------------------------------------------------------- 沙箱

await fs.rm(SANDBOX, { recursive: true, force: true })
await fs.mkdir(path.join(SANDBOX, 'profiles', 'desktop'), { recursive: true })
await fs.mkdir(path.join(SANDBOX, 'storages', 'aizhiye-entry'), { recursive: true })
await fs.copyFile(
  path.join(REAL_HOME, 'profiles', 'desktop', 'cordis.patch.yml'),
  path.join(SANDBOX, 'profiles', 'desktop', 'cordis.patch.yml'),
)
// 预置改名前的旧引用名，用来验「配置一次就顺手清掉旧东西」。
await fs.writeFile(
  path.join(SANDBOX, '.credentials.yaml'),
  'version: 1\nrefs:\n  ITEDU_AZY_KEY: "legacy-value"\nrecords: {}\n',
  'utf8',
)
process.env.DSH_HOME = SANDBOX

// ---------------------------------------------------------------- 假 ctx

const calls = { credentialSets: [], injects: [] }

/**
 * 只把 `inject` 声明过的服务挂到 ctx 上；读别的属性一律抛 Cordis 的原话。
 * `inject(deps, cb)` 在依赖齐备时同步回调，回调拿到的是同样受限的子 ctx。
 */
function makeCtx(services) {
  return {
    inject(deps, callback) {
      calls.injects.push(deps.join(','))
      if (!deps.every(service => service in services)) return () => {}
      const child = makeCtx(Object.fromEntries(deps.filter(service => service in services).map(service => [service, services[service]])))
      callback(child)
      return () => {}
    },
    get service() {
      throw new Error('cannot get service without inject')
    },
    ...services,
  }
}

const credentialsService = {
  async set(ref, value) {
    calls.credentialSets.push({ ref, length: value.length })
  },
}

const services = {}
const listen = {}
const webServer = {
  register({ path: prefix, handler }) {
    listen.prefix = prefix
    listen.handler = handler
    return () => {}
  },
}
services.webServer = webServer
if (MODE === 'with') services.credentials = credentialsService

// 未声明的属性一读就抛——这是真实 Cordis 的行为，也是上一版脚本漏掉的那条。
function guarded(services) {
  return new Proxy(services, {
    get(target, key) {
      if (key in target) return target[key]
      if (key === 'inject') return undefined
      throw new Error(`cannot get property "${String(key)}" without inject`)
    },
  })
}

const plugin = await import(PLUGIN)
plugin.apply(guarded(makeCtx(services)))

if (!listen.handler) {
  console.error('FAILED: apply() 没有注册 handler')
  process.exit(1)
}

// ---------------------------------------------------------------- 起服务

const server = http.createServer((req, res) => {
  req.url = listen.prefix + (req.url === '/' ? '' : req.url)
  listen.handler(req, res)
})
await new Promise(resolve => server.listen(5599, '127.0.0.1', resolve))

async function post(route, body) {
  const response = await fetch(`http://127.0.0.1:5599${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  return { status: response.status, data: await response.json().catch(() => null) }
}

const login = await post('/login', { username: USERNAME, password: PASSWORD })
console.log('login:', login.status, login.data?.ok === true ? 'ok' : JSON.stringify(login.data))
if (login.status !== 200) process.exit(1)

const applied = await post('/apply', {})
console.log('apply:', applied.status, JSON.stringify({ ok: applied.data?.ok, sink: applied.data?.credentialSink, models: applied.data?.models?.length, masked: applied.data?.maskedKey, error: applied.data?.error }))

const patch = await fs.readFile(path.join(SANDBOX, 'profiles', 'desktop', 'cordis.patch.yml'), 'utf8')
const creds = await fs.readFile(path.join(SANDBOX, '.credentials.yaml'), 'utf8')
const hasProvider = /providers:\s*\n\s+aizhiye:/.test(patch) || patch.includes('aizhiye:')
const credsHasRef = creds.includes('AIZHIYE_KEY')
// 改名迁移的两条读数：旧 provider 段与旧引用名都不该留下。
const legacyProviderGone = !/^\s+itedu:$/m.test(patch)
const legacyRefGone = !creds.includes('ITEDU_AZY_KEY')

console.log('credentialSets:', calls.credentialSets.length, calls.credentialSets[0] ? `ref=${calls.credentialSets[0].ref} len=${calls.credentialSets[0].length}` : '')
console.log('injects:', calls.injects.join(' | '))
console.log('patch has aizhiye:', hasProvider, '| creds file has ref:', credsHasRef)
console.log('legacy provider gone:', legacyProviderGone, '| legacy ref gone:', legacyRefGone)
console.log('key leaked into patch:', applied.data?.maskedKey ? patch.includes(String(applied.data.maskedKey).replace(/•/g, '')) : 'n/a')

const expectSink = MODE === 'with' ? 'service' : 'file'
const ok = applied.status === 200
  && applied.data?.credentialSink === expectSink
  && hasProvider
  && legacyProviderGone
  && legacyRefGone
  && (MODE === 'with' ? !credsHasRef : credsHasRef)
  && (MODE === 'with' ? calls.credentialSets.length === 1 : calls.credentialSets.length === 0)

console.log(ok ? `PASS (${MODE} credentials)` : `FAIL (${MODE} credentials)`)
server.close()
await fs.rm(SANDBOX, { recursive: true, force: true })
process.exit(ok ? 0 : 1)
