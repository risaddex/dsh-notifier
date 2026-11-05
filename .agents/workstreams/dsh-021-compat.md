# Workstream: DSH 0.2.1 compatibility follow-up (#51)

- Agent identity: `Codex | cloud workspace`
- Agent: `Codex`
- Branch: `codex/dsh-021-compat`
- Status: `done`
- Start/end: `2026-11-05 -> 2026-11-05`
- Scope: Finish reproducible compatibility verification for the upstream dev migration to DSH 0.2.1-rc.5; prepare a branch in risaddex/dsh-notifier for an upstream dev PR.
- Plan: (1) Reuse the existing dev install-gate/core-web split; (2) guard the authoritative engines.dsh declaration against drift; (3) remove maintainer-machine assumptions from the disposable host harness; (4) validate the published rc.5 host and a packed plugin in isolated profiles; (5) run focused/full checks, document evidence and publish only the fork branch.
- Owned files: scripts/verify-host-compat.mjs; test/host-compat-matrix.test.mjs; test/host/harness.mjs; test/host/README.md; focused host-harness tests; docs/compatibility-matrix.md; CHANGELOG.md; HANDOFF.md; docs/memory/project-state.md; this workstream.
- Do not touch: Security findings from the v0.13.1 audit; provider integrations; upstream branches/releases; the remaining new-host roadmap.
- Risks: An engines.dsh declaration can override otherwise-correct peers; fake-host tests do not prove real boot; portable path changes must keep real ~/.dsh protected; current dev also includes upstream state/admission changes and is not a released 0.13.1 artifact.
- Validation: Focused compatibility/path tests; npm test with disposable DSH_HOME; verify-host-compat; verify-release; channel matrix; syntax check; real rc.5 web/headless smoke with local HTTP receiver; package contents and install/preflight checks.
- Adversarial review: Confirmed published host engines precedence; negative cases cover missing/inherited/stale/widened requirements. Verified real browser-cookie auth and unauthenticated 401; counted 28 outbound capabilities rather than all 29 projection rows. Native host optional binary was installed without enabling lifecycle scripts. No provider credentials, normal profiles or security runtime paths were changed.
- Handoff: Code commit `a8d639179091158cdc5c64d5c3b8a77230225565`; 2040/2040 unit tests, four published-host gate checks, 19/19 packed-host checks, and actual CLI tarball installation without exemptions passed. Reproduction and limits are in test/host/README.md and docs/new-host/evidence/issue-51-compat.json. Publish the fork branch and compare against upstream dev; no upstream PR, merge, tag or release requested.
