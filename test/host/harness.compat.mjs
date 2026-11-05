#!/usr/bin/env node
// Exercise the published DSH installation gate, without importing the notifier.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DSH_HOST_NODE_MODULES, REPO_ROOT } from './harness.mjs'

const hostDir = join(DSH_HOST_NODE_MODULES, '@deepseek-ai/dsh-app-boot')
const host = JSON.parse(readFileSync(join(hostDir, 'package.json'), 'utf8'))
const supported = ['0.2.1-rc.5', '0.2.2-rc.1']
assert(supported.includes(host.version), 'Install one of the exact supported hosts before running this check')
const { evaluatePluginCompatibility } = await import(pathToFileURL(join(hostDir, 'lib/index.js')).href)
const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))

// Reproduce the pre-install rejection from #51, for both the reported runtime
// and the pinned current host. No exact-version exemption is supplied.
const legacy = structuredClone(manifest)
delete legacy.engines.dsh
legacy.peerDependencies['@deepseek-ai/dsh-session'] = '0.1.7-alpha.1 || 0.1.7-alpha.2 || 0.1.7-rc.1 || 0.1.7-rc.2'
for (const runtime of ['0.2.1-rc.2', host.version]) {
  const issue = evaluatePluginCompatibility(legacy, {}, runtime)
  assert.equal(issue.exempted, false)
  assert.equal(issue.requirements['@deepseek-ai/dsh-session'], legacy.peerDependencies['@deepseek-ai/dsh-session'])
}
console.log('PASS: published DSH gate reproduces #51 without an exemption')

for (const runtime of supported) {
  assert.equal(evaluatePluginCompatibility(manifest, {}, runtime), undefined)
}
console.log(`PASS: ${host.version} evaluator accepts both supported hosts without an exemption`)

const previous = structuredClone(manifest)
previous.engines.dsh = '0.2.1-rc.5'
previous.peerDependencies['@deepseek-ai/dsh-session'] = '0.2.1-rc.5'
assert.deepEqual(evaluatePluginCompatibility(previous, {}, '0.2.2-rc.1').requirements, { 'engines.dsh': '0.2.1-rc.5' })
console.log('PASS: previous rc.5-only manifest reproduces the 0.2.2-rc.1 rejection')

const staleEngine = structuredClone(manifest)
staleEngine.engines.dsh = '0.1.7-rc.2'
assert.deepEqual(evaluatePluginCompatibility(staleEngine, {}, host.version).requirements, { 'engines.dsh': '0.1.7-rc.2' })
console.log('PASS: stale engines.dsh is rejected even when the optional peer is correct')

for (const runtime of ['0.1.7-rc.2', '0.2.1-rc.2', '0.2.1-rc.6', '0.2.2-alpha.2', '0.2.2-rc.2']) {
  const issue = evaluatePluginCompatibility(manifest, {}, runtime)
  assert.equal(issue.exempted, false)
  assert.deepEqual(issue.requirements, { 'engines.dsh': manifest.engines.dsh })
}
console.log('PASS: unverified older and future hosts remain rejected')
