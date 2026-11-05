// dsh-notifier adapter: desktop
// 本地渠道：调用操作系统原生桌面通知（v0.4.0 新增，与 bell 平级的零凭证渠道）。
// 第一性原则：跨平台通知最成熟的实现就是 OS 自带的命令——macOS osascript、
// Linux notify-send（libnotify）、Windows PowerShell BurntToast 模块；插件零运行时
// 依赖、零 vendored 二进制，只做「命令拼装 + 失败归一」。
//
// 对抗性防御（本文件的安全底线）：
//   - 一律 spawn(file, argsArray)，永不 shell:true / 模板拼 shell——标题/正文含任意
//     字符（引号、$(...)、; rm -rf）也只是字面参数，注入在结构上不可能；
//   - osascript 的 AppleScript 字面量做转义（\ 与 " 各自转义，控制字符抹平）；
//   - PowerShell 单引号字面量按 PS 规则 '' 转义（整段脚本作为单个 argv 传入）；
//   - notify-send 标题/正文前置 -- 终结符，防标题以 - 开头被解析成选项；
//   - 标题/正文长度钳制（通知中心的实际显示上限），超长不报错只截断；
//   - 子进程 10s 超时 kill（PowerShell 偶发卡死防御），绝不悬挂通知流程；
//   - 命令缺失（ENOENT：headless Linux 无 notify-send 等）抛中文 NotifyError——
//     渠道级失败可见但不影响其他渠道（notify.mjs 每渠道独立 try/catch）。
//
// 语义对接（与其他渠道同规矩）：
//   - msg.silent === true 直接返回——静默推送的本地等价物就是不打扰；
//   - level → 紧迫度映射（Linux -u critical/normal/low；macOS 紧急级带提示音）；
//   - sound 配置：'auto'（默认，仅 timeSensitive 出声）/ 'always' / 'never'。
//   - Linux 无独立声音参数——是否出声由桌面环境按 urgency 决定（ GNOME 忽略 -t 同理，
//     属平台行为，插件不越权模拟）。

import { spawn } from 'node:child_process'
import { accessSync, constants as fsConstants, statSync } from 'node:fs'
import { join } from 'node:path'
import { NotifyError, ERROR_CODES } from './_shared.mjs'

export const type = 'desktop'

/**
 * 投递证据等级（delivery-evidence.mjs 的词汇）：本地桌面通知没有 provider 回执——
 * 命令退出码 0 只说明系统接口被调过，屏幕上是否真的出现（勿扰/通知权限/横幅开关）
 * 插件观测不到。声明 unverifiable 后控制面不再把 accepted 当绿色 healthy：
 * UI 显示「可用 / Ready」，绝不替用户担保「已经能收到通知」。
 */
export const deliveryEvidence = 'unverifiable'

/** 子进程硬超时（ms）：PowerShell 冷启动偶发慢，10s 足够且绝不悬挂调用方。 */
const COMMAND_TIMEOUT_MS = 10_000

/** 标题/正文长度钳制（通知中心实际显示上限量级；分段由上游 segment 负责，这里只防极端值）。 */
const TITLE_MAX = 120
const BODY_MAX = 500

/** level → libnotify urgency 映射（timeSensitive 视作最高档）。 */
const URGENCY_OF = { timeSensitive: 'critical', active: 'normal', passive: 'low' }

/** macOS 提示音名（系统自带音效，紧急级默认用它）。 */
const MAC_SOUND = 'Ping'

// ---- macOS 通知身份（为什么身份这件事必须写清楚）--------------------------------
// `osascript -e 'display notification'` 在现役 macOS 上由 **Script Editor**（脚本编辑器）
// 的应用身份发出：通知设置里看不到 dsh-notifier，用户想授权也无处可授；命令照样退出 0，
// 所以退出码不能当作送达证据。能拿到自有身份的唯一零依赖替代品是 terminal-notifier
// （自带 app bundle，项目已停更但仍是社区通用做法）——装了就用它，没装回落 osascript，
// 并在错误文案里点名用户真正要授权的发送方。
// 放弃的方案：osacompile 生成 applet 冒充自有身份。实测直接执行 applet 二进制时
// `on run argv` 收不到命令行参数（argv 为空 → -1728 且弹阻塞对话框），只能改用
// Apple Event 传参，等于再要一道自动化授权，比它解决的问题更脆。
const MAC_SENDER_FALLBACK = 'Script Editor'

/** 通知发送方在系统「通知」设置里的名字（错误文案与自检提示共用）。 */
export function macSenderName(strategy) {
  return strategy?.kind === 'terminal-notifier' ? 'terminal-notifier' : MAC_SENDER_FALLBACK
}

/** 在 PATH 里找可执行文件（纯文件系统扫描：不 spawn `which`，也不经 shell）。 */
export function findExecutableOnPath(name, pathEnv = process.env.PATH ?? '') {
  for (const dir of String(pathEnv ?? '').split(':')) {
    if (dir === '') continue
    const candidate = join(dir, name)
    try {
      if (!statSync(candidate).isFile()) continue
      accessSync(candidate, fsConstants.X_OK)
      return candidate
    } catch { /* 不可执行 / 不存在：继续找 */ }
  }
  return null
}

