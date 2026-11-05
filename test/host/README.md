# Disposable DSH compatibility tests

These tests run the published DSH CLI against disposable profiles and a local
HTTP receiver. They never use your normal `~/.dsh`, IM accounts or model keys.
The supported targets are exactly `0.2.1-rc.5` and `0.2.2-rc.1`; the `0.2.1-rc.2`
runtime in upstream issue #51 and unverified future releases remain excluded. The published notifier `0.13.1`
still has its old requirements: this procedure validates the development source.

## Set up the pinned host

Use Node **>=24.9.0** for `0.2.2-rc.1` (verified on Node 24.22.1). Keep the host
installation separate from the notifier repository:

```bash
export DSH_NOTIFIER_HOST_ROOT="$(mktemp -d)"
npm install --prefix "$DSH_NOTIFIER_HOST_ROOT" --ignore-scripts \
  @deepseek-ai/dsh@0.2.2-rc.1 pnpm@10.32.1
node test/host/harness.compat.mjs
node test/host/harness.smoke.mjs
```

Do not omit the host's platform-specific optional packages: DSH needs its
prebuilt native binding to boot. No install/build scripts are required for the
verified Linux x64 environment. `pnpm` is needed for the actual CLI installation
check below; the smoke itself uses DSH's profile-bundle loading path.

## Paths and isolation

| Variable | Default | Purpose |
| --- | --- | --- |
| `DSH_NOTIFIER_HOST_ROOT` | OS temporary directory + `dsh-notifier-rc5-host` | Directory containing the pinned host installation's `node_modules`. |
| `DSH_NOTIFIER_SCRATCH_ROOT` | OS temporary directory + `dsh-notifier-host-tests-<pid>` | Only location where the harness creates/removes profiles. |
| `DSH_NOTIFIER_PLUGIN_ROOT` | Notifier repository | Optional unpacked package directory to test instead of the working tree. |

Every mutating helper rejects paths outside the scratch root and paths inside
the real `~/.dsh`. Each invocation uses its own default scratch root. Children
receive an allowlisted environment, not the parent's provider credentials.
See [never-touch-real-profile.md](never-touch-real-profile.md).

## What is verified

- `harness.compat.mjs` uses the published app-boot compatibility evaluator. It
  reproduces #51, accepts the current manifest on rc.5 with no exemption, rejects
  stale `engines.dsh` even when peers match, and rejects unverified host versions.
- The same check also accepts `0.2.2-rc.1` and reproduces the old rc.5-only
  manifest's rejection on the new host. To repeat the regression against rc.5,
  select a separate host root and install `@deepseek-ai/dsh@0.2.1-rc.5` there.
- `harness.smoke.mjs` boots the real web profile, exchanges its temporary launch
  token for a browser cookie, verifies unauthenticated RPC receives `401`, and
  checks `surface.home` and `channels.list` (28 outbound channels plus an
  inbound-only row) over HTTP with valid envelopes.
- The same smoke boots headless without `connection`/`webServer`, checks that the
  notifier activates and its probe can push to the temporary HTTP receiver.
- Headless may exit with `MISSING_CREDENTIAL` after that successful delivery:
  there is intentionally no model key. This does not prove a complete model turn.
- No browser visual walkthrough or provider/device delivery is claimed.

The three portable-path tests and manifest consistency tests run in `npm test`.
The explicit host scripts remain outside that test glob and require the pinned
host installation above.

## Check the distributable and real CLI installation

From the repository root:

```bash
export DSH_NOTIFIER_PACKAGE_TEST="$(mktemp -d)"
npm pack --ignore-scripts --pack-destination "$DSH_NOTIFIER_PACKAGE_TEST"
mv "$DSH_NOTIFIER_PACKAGE_TEST/dsh-notifier-0.13.1.tgz" \
  "$DSH_NOTIFIER_PACKAGE_TEST/dsh-notifier-0.13.1-dsh-022-rc1.tgz"
mkdir "$DSH_NOTIFIER_PACKAGE_TEST/unpacked"
tar -xzf "$DSH_NOTIFIER_PACKAGE_TEST/dsh-notifier-0.13.1-dsh-022-rc1.tgz" \
  -C "$DSH_NOTIFIER_PACKAGE_TEST/unpacked" --strip-components=1
DSH_NOTIFIER_PLUGIN_ROOT="$DSH_NOTIFIER_PACKAGE_TEST/unpacked" \
  node test/host/harness.smoke.mjs

export DSH_HOME="$(mktemp -d)"
export PATH="$DSH_NOTIFIER_HOST_ROOT/node_modules/.bin:$PATH"
node "$DSH_NOTIFIER_HOST_ROOT/node_modules/@deepseek-ai/dsh/lib/bin.js" \
  plugin --profile web add "$DSH_NOTIFIER_PACKAGE_TEST/dsh-notifier-0.13.1-dsh-022-rc1.tgz" \
  --ignore-scripts
node "$DSH_NOTIFIER_HOST_ROOT/node_modules/@deepseek-ai/dsh/lib/bin.js" \
  --profile web --dump-config
```

Use a fresh terminal afterward to restore any existing DSH_HOME/PATH settings.
Use the distinct tarball filename when upgrading an existing installation. In
the verified pnpm 10.32.1 path, overwriting the old file at the same absolute
path and keeping package version `0.13.1` reused the old installed manifest.
Selecting the newly named file installed the updated exact host requirement
without clearing the store, removing the profile or granting an exemption.
Do not pass `--no-optional`: that combination produced a missing optional-package
lockfile entry in pnpm 10.32.1 during this verification; the normal installation
above succeeded. No compatibility exemption was granted. The peer warning for
Cordis does not mean a host mismatch: DSH supplies Cordis through its installation.

## Limits and review scope

This branch builds on upstream `dev`, which already contains the original rc.5 install-gate,
core/web injection split and other in-progress new-host changes. Open follow-up
PRs against **upstream dev** to keep the diff focused; it is not a minimal patch
against the released main branch. Provider credentials/state must be configured
again as required by the existing development migration.
