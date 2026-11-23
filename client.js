/** 
 * dsh-azy-entry — 浏览器半边。
 *
 * 两件事：左侧栏一行（`sidebar.panellist`）、点击后的页面（`main`）。登录、取
 * 算力密钥、写 provider 配置都在 host 半边（`./index.js`）完成，这里只发请求与
 * 呈现状态——密钥不在页面里出现第二遍。
 *
 * 图标取自 https://azy.ohhub.net/logo.svg，转 data URI 内联：侧栏属于应用外壳，
 * 不该因为远端图标慢一拍先空一格，也免得外壳 CSP 把外链图拦掉。`icon.svg` 是
 * 同一份原始文件的副本，换图标重跑生成脚本即可。
 */
window.__ModuleLoader__.load({
  id: 'dsh-azy-entry',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSLprZTmlrnpooTop4jvvJrlt6bpnaJU55Sx56ysMeOAgTLjgIEz44CBNeOAgTjmoLznu4TmiJDvvJvpobbpnaJI6auY5Lqu56ysMeOAgTPjgIE044CBNeOAgTbjgIE344CBOeagvO+8m+WPs+mdolXnlLHnrKwx44CBM+OAgTTjgIE244CBN+OAgTjjgIE55qC857uE5oiQ77yM54+K55Ga5bqV5LiO5rex6Z2S57u/6auY5LquIj48Zz48cG9seWdvbiBwb2ludHM9IjI1Ni4wMCw0Mi4wMCA0NDYuMDAsMTUwLjAwIDI1Ni4wMCwyNTguMDAgNjYuMDAsMTUwLjAwIiBmaWxsPSIjRkZENDNCIi8+PHBvbHlnb24gcG9pbnRzPSI2Ni4wMCwxNTAuMDAgMjU2LjAwLDI1OC4wMCAyNTYuMDAsNDc0LjAwIDY2LjAwLDM2Ni4wMCIgZmlsbD0iIzI5Q0JFMCIvPjxwb2x5Z29uIHBvaW50cz0iMjU2LjAwLDI1OC4wMCA0NDYuMDAsMTUwLjAwIDQ0Ni4wMCwzNjYuMDAgMjU2LjAwLDQ3NC4wMCIgZmlsbD0iI0ZGNjU0QSIvPjxwb2x5Z29uIHBvaW50cz0iMjU2LjAwLDQ1LjI0IDMxMy42Myw3OC4wMCAyNTYuMDAsMTEwLjc2IDE5OC4zNyw3OC4wMCIgZmlsbD0iIzdFM0ZCMiIvPjxwb2x5Z29uIHBvaW50cz0iMzgyLjY3LDExNy4yNCA0NDAuMzAsMTUwLjAwIDM4Mi42NywxODIuNzYgMzI1LjAzLDE1MC4wMCIgZmlsbD0iIzdFM0ZCMiIvPjxwb2x5Z29uIHBvaW50cz0iMTkyLjY3LDgxLjI0IDI1MC4zMCwxMTQuMDAgMTkyLjY3LDE0Ni43NiAxMzUuMDMsMTE0LjAwIiBmaWxsPSIjN0UzRkIyIi8+PHBvbHlnb24gcG9pbnRzPSIyNTYuMDAsMTE3LjI0IDMxMy42MywxNTAuMDAgMjU2LjAwLDE4Mi43NiAxOTguMzcsMTUwLjAwIiBmaWxsPSIjN0UzRkIyIi8+PHBvbHlnb24gcG9pbnRzPSIzMTkuMzMsMTUzLjI0IDM3Ni45NywxODYuMDAgMzE5LjMzLDIxOC43NiAyNjEuNzAsMTg2LjAwIiBmaWxsPSIjN0UzRkIyIi8+PHBvbHlnb24gcG9pbnRzPSIxMjkuMzMsMTE3LjI0IDE4Ni45NywxNTAuMDAgMTI5LjMzLDE4Mi43NiA3MS43MCwxNTAuMDAiIGZpbGw9IiM3RTNGQjIiLz48cG9seWdvbiBwb2ludHM9IjI1Ni4wMCwxODkuMjQgMzEzLjYzLDIyMi4wMCAyNTYuMDAsMjU0Ljc2IDE5OC4zNywyMjIuMDAiIGZpbGw9IiM3RTNGQjIiLz48cG9seWdvbiBwb2ludHM9IjY4Ljg1LDE1NC44NiAxMjYuNDgsMTg3LjYyIDEyNi40OCwyNTMuMTQgNjguODUsMjIwLjM4IiBmaWxsPSIjMUQzNTU3Ii8+PHBvbHlnb24gcG9pbnRzPSIxMzIuMTgsMTkwLjg2IDE4OS44MiwyMjMuNjIgMTg5LjgyLDI4OS4xNCAxMzIuMTgsMjU2LjM4IiBmaWxsPSIjMUQzNTU3Ii8+PHBvbHlnb24gcG9pbnRzPSIxOTUuNTIsMjI2Ljg2IDI1My4xNSwyNTkuNjIgMjUzLjE1LDMyNS4xNCAxOTUuNTIsMjkyLjM4IiBmaWxsPSIjMUQzNTU3Ii8+PHBvbHlnb24gcG9pbnRzPSIxMzIuMTgsMjYyLjg2IDE4OS44MiwyOTUuNjIgMTg5LjgyLDM2MS4xNCAxMzIuMTgsMzI4LjM4IiBmaWxsPSIjMUQzNTU3Ii8+PHBvbHlnb24gcG9pbnRzPSIxMzIuMTgsMzM0Ljg2IDE4OS44MiwzNjcuNjIgMTg5LjgyLDQzMy4xNCAxMzIuMTgsNDAwLjM4IiBmaWxsPSIjMUQzNTU3Ii8+PHBvbHlnb24gcG9pbnRzPSIyNTguODUsMjU5LjYyIDMxNi40OCwyMjYuODYgMzE2LjQ4LDI5Mi4zOCAyNTguODUsMzI1LjE0IiBmaWxsPSIjMEI0RjRCIi8+PHBvbHlnb24gcG9pbnRzPSIzODUuNTIsMTg3LjYyIDQ0My4xNSwxNTQuODYgNDQzLjE1LDIyMC4zOCAzODUuNTIsMjUzLjE0IiBmaWxsPSIjMEI0RjRCIi8+PHBvbHlnb24gcG9pbnRzPSIyNTguODUsMzMxLjYyIDMxNi40OCwyOTguODYgMzE2LjQ4LDM2NC4zOCAyNTguODUsMzk3LjE0IiBmaWxsPSIjMEI0RjRCIi8+PHBvbHlnb24gcG9pbnRzPSIzODUuNTIsMjU5LjYyIDQ0My4xNSwyMjYuODYgNDQzLjE1LDI5Mi4zOCAzODUuNTIsMzI1LjE0IiBmaWxsPSIjMEI0RjRCIi8+PHBvbHlnb24gcG9pbnRzPSIyNTguODUsNDAzLjYyIDMxNi40OCwzNzAuODYgMzE2LjQ4LDQzNi4zOCAyNTguODUsNDY5LjE0IiBmaWxsPSIjMEI0RjRCIi8+PHBvbHlnb24gcG9pbnRzPSIzMjIuMTgsMzY3LjYyIDM3OS44MiwzMzQuODYgMzc5LjgyLDQwMC4zOCAzMjIuMTgsNDMzLjE0IiBmaWxsPSIjMEI0RjRCIi8+PHBvbHlnb24gcG9pbnRzPSIzODUuNTIsMzMxLjYyIDQ0My4xNSwyOTguODYgNDQzLjE1LDM2NC4zOCAzODUuNTIsMzk3LjE0IiBmaWxsPSIjMEI0RjRCIi8+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZGREY2IiBzdHJva2Utd2lkdGg9IjMuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj48cGF0aCBkPSJNIDMxOS4zMyA3OC4wMCBMIDEyOS4zMyAxODYuMDAiLz48cGF0aCBkPSJNIDE5Mi42NyA3OC4wMCBMIDM4Mi42NyAxODYuMDAiLz48cGF0aCBkPSJNIDM4Mi42NyAxMTQuMDAgTCAxOTIuNjcgMjIyLjAwIi8+PHBhdGggZD0iTSAxMjkuMzMgMTE0LjAwIEwgMzE5LjMzIDIyMi4wMCIvPjxwYXRoIGQ9Ik0gMTI5LjMzIDE4Ni4wMCBMIDEyOS4zMyA0MDIuMDAiLz48cGF0aCBkPSJNIDY2LjAwIDIyMi4wMCBMIDI1Ni4wMCAzMzAuMDAiLz48cGF0aCBkPSJNIDE5Mi42NyAyMjIuMDAgTCAxOTIuNjcgNDM4LjAwIi8+PHBhdGggZD0iTSA2Ni4wMCAyOTQuMDAgTCAyNTYuMDAgNDAyLjAwIi8+PHBhdGggZD0iTSAzMTkuMzMgMjIyLjAwIEwgMzE5LjMzIDQzOC4wMCIvPjxwYXRoIGQ9Ik0gMjU2LjAwIDMzMC4wMCBMIDQ0Ni4wMCAyMjIuMDAiLz48cGF0aCBkPSJNIDM4Mi42NyAxODYuMDAgTCAzODIuNjcgNDAyLjAwIi8+PHBhdGggZD0iTSAyNTYuMDAgNDAyLjAwIEwgNDQ2LjAwIDI5NC4wMCIvPjwvZz48ZyBmaWxsPSJub25lIiBzdHJva2U9IiMxNzMzNjYiIHN0cm9rZS13aWR0aD0iNSIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj48cGF0aCBkPSJNIDI1NiA0MiBMIDQ0NiAxNTAgTCAyNTYgMjU4IEwgNjYgMTUwIFoiLz48cGF0aCBkPSJNIDY2IDE1MCBMIDI1NiAyNTggTCAyNTYgNDc0IEwgNjYgMzY2IFoiLz48cGF0aCBkPSJNIDI1NiAyNTggTCA0NDYgMTUwIEwgNDQ2IDM2NiBMIDI1NiA0NzQgWiIvPjwvZz48L2c+PC9zdmc+'
    const API = '/azy-entry-api'

    /**
     * 配色一律走外壳的 alias 变量并带中性 fallback：深浅两套主题下都不出现
     * 「白底白字」。仅主按钮用强调色，缺变量时退回一个常见的蓝。
     */
    const S = {
      page: { height: '100%', minHeight: 480, overflow: 'auto', padding: '26px 24px 40px', boxSizing: 'border-box' },
      wrap: { maxWidth: 560, margin: '0 auto' },
      row: { display: 'flex', alignItems: 'center', gap: 10 },
      eyebrow: { margin: 0, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .55 },
      title: { margin: '5px 0 0', fontSize: 19, fontWeight: 650, lineHeight: 1.3 },
      lede: { margin: '12px 0 0', fontSize: 13, lineHeight: 1.7, opacity: .72 },
      card: {
        marginTop: 18,
        padding: 16,
        borderRadius: 10,
        border: '1px solid var(--dsw-alias-border, rgba(127,127,127,.28))',
        background: 'var(--dsw-alias-bg-elevated, rgba(127,127,127,.05))',
      },
      field: { display: 'grid', gap: 6, marginBottom: 12 },
      label: { fontSize: 12, opacity: .7 },
      input: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '8px 10px',
        fontSize: 13,
        lineHeight: 1.5,
        borderRadius: 7,
        border: '1px solid var(--dsw-alias-border, rgba(127,127,127,.35))',
        background: 'var(--dsw-alias-bg, transparent)',
        color: 'inherit',
        outline: 'none',
      },
      primary: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 7,
        border: '1px solid transparent',
        background: 'var(--dsw-alias-accent, #2f6feb)',
        color: '#fff',
        cursor: 'pointer',
      },
      quiet: {
        padding: '7px 12px',
        fontSize: 12.5,
        borderRadius: 7,
        border: '1px solid var(--dsw-alias-border, rgba(127,127,127,.35))',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
      },
      link: { fontSize: 12, opacity: .7, color: 'inherit' },
      meta: { fontSize: 12, opacity: .62 },
      kv: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 12.5, marginTop: 14 },
      bar: { height: 6, marginTop: 12, borderRadius: 999, background: 'rgba(127,127,127,.22)', overflow: 'hidden' },
      barFill: { height: '100%', borderRadius: 999, background: 'var(--dsw-alias-accent, #2f6feb)' },
      err: {
        marginTop: 12,
        padding: '9px 11px',
        borderRadius: 7,
        fontSize: 12.5,
        lineHeight: 1.65,
        color: '#b42318',
        background: 'rgba(220,38,38,.09)',
        border: '1px solid rgba(220,38,38,.28)',
      },
      ok: {
        marginTop: 12,
        padding: '10px 12px',
        borderRadius: 7,
        fontSize: 12.5,
        lineHeight: 1.7,
        color: '#067647',
        background: 'rgba(16,158,102,.10)',
        border: '1px solid rgba(16,158,102,.28)',
      },
    }

    function AzyIcon(props) {
      const size = props && typeof props.size === 'number' ? props.size : 18
      return h('img', {
        src: ICON,
        width: size,
        height: size,
        alt: '',
        'aria-hidden': true,
        draggable: false,
        style: { display: 'block', width: size, height: size, borderRadius: 4, objectFit: 'contain' },
      })
    }

    async function call(path, init) {
      let res
      try {
        res = await fetch(API + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, init))
      } catch (error) {
        throw new Error('连不上本地插件服务：' + (error && error.message ? error.message : error))
      }
      let data = null
      try {
        data = await res.json()
      } catch (error) {
        data = null
      }
      if (!res.ok || (data && data.ok === false)) {
        throw new Error((data && data.error) || '请求失败（HTTP ' + res.status + '）')
      }
      return data || {}
    }

    function fmt(value) {
      const n = Number(value)
      return Number.isFinite(n) ? n.toLocaleString('zh-CN') : '—'
    }

    function fmtDate(seconds) {
      if (!seconds) return '—'
      const day = new Date(Number(seconds) * 1000)
      return Number.isNaN(day.getTime()) ? '—' : day.toLocaleDateString('zh-CN')
    }

    function LoginCard(props) {
      const [username, setUsername] = React.useState('')
      const [password, setPassword] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')

      function submit(event) {
        if (event && event.preventDefault) event.preventDefault()
        if (busy) return
        const account = username.trim()
        if (!account || !password) {
          setError('请填写账号与密码')
          return
        }
        setBusy(true)
        setError('')
        call('/login', { method: 'POST', body: JSON.stringify({ username: account, password: password }) })
          .then(() => props.onSignedIn())
          .catch(reason => setError(reason.message))
          .finally(() => setBusy(false))
      }

      return h('form', { style: S.card, onSubmit: submit },
        h('div', { style: S.field },
          h('label', { style: S.label, htmlFor: 'azy-user' }, '爱职业账号'),
          h('input', {
            id: 'azy-user',
            style: S.input,
            autoComplete: 'username',
            placeholder: '学号或工号',
            value: username,
            onChange: event => setUsername(event.target.value),
          }),
        ),
        h('div', { style: S.field },
          h('label', { style: S.label, htmlFor: 'azy-pass' }, '密码'),
          h('input', {
            id: 'azy-pass',
            type: 'password',
            style: S.input,
            autoComplete: 'current-password',
            value: password,
            onChange: event => setPassword(event.target.value),
          }),
        ),
        h('div', { style: S.row },
          h('button', {
            type: 'submit',
            disabled: busy,
            style: Object.assign({}, S.primary, busy ? { opacity: .6, cursor: 'default' } : null),
          }, busy ? '正在登录…' : '登录并读取算力'),
          h('a', { href: 'https://azy.ohhub.net/login?redirect=%2Fworkspace', target: '_blank', rel: 'noreferrer', style: S.link }, '在浏览器打开'),
        ),
        error ? h('div', { style: S.err, role: 'alert' }, error) : null,
        h('p', { style: { margin: '14px 0 0', fontSize: 11.5, lineHeight: 1.65, opacity: .5 } },
          '登录只用于读取本校分配给你的算力密钥。密钥写入本机凭据存储，这里只显示首尾各四位。'),
      )
    }

    function Dashboard(props) {
      const data = props.data
      const tokens = data.tokens || []
      const [tokenId, setTokenId] = React.useState(tokens[0] ? tokens[0].id : '')
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')
      const [result, setResult] = React.useState(null)

      const token = tokens.filter(item => item.id === tokenId)[0] || tokens[0]
      const ratio = token && token.allocated > 0 ? Math.max(0, Math.min(1, token.used / token.allocated)) : 0

      function apply() {
        if (busy) return
        setBusy(true)
        setError('')
        setResult(null)
        call('/apply', { method: 'POST', body: JSON.stringify({ tokenId: token ? token.id : null }) })
          .then(outcome => setResult(outcome))
          .catch(reason => setError(reason.message))
          .finally(() => setBusy(false))
      }

      const who = (data.user.displayName || data.user.username) + ' · ' + data.user.username

      return h('div', { style: S.card },
        h('div', { style: S.row },
          h('div', { style: { minWidth: 0 } },
            h('div', { style: { fontSize: 14, fontWeight: 600 } }, who),
            h('div', { style: S.meta },
              '学校 #' + (data.schoolId == null ? '—' : data.schoolId) + ' · ' + (data.user.role || 'learner'),
            ),
          ),
          h('div', { style: { marginLeft: 'auto', display: 'flex', gap: 8, flex: 'none' } },
            h('button', {
              type: 'button',
              style: S.quiet,
              onClick: props.onRefresh,
            }, '重新读取'),
            h('button', {
              type: 'button',
              style: S.quiet,
              onClick: props.onLogout,
            }, '退出登录'),
          ),
        ),

        data.tokenError ? h('div', { style: S.err, role: 'alert' }, data.tokenError) : null,

        token
          ? h('div', { style: { marginTop: 16 } },
              h('div', { style: S.row },
                h('span', { style: { fontSize: 12.5, opacity: .72 } }, '算力密钥'),
                tokens.length > 1
                  ? h('select', {
                      value: token.id,
                      onChange: event => setTokenId(event.target.value),
                      style: Object.assign({}, S.quiet, { marginLeft: 'auto', padding: '4px 6px', maxWidth: 260 }),
                    }, tokens.map(item => h('option', { key: item.id, value: item.id }, item.name)))
                  : h('span', { style: Object.assign({}, S.meta, { marginLeft: 'auto', textAlign: 'right' }) }, token.name),
              ),
              h('div', { style: S.kv },
                h('span', { style: S.meta }, '剩余 / 总额度'),
                h('span', null, fmt(token.remain) + ' / ' + fmt(token.allocated)),
                h('span', { style: S.meta }, '已用'),
                h('span', null, fmt(token.used)),
                h('span', { style: S.meta }, '有效期至'),
                h('span', null, fmtDate(token.expiresAt)),
              ),
              h('div', { style: S.bar },
                h('div', { style: Object.assign({}, S.barFill, { width: (ratio * 100).toFixed(1) + '%' }) }),
              ),
              h('div', { style: { marginTop: 18, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
                h('button', {
                  type: 'button',
                  disabled: busy,
                  onClick: apply,
                  style: Object.assign({}, S.primary, busy ? { opacity: .6, cursor: 'default' } : null),
                }, busy ? '正在配置…' : '配置到 Harness'),
                h('span', { style: S.meta }, '写入 provider「itedu」与网关的聊天模型'),
              ),
            )
          : data.tokenError
            ? null
            : h('div', {
                style: {
                  marginTop: 16,
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '1px dashed var(--dsw-alias-border, rgba(127,127,127,.35))',
                  fontSize: 12.5,
                  lineHeight: 1.7,
                  opacity: .82,
                },
              },
              '这个账号名下还没有算力密钥。到爱职业的「算力」页面创建一把，再回来点「重新读取」。',
              h('br'),
              h('a', {
                href: 'https://azy.ohhub.net/workspace/compute',
                target: '_blank',
                rel: 'noreferrer',
                style: { color: 'inherit', fontSize: 12 },
              }, '打开算力页面 ↗')),

        error ? h('div', { style: S.err, role: 'alert' }, error) : null,

        result
          ? h('div', { style: S.ok },
              '已配置 ' + result.models.length + ' 个模型 · 密钥 ' + result.maskedKey + ' · ' + (result.configChanged ? '配置文件已更新' : '配置文件无变化'),
              h('br'),
              h('span', { style: { opacity: .85 } },
                '到「设置 → 模型」选「爱职业（算力）」下的模型。若模型列表暂时没出现，重启一次 Harness 即可。'),
            )
          : null,
      )
    }

    function AzyPage() {
      const [view, setView] = React.useState({ loading: true, signedIn: false })
      const [error, setError] = React.useState('')

      function load() {
        setView(current => Object.assign({}, current, { loading: true }))
        call('/state')
          .then(data => setView({ loading: false, signedIn: data.signedIn === true, data: data }))
          .catch(reason => {
            setError(reason.message)
            setView({ loading: false, signedIn: false })
          })
      }

      React.useEffect(() => {
        load()
      }, [])

      function logout() {
        call('/logout', { method: 'POST', body: '{}' })
          .then(() => {
            setError('')
            load()
          })
          .catch(reason => setError(reason.message))
      }

      return h('div', { style: S.page },
        h('div', { style: S.wrap },
          h('div', { style: S.row },
            h(AzyIcon, { size: 30 }),
            h('div', null,
              h('p', { style: S.eyebrow }, 'DeepSeek Harness × 爱职业'),
              h('h1', { style: S.title }, '算力接入'),
            ),
          ),
          h('p', { style: S.lede },
            '用爱职业账号登录，把学校分配给这个账号的算力密钥接到这台 Harness 上。配置完成后，模型列表里会多出「爱职业（算力）」一组模型，直接选来用即可。'),
          view.loading
            ? h('div', { style: Object.assign({}, S.card, { fontSize: 13, opacity: .7 }) }, '正在读取本机登录状态…')
            : view.signedIn
              ? h(Dashboard, { data: view.data, onLogout: logout, onRefresh: load })
              : h(LoginCard, { onSignedIn: () => { setError(''); load() } }),
          error ? h('div', { style: S.err, role: 'alert' }, error) : null,
        ),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const disposers = []
        disposers.push(ctx.slots.inject('main', () => ctx.slots.register(
          { name: 'main', key: 'azy-entry' }, AzyPage,
        )))
        disposers.push(ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
          { name: 'sidebar.panellist', id: 'azy-entry', order: 20, label: () => '爱职业' }, AzyIcon,
        )))
        const cleanup = () => {
          for (const dispose of disposers.splice(0).reverse()) dispose()
        }
        if (typeof ctx.effect === 'function') ctx.effect(() => cleanup)
        return cleanup
      },
    }
  },
})
