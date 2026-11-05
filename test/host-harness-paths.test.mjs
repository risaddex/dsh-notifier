import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  SCRATCH_ROOT, REAL_DSH_HOME, assertInsideScratch, assertNotRealDshHome,
  makeDisposableDshHome,
} from './host/harness.mjs'

test('host harness: a disposable profile can be created and cleaned on any machine', () => {
  const profile = makeDisposableDshHome('portable-path-test')
  try {
    assert(existsSync(profile.home))
    assert.doesNotThrow(() => assertInsideScratch(profile.home))
    assert.notEqual(profile.home, REAL_DSH_HOME)
  } finally { profile.cleanup() }
  assert.equal(existsSync(profile.home), false)
})

test('host harness: portable defaults preserve profile and scratch boundaries', () => {
  assert.throws(() => assertNotRealDshHome(REAL_DSH_HOME), /real DSH home/)
  assert.throws(() => assertNotRealDshHome(join(REAL_DSH_HOME, 'profiles/web')), /real DSH home/)
  assert.throws(() => assertInsideScratch(join(SCRATCH_ROOT, '..', 'outside')), /outside scratch/)
  assert.throws(() => makeDisposableDshHome('../outside'), /invalid home name/)
})

test('host harness: host installation and scratch roots can be selected explicitly', () => {
  const hostRoot = join(tmpdir(), 'notifier-host-path-fixture')
  const scratch = join(tmpdir(), 'notifier-scratch-path-fixture')
  const moduleUrl = new URL('./host/harness.mjs', import.meta.url).href
  const script = `import { DSH_CLI, DSH_HOST_NODE_MODULES, SCRATCH_ROOT } from ${JSON.stringify(moduleUrl)};
    console.log(JSON.stringify({ DSH_CLI, DSH_HOST_NODE_MODULES, SCRATCH_ROOT }));`
  const actual = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    env: { DSH_NOTIFIER_HOST_ROOT: hostRoot, DSH_NOTIFIER_SCRATCH_ROOT: scratch },
  }))
  assert.deepEqual(actual, {
    DSH_CLI: join(hostRoot, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
    DSH_HOST_NODE_MODULES: join(hostRoot, 'node_modules'),
    SCRATCH_ROOT: scratch,
  })
})
