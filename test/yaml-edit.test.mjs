/**
 * 配置改写的回归测试：`node --test test/`
 *
 * 这两段代码会改到 harness 正在读的配置文件，出错的代价是「DSH 起不来」或
 * 「别人的 provider 被吃掉」。所以这里不测「能不能用」，测的是不变量：
 * 别的条目与注释必须逐字留下，重复执行必须等价于执行一次。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { dropCredentialRef, dropProviderConfig, upsertProviderConfig, upsertCredentialRef } from '../lib/yaml-edit.js'

const SPEC = {
  id: 'aizhiye',
  label: '爱职业（学生算力）',
  credentialRef: 'AIZHIYE_KEY',
  baseURL: 'https://ohhub.net/v1',
}

const MODELS = [
  { id: 'deepseek-v4.1-flash', name: 'deepseek-v4.1-flash' },
  { id: 'GLM-5.3', name: 'GLM-5.3' },
]

const PATCH = [
  '# profile 补丁',
  '- id: llm-pi-ai',
  '  name: "@deepseek-ai/dsh-llm-pi-ai"',
  '  config:',
  '    providers: {}',
  '- id: ui-chat',
  '  name: "@deepseek-ai/dsh-client-ui-chat"',
  '  config:',
  '    transcriptView: standard',
  '',
].join('\n')

test('providers 是 {} 时填成块', () => {
  const out = upsertProviderConfig(PATCH, MODELS, SPEC)
  assert.match(out, /^ {4}providers:$/m)
  assert.match(out, /^ {6}aizhiye:$/m)
  assert.match(out, /^ {8}apiKeyEnv: AIZHIYE_KEY$/m)
  assert.match(out, /^ {8}baseURL: https:\/\/ohhub\.net\/v1$/m)
  assert.match(out, /^ {10}- id: GLM-5\.3$/m)
  // 花括号必须已经消失，否则 YAML 里是「空 map + 子键」的矛盾结构。
  assert.doesNotMatch(out, /providers: \{\}/)
})

test('别的条目与注释一个字符都不动', () => {
  const out = upsertProviderConfig(PATCH, MODELS, SPEC)
  assert.match(out, /^# profile 补丁$/m)
  assert.match(out, /^- id: ui-chat$/m)
  assert.ok(out.includes('    transcriptView: standard'))
  // llm-pi-ai 这一项除 providers 外的键都还在。
  assert.match(out, /^ {2}name: "@deepseek-ai\/dsh-llm-pi-ai"$/m)
})

test('已有别的 provider 时保留并追加', () => {
  const withOther = PATCH.replace(
    '    providers: {}',
    ['    providers:', '      acme:', '        apiKeyEnv: ACME_KEY', '        api: openai-completions', '        baseURL: https://acme.example/v1', '        models:', '          - id: acme-1'].join('\n'),
  )
  const out = upsertProviderConfig(withOther, MODELS, SPEC)
  assert.match(out, /^ {6}acme:$/m)
  assert.match(out, /^ {10}- id: acme-1$/m)
  assert.match(out, /^ {6}aizhiye:$/m)
})

test('重复执行与执行一次等价', () => {
  const once = upsertProviderConfig(PATCH, MODELS, SPEC)
  const twice = upsertProviderConfig(once, MODELS, SPEC)
  assert.equal(twice, once)
})

test('第二次换了模型列表时只替换自己的块', () => {
  const once = upsertProviderConfig(PATCH, MODELS, SPEC)
  const next = upsertProviderConfig(once, [{ id: 'Qwen3.6-27B', name: 'Qwen3.6-27B' }], SPEC)
  assert.equal((next.match(/^ {6}aizhiye:$/gm) || []).length, 1)
  assert.match(next, /- id: Qwen3\.6-27B/)
  assert.doesNotMatch(next, /- id: GLM-5\.3/)
})

test('找不到 llm-pi-ai 时返回 null，不猜位置', () => {
  assert.equal(upsertProviderConfig('- id: ui-chat\n  config: {}\n', MODELS, SPEC), null)
})

test('凭据：空文件生成 version + refs', () => {
  const out = upsertCredentialRef('', 'AIZHIYE_KEY', 'abc123')
  assert.equal(out, ['version: 1', '', 'refs:', '  AIZHIYE_KEY: "abc123"'].join('\n'))
})

test('凭据：已有 refs 与别的密钥时插入而不覆盖', () => {
  const src = ['version: 1', '', 'refs:', '  DEEPSEEK_API_KEY: "sk-a"', ''].join('\n')
  const out = upsertCredentialRef(src, 'AIZHIYE_KEY', 'abc123')
  assert.match(out, /^ {2}DEEPSEEK_API_KEY: "sk-a"$/m)
  assert.match(out, /^ {2}AIZHIYE_KEY: "abc123"$/m)
})

test('凭据：同名键替换而非重复', () => {
  const src = ['version: 1', 'refs:', '  AIZHIYE_KEY: "old"', '  OTHER: "x"'].join('\n')
  const out = upsertCredentialRef(src, 'AIZHIYE_KEY', 'new')
  assert.equal((out.match(/AIZHIYE_KEY:/g) || []).length, 1)
  assert.match(out, /AIZHIYE_KEY: "new"/)
  assert.match(out, /^ {2}OTHER: "x"$/m)
})

test('凭据：refs 写成 {} 时改成块，不产生第二个 refs 键', () => {
  const src = ['version: 1', 'records:', '  client-connection/browser-session:', '    kind: api-key', 'refs: {}'].join('\n')
  const out = upsertCredentialRef(src, 'AIZHIYE_KEY', 'abc123')
  assert.equal((out.match(/^refs:/gm) || []).length, 1)
  assert.doesNotMatch(out, /refs: \{\}/)
  assert.match(out, /^ {2}AIZHIYE_KEY: "abc123"$/m)
  // records 段原样保留
  assert.match(out, /^ {2}client-connection\/browser-session:$/m)
  assert.match(out, /^ {4}kind: api-key$/m)
})

test('凭据：records 段不会被写进 refs', () => {
  const src = ['version: 1', 'refs:', '  A: "1"', '', 'records:', '  llm-pi-ai/openai: {}'].join('\n')
  const out = upsertCredentialRef(src, 'AIZHIYE_KEY', 'abc')
  const [beforeRecords] = out.split(/^records:$/m)
  assert.match(beforeRecords, /AIZHIYE_KEY/)
  assert.doesNotMatch(beforeRecords.split('refs:')[1] || '', /llm-pi-ai/)
})

test('凭据：值里的引号与反斜杠被转义', () => {
  const out = upsertCredentialRef('', 'AIZHIYE_KEY', 'a"b\\c')
  assert.match(out, /AIZHIYE_KEY: "a\\"b\\\\c"/)
})

// ---------------------------------------------------------------- 改名迁移

const LEGACY_PATCH = [
  '- id: llm-pi-ai',
  '  name: "@deepseek-ai/dsh-llm-pi-ai"',
  '  config:',
  '    providers:',
  '      itedu:',
  '        displayName: 爱职业（算力）',
  '        apiKeyEnv: ITEDU_AZY_KEY',
  '        baseURL: https://ohhub.net/v1',
  '        models:',
  '          - id: deepseek-v4.1-flash',
  '      openai:',
  '        apiKeyEnv: OPENAI_KEY',
  '        baseURL: https://api.openai.com/v1',
  '- id: ui-chat',
  '',
].join('\n')

test('改名迁移：特征匹配的旧 provider 段被删掉，别的 provider 与后继条目保留', () => {
  const out = dropProviderConfig(LEGACY_PATCH, { id: 'itedu', baseURL: 'https://ohhub.net/v1', credentialRef: 'ITEDU_AZY_KEY' })
  assert.doesNotMatch(out, /^\s+itedu:$/m)
  assert.doesNotMatch(out, /ITEDU_AZY_KEY/)
  assert.match(out, /^\s+openai:$/m)
  assert.match(out, /OPENAI_KEY/)
  assert.match(out, /^- id: ui-chat$/m)
})

test('改名迁移：同名但别家的 provider 不动', () => {
  const foreign = [
    '- id: llm-pi-ai',
    '  config:',
    '    providers:',
    '      itedu:',
    '        baseURL: https://example.com/v1',
    '        apiKeyEnv: OTHER_KEY',
    '',
  ].join('\n')
  const out = dropProviderConfig(foreign, { id: 'itedu', baseURL: 'https://ohhub.net/v1', credentialRef: 'ITEDU_AZY_KEY' })
  assert.equal(out, foreign)
})

test('改名迁移：没有旧段时原样返回', () => {
  assert.equal(dropProviderConfig(PATCH, { id: 'itedu', baseURL: 'https://ohhub.net/v1' }), PATCH)
})

test('凭据：旧引用名被删掉，其它引用保留', () => {
  const src = ['version: 1', 'refs:', '  ITEDU_AZY_KEY: "old"', '  AIZHIYE_KEY: "new"', '', 'records:', '  llm-pi-ai/openai: {}'].join('\n')
  const out = dropCredentialRef(src, 'ITEDU_AZY_KEY')
  assert.doesNotMatch(out, /ITEDU_AZY_KEY/)
  assert.match(out, /AIZHIYE_KEY: "new"/)
  assert.match(out, /records:/)
})

test('凭据：要删的引用不存在时原样返回', () => {
  const src = ['version: 1', 'refs:', '  A: "1"', ''].join('\n')
  assert.equal(dropCredentialRef(src, 'MISSING'), src)
})
