/**
 * 两段「在别人写的 YAML 里安全地改一处」的函数。
 *
 * 单独成文件只为一件事：它们会改到 harness 正在使用的配置文件，必须能脱离
 * 插件运行时被直接测（`qa` 里的脚本 import 这个文件）。两者都只做行级插入/
 * 替换，遇到的注释与别的条目原样留着，重复执行结果一致。
 */

/** YAML 双引号字符串：反斜杠与引号转义。密钥里可能出现 `#`、`:` 等裸写会误读的字符。 */
function quote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 定位 `llm-pi-ai` 项里的 `providers:` 与其子块范围。
 *
 * 三个函数（upsert / 两个 drop）都要这段定位，抽出来免得各写一份、日后走样。
 * 找不到 `llm-pi-ai` 项或其中没有 `providers:` 时返回 null，由调用方各自决定
 * 是报错还是原样返回。
 */
function locateProviders(lines) {
  const start = lines.findIndex(line => /^-\s+id:\s*llm-pi-ai\s*$/.test(line))
  if (start < 0) return null

  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^-\s/.test(lines[i])) {
      end = i
      break
    }
  }

  let providersAt = -1
  for (let i = start; i < end; i += 1) {
    if (/^\s{2,6}providers:\s*(\{\}\s*)?$/.test(lines[i])) {
      providersAt = i
      break
    }
  }
  if (providersAt < 0) return null

  const indent = lines[providersAt].match(/^\s*/)[0].length
  let segmentEnd = providersAt + 1
  while (segmentEnd < end) {
    const line = lines[segmentEnd]
    if (!line.trim()) {
      segmentEnd += 1
      continue
    }
    if (line.match(/^\s*/)[0].length <= indent) break
    segmentEnd += 1
  }

  return { providersAt, segmentEnd, childIndent: indent + 2 }
}

/**
 * 在 `.credentials.yaml` 的 `refs` 段写入/替换一条引用。
 *
 * 没有 `refs` 段时按文件规范补一个（`version` 之后）；有就只碰那一行。
 */
export function upsertCredentialRef(yaml, refName, value) {
  const lines = yaml && yaml.length ? yaml.split(/\r?\n/) : ['version: 1']

  // `refs: {}` 是空 map 的写法，必须认——当前安装上就是这个形状，不认会再写
  // 一个 `refs:` 键出来，YAML 重复键让 DSH 直接起不来。
  let refsAt = lines.findIndex(line => /^refs:\s*(\{\})?\s*$/.test(line))
  if (refsAt >= 0) {
    lines[refsAt] = lines[refsAt].replace(/\s*\{\}\s*$/, '')
  } else {
    const versionAt = lines.findIndex(line => /^version:/.test(line))
    const insertAt = versionAt >= 0 ? versionAt + 1 : 0
    lines.splice(insertAt, 0, '', 'refs:')
    refsAt = insertAt + 1
  }

  // refs 段到下一个顶格键为止；空行与注释不算结束。
  let refsEnd = lines.length
  for (let i = refsAt + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    if (!/^\s/.test(line)) {
      refsEnd = i
      break
    }
  }

  const entry = new RegExp(`^\\s+${refName}:`)
  for (let i = refsAt + 1; i < refsEnd; i += 1) {
    if (entry.test(lines[i])) {
      lines[i] = `  ${refName}: ${quote(value)}`
      return lines.join('\n')
    }
  }

  let insertAt = refsEnd
  while (insertAt > refsAt + 1 && !lines[insertAt - 1].trim()) insertAt -= 1
  lines.splice(insertAt, 0, `  ${refName}: ${quote(value)}`)
  return lines.join('\n')
}

/** provider 在 `providers:` 下的那一段，缩进由调用方给。 */
export function providerBlock(models, indent, { id, label, credentialRef, baseURL }) {
  const pad = ' '.repeat(indent)
  const lines = [
    `${pad}${id}:`,
    `${pad}  displayName: ${label}`,
    `${pad}  apiKeyEnv: ${credentialRef}`,
    `${pad}  api: openai-completions`,
    `${pad}  baseURL: ${baseURL}`,
    `${pad}  defaultContextWindow: 131072`,
    `${pad}  defaultMaxTokens: 8192`,
    `${pad}  models:`,
  ]
  for (const model of models) {
    lines.push(`${pad}    - id: ${model.id}`)
    lines.push(`${pad}      name: ${model.name || model.id}`)
  }
  return lines
}

/**
 * 在 profile 补丁里把 `llm-pi-ai` 那一项的 `providers` 换成含本 provider 的样子。
 *
 * 找 `providers:` 行 → 圈出它的子块 → 摘掉同名的旧子块 → 追加新块。别的
 * provider、`{}` 之外的兄弟键与注释都不动。找不到 `llm-pi-ai` 项时返回 `null`，
 * 由调用方报错而不是瞎猜位置。
 */
