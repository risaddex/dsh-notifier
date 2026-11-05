# Workstream: DSH 0.2.2-rc.1 compatibility

- Agent identity: `Codex | cloud workspace`
- Agent: `Codex`
- Branch: `codex/dsh-021-compat`
- Status: `done`
- Start/end: `2026-11-05 -> 2026-11-05`
- Scope: Add verified support for DSH 0.2.2-rc.1 while retaining the previously verified 0.2.1-rc.5 on the user's existing fork branch.
- Plan: (1) Fast-forward to the user's current fork head, preserving desktop/i18n work; (2) install the exact new published host in isolation and compare consumed contracts; (3) align engines.dsh, optional peer and the matrix using exact alternatives; (4) run both host gates and packed web/headless/RPC checks, plus a real CLI installation; (5) run regression/guards, update evidence and publish the existing fork branch.
- Owned files: package.json; compatibility tests/matrix; host harness scripts/docs; CHANGELOG.md; HANDOFF.md; current compatibility guidance and memory; new compatibility evidence; this workstream.
- Do not touch: Existing desktop/i18n behavior, provider/security runtime paths, daily profiles, upstream refs or releases.
- Risks: New host contracts can change despite an accepted manifest; a wider guessed range would silently permit untested hosts; new host requires Node >=24.9.0 while the older verified host remains supported.
- Validation: Focused compatibility tests; full npm test with disposable DSH_HOME; release/host/matrix/syntax guards; native-host smoke against both pinned releases; packaged CLI installation without exemptions; clean local/remote tree comparison.
- Adversarial review: Exact alternatives reject unverified releases; rc.5 regression remains green. Published gate/connection contracts compared. Real packed smoke covers cookie authentication, unauthenticated 401, Native RPC, notify registration and local delivery. Existing-profile test caught stale same-path tarball reuse; a distinct filename resolves it without exemptions or profile/store deletion.
- Handoff: 2059/2059 regression, 20/20 packed-host checks on each supported runtime, both five-check host gates and real rc.1 CLI installation/upgrade passed. See docs/new-host/evidence/dsh-022-compat.json and test/host/README.md. Update the existing fork branch; user rebuilds the newly named local tarball. No upstream PR, tag, merge or publication requested.
