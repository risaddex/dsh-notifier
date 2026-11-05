// dsh-notifier field-hints.mjs
// 手写 adapter 的字段表（管理台 / Native 凭证表单渲染用，v0.3.3 起）：
// 形状对齐 spec 引擎的 fields 声明（{ [key]: { required?, secret?, desc, descEn? } }）。
// spec 渠道不在此表——由 ADAPTERS[type].spec.fields 机器读取（单一事实源）。
// 元数据双语：中文 desc 是错误文案素材与旧行为默认值，descEn 是同一条说明的英文版本；
// 消费者（control-surface 投影 / createAdminApi(lang)）按语言取槽，缺 descEn 回落中文。

export const FIELD_HINTS = {
  telegram: {
    botToken: {
      required: true, secret: true, desc: 'Telegram Bot Token（@BotFather 获取）',
      descEn: 'Telegram Bot Token (get it from @BotFather)',
    },
    chatId: {
      required: true, secret: false, exposure: 'public', desc: '接收者的 chat id（可向 @userinfobot 查询）',
      descEn: 'Recipient chat id (look it up with @userinfobot)',
    },
  },
  dingtalk: {
    webhook: {
      required: true, secret: true, desc: '钉钉群自定义机器人完整地址',
      descEn: 'Full webhook URL of the DingTalk group custom robot',
    },
    secret: {
      required: false, secret: true, desc: '加签密钥（机器人安全设置选「加签」时填）',
      descEn: 'Signing secret (fill it in when the robot security setting is "Signature")',
    },
  },
  feishu: {
    webhook: {
      required: true, secret: true, desc: '飞书群自定义机器人完整地址',
      descEn: 'Full webhook URL of the Feishu group custom robot',
    },
    secret: {
      required: false, secret: true, desc: '加签密钥（机器人安全设置选「签名校验」时填）',
      descEn: 'Signing secret (fill it in when the robot security setting is "Signature verification")',
    },
  },
  wxpusher: {
    appToken: {
      required: true, secret: true, desc: 'WxPusher 应用 APP_TOKEN（wxpusher.zjiecode.com）',
      descEn: 'WxPusher app APP_TOKEN (wxpusher.zjiecode.com)',
    },
    accountId: {
      required: false, secret: false, desc: '本地账号标识（多账号/多应用时建议填写；不要填 APP_TOKEN）',
      descEn: 'Local account label (recommended when using multiple accounts or apps; do not put the APP_TOKEN here)',
    },
    uids: {
      required: false, secret: true, desc: '接收者 UID 数组，如 ["UID_xxx"]（与 topicIds 至少一项）',
      descEn: 'Array of recipient UIDs, e.g. ["UID_xxx"] (at least one of this and topicIds)',
    },
    topicIds: {
      required: false, secret: false, desc: '主题 ID 数组（群发用）',
      descEn: 'Array of topic IDs (for broadcasting to a group)',
    },
  },
  pushplus: {
    token: {
      required: true, secret: true, desc: 'pushplus token（www.pushplus.plus）',
      descEn: 'pushplus token (www.pushplus.plus)',
    },
  },
  serverchan: {
    sct: {
      required: true, secret: true, desc: 'Server酱 SENDKEY（sct.ftqq.com；SC3 企业版 sctp 前缀自动走 <数字>.push.ft07.com）',
      descEn: 'ServerChan SENDKEY (sct.ftqq.com; the SC3 enterprise "sctp" prefix automatically goes to <number>.push.ft07.com)',
    },
  },
  bark: {
    key: {
      required: true, secret: true, desc: 'Bark 设备 key（App 内复制）',
      descEn: 'Bark device key (copy it from the app)',
    },
    barkUrl: {
      required: false, secret: true, desc: '自建 Bark 服务地址（默认官方）',
      descEn: 'Self-hosted Bark server URL (official server by default)',
    },
    device: {
      required: false, secret: false, desc: '设备名（多设备时指定）',
      descEn: 'Device name (specify it when you have multiple devices)',
    },
  },
  webhook: {
    url: {
      required: true, secret: true, desc: '接收 POST JSON 的 webhook 地址',
      descEn: 'Webhook URL that receives the POST JSON',
    },
    headers: {
      required: false, secret: true, desc: '附加请求头对象，如 {"Authorization": "..."}',
      descEn: 'Extra request headers object, e.g. {"Authorization": "..."}',
    },
  },
  bell: {
    count: {
      required: false, secret: false, desc: '响铃次数 1-5（默认 1）',
      descEn: 'Number of rings, 1-5 (default 1)',
    },
  },
  desktop: {
    sound: {
      required: false, secret: false, desc: '提示音：auto（默认，仅紧急级）/ always / never',
      descEn: 'Sound: auto (default, urgent level only) / always / never',
    },
  },
  'qq-bot': {
    appId: {
      required: true, secret: true, desc: 'QQ 开放平台开发者 ID（q.qq.com → 机器人开发设置）',
      descEn: 'QQ Open Platform developer ID (q.qq.com -> Bot developer settings)',
    },
    appSecret: {
      required: true, secret: true, desc: '同页面 AppSecret',
      descEn: 'AppSecret on the same page',
    },
    targetType: {
      required: false, secret: false, desc: '"user"（单聊，默认）或 "group"（群聊）',
      descEn: '"user" (direct message, default) or "group" (group chat)',
    },
    userId: {
      required: false, secret: false, desc: '单聊目标用户 openid（targetType=user 时）',
      descEn: 'Target user openid for direct messages (used when targetType=user)',
    },
    groupId: {
      required: false, secret: false, desc: '群 open id（targetType=group 时）',
      descEn: 'Group open id (used when targetType=group)',
    },
    markdown: {
      required: false, secret: false, desc: '默认 markdown（msg_type=2）；填 false 回退纯文本（msg_type=0）',
      descEn: 'markdown by default (msg_type=2); set false to fall back to plain text (msg_type=0)',
    },
  },
  'wecom-app': {
    corpid: {
      required: true, secret: true, desc: '企业 ID（企业微信管理后台「我的企业」）',
      descEn: 'Corp ID (WeCom Admin Console > My Enterprise)',
    },
    secret: {
      required: true, secret: true, desc: '应用 Secret（管理后台「应用管理」）',
      descEn: 'App Secret (Admin Console > App Management)',
    },
    agentId: {
      required: true, secret: false, desc: '应用 AgentId（数字）',
      descEn: 'App AgentId (a number)',
    },
    toUser: {
      required: false, secret: false, desc: '接收成员账号，默认 "@all"',
      descEn: 'Recipient member accounts, default "@all"',
    },
  },
}