/**
 * macOS 投递策略（进程内缓存一次）：`{ kind: 'terminal-notifier' | 'osascript', file }`。
 * 只做只读探测——找不到 terminal-notifier 就回落 osascript（历史行为不变），探测永不抛。
 */
let macStrategyPromise = null
export function resolveMacStrategy(options = {}) {
  if (macStrategyPromise !== null) return macStrategyPromise
  const pathEnv = options.pathEnv ?? process.env.PATH ?? ''
  macStrategyPromise = Promise.resolve().then(() => {
    const notifier = findExecutableOnPath('terminal-notifier', pathEnv)
    return notifier !== null
      ? { kind: 'terminal-notifier', file: notifier }
      : { kind: 'osascript', file: 'osascript' }
  })
  return macStrategyPromise
}

/** 测试缝：清空缓存（macStrategyPromise 是进程级单例）。 */
export function _resetMacStrategy() {
  macStrategyPromise = null
}

/**
 * 校验并归一化配置；桌面渠道无凭证，唯一可选项 sound 钳制合法枚举。
 * G-64：布尔形态显式解析——YAML 裸 `sound: true/false` 首版被静默吞成 auto，
 * 用户写 false 却照样在紧急级出声是反直觉的。true→always / false→never 语义
 * 与三态枚举自然对齐；其余非法值回落 auto（默认策略），不因拼错炸掉桌面通知。
 * @returns {{ sound: 'auto'|'always'|'never' }}
 */
export function resolve(cfg = {}) {
  const raw = cfg?.sound
  if (raw === true) return { sound: 'always' }
  if (raw === false) return { sound: 'never' }
  return { sound: raw === 'always' || raw === 'never' ? raw : 'auto' }
}

/** 提示音策略：never 关 / always 开 / auto 仅紧急级。 */
function soundOn(resolved, msg) {
  if (resolved?.sound === 'never') return false
  if (resolved?.sound === 'always') return true
  return msg?.level === 'timeSensitive'
}

/** 控制字符抹平（通知横幅不支持换行/控制字符；AppleScript 字面量更不允许裸换行）。 */
function flatten(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ')
}

