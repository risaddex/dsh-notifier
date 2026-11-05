# Optional SDK and DSH host compatibility matrix

Development compatibility verification: 2026-11-05. Published `0.13.1` remains a separate, older artifact.

This document separates three evidence levels:

- **contract/source verified** — repository seams and official source/artifact shape match;
- **host smoke verified** — the plugin was booted in that DSH release and the relevant host/client seam responded;
- **real-provider/device verified** — an external provider/device flow was exercised end to end.

Do not collapse these into one “supported” claim.

## Optional SDK / legacy compatibility

| Surface | Optional dependency | Supported seam | Missing/old shape | Lifecycle evidence | Capability status |
|---|---|---|---|---|---|
| Feishu QR login | `@larksuiteoapi/node-sdk` `>=1.61.1` | lazy `registerApp`; named/default export variants | normalized `missing-sdk` guidance | timeout/denied/expired/malformed/partial persistence guarded | contract-tested; provider validation scoped separately |
| QQ QR login | `@tencent-connect/qqbot-connector` `^1.2.0` | lazy `startQrConnect`; named/default export variants | incompatible export/result fails safely | timeout/SDK error/invalid credential list guarded | contract-tested; provider validation scoped separately |
| Feishu inbound WS | `@larksuiteoapi/node-sdk` | lazy `Client`/`WSClient`/`EventDispatcher`; isolated bounded HTTP instance | missing/incomplete SDK reports unavailable | idempotent start/stop, bounded transport, SDK-owned reconnect | contract-tested; long-connection real validation still external |
| QQ inbound gateway | none | native fetch + WebSocket implementation | transport errors isolated | heartbeat/reconnect/stop/restart covered by tests | contract-tested; gateway/device validation still external |
| QR terminal rendering | `qrcode-terminal` | login CLI convenience | absence does not affect credential result | callback failures absorbed | optional convenience |

Legacy YAML `inbound.allowUsers` remains a one-time migration input. Runtime membership is managed by pairing/admin APIs.

WxPusher inbound has a local `accountId` (default `default` when omitted). Multiple apps should use distinct explicit `accountId` values; channel names are never used as account IDs.

No optional SDK is a production runtime dependency.

## DSH host compatibility matrix

Declared host requirement (`engines.dsh`):

```text
0.2.1-rc.5
```

`engines.dsh` decides alone in the rc.5 preflight (`@deepseek-ai/dsh-app-boot`
`unmetRequirements`): once a plugin declares its own `engines.dsh`, its
`@deepseek-ai/dsh*` peers are ignored. The optional peer marker
`@deepseek-ai/dsh-session` is declared at the same line (`0.2.1-rc.5`), and
`scripts/verify-host-compat.mjs` keeps the own `engines.dsh` declaration, peer range, this matrix and
`dshWorkshop.compatibility.dshVersions` aligned.

| DSH | Core Session/Message seams | Native client dependency/slot seams | Native Control Surface evidence | Evidence level |
|---|---|---|---|---|
| `0.2.1-rc.5` | compatible with the rc.5 host contract set (tools/agents/connection/webServer seams present) | connection / locale / renderer / layout / sidebar / plugin-manager packages present; global panel slots exist | packed plugin boots in web/headless; browser-authenticated Native RPC responds; notify probe reaches a local HTTP receiver; actual CLI tarball installation needs no exemption | **host smoke verified** |
| `0.1.0-rc.6` | historical only | current Native surface not re-certified | old historical plugin verification only | **unverified** |

Peer range: `0.2.1-rc.5`.

No row is `real-device-verified`; the current row has source/artifact and isolated-host evidence.
The `0.1.7-*` family is no longer a supported target (removed with the rc.5 line).

### Issue #51: published package versus development source

The issue reports `dsh-notifier@0.13.1` being rejected by DSH `0.2.1-rc.2`.
The upstream development migration targets **only `0.2.1-rc.5`**, not every
`0.2.x` runtime. It is not yet a new npm release. Its authoritative
`engines.dsh`, optional peer and Workshop metadata all identify that exact host.
Changing a peer alone cannot override a stale `engines.dsh` in rc.5.

Reproducible installation/boot checks are documented in
[`test/host/README.md`](../test/host/README.md). The published host evaluator
reproduces the old manifest's rejection, accepts this development manifest on
rc.5 without an exemption, and still rejects rc.2 and unverified future hosts.
The smoke uses the temporary web process's launch-token exchange to obtain a
browser cookie; unauthenticated Native RPC remains rejected with `401`.
The channel projection includes 28 outbound channels and an additional
inbound-only row; its total row count is not the outbound channel count.

Provider/device delivery and a visual browser walkthrough remain unverified.

### Inbound file attachment boundary

File admission requires the Host AttachmentStore capability `attachments.saveFile`. A
legacy host that exposes the attachment service but not `saveFile` is outside the current
file-inbound support boundary: the plugin fails closed, does not pass a remote URL into the
Session, and emits a bounded diagnostic in both Chinese and English. The current supported
host matrix above is the rc.5 line only.

The closed #36 follow-up now has one real QQ C2C file-download sample: the URL used
`grouptalk.c2c.qq.com`, returned HTTP 200 without redirect or authentication, used
`application/octet-stream`, and its declared `content-length` matched the downloaded bytes.
The sample had no usable `content-disposition` filename. This confirms the download-side
shape for that sample only; it does not certify all QQ payloads. QQ GROUP attachment
evidence remains unreachable under the existing upstream group-control deny policy, so
`fileInbound` remains disabled until a supported-host end-to-end image/file admission run
is available.

Machine-readable block (the source of truth for `scripts/verify-host-compat.mjs` and
`npm run verify:release`):

```json dsh-host-matrix
{
  "peerPackage": "@deepseek-ai/dsh-session",
  "runtimes": [
    { "version": "0.2.1-rc.5", "status": "verified", "tag": "dsh-v0.2.1-rc.5" },
    { "version": "0.1.0-rc.6", "status": "unverified", "tag": null }
  ]
}
```

### v0.12 Connection transport note

The intended logical channel is `/dsh-notifier`.

On the earlier `0.1.7-*` hosts, `ctx.connection.rpc.handle` could not own the route because
its owner context lacked the required `webServer` injection. The current host line therefore
uses a guarded fallback that mounts the same authenticated request envelope on the Host web
server seam, applying Connection admission/trust rules. The Native mount lives in a child
fiber (`ctx.inject(['connection','webServer'], …)`) so headless/no-webServer profiles
degrade without crashing the notifier runtime.

This is a host-integration fact, not a reason to expose the loopback Admin API to Native.

### Client dependency set

v0.12 Native client metadata depends on these DSH client packages:

```text
@deepseek-ai/dsh-client-connection
@deepseek-ai/dsh-client-locale
@deepseek-ai/dsh-client-ui-renderer
@deepseek-ai/dsh-client-ui-layout
@deepseek-ai/dsh-client-ui-sidebar
@deepseek-ai/dsh-client-ui-plugin-manager
```

They are Host-provided client dependencies, not npm runtime dependencies of dsh-notifier.

## Provider/device scope

The v0.12 real-host gate verifies DSH integration. It does **not** automatically certify every Telegram/Feishu/QQ/DingTalk/WeChat/WxPusher provider payload, button ACK, media limit or reconnect condition.

Standing provider-level gaps remain documented in `docs/memory/risks.md`.
