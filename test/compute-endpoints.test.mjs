/**
 * 算力接口分工的回归测试：`npm test`
 *
 * 这两条路径写错一次的代价是「教师登录后看到 Permission denied」——2026-11-23
 * 实际发生过：插件一律打学员接口，教师在 `/workspace/compute` 明明有 token，
 * 页面却说没有。这里钉住「谁走哪条路」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { computeEndpoints } from '../index.js'

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