/** 长度钳制：超长截断加省略号，不报错（通知场景宁可截断不可失败）。 */
function clampText(value, max) {
  const text = flatten(value)
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1))}…`
}

/** AppleScript 双引号字面量转义：先 \ 后 "（入参已 clampText 钳制过的文本）。 */
function asq(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

/** PowerShell 单引号字面量转义：' → ''（入参已钳制；整段脚本作为单个 argv，不经 shell）。 */
function psq(value) {
  return String(value ?? '').replaceAll("'", "''")
}

/**
 * 纯命令构造器（单测核心）：按平台产出 { file, args } 或 { unsupported }。
 * 不做任何 IO——平台的可用性探测（Windows BurntToast）由 send 层缓存后经 probe 传入。
 * @param {string} platform - process.platform（注入便于测试）。
 * @param {object} resolved - resolve() 产物。
 * @param {object} msg - { title, content, level, silent }。
 * @param {object|boolean|null} probe - win32：BurntToast 探测结果；darwin：resolveMacStrategy()
 *   的策略对象（null = 未探测，按历史 osascript 行为）。
 * @returns {{ file: string, args: string[] } | { unsupported: string }}
 */
export function buildDesktopCommand(platform, resolved, msg, probe = null) {
  if (msg?.silent === true) return { unsupported: 'silent' }
  const title = clampText(msg?.title, TITLE_MAX)
  const body = clampText(msg?.content, BODY_MAX)
  const sound = soundOn(resolved, msg)
  if (platform === 'darwin') {
    if (probe?.kind === 'terminal-notifier') {
      // terminal-notifier 自带 app 身份，标题/正文各成参数（不经脚本宿主）
      return {
        file: probe.file,
        args: ['-title', title, '-message', body, ...(sound ? ['-sound', MAC_SOUND] : [])],
      }
    }
    // display notification "正文" with title "标题" [sound name "Ping"]
    let script = `display notification "${asq(body)}" with title "${asq(title)}"`
    if (sound) script += ` sound name "${MAC_SOUND}"`
    return { file: 'osascript', args: ['-e', script] }
  }
  if (platform === 'linux') {
    // -a 应用名 / -u 紧迫度 / -- 终结选项（防标题以 - 开头被当参数）
    return {
      file: 'notify-send',
      args: ['-a', 'dsh-notifier', '-u', URGENCY_OF[msg?.level] ?? 'normal', '--', title, body],
    }
  }
  if (platform === 'win32') {
    if (probe !== true) {
      return {
        unsupported: 'burnttoast',
        hint: 'Windows 桌面通知需要 BurntToast 模块：以管理员身份运行 PowerShell 执行 Install-Module -Name BurntToast -Scope CurrentUser，或改用 bell / 浏览器通知（管理台「通知」页）',
      }
    }
    // New-BurntToastNotification -Text @('标题','正文') [-SuppressSound]
    // 整段脚本作为单个 argv 传入（spawn 永不经 shell），PS 字面量单引号转义
    const suppress = sound ? '' : ' -SuppressSound'
    const script = `New-BurntToastNotification -Text @('${psq(title)}','${psq(body)}')${suppress}`
    return {
      file: 'powershell.exe',
      args: ['-NoProfile', '-NonInteractive', '-Command', script],
    }
  }
  return { unsupported: `平台 ${String(platform)} 无原生桌面通知支持（可用：macOS/Linux/Windows）` }
}

/**
 * 跑一条子命令：resolve/reject 归一——ENOENT 抛中文 NOT_CONFIGURED，非零退出码抛
 * API_ERROR（带 stderr 摘要），超时 kill 抛 TIMEOUT。probe 调用方传 catchAll 把
 * 一切失败折叠成 false（探测失败按不可用处理，不抛）。
 * @returns {Promise<{ code: number, stderr: string }>}
 */
function runCommand(file, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    let child
    try {
      child = spawnImpl(file, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    } catch (error) {
      rejectPromise(new NotifyError(`桌面通知命令启动失败: ${error instanceof Error ? error.message : String(error)}`, ERROR_CODES.NETWORK_ERROR))
      return
    }
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try { child.kill() } catch { /* 已退出 */ }
      rejectPromise(new NotifyError(`桌面通知命令超时（${COMMAND_TIMEOUT_MS}ms）：${file}`, ERROR_CODES.TIMEOUT))
    }, COMMAND_TIMEOUT_MS)
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn(value)
    }
    child.on('error', (error) => {
      const notFound = error instanceof Error && 'code' in error && error.code === 'ENOENT'
      finish(
        rejectPromise,
        notFound
          ? new NotifyError(`系统缺少 ${file}——Linux 需桌面环境（libnotify），无桌面场景请改用 bell 渠道`, ERROR_CODES.NOT_CONFIGURED)
          : new NotifyError(`桌面通知命令执行失败: ${error instanceof Error ? error.message : String(error)}`, ERROR_CODES.NETWORK_ERROR),
      )
    })
    child.stderr?.on('data', (chunk) => { stderr += String(chunk) })
    child.on('close', (code) => {
      if (code === 0) {
        finish(resolvePromise, { code, stderr })
      } else {
        finish(rejectPromise, new NotifyError(`桌面通知命令退出码 ${code}${stderr !== '' ? `: ${stderr.slice(0, 200)}` : ''}`, ERROR_CODES.API_ERROR))
      }
    })
  })
}

/**
 * 发送桌面通知。silent 直接跳过；Windows 首次调用探测 BurntToast 并缓存于 resolved
 * （插件生命周期内只探测一次，配置热重载会重新 resolve = 重新探测）。
 * @returns {Promise<void>} 失败一律抛 NotifyError（中文指引），由上层渠道级 try/catch 兜住。
 */
export async function send(resolved, msg) {
  const platform = process.platform
  if (platform === 'win32' && resolved?.__burntToastProbe === undefined) {
    // 探测失败（无 PowerShell / 模块缺失）折叠为 false，绝不让探测本身抛
    resolved.__burntToastProbe = runCommand('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command', 'if (Get-Module -ListAvailable BurntToast) { exit 0 } else { exit 1 }',
    ]).then(() => true, () => false)
  }
  const probe = platform === 'win32'
    ? await resolved.__burntToastProbe
    : (platform === 'darwin' ? await resolveMacStrategy() : null)
  const command = buildDesktopCommand(platform, resolved, msg, probe)
  if (command.unsupported === 'silent') return
  if (command.unsupported !== undefined) {
    throw new NotifyError(command.hint ?? command.unsupported, ERROR_CODES.NOT_CONFIGURED)
  }
  try {
    await runCommand(command.file, command.args)
  } catch (error) {
    // macOS：把「发送方是谁、去哪里授权」写进公开文案——否则用户只看到「退出码 1」，
    // 真实原因却常常是系统把 Script Editor / terminal-notifier 的通知关掉了。
    if (platform !== 'darwin') throw error
    const reason = error instanceof Error ? error.message : String(error)
    throw new NotifyError(
      `${reason}——macOS 通知需在「系统设置 → 通知」里允许发送方「${macSenderName(probe)}」`,
      error instanceof Error && error.code !== undefined ? error.code : ERROR_CODES.API_ERROR,
    )
  }
}

/** 测试注入缝：替换 spawn 实现（仅 test/desktop.test.mjs 使用，生产恒为 node:child_process.spawn）。 */
export let spawnImpl = spawn
export function _setSpawnImpl(fn) {
  spawnImpl = typeof fn === 'function' ? fn : spawn
}
