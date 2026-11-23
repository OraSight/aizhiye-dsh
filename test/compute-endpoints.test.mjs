/**
 * 算力接口分工的回归测试：`npm test`
 *
 * 这两条路径写错一次的代价是「教师登录后看到 Permission denied」——2026-11-23
 * 实际发生过：插件一律打学员接口，教师在 `/workspace/compute` 明明有 token，
 * 页面却说没有。这里钉住「谁走哪条路」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { computeEndpoints, pickOwnTokens } from '../index.js'

test('学员走 /learner/compute/tokens', () => {
  const endpoints = computeEndpoints('learner')
  assert.equal(endpoints.list, '/api/v1/learner/compute/tokens')
  assert.equal(endpoints.key('abc'), '/api/v1/learner/compute/tokens/abc/key')
})

test('教师走 /compute/tokens', () => {
  const endpoints = computeEndpoints('teacher')
  assert.equal(endpoints.list, '/api/v1/compute/tokens')
  assert.equal(endpoints.key('abc'), '/api/v1/compute/tokens/abc/key')
})

test('未知角色退回学员路径，不拼出空前缀', () => {
  for (const role of ['', undefined, null, 'admin']) {
    const endpoints = computeEndpoints(role)
    assert.equal(endpoints.list, '/api/v1/learner/compute/tokens')
    assert.match(endpoints.key('x'), /^\/api\/v1\//)
  }
})

test('token id 会被转义，不拼进路径分隔符', () => {
  const endpoints = computeEndpoints('teacher')
  assert.equal(endpoints.key('a/b?c'), '/api/v1/compute/tokens/a%2Fb%3Fc/key')
})

// ---------------------------------------------------------------- 归属筛选

test('教师只取自己的 kind=teacher，学生 token 再像也不算', () => {
  // 2026-11-23 的真实形态：s3t1 名下有一把自己的、一把分配给学生 s3c01s001 的。
  const items = [
    { external_token_id: 'mine', kind: 'teacher', learner_id: null },
    { external_token_id: 'student', kind: 'student', learner_id: 77 },
  ]
  const own = pickOwnTokens('teacher', items)
  assert.deepEqual(own.map(token => token.external_token_id), ['mine'])
})

test('学员列表原样保留（接口已按 learner_id 限定）', () => {
  const items = [{ external_token_id: 'a', kind: 'student', learner_id: 77 }]
  assert.equal(pickOwnTokens('learner', items).length, 1)
})

test('未知角色不过滤，不因角色缺失把列表清空', () => {
  const items = [{ external_token_id: 'a', kind: 'student' }]
  assert.equal(pickOwnTokens('', items).length, 1)
})

test('列表不是数组或含空项时不抛错', () => {
  assert.deepEqual(pickOwnTokens('teacher', null), [])
  assert.deepEqual(pickOwnTokens('teacher', undefined), [])
  assert.deepEqual(pickOwnTokens('teacher', [null, { kind: 'teacher' }]).length, 1)
})