export function upsertProviderConfig(yaml, models, options) {
  const { id } = options
  const lines = yaml.split(/\r?\n/)
  const start = lines.findIndex(line => /^-\s+id:\s*llm-pi-ai\s*$/.test(line))
  if (start < 0) return null

  const located = locateProviders(lines)
  if (!located) {
    let end = lines.length
    for (let i = start + 1; i < lines.length; i += 1) {
      if (/^-\s/.test(lines[i])) {
        end = i
        break
      }
    }
    let configAt = -1
    for (let i = start; i < end; i += 1) {
      if (/^\s{2,6}config:\s*$/.test(lines[i])) {
        configAt = i
        break
      }
    }
    if (configAt < 0) return null
    lines.splice(configAt + 1, 0, '    providers:', ...providerBlock(models, 6, options))
    return lines.join('\n')
  }

  const { providersAt, segmentEnd, childIndent } = located
  const kept = []
  let skipping = false
  for (const line of lines.slice(providersAt + 1, segmentEnd)) {
    if (!line.trim()) {
      if (!skipping) kept.push(line)
      continue
    }
    const lineIndent = line.match(/^\s*/)[0].length
    if (lineIndent === childIndent && new RegExp(`^\\s{${childIndent}}${id}:`).test(line)) {
      skipping = true
      continue
    }
    if (skipping && lineIndent <= childIndent) skipping = false
    if (!skipping) kept.push(line)
  }

  const head = lines[providersAt].replace(/\s*\{\}\s*$/, '')
  lines.splice(providersAt, segmentEnd - providersAt, head, ...kept, ...providerBlock(models, childIndent, options))
  return lines.join('\n')
}

/**
 * 删掉 `providers` 下某个**确认是我们写的**旧 provider 段。
 *
 * 用于改名迁移：插件从 `itedu` 改叫 `aizhiye` 之后，配置文件里那段旧的反向
 * 引用还留着——它指向一个已不存在的凭据名，DSH 的模型列表里会多出一组永远
 * 连不上的模型。这里只在段内出现预期的 `baseURL` 或 `apiKeyEnv` 时才删，
 * 别家同名 provider 一个字都不动；特征不匹配就原样返回。
 */
export function dropProviderConfig(yaml, { id, baseURL, credentialRef }) {
  const lines = yaml.split(/\r?\n/)
  const located = locateProviders(lines)
  if (!located) return yaml

  const { providersAt, segmentEnd, childIndent } = located
  const keyPattern = new RegExp(`^\\s{${childIndent}}${escapeRegExp(id)}:\\s*$`)
  let blockStart = -1
  for (let i = providersAt + 1; i < segmentEnd; i += 1) {
    if (keyPattern.test(lines[i])) {
      blockStart = i
      break
    }
  }
  if (blockStart < 0) return yaml

  let blockEnd = blockStart + 1
  while (blockEnd < segmentEnd) {
    const line = lines[blockEnd]
    if (!line.trim()) {
      blockEnd += 1
      continue
    }
    if (line.match(/^\s*/)[0].length <= childIndent) break
    blockEnd += 1
  }

  const block = lines.slice(blockStart, blockEnd)
  const isOurs = (baseURL && block.some(line => line.includes(baseURL)))
    || (credentialRef && block.some(line => line.includes(credentialRef)))
  if (!isOurs) return yaml

  let removeEnd = blockEnd
  while (removeEnd < segmentEnd && !lines[removeEnd].trim()) removeEnd += 1
  lines.splice(blockStart, removeEnd - blockStart)
  return lines.join('\n')
}

/**
 * 删掉 `refs` 段里的某一条引用（改名后旧引用名已无人使用）。
 *
 * 只删名字完全相等的那一行；没有就原样返回，不顺手动别的引用。
 */
export function dropCredentialRef(yaml, refName) {
  const lines = yaml && yaml.length ? yaml.split(/\r?\n/) : []
  const refsAt = lines.findIndex(line => /^refs:\s*(\{\})?\s*$/.test(line))
  if (refsAt < 0) return yaml

  let refsEnd = lines.length
  for (let i = refsAt + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    if (!/^\s/.test(line)) {
      refsEnd = i
      break
    }
  }

  const entry = new RegExp(`^\\s+${escapeRegExp(refName)}:\\s*`)
  for (let i = refsAt + 1; i < refsEnd; i += 1) {
    if (entry.test(lines[i])) {
      lines.splice(i, 1)
      return lines.join('\n')
    }
  }
  return yaml
}
