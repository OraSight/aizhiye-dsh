/**
 * host 半边：代浏览器半边调用 ITEDU，并把结果落到本地配置。
 *
 * 为什么必须放在 host：浏览器里直接打 azy.ohhub.net 会被 CORS 与 Cookie
 * SameSite 拦（外壳的 origin 不是 azy），而且取回的算力密钥不该经过页面——它
 * 只在这里存活一次，随即写进 harness 凭据存储。
 *
 * 三个落点，各自的约束：
 *
 * 1. 会话 cookie → `~/.dsh/storages/azy-entry/state.json`。只是会话，不是密钥。
 * 2. 算力密钥 → harness 凭据存储（`ctx.credentials`，或文件
 *    `~/.dsh/.credentials.yaml` 的 `refs` 段）。配置文件里只出现引用名。
 * 3. provider 路由 → `~/.dsh/profiles/<profile>/cordis.patch.yml` 的
 *    `llm-pi-ai.config.providers.itedu`。按 README 的约定，路由只写
 *    `apiKeyEnv: ITEDU_AZY_KEY`，绝不写密钥本身。
 *
 * 配置写入幂等：重复执行只覆盖 `itedu` 这一段，别的 provider 与注释保持原样。
 */
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { upsertCredentialRef, upsertProviderConfig } from './lib/yaml-edit.js'

export const name = 'dsh-azy-entry'

const PREFIX = '/azy-entry-api'
const ORIGIN = 'https://azy.ohhub.net'
const GATEWAY = 'https://ohhub.net/v1'
const PROVIDER_ID = 'itedu'
const CREDENTIAL_REF = 'ITEDU_AZY_KEY'
const PROVIDER_LABEL = '爱职业（学生算力）'

/** 传给纯函数的一处集中声明，避免两边各写一份字面量。 */
const PROVIDER_SPEC = {
  id: PROVIDER_ID,
  label: PROVIDER_LABEL,
  credentialRef: CREDENTIAL_REF,
  baseURL: GATEWAY,
}

/** 只做图片生成的模型不进聊天路由，否则模型选择器里会多出必然报错的项。 */
function isChatModel(model) {
  const kinds = Array.isArray(model?.supported_endpoint_types) ? model.supported_endpoint_types : []
  if (kinds.length === 0) return true
  return kinds.includes('openai')
}

// ------------------------------------------------------------------ 落点路径

function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

function statePath() {
  return path.join(dshHome(), 'storages', 'azy-entry', 'state.json')
}

function credentialsPath() {
  return path.join(dshHome(), '.credentials.yaml')
}

/**
 * profile 目录：优先用显式配置，其次取进程命令行里的 `--profile`，
 * 最后按 `profiles/desktop` 兜底（本机就这一个 profile）。
 */
function profileDir() {
  if (process.env.DSH_PROFILE_DIR) return process.env.DSH_PROFILE_DIR
  const named = process.argv.join(' ').match(/--profile[= ]([\w.-]+)/)
  return path.join(dshHome(), 'profiles', named ? named[1] : 'desktop')
}

function patchPath() {
  return path.join(profileDir(), 'cordis.patch.yml')
}

