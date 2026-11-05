// dsh-notifier test/channel-metadata-i18n.test.mjs
// 英文声明表守卫：渠道配置元数据（字段说明 / 渠道名 / 渠道简介）必须有英文版本。
//
// 背景（issue: English surface）：控制面早已输出双语槽 `{ en, zh }`
// （src/control-surface/channels.mjs、activity.mjs），但渠道声明表里只有中文 `desc`，
// 投影层只能把中文同时塞进 en/zh —— 英文 DSH 界面因此显示中文提示。
// 本套件是「不许再漏」的静态守卫，而不是翻译质量评审：
//   1) 声明表里凡是含 CJK 的 desc/label，必须配无 CJK 的 descEn/labelEn；
//   2) 投影层必须真的把 en 槽填成英文（缺 descEn 时回落 zh，保持旧行为）；
//   3) 包元数据（npm / DSH 插件卡片描述）不得回退成中文。

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CHANNEL_TYPES, channelFieldsOf } from '../src/config.mjs'
import { SPEC_CHANNELS } from '../src/adapters/spec-channels.mjs'
import { INBOUND_FIELDS } from '../src/inbound/channel-config.mjs'
import { createChannelProjection } from '../src/control-surface/channels.mjs'

/** CJK 统一表意文字 + 中文标点（含全角括号/分号/顿号）：英文文案里出现即视为未翻译。 */
const CJK = /[\u3000-\u303f\u4e00-\u9fff\uff01-\uff60]/
const hasCjk = (value) => typeof value === 'string' && CJK.test(value)
const isEnglish = (value) => typeof value === 'string' && value.trim().length > 0 && !CJK.test(value)

const rowOf = (rows, type) => rows.find((row) => row.type === type)

test('英文守卫：出站字段说明含中文时必须配 descEn，且 descEn 不得是中文或原文复制', () => {
  const missing = []
  for (const type of CHANNEL_TYPES) {
    for (const [key, meta] of Object.entries(channelFieldsOf(type))) {
      if (hasCjk(meta?.desc) !== true) continue
      if (isEnglish(meta?.descEn) !== true || meta.descEn === meta.desc) missing.push(`${type}.${key}`)
    }
  }
  assert.deepEqual(missing, [], '下列出站字段缺英文说明（descEn）')
})

test('英文守卫：入站字段说明含中文时必须配 descEn', () => {
  const missing = []
  for (const [type, fields] of Object.entries(INBOUND_FIELDS)) {
    for (const [key, meta] of Object.entries(fields ?? {})) {
      if (hasCjk(meta?.desc) !== true) continue
      if (isEnglish(meta?.descEn) !== true || meta.descEn === meta.desc) missing.push(`${type}.${key}`)
    }
  }
  assert.deepEqual(missing, [], '下列入站字段缺英文说明（descEn）')
})

test('英文守卫：声明表渠道名与渠道简介同样要有英文版本', () => {
  const missing = []
  for (const [type, spec] of Object.entries(SPEC_CHANNELS)) {
    if (hasCjk(spec?.label) === true && isEnglish(spec?.labelEn) !== true) missing.push(`${type}.label`)
    if (hasCjk(spec?.desc) === true && isEnglish(spec?.descEn) !== true) missing.push(`${type}.desc`)
  }
  assert.deepEqual(missing, [], '下列声明表渠道缺英文 labelEn / descEn')
})

test('英文守卫：Native 投影把 en 槽填成英文、zh 槽保留中文', () => {
  const type = CHANNEL_TYPES[0]
  const projection = createChannelProjection({
    outboundConfig: {
      describe: () => ({
        configured: true,
        active: true,
        applyMode: 'hot',
        configRevision: 1,
        fields: channelFieldsOf(type),
      }),
      raw: () => ({}),
    },
  })
  const row = rowOf(projection.list(), type)
  const fields = Object.entries(row.notify.fields).filter(([, view]) => view.description !== undefined)
  assert.ok(fields.length > 0, `${type} 必须有带说明的字段，否则本守卫失去意义`)
  for (const [key, view] of fields) {
    assert.equal(hasCjk(view.description.zh), true, `${type}.${key} 的 zh 槽应保留中文`)
    assert.equal(isEnglish(view.description.en), true, `${type}.${key} 的 en 槽必须是英文`)
    assert.notEqual(view.description.en, view.description.zh, `${type}.${key} 的 en/zh 槽不得同文`)
  }
})

test('英文守卫：未翻译字段回落 zh（旧声明表不报错、不丢说明）', () => {
  const type = CHANNEL_TYPES[0]
  const projection = createChannelProjection({
    outboundConfig: {
      describe: () => ({
        configured: true,
        active: true,
        applyMode: 'hot',
        configRevision: 1,
        fields: { onlyChinese: { desc: '只有中文的旧字段说明' } },
      }),
      raw: () => ({}),
    },
  })
  const view = rowOf(projection.list(), type).notify.fields.onlyChinese
  assert.deepEqual(view.description, { en: '只有中文的旧字段说明', zh: '只有中文的旧字段说明' })
})

test('英文守卫：包元数据描述（npm / DSH 插件卡片）不得包含中文', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(typeof pkg.description, 'string')
  assert.equal(hasCjk(pkg.description), false, 'package.json description 必须是英文（插件卡片直接展示）')
  assert.ok(pkg.description.length > 20, 'description 应保留产品摘要，不要退化成一句话占位')
})