// ------------------------------------------------------------------ 小工具

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw new HttpError(400, '请求体不是合法 JSON')
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** 只用于界面上让人确认「配的是哪一把」，不用于任何请求。 */
function maskKey(key) {
  if (!key || key.length < 12) return '••••'
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

// ------------------------------------------------------------------ ITEDU 调用

async function itedu(pathname, { method = 'GET', body, cookie, schoolId } = {}) {
  const headers = { Accept: 'application/json', Origin: ORIGIN, Referer: `${ORIGIN}/login` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (cookie) headers.Cookie = cookie
  if (schoolId) headers['X-School-Id'] = String(schoolId)

  let response
  try {
    response = await fetch(ORIGIN + pathname, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    throw new HttpError(502, `连不上 ${ORIGIN}：${error?.message ?? error}`)
  }

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  const rawCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : response.headers.get('set-cookie')
        ? [response.headers.get('set-cookie')]
        : []

  return {
    status: response.status,
    data,
    text,
    cookies: rawCookies.map(value => String(value).split(';')[0]).filter(Boolean),
  }
}

function upstreamMessage(result, fallback) {
  const detail = result?.data?.detail || result?.data?.error || result?.data?.message
  return typeof detail === 'string' && detail.trim() ? detail : fallback
}

// ------------------------------------------------------------------ 状态文件

const EMPTY_STATE = { username: '', displayName: '', cookie: '', schoolId: null, savedAt: 0 }

async function readState() {
  try {
    const parsed = JSON.parse(await fs.readFile(statePath(), 'utf8'))
    return { ...EMPTY_STATE, ...parsed }
  } catch {
    return { ...EMPTY_STATE }
  }
}

async function writeState(next) {
  const file = statePath()
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(next, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
}

// ------------------------------------------------------------------ 凭据

async function writeCredential(ctx, refName, value) {
  const service = ctx?.credentials ?? (typeof ctx?.get === 'function' ? ctx.get('credentials') : undefined)
  if (service && typeof service.set === 'function') {
    try {
      await service.set(refName, value)
      return 'service'
    } catch (error) {
      // 服务在但拒绝写入（只读实现等）时退回文件，不让整条链路失败。
      if (!/read.?only|not.?writable/i.test(String(error?.message ?? ''))) throw error
    }
  }

  const file = credentialsPath()
  let existing = ''
  try {
    existing = await fs.readFile(file, 'utf8')
  } catch {
    existing = ''
  }
  const next = upsertCredentialRef(existing, refName, value)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, next.endsWith('\n') ? next : `${next}\n`, { encoding: 'utf8', mode: 0o600 })
  return 'file'
}

// ------------------------------------------------------------------ provider 配置

async function writeProviderConfig(models) {
  const file = patchPath()
  let yaml
  try {
    yaml = await fs.readFile(file, 'utf8')
  } catch {
    throw new HttpError(500, `找不到 profile 补丁文件：${file}`)
  }

  const next = upsertProviderConfig(yaml, models, PROVIDER_SPEC)
  if (next === null) {
    throw new HttpError(500, `补丁文件里没有 llm-pi-ai 项，未改动：${file}`)
  }
  if (next !== yaml) {
    await fs.writeFile(`${file}.azy-bak`, yaml, 'utf8')
    await fs.writeFile(file, next, 'utf8')
  }
  return { file, changed: next !== yaml }
}

// ------------------------------------------------------------------ 业务动作

async function sessionSnapshot(state) {
  if (!state.cookie) throw new HttpError(401, '还没有登录')

  const session = await itedu('/api/v1/auth/session', { cookie: state.cookie })
  if (session.status === 401 || session.status === 403) {
    throw new HttpError(401, '登录状态已失效，请重新登录')
  }
  if (session.status !== 200) {
    throw new HttpError(502, upstreamMessage(session, `读取会话失败（HTTP ${session.status}）`))
  }

  const schools = Array.isArray(session.data?.schools) ? session.data.schools : []
  const schoolId = state.schoolId ?? schools[0]?.school_id ?? null

  let tokens = []
  let tokenError = ''
  if (schoolId) {
    const list = await itedu('/api/v1/learner/compute/tokens', { cookie: state.cookie, schoolId })
    if (list.status === 200) {
      tokens = Array.isArray(list.data?.items) ? list.data.items : []
    } else {
      tokenError = upstreamMessage(list, `读取算力密钥失败（HTTP ${list.status}）`)
    }
  } else {
    tokenError = '账号没有关联学校，取不到算力密钥'
  }

  const user = session.data?.user ?? {}
  return {
    user: {
      username: user.username ?? state.username,
      displayName: user.display_name ?? state.displayName,
      role: user.role ?? '',
    },
    schoolId,
    tokens: tokens.map(token => ({
      id: token.external_token_id,
      name: token.name,
      kind: token.kind,
      allocated: token.allocated_quota ?? 0,
      remain: token.remain_quota ?? 0,
      used: token.used_quota ?? 0,
      status: token.status,
      expiresAt: token.expires_at ?? 0,
      keyAvailable: token.key_available !== false,
    })),
    tokenError,
  }
}

async function revealKey(state, tokenId) {
  const snapshot = await sessionSnapshot(state)
  const token =
    snapshot.tokens.find(item => item.id === tokenId) ??
    snapshot.tokens.find(item => item.status === 'active' && item.keyAvailable) ??
    snapshot.tokens[0]
  if (!token) throw new HttpError(404, snapshot.tokenError || '这个账号没有可用的算力密钥')
  if (!token.keyAvailable) throw new HttpError(409, '这把密钥当前不可取回，请到爱职业的算力页面查看')

  const result = await itedu(`/api/v1/learner/compute/tokens/${encodeURIComponent(token.id)}/key`, {
    method: 'POST',
    cookie: state.cookie,
    schoolId: snapshot.schoolId,
    body: {},
  })
  if (result.status !== 200) {
    throw new HttpError(result.status >= 500 ? 502 : result.status, upstreamMessage(result, '取回算力密钥失败'))
  }
  const key = result.data?.key ?? ''
  if (!key) throw new HttpError(502, '爱职业返回的密钥为空')
  return { key, token }
}

async function listGatewayModels(key) {
  let response
  try {
    response = await fetch(`${GATEWAY}/models`, { headers: { Authorization: `Bearer ${key}` } })
  } catch (error) {
    throw new HttpError(502, `连不上网关 ${GATEWAY}：${error?.message ?? error}`)
  }
  if (response.status === 401) throw new HttpError(409, '这把密钥在网关侧不被接受，可能已过期')
  if (!response.ok) throw new HttpError(502, `网关拒绝列出模型（HTTP ${response.status}）`)

  const payload = await response.json().catch(() => null)
  const items = Array.isArray(payload?.data) ? payload.data : []
  const models = items.filter(isChatModel).map(item => ({ id: item.id, name: item.name || item.id }))
  if (models.length === 0) throw new HttpError(502, '网关没有返回可用的聊天模型')
  return models
}

// ------------------------------------------------------------------ HTTP 入口

function createHandler(ctx) {
  return async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://azy.local')
    const route = url.pathname.replace(new RegExp(`^${PREFIX}`), '') || '/'
    const method = (req.method ?? 'GET').toUpperCase()

    try {
      if (route === '/state' && method === 'GET') {
        const state = await readState()
        if (!state.cookie) return sendJson(res, 200, { ok: true, signedIn: false })
        const snapshot = await sessionSnapshot(state)
        return sendJson(res, 200, { ok: true, signedIn: true, ...snapshot })
      }

      if (route === '/login' && method === 'POST') {
        const { username, password } = await readJson(req)
        if (!username || !password) throw new HttpError(400, '请填写账号与密码')

        const login = await itedu('/api/v1/auth/login', { method: 'POST', body: { username, password } })
        if (login.status === 401 || login.status === 403) throw new HttpError(401, '账号或密码不正确')
        if (login.status === 429) throw new HttpError(429, '尝试过于频繁，请一分钟后再试')
        if (login.status !== 200) throw new HttpError(502, upstreamMessage(login, `登录失败（HTTP ${login.status}）`))
        if (login.cookies.length === 0) throw new HttpError(502, '登录成功但没拿到会话 Cookie')

        const user = login.data?.user ?? {}
        const state = {
          username: user.username ?? String(username),
          displayName: user.display_name ?? '',
          cookie: login.cookies.join('; '),
          schoolId: null,
          savedAt: Date.now(),
        }
        await writeState(state)
        const snapshot = await sessionSnapshot(state)
        return sendJson(res, 200, { ok: true, signedIn: true, ...snapshot })
      }

      if (route === '/logout' && method === 'POST') {
        const state = await readState()
        if (state.cookie) {
          await itedu('/api/v1/auth/logout', { method: 'POST', cookie: state.cookie, body: {} }).catch(() => null)
        }
        await writeState({ ...EMPTY_STATE })
        return sendJson(res, 200, { ok: true, signedIn: false })
      }

      if (route === '/apply' && method === 'POST') {
        const body = await readJson(req)
        const state = await readState()
        const { key, token } = await revealKey(state, body?.tokenId)
        const models = await listGatewayModels(key)
        const credentialSink = await writeCredential(ctx, CREDENTIAL_REF, key)
        const written = await writeProviderConfig(models)

        return sendJson(res, 200, {
          ok: true,
          provider: PROVIDER_ID,
          credentialRef: CREDENTIAL_REF,
          credentialSink,
          maskedKey: maskKey(key),
          token: { name: token.name, remain: token.remain, allocated: token.allocated, expiresAt: token.expiresAt },
          models,
          configFile: written.file,
          configChanged: written.changed,
        })
      }

      return sendJson(res, 404, { ok: false, error: `未知接口 ${method} ${route}` })
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      if (status >= 500) console.error('[dsh-azy-entry]', error)
      return sendJson(res, status, { ok: false, error: error?.message ?? String(error) })
    }
  }
}

export function apply(ctx) {
  ctx.inject(['webServer'], webCtx => {
    const dispose = webCtx.webServer.register({ kind: 'prefix', path: PREFIX, handler: createHandler(ctx) })
    return typeof dispose === 'function' ? dispose : undefined
  })
}
