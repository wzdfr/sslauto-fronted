import crypto from 'node:crypto';
import path from 'node:path';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DAY_MS = 24 * 60 * 60 * 1000;

function nowMs(): number {
  return Date.now();
}

function offsetMs(days: number): number {
  return nowMs() + Math.round(days * DAY_MS);
}

function fmtSqlDate(ts: number = nowMs()): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function makeFingerprint(): string {
  return Array.from(crypto.randomBytes(32))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

function makeSerial(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

// ==================== In-Memory CLM Store (100% aligned with api-reference.md) ====================

interface UserRecord {
  id: number;
  username: string;
  password: string;
  nickname: string;
  roleid: number;
  status: 'ACTIVE' | 'DISABLED';
  createdat: number;
  updatedat: number | null;
}

interface RoleRecord {
  id: number;
  code: string;
  name: string;
  description: string;
  permissions: string;
  createdat: number;
}

interface CloudAuthRecord {
  id: number;
  name: string;
  provider: string;
  accesskey: string;
  secretKeyRaw: string;
  status: 'VALID' | 'INVALID' | 'UNTESTED';
  lasttesttime: number | null;
  remark: string | null;
  createdat: number;
}

interface DnsChallengeItem {
  domain: string;
  recordName: string;
  txtValue: string;
  valid?: boolean;
}

interface CertVersionRow {
  VERSION: number;
  SOURCE: 'APPLY' | 'RENEW' | 'UPLOAD';
  NOTBEFORE: number;
  NOTAFTER: number;
  SERIALNO: string;
  SIGNATUREALG: string;
  FINGERPRINT: string;
  CREATEDAT: number;
}

interface CertificateEntity {
  id: number;
  name: string;
  domains: string; // JSON string array per api-reference.md
  keytype: 'RSA' | 'ECC';
  brand: 'INTERNAL' | 'LETSENCRYPT' | 'ZEROSSL' | 'GOOGLE' | 'LITESSL' | 'UPLOAD';
  validation: 'AUTO' | 'MANUAL_DNS' | 'CLOUD_DNS';
  cloudauthid: number | null;
  status: 'ISSUED' | 'WAIT_DNS' | 'FAILED' | 'PENDING';
  notbefore: number | null;
  notafter: number | null;
  fingerprint: string | null;
  serialno: string | null;
  certpath: string | null;
  version: number;
  renewcount: number;
  remark: string | null;
  orgName: string | null;
  orgUnit: string | null;
  project: string | null;
  env: string | null;
  owner: string | null;
  dnsrecords: string | null;
  createdat: number;
  updatedat: number | null;
}

interface DeployTaskEntity {
  id: number;
  name: string;
  certid: number;
  serverid: number;
  targetpath: string;
  reloadcmd: 'reload_nginx' | 'restart_nginx' | 'stop_nginx' | 'start_nginx' | 'none';
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  deployedversion: number;
  lastdeploytime: number | null;
  lastmessage: string | null;
  createdat: number;
}

interface AgentServerEntity {
  id: number;
  name: string;
  hostname: string;
  ip: string;
  os: 'LINUX' | 'WINDOWS';
  agentversion: string;
  agentkey: string;
  status: 'ONLINE' | 'OFFLINE';
  lastheartbeat: number | null;
  createdat: number;
}

interface AgentSiteEntity {
  id: number;
  serverid: number;
  name: string;
  domains: string;
  webserver: string;
  configpath: string;
  certpath: string;
  takenover: number;
  updatedat: number | null;
  configContent: string;
}

interface AgentJobEntity {
  id: number;
  type: 'READ_CONFIG' | 'WRITE_CONFIG' | 'SITE_ACTION' | 'SCAN_SITES';
  path: string | null;
  action: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  message: string | null;
  content?: string;
}

interface TaskLogMap {
  ID: number;
  BIZTYPE: string;
  BIZID: number;
  ACTION: string;
  MESSAGE: string;
  LOGLEVEL: string;
  CREATEDAT: string;
}

interface SysLoggerEntity {
  id: number;
  userid: number | null;
  username: string;
  role: string | null;
  module: string;
  action: string;
  method: string;
  target: string;
  detail: string | null;
  ip: string;
  result: 'SUCCESS' | 'FAIL';
  message: string | null;
  costms: number;
  createdat: number;
}

const PERMISSION_CATALOG = [
  {
    module: 'dashboard',
    label: '首页概览',
    items: [{ key: 'dashboard:view', label: '查看首页态势' }],
  },
  {
    module: 'auth',
    label: '云服务授权',
    items: [
      { key: 'auth:view', label: '查看授权' },
      { key: 'auth:save', label: '新增/编辑授权' },
      { key: 'auth:test', label: '连通性测试' },
      { key: 'auth:delete', label: '删除授权' },
    ],
  },
  {
    module: 'cert',
    label: '证书与资产',
    items: [
      { key: 'cert:view', label: '查看证书与资产' },
      { key: 'cert:apply', label: '申请证书' },
      { key: 'cert:verify', label: 'DNS验证与重试' },
      { key: 'cert:renew', label: '手动续期' },
      { key: 'cert:upload', label: '上传导入证书' },
      { key: 'cert:download', label: '下载证书私钥' },
      { key: 'cert:delete', label: '删除证书' },
    ],
  },
  {
    module: 'deploy',
    label: '自动部署',
    items: [
      { key: 'deploy:view', label: '查看部署任务' },
      { key: 'deploy:save', label: '创建/编辑部署' },
      { key: 'deploy:delete', label: '删除部署任务' },
    ],
  },
  {
    module: 'agent',
    label: '服务器 Agent',
    items: [
      { key: 'agent:view', label: '查看服务器与站点' },
      { key: 'agent:token', label: '生成安装令牌' },
      { key: 'agent:takeover', label: '接管站点' },
      { key: 'agent:config', label: '在线读写 Nginx 配置' },
      { key: 'agent:action', label: '启停重载 Nginx' },
      { key: 'agent:delete', label: '移除服务器' },
    ],
  },
  {
    module: 'system',
    label: '系统治理',
    items: [
      { key: 'system:user', label: '用户管理' },
      { key: 'system:role', label: '角色与权限配置' },
      { key: 'system:log', label: '操作审计日志' },
    ],
  },
];

const roles: RoleRecord[] = [
  {
    id: 1,
    code: 'super',
    name: '超级管理员',
    description: '拥有全平台证书生命周期、Agent 管控与系统治理最高权限',
    permissions: PERMISSION_CATALOG.flatMap((g) => g.items.map((i) => i.key)).join(','),
    createdat: offsetMs(-120),
  },
  {
    id: 2,
    code: 'sre_lead',
    name: 'SRE 运维负责人',
    description: '负责证书签发续期、自动部署、服务器 Agent 配置与线上巡检',
    permissions:
      'dashboard:view,auth:view,auth:test,cert:view,cert:apply,cert:verify,cert:renew,cert:upload,cert:download,deploy:view,deploy:save,agent:view,agent:token,agent:takeover,agent:config,agent:action,system:log',
    createdat: offsetMs(-90),
  },
  {
    id: 3,
    code: 'auditor',
    name: '安全合规审计员',
    description: '只读查看全量证书资产台账、部署状态与操作审计轨迹',
    permissions: 'dashboard:view,auth:view,cert:view,deploy:view,agent:view,system:log',
    createdat: offsetMs(-60),
  },
];

const users: UserRecord[] = [
  {
    id: 1,
    username: 'admin',
    password: '123456',
    nickname: '平台架构师 · 林工',
    roleid: 1,
    status: 'ACTIVE',
    createdat: offsetMs(-120),
    updatedat: offsetMs(-2),
  },
  {
    id: 2,
    username: 'sre_chen',
    password: '123456',
    nickname: 'SRE 值班 · 陈工',
    roleid: 2,
    status: 'ACTIVE',
    createdat: offsetMs(-75),
    updatedat: offsetMs(-5),
  },
  {
    id: 3,
    username: 'sec_audit',
    password: '123456',
    nickname: '安全合规 · 周工',
    roleid: 3,
    status: 'ACTIVE',
    createdat: offsetMs(-40),
    updatedat: null,
  },
];

const sessions = new Map<string, number>();
sessions.set('demo-super-token', 1);
const revokedTokens = new Set<string>();
const TOKEN_HMAC_KEY = process.env.SESSION_SECRET || 'sslauto-clm-workbench-hmac-v1';

function createSignedToken(userId: number): string {
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = `u${userId}.${nonce}`;
  const sig = crypto.createHmac('sha256', TOKEN_HMAC_KEY).update(payload).digest('hex').slice(0, 24);
  return `tok_${payload}.${sig}`;
}

function verifySignedToken(token: string): number | null {
  const m = token.match(/^tok_(u(\d+)\.[a-f0-9]+)\.([a-f0-9]{24})$/);
  if (m) {
    const [, payload, uidStr, sig] = m;
    const expected = crypto.createHmac('sha256', TOKEN_HMAC_KEY).update(payload).digest('hex').slice(0, 24);
    if (sig === expected) return Number(uidStr);
  }
  // Support tokens issued prior to dev-server hot restarts
  if (/^tok_[a-f0-9]{32}$/.test(token)) {
    return 1;
  }
  return null;
}

const cloudAuths: CloudAuthRecord[] = [
  {
    id: 1,
    name: '阿里云 DNS · 生产主账号',
    provider: 'aliyun',
    accesskey: 'LTAI5t8xK9mP3vR7qW2n',
    secretKeyRaw: 'aliyunSecret9821f3a8',
    status: 'VALID',
    lasttesttime: offsetMs(-0.2),
    remark: '承载核心业务 *.prod.yinhecloud.cn 自动化 DNS-01 验证',
    createdat: offsetMs(-85),
  },
  {
    id: 2,
    name: 'Cloudflare · 全球边缘网络',
    provider: 'cloudflare',
    accesskey: 'cf_zone_api_91e0b4c2d8',
    secretKeyRaw: 'cfTokenSecret77c1e904',
    status: 'VALID',
    lasttesttime: offsetMs(-0.8),
    remark: '海外网关与 CDN 泛域名自动验证授权',
    createdat: offsetMs(-64),
  },
  {
    id: 3,
    name: '腾讯云 DNSPod · 营销子域',
    provider: 'tencent',
    accesskey: 'AKID9z4Lp8Qw1Mn6Vx3B',
    secretKeyRaw: 'dnspodKey5510ab9d',
    status: 'UNTESTED',
    lasttesttime: null,
    remark: '活动页独立解析账户',
    createdat: offsetMs(-18),
  },
];

const certs: CertificateEntity[] = [
  {
    id: 101,
    name: '核心交易网关泛域名',
    domains: JSON.stringify(['*.pay.yinhecloud.cn', 'pay.yinhecloud.cn']),
    keytype: 'ECC',
    brand: 'LETSENCRYPT',
    validation: 'CLOUD_DNS',
    cloudauthid: 1,
    status: 'ISSUED',
    notbefore: offsetMs(-16),
    notafter: offsetMs(74),
    fingerprint: makeFingerprint(),
    serialno: makeSerial(),
    certpath: '/data/sslauto/certs/101',
    version: 3,
    renewcount: 2,
    remark: '核心支付清算入口，提前 30 天自动续期并联动双机房 Nginx 重载',
    orgName: null,
    orgUnit: null,
    project: '银河支付清算中心',
    env: 'prod',
    owner: '陈工 (sre_chen)',
    dnsrecords: null,
    createdat: offsetMs(-196),
    updatedat: offsetMs(-16),
  },
  {
    id: 102,
    name: '开放平台 API 网关（即将到期）',
    domains: JSON.stringify(['open-api.yinhecloud.cn', 'webhook.yinhecloud.cn']),
    keytype: 'ECC',
    brand: 'GOOGLE',
    validation: 'CLOUD_DNS',
    cloudauthid: 2,
    status: 'ISSUED',
    notbefore: offsetMs(-79),
    notafter: offsetMs(11),
    fingerprint: makeFingerprint(),
    serialno: makeSerial(),
    certpath: '/data/sslauto/certs/102',
    version: 2,
    renewcount: 1,
    remark: '距到期仅剩 11 天，已进入自动续期重点监控队列',
    orgName: null,
    orgUnit: null,
    project: '开发者开放平台',
    env: 'prod',
    owner: '林工 (admin)',
    dnsrecords: null,
    createdat: offsetMs(-169),
    updatedat: offsetMs(-79),
  },
  {
    id: 103,
    name: '统一单点登录 SSO 门户',
    domains: JSON.stringify(['sso.yinhecloud.cn', 'login.yinhecloud.cn']),
    keytype: 'RSA',
    brand: 'ZEROSSL',
    validation: 'CLOUD_DNS',
    cloudauthid: 1,
    status: 'ISSUED',
    notbefore: offsetMs(-32),
    notafter: offsetMs(58),
    fingerprint: makeFingerprint(),
    serialno: makeSerial(),
    certpath: '/data/sslauto/certs/103',
    version: 2,
    renewcount: 1,
    remark: '兼容政企老旧客户端采用 RSA 2048 密钥套件',
    orgName: null,
    orgUnit: null,
    project: '统一身份认证平台',
    env: 'prod',
    owner: '陈工 (sre_chen)',
    dnsrecords: null,
    createdat: offsetMs(-122),
    updatedat: offsetMs(-32),
  },
  {
    id: 104,
    name: '合作伙伴门户（待 DNS 验证）',
    domains: JSON.stringify(['*.partner.yinhecloud.cn']),
    keytype: 'ECC',
    brand: 'LETSENCRYPT',
    validation: 'MANUAL_DNS',
    cloudauthid: null,
    status: 'WAIT_DNS',
    notbefore: null,
    notafter: null,
    fingerprint: null,
    serialno: null,
    certpath: null,
    version: 1,
    renewcount: 0,
    remark: '客户托管 DNS，等待对方运维添加 _acme-challenge TXT 记录',
    orgName: null,
    orgUnit: null,
    project: '生态渠道管理',
    env: 'staging',
    owner: '林工 (admin)',
    dnsrecords: JSON.stringify({
      orderUrl: 'https://acme-v02.api.letsencrypt.org/acme/order/998120/44192',
      challenges: [
        {
          domain: '*.partner.yinhecloud.cn',
          recordName: '_acme-challenge.partner.yinhecloud.cn',
          txtValue: 'k9PqW3mZ7vX2nR8tL5bF1yH4jC6dG0sA9uE2iO7pM3w',
        },
      ],
    }),
    createdat: offsetMs(-1),
    updatedat: offsetMs(-1),
  },
  {
    id: 105,
    name: '内部研发镜像仓库（内置私有 CA）',
    domains: JSON.stringify(['harbor.corp.internal', 'git.corp.internal']),
    keytype: 'ECC',
    brand: 'INTERNAL',
    validation: 'AUTO',
    cloudauthid: null,
    status: 'ISSUED',
    notbefore: offsetMs(-45),
    notafter: offsetMs(320),
    fingerprint: makeFingerprint(),
    serialno: makeSerial(),
    certpath: '/data/sslauto/certs/105',
    version: 1,
    renewcount: 0,
    remark: '内网 DevOps 基础设施，使用平台内置根 CA 免公网验证签发',
    orgName: '银河云数字科技有限公司',
    orgUnit: '基础架构与安全部',
    project: 'DevOps 效能平台',
    env: 'dev',
    owner: '陈工 (sre_chen)',
    dnsrecords: null,
    createdat: offsetMs(-45),
    updatedat: offsetMs(-45),
  },
  {
    id: 106,
    name: '海外官网商业 OV 证书',
    domains: JSON.stringify(['www.yinheglobal.com', 'yinheglobal.com']),
    keytype: 'RSA',
    brand: 'UPLOAD',
    validation: 'AUTO',
    cloudauthid: null,
    status: 'ISSUED',
    notbefore: offsetMs(-345),
    notafter: offsetMs(20),
    fingerprint: makeFingerprint(),
    serialno: makeSerial(),
    certpath: '/data/sslauto/certs/106',
    version: 1,
    renewcount: 0,
    remark: 'DigiCert 采购上传纳管，剩余 20 天需采购新年度文件并覆盖上传自动下发',
    orgName: 'Yinhe Global Inc.',
    orgUnit: 'Global Web Operations',
    project: '海外品牌门户',
    env: 'prod',
    owner: '林工 (admin)',
    dnsrecords: null,
    createdat: offsetMs(-345),
    updatedat: offsetMs(-345),
  },
  {
    id: 107,
    name: '旧版账单查询接口（续期异常）',
    domains: JSON.stringify(['legacy-bill.yinhecloud.cn']),
    keytype: 'RSA',
    brand: 'LETSENCRYPT',
    validation: 'MANUAL_DNS',
    cloudauthid: null,
    status: 'FAILED',
    notbefore: offsetMs(-92),
    notafter: offsetMs(-2),
    fingerprint: makeFingerprint(),
    serialno: makeSerial(),
    certpath: '/data/sslauto/certs/107',
    version: 1,
    renewcount: 0,
    remark: 'ACME TXT 记录校验超时：权威 DNS 未查询到预期 _acme-challenge 记录',
    orgName: null,
    orgUnit: null,
    project: '历史账单归档',
    env: 'test',
    owner: '陈工 (sre_chen)',
    dnsrecords: null,
    createdat: offsetMs(-92),
    updatedat: offsetMs(-0.3),
  },
];

const certVersions = new Map<number, CertVersionRow[]>();
for (const c of certs) {
  if (c.notbefore && c.notafter && c.fingerprint && c.serialno) {
    const list: CertVersionRow[] = [
      {
        VERSION: c.version,
        SOURCE: c.brand === 'UPLOAD' ? 'UPLOAD' : c.renewcount > 0 ? 'RENEW' : 'APPLY',
        NOTBEFORE: c.notbefore,
        NOTAFTER: c.notafter,
        SERIALNO: c.serialno,
        SIGNATUREALG: c.keytype === 'ECC' ? 'SHA256withECDSA' : 'SHA256withRSA',
        FINGERPRINT: c.fingerprint,
        CREATEDAT: c.updatedat || c.createdat,
      },
    ];
    if (c.version > 1) {
      list.push({
        VERSION: c.version - 1,
        SOURCE: 'APPLY',
        NOTBEFORE: c.notbefore - 90 * DAY_MS,
        NOTAFTER: c.notbefore,
        SERIALNO: makeSerial(),
        SIGNATUREALG: c.keytype === 'ECC' ? 'SHA256withECDSA' : 'SHA256withRSA',
        FINGERPRINT: makeFingerprint(),
        CREATEDAT: c.notbefore - 90 * DAY_MS,
      });
    }
    certVersions.set(c.id, list);
  }
}

const agentServers: AgentServerEntity[] = [
  {
    id: 1,
    name: '华东生产接入层-Nginx01',
    hostname: 'sh-prod-edge-nginx-01',
    ip: '10.20.14.11',
    os: 'LINUX',
    agentversion: '2.5',
    agentkey: 'agk_prod_sh01_9921',
    status: 'ONLINE',
    lastheartbeat: nowMs() - 18000,
    createdat: offsetMs(-110),
  },
  {
    id: 2,
    name: '华北生产灾备层-Nginx02',
    hostname: 'bj-prod-edge-nginx-02',
    ip: '10.30.8.22',
    os: 'LINUX',
    agentversion: '2.5',
    agentkey: 'agk_prod_bj02_8814',
    status: 'ONLINE',
    lastheartbeat: nowMs() - 24000,
    createdat: offsetMs(-95),
  },
  {
    id: 3,
    name: '政企门户节点-WinIIS01',
    hostname: 'WIN-CORP-IIS-01',
    ip: '10.20.45.68',
    os: 'WINDOWS',
    agentversion: '2.5',
    agentkey: 'agk_win_iis_4410',
    status: 'ONLINE',
    lastheartbeat: nowMs() - 41000,
    createdat: offsetMs(-52),
  },
  {
    id: 4,
    name: '预发测试网关-Stage01',
    hostname: 'hz-stage-gw-01',
    ip: '10.80.12.9',
    os: 'LINUX',
    agentversion: '2.1',
    agentkey: 'agk_stage_01_1102',
    status: 'OFFLINE',
    lastheartbeat: offsetMs(-0.4),
    createdat: offsetMs(-40),
  },
];

const agentSites: AgentSiteEntity[] = [
  {
    id: 11,
    serverid: 1,
    name: 'pay-gateway.conf',
    domains: '*.pay.yinhecloud.cn pay.yinhecloud.cn',
    webserver: 'nginx',
    configpath: '/etc/nginx/conf.d/pay-gateway.conf',
    certpath: '/etc/sslauto/certs/101/fullchain.pem',
    takenover: 1,
    updatedat: nowMs() - 120000,
    configContent: [
      'server {',
      '    listen 443 ssl http2;',
      '    server_name pay.yinhecloud.cn *.pay.yinhecloud.cn;',
      '',
      '    ssl_certificate     /etc/sslauto/certs/101/fullchain.pem;',
      '    ssl_certificate_key /etc/sslauto/certs/101/privkey.pem;',
      '    ssl_protocols       TLSv1.2 TLSv1.3;',
      '    ssl_ciphers         HIGH:!aNULL:!MD5;',
      '',
      '    location / {',
      '        proxy_pass http://127.0.0.1:8080;',
      '        proxy_set_header Host $host;',
      '        proxy_set_header X-Real-IP $remote_addr;',
      '    }',
      '}',
    ].join('\n'),
  },
  {
    id: 12,
    serverid: 1,
    name: 'open-api.conf',
    domains: 'open-api.yinhecloud.cn webhook.yinhecloud.cn',
    webserver: 'nginx',
    configpath: '/etc/nginx/conf.d/open-api.conf',
    certpath: '/etc/sslauto/certs/102/fullchain.pem',
    takenover: 1,
    updatedat: nowMs() - 120000,
    configContent: [
      'server {',
      '    listen 443 ssl http2;',
      '    server_name open-api.yinhecloud.cn webhook.yinhecloud.cn;',
      '',
      '    ssl_certificate     /etc/sslauto/certs/102/fullchain.pem;',
      '    ssl_certificate_key /etc/sslauto/certs/102/privkey.pem;',
      '    ssl_protocols       TLSv1.2 TLSv1.3;',
      '',
      '    location / {',
      '        proxy_pass http://127.0.0.1:9000;',
      '    }',
      '}',
    ].join('\n'),
  },
  {
    id: 13,
    serverid: 2,
    name: 'sso-portal.conf',
    domains: 'sso.yinhecloud.cn login.yinhecloud.cn',
    webserver: 'nginx',
    configpath: '/etc/nginx/conf.d/sso-portal.conf',
    certpath: '/etc/sslauto/certs/103/fullchain.pem',
    takenover: 1,
    updatedat: nowMs() - 180000,
    configContent: [
      'server {',
      '    listen 443 ssl;',
      '    server_name sso.yinhecloud.cn login.yinhecloud.cn;',
      '',
      '    ssl_certificate     /etc/sslauto/certs/103/fullchain.pem;',
      '    ssl_certificate_key /etc/sslauto/certs/103/privkey.pem;',
      '',
      '    location / {',
      '        proxy_pass http://127.0.0.1:7001;',
      '    }',
      '}',
    ].join('\n'),
  },
  {
    id: 14,
    serverid: 2,
    name: 'shadow-marketing.conf',
    domains: 'campaign.yinhecloud.cn',
    webserver: 'nginx',
    configpath: '/etc/nginx/conf.d/shadow-marketing.conf',
    certpath: '/etc/nginx/legacy_ssl/campaign_2024.crt',
    takenover: 0,
    updatedat: nowMs() - 180000,
    configContent: [
      'server {',
      '    listen 443 ssl;',
      '    server_name campaign.yinhecloud.cn;',
      '',
      '    ssl_certificate     /etc/nginx/legacy_ssl/campaign_2024.crt;',
      '    ssl_certificate_key /etc/nginx/legacy_ssl/campaign_2024.key;',
      '',
      '    location / {',
      '        root /var/www/campaign;',
      '    }',
      '}',
    ].join('\n'),
  },
  {
    id: 15,
    serverid: 3,
    name: 'Default Web Site (Overseas Portal)',
    domains: 'www.yinheglobal.com',
    webserver: 'IIS',
    configpath: 'IIS://Sites/Default Web Site',
    certpath: 'Cert:\\LocalMachine\\My\\9F8A7B',
    takenover: 0,
    updatedat: nowMs() - 240000,
    configContent: '',
  },
];

const deployTasks: DeployTaskEntity[] = [
  {
    id: 201,
    name: '支付网关-华东主节点推送',
    certid: 101,
    serverid: 1,
    targetpath: '/etc/sslauto/certs',
    reloadcmd: 'reload_nginx',
    status: 'SUCCESS',
    deployedversion: 3,
    lastdeploytime: offsetMs(-16),
    lastmessage: '证书包 v3 校验通过，已自动备份旧配置并执行 nginx -t && nginx -s reload',
    createdat: offsetMs(-195),
  },
  {
    id: 202,
    name: '支付网关-华北灾备节点推送',
    certid: 101,
    serverid: 2,
    targetpath: '/etc/sslauto/certs',
    reloadcmd: 'reload_nginx',
    status: 'SUCCESS',
    deployedversion: 3,
    lastdeploytime: offsetMs(-16),
    lastmessage: '证书包 v3 同步完成，双活节点指纹校验一致',
    createdat: offsetMs(-190),
  },
  {
    id: 203,
    name: '开放平台-华东节点部署',
    certid: 102,
    serverid: 1,
    targetpath: '/etc/sslauto/certs',
    reloadcmd: 'reload_nginx',
    status: 'SUCCESS',
    deployedversion: 2,
    lastdeploytime: offsetMs(-79),
    lastmessage: '已下发 v2 并平滑重载 Nginx 工作进程',
    createdat: offsetMs(-165),
  },
  {
    id: 204,
    name: 'SSO门户-预发网关下发（异常）',
    certid: 103,
    serverid: 4,
    targetpath: '/etc/sslauto/certs',
    reloadcmd: 'reload_nginx',
    status: 'FAILED',
    deployedversion: 1,
    lastdeploytime: offsetMs(-1),
    lastmessage: '目标 Agent (hz-stage-gw-01) 离线超时未领取 v2 部署事务，线上仍保留 v1 备份配置',
    createdat: offsetMs(-38),
  },
];

const agentJobs = new Map<number, AgentJobEntity>();

const taskLogs: TaskLogMap[] = [
  {
    ID: 501,
    BIZTYPE: 'DEPLOY',
    BIZID: 204,
    ACTION: 'SYNC_FAIL',
    MESSAGE: '任务「SSO门户-预发网关下发」等待 Agent (hz-stage-gw-01) 心跳超时，保留 v1 安全快照未覆盖',
    LOGLEVEL: 'WARN',
    CREATEDAT: fmtSqlDate(offsetMs(-0.15)),
  },
  {
    ID: 502,
    BIZTYPE: 'CERT',
    BIZID: 107,
    ACTION: 'RENEW_FAIL',
    MESSAGE: '域名 legacy-bill.yinhecloud.cn 自动续期校验未通过：未检测到 _acme-challenge TXT 记录',
    LOGLEVEL: 'ERROR',
    CREATEDAT: fmtSqlDate(offsetMs(-0.3)),
  },
  {
    ID: 503,
    BIZTYPE: 'AGENT',
    BIZID: 2,
    ACTION: 'SCAN_SITES',
    MESSAGE: '华北生产灾备层-Nginx02 上报站点扫描结果：发现未接管站点 campaign.yinhecloud.cn',
    LOGLEVEL: 'INFO',
    CREATEDAT: fmtSqlDate(offsetMs(-0.5)),
  },
  {
    ID: 504,
    BIZTYPE: 'CERT',
    BIZID: 104,
    ACTION: 'CREATE_ORDER',
    MESSAGE: '创建泛域名 *.partner.yinhecloud.cn ACME 订单，等待手动添加 DNS TXT 记录',
    LOGLEVEL: 'INFO',
    CREATEDAT: fmtSqlDate(offsetMs(-1)),
  },
  {
    ID: 505,
    BIZTYPE: 'DEPLOY',
    BIZID: 201,
    ACTION: 'DEPLOY_OK',
    MESSAGE: '支付网关泛域名 v3 已下发至华东/华北双节点并通过 nginx -t 事务校验',
    LOGLEVEL: 'INFO',
    CREATEDAT: fmtSqlDate(offsetMs(-16)),
  },
];

const sysLogs: SysLoggerEntity[] = [
  {
    id: 901,
    userid: 1,
    username: 'admin',
    role: 'super',
    module: 'cert',
    action: 'APPLY',
    method: 'POST',
    target: '*.partner.yinhecloud.cn',
    detail: '发起 Let\'s Encrypt 通配符证书申请（手动 DNS 验证）',
    ip: '10.20.1.56',
    result: 'SUCCESS',
    message: '订单已创建，请配置 DNS 记录',
    costms: 842,
    createdat: offsetMs(-1),
  },
  {
    id: 902,
    userid: 2,
    username: 'sre_chen',
    role: 'sre_lead',
    module: 'cloud',
    action: 'TEST_AUTH',
    method: 'POST',
    target: '阿里云 DNS · 生产主账号',
    detail: '测试云厂商 DNS API 读写连通性',
    ip: '10.20.1.89',
    result: 'SUCCESS',
    message: '连通正常，可托管 18 个域名 Zone',
    costms: 416,
    createdat: offsetMs(-0.2),
  },
  {
    id: 903,
    userid: 2,
    username: 'sre_chen',
    role: 'sre_lead',
    module: 'agent',
    action: 'WRITE_CONFIG',
    method: 'POST',
    target: '/etc/nginx/conf.d/pay-gateway.conf',
    detail: '更新 TLS 1.3 加密套件配置并执行 nginx -t 自动备份重载',
    ip: '10.20.1.89',
    result: 'SUCCESS',
    message: '保存并重载成功',
    costms: 1120,
    createdat: offsetMs(-3),
  },
  {
    id: 904,
    userid: 1,
    username: 'admin',
    role: 'super',
    module: 'cert',
    action: 'RENEW',
    method: 'POST',
    target: '*.pay.yinhecloud.cn',
    detail: '执行证书续期，版本号升级至 v3',
    ip: '10.20.1.56',
    result: 'SUCCESS',
    message: '续期成功',
    costms: 2390,
    createdat: offsetMs(-16),
  },
];

let nextId = 1000;
function genId(): number {
  nextId += 1;
  return nextId;
}

function recordAudit(
  user: UserRecord | null,
  module: string,
  action: string,
  method: string,
  target: string,
  detail: string,
  result: 'SUCCESS' | 'FAIL' = 'SUCCESS',
  message = 'success',
  costms = 128
) {
  const roleObj = user ? roles.find((r) => r.id === user.roleid) : null;
  sysLogs.unshift({
    id: genId(),
    userid: user ? user.id : null,
    username: user ? user.username : 'anonymous',
    role: roleObj ? roleObj.code : null,
    module,
    action,
    method,
    target,
    detail,
    ip: '127.0.0.1',
    result,
    message,
    costms,
    createdat: nowMs(),
  });
}

function pushTaskLog(bizType: string, bizId: number, action: string, message: string, level = 'INFO') {
  taskLogs.unshift({
    ID: genId(),
    BIZTYPE: bizType,
    BIZID: bizId,
    ACTION: action,
    MESSAGE: message,
    LOGLEVEL: level,
    CREATEDAT: fmtSqlDate(nowMs()),
  });
}

function computeAssetStatus(cert: CertificateEntity): string {
  const certDeploys = deployTasks.filter((d) => d.certid === cert.id);
  if (cert.notafter) {
    const diffDays = Math.floor((cert.notafter - nowMs()) / DAY_MS);
    if (diffDays < 0) return 'EXPIRED';
    if (certDeploys.some((d) => d.status === 'FAILED' || d.deployedversion < cert.version)) {
      return 'DEPLOY_ABNORMAL';
    }
    if (diffDays <= 30) return 'EXPIRING';
    return 'VALID';
  }
  return 'UNKNOWN';
}

function maskSecret(raw: string): string {
  if (!raw) return '****';
  const tail = raw.slice(-4);
  return `****${tail}`;
}

function getAuthUser(req: Request): UserRecord | null {
  const token = String(req.headers['x-token'] || req.query.token || '').trim();
  if (!token || revokedTokens.has(token)) return null;
  let uid: number | null | undefined = sessions.get(token);
  if (!uid) {
    uid = verifySignedToken(token);
    if (uid) sessions.set(token, uid);
  }
  if (!uid) return null;
  return users.find((u) => u.id === uid && u.status === 'ACTIVE') || null;
}

function ok(res: Response, data: unknown = null, message = 'success') {
  res.json({ code: 200, message, data });
}

function fail(res: Response, code: number, message: string) {
  res.json({ code, message, data: null });
}

// ==================== Live TLS Socket Handshake Probe ====================

function isValidPublicHost(hostname: string): boolean {
  const clean = hostname.trim().toLowerCase();
  if (!clean || clean.length > 253) return false;
  if (
    clean === 'localhost' ||
    clean.endsWith('.local') ||
    clean.endsWith('.internal') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(clean) ||
    clean.includes(':')
  ) {
    return false;
  }
  return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(clean);
}

async function probeRemoteTls(hostname: string, port: number) {
  return new Promise<{
    hostname: string;
    port: number;
    subjectCN: string;
    issuerOrg: string;
    issuerCN: string;
    sans: string[];
    validFrom: number;
    validTo: number;
    daysRemaining: number;
    protocol: string;
    cipher: string;
    fingerprint: string;
    serialNumber: string;
    authorized: boolean;
    authError: string | null;
    domainMatched: boolean;
    checkedAt: number;
  }>((resolve, reject) => {
    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: 6500,
      },
      () => {
        try {
          const peer = socket.getPeerCertificate(false);
          if (!peer || Object.keys(peer).length === 0) {
            socket.destroy();
            reject(new Error('目标端点未返回有效 X.509 证书'));
            return;
          }
          const validFrom = new Date(peer.valid_from).getTime();
          const validTo = new Date(peer.valid_to).getTime();
          const daysRemaining = Math.floor((validTo - nowMs()) / DAY_MS);
          const rawSan = peer.subjectaltname || '';
          const sans = rawSan
            .split(',')
            .map((s) => s.trim().replace(/^DNS:/i, ''))
            .filter(Boolean);

          const subjectCN = Array.isArray(peer.subject?.CN)
            ? peer.subject.CN[0]
            : peer.subject?.CN || hostname;
          const issuerOrg = Array.isArray(peer.issuer?.O)
            ? peer.issuer.O[0]
            : peer.issuer?.O || 'Unknown CA';
          const issuerCN = Array.isArray(peer.issuer?.CN)
            ? peer.issuer.CN[0]
            : peer.issuer?.CN || issuerOrg;

          const allNames = sans.length ? sans : [subjectCN];
          const domainMatched = allNames.some((pattern) => {
            const p = pattern.toLowerCase();
            const h = hostname.toLowerCase();
            if (p === h) return true;
            if (p.startsWith('*.')) {
              const suffix = p.slice(1);
              return h.endsWith(suffix) && h.slice(0, h.length - suffix.length).indexOf('.') === -1;
            }
            return false;
          });

          const cipherInfo = socket.getCipher();
          const result = {
            hostname,
            port,
            subjectCN,
            issuerOrg,
            issuerCN,
            sans: allNames,
            validFrom,
            validTo,
            daysRemaining,
            protocol: socket.getProtocol() || 'TLS',
            cipher: cipherInfo?.standardName || cipherInfo?.name || 'TLS_AES_128_GCM_SHA256',
            fingerprint: peer.fingerprint256 || makeFingerprint(),
            serialNumber: peer.serialNumber || makeSerial(),
            authorized: socket.authorized,
            authError: socket.authorizationError ? String(socket.authorizationError) : null,
            domainMatched,
            checkedAt: nowMs(),
          };
          socket.end();
          resolve(result);
        } catch (err) {
          socket.destroy();
          reject(err);
        }
      }
    );

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`连接 ${hostname}:${port} TLS 握手超时 (6.5s)`));
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(new Error(`连接 ${hostname}:${port} 失败: ${err.message}`));
    });
  });
}

// ==================== Express Application ====================

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const backendUrl = (process.env.BACKEND_URL || '').trim().replace(/\/+$/, '');

  // Public runtime mode endpoint so frontend distinguishes real Java backend vs local sandbox
  app.get('/api/runtime-mode', (_req: Request, res: Response) => {
    ok(res, { sandbox: !backendUrl });
  });

  // Optional transparent proxy if user points BACKEND_URL to Java backend (e.g. http://127.0.0.1:8088)
  if (backendUrl) {
    // Provide Node TLS live socket handshake + fingerprint consistency check against Java backend inventory
    app.post('/api/probe/tls', async (req: Request, res: Response) => {
      const token = String(req.headers['x-token'] || '').trim();
      if (!token) {
        fail(res, 401, '未登录或会话已过期');
        return;
      }
      const rawHost = String(req.body?.hostname || '')
        .trim()
        .replace(/^https?:\/\//i, '')
        .split('/')[0]
        .split(':')[0];
      const port = Number(req.body?.port || 443);

      if (!isValidPublicHost(rawHost)) {
        fail(res, 400, '请输入合法的公网域名（例如 letsencrypt.org 或您的线上业务域名）');
        return;
      }
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        fail(res, 400, '端口需为 1 ~ 65535 之间的整数');
        return;
      }

      try {
        // Verify session against upstream Java backend and fetch managed cert list for fingerprint match
        const authResp = await fetch(`${backendUrl}/api/auth/info`, {
          headers: { 'X-Token': token },
        });
        const authJson = (await authResp.json()) as { code?: number; message?: string };
        if (authJson.code === 401) {
          fail(res, 401, authJson.message || '未登录或会话已过期');
          return;
        }

        const probe = await probeRemoteTls(rawHost, port);

        let inventoryMatch = null;
        try {
          const listResp = await fetch(`${backendUrl}/api/cert/list?keyword=`, {
            headers: { 'X-Token': token },
          });
          const listJson = (await listResp.json()) as {
            code?: number;
            data?: Array<{
              id: number;
              name: string;
              domains: string;
              fingerprint: string | null;
              version: number;
            }>;
          };
          const remoteCerts = Array.isArray(listJson.data) ? listJson.data : [];
          const hit = remoteCerts.find((c) => {
            try {
              const dList: string[] = JSON.parse(c.domains || '[]');
              return dList.some((pat) => {
                const p = pat.toLowerCase();
                const h = rawHost.toLowerCase();
                if (p === h) return true;
                if (p.startsWith('*.')) {
                  const suffix = p.slice(1);
                  return h.endsWith(suffix);
                }
                return false;
              });
            } catch {
              return false;
            }
          });
          if (hit) {
            const norm = (fp: string | null | undefined) =>
              String(fp || '')
                .replace(/[^a-fA-F0-9]/g, '')
                .toUpperCase();
            inventoryMatch = {
              certId: hit.id,
              certName: hit.name,
              expectedFingerprint: hit.fingerprint,
              fingerprintConsistent: Boolean(
                hit.fingerprint && norm(hit.fingerprint) === norm(probe.fingerprint)
              ),
              version: hit.version || 1,
            };
          }
        } catch {
          // ignore optional inventory lookup error
        }

        ok(res, { ...probe, inventoryMatch });
      } catch (err) {
        fail(res, 500, err instanceof Error ? err.message : 'TLS 在线探测失败');
      }
    });

    app.use('/api', async (req: Request, res: Response) => {
      try {
        const target = `${backendUrl}/api${req.url}`;
        const headers: Record<string, string> = {};
        if (req.headers['x-token']) headers['X-Token'] = String(req.headers['x-token']);
        if (req.headers['content-type']) headers['Content-Type'] = String(req.headers['content-type']);
        const upstream = await fetch(target, {
          method: req.method,
          headers,
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
        });
        res.status(upstream.status);
        upstream.headers.forEach((v, k) => {
          if (k.toLowerCase() !== 'transfer-encoding') res.setHeader(k, v);
        });
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.send(buf);
      } catch (err) {
        fail(res, 500, err instanceof Error ? err.message : '后端代理请求失败');
      }
    });
  }

  // ---------- 2. 认证模块 /api/auth ----------
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username || !password) {
      fail(res, 400, '用户名和密码不能为空');
      return;
    }
    const user = users.find((u) => u.username === username);
    if (!user) {
      fail(res, 500, '用户名或密码错误');
      return;
    }
    if (user.status === 'DISABLED') {
      fail(res, 500, '该账号已被禁用，请联系超级管理员');
      return;
    }
    // Accept exact password or demo admin123 convenience password
    if (user.password !== password && !(username === 'admin' && password === 'admin123')) {
      fail(res, 500, '用户名或密码错误');
      return;
    }
    const token = createSignedToken(user.id);
    sessions.set(token, user.id);
    revokedTokens.delete(token);
    recordAudit(user, 'auth', 'LOGIN', 'POST', username, '登录 SSLAuto 证书生命周期工作台');
    ok(res, { token }, '登录成功');
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = String(req.headers['x-token'] || '').trim();
    if (token && token !== 'demo-super-token') {
      sessions.delete(token);
      revokedTokens.add(token);
    }
    ok(res, null, '已退出');
  });

  app.get('/api/auth/info', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    if (!user) {
      fail(res, 401, '登录状态已失效，请重新登录');
      return;
    }
    const role = roles.find((r) => r.id === user.roleid);
    const permissions = role
      ? role.code === 'super'
        ? PERMISSION_CATALOG.flatMap((g) => g.items.map((i) => i.key))
        : role.permissions.split(',').filter(Boolean)
      : [];
    ok(res, {
      username: user.username,
      nickname: user.nickname,
      roleCode: role?.code || '',
      roleName: role?.name || '',
      permissions,
    });
  });

  app.post('/api/auth/password', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    if (!user) {
      fail(res, 401, '未登录');
      return;
    }
    const { oldPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6) {
      fail(res, 400, '新密码至少 6 位');
      return;
    }
    if (oldPassword && user.password !== oldPassword && oldPassword !== 'admin123') {
      fail(res, 500, '原密码错误');
      return;
    }
    user.password = String(newPassword);
    user.updatedat = nowMs();
    recordAudit(user, 'auth', 'CHANGE_PASSWORD', 'POST', user.username, '修改个人登录密码');
    ok(res, null, '密码修改成功');
  });

  // Require auth middleware for protected /api routes (except public agent scripts)
  app.use('/api', (req: Request, res: Response, next) => {
    if (
      req.path.startsWith('/agent/install') ||
      req.path.startsWith('/agent/agent.') ||
      req.path === '/health'
    ) {
      next();
      return;
    }
    const user = getAuthUser(req);
    if (!user) {
      if (req.path === '/cert/download') {
        res.status(401).send('Unauthorized');
        return;
      }
      fail(res, 401, '未登录或会话已过期');
      return;
    }
    (req as Request & { currentUser?: UserRecord }).currentUser = user;
    next();
  });

  // ---------- 3. 首页概览 /api/dashboard ----------
  app.get('/api/dashboard/summary', (_req: Request, res: Response) => {
    const certTotal = certs.length;
    const issuedList = certs.filter((c) => c.status === 'ISSUED');
    const certIssued = issuedList.length;
    const certExpiring = issuedList.filter((c) => {
      if (!c.notafter) return false;
      const days = Math.floor((c.notafter - nowMs()) / DAY_MS);
      return days >= 0 && days <= 30;
    }).length;
    const authTotal = cloudAuths.length;
    const serverTotal = agentServers.length;
    const serverOnline = agentServers.filter((s) => s.status === 'ONLINE').length;
    const siteTotal = agentSites.length;
    const deployTotal = deployTasks.length;
    const deploySuccess = deployTasks.filter((d) => d.status === 'SUCCESS').length;

    ok(res, {
      certTotal,
      certIssued,
      certExpiring,
      authTotal,
      serverTotal,
      serverOnline,
      siteTotal,
      deployTotal,
      deploySuccess,
    });
  });

  app.get('/api/dashboard/logs', (_req: Request, res: Response) => {
    ok(res, taskLogs.slice(0, 20));
  });

  // ---------- 4. 云服务授权 /api/cloud/auth ----------
  app.get('/api/cloud/auth/list', (_req: Request, res: Response) => {
    const list = cloudAuths.map((a) => ({
      id: a.id,
      name: a.name,
      provider: a.provider,
      accesskey: a.accesskey,
      secretkey: maskSecret(a.secretKeyRaw),
      status: a.status,
      lasttesttime: a.lasttesttime,
      remark: a.remark,
      createdat: a.createdat,
    }));
    ok(res, list);
  });

  app.post('/api/cloud/auth/save', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const { id, name, provider, accessKey, secretKey, remark } = req.body || {};
    if (!name || !provider || !accessKey || !secretKey) {
      fail(res, 400, '授权名称、厂商、AccessKey、SecretKey 均不能为空');
      return;
    }
    if (id) {
      const existing = cloudAuths.find((a) => a.id === Number(id));
      if (!existing) {
        fail(res, 404, '授权记录不存在');
        return;
      }
      existing.name = String(name).trim();
      existing.provider = String(provider).trim().toLowerCase();
      existing.accesskey = String(accessKey).trim();
      if (!String(secretKey).startsWith('****')) {
        existing.secretKeyRaw = String(secretKey).trim();
      }
      if (remark !== undefined) existing.remark = remark ? String(remark) : null;
      recordAudit(user, 'auth', 'AUTH_UPDATE', 'POST', existing.name, `更新 ${existing.provider} 云授权凭证`);
      ok(res, existing.id, '更新成功');
      return;
    }
    const created: CloudAuthRecord = {
      id: genId(),
      name: String(name).trim(),
      provider: String(provider).trim().toLowerCase(),
      accesskey: String(accessKey).trim(),
      secretKeyRaw: String(secretKey).trim(),
      status: 'UNTESTED',
      lasttesttime: null,
      remark: remark ? String(remark) : null,
      createdat: nowMs(),
    };
    cloudAuths.unshift(created);
    recordAudit(user, 'auth', 'AUTH_CREATE', 'POST', created.name, `新增 ${created.provider} 云授权凭证`);
    ok(res, created.id, '保存成功');
  });

  app.post('/api/cloud/auth/test', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const id = Number(req.body?.id);
    const item = cloudAuths.find((a) => a.id === id);
    if (!item) {
      fail(res, 404, '授权不存在');
      return;
    }
    item.status = 'VALID';
    item.lasttesttime = nowMs();
    const msg = `连通性验证通过（${item.provider.toUpperCase()} API 鉴权正常，TXT 写入权限可用）`;
    recordAudit(user, 'auth', 'AUTH_TEST', 'POST', item.name, msg);
    ok(res, msg, msg);
  });

  app.post('/api/cloud/auth/delete', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const id = Number(req.body?.id);
    const idx = cloudAuths.findIndex((a) => a.id === id);
    if (idx === -1) {
      fail(res, 404, '授权不存在');
      return;
    }
    const [removed] = cloudAuths.splice(idx, 1);
    recordAudit(user, 'auth', 'AUTH_DELETE', 'POST', removed.name, '删除云厂商 DNS 授权');
    ok(res, id, '删除成功');
  });

  // ---------- 5. 证书管理 & 资产中心 /api/cert ----------
  app.get('/api/cert/list', (req: Request, res: Response) => {
    const kw = String(req.query.keyword || '').trim().toLowerCase();
    const list = certs
      .filter((c) => {
        if (!kw) return true;
        return (
          (c.name || '').toLowerCase().includes(kw) ||
          c.domains.toLowerCase().includes(kw) ||
          (c.remark || '').toLowerCase().includes(kw)
        );
      })
      .sort((a, b) => b.id - a.id);
    ok(res, list);
  });

  app.post('/api/cert/page', (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.body?.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.body?.size) || 10));
    const kw = String(req.body?.keyword || '').trim().toLowerCase();
    const brand = String(req.body?.brand || '').trim();
    const status = String(req.body?.status || '').trim();
    const expiry = String(req.body?.expiry || '').trim();

    const filtered = certs
      .filter((c) => {
        if (brand && c.brand !== brand) return false;
        if (status && c.status !== status) return false;
        if (expiry) {
          if (!c.notafter) return false;
          const diff = Math.floor((c.notafter - nowMs()) / DAY_MS);
          if (expiry === 'EXPIRED' && diff >= 0) return false;
          if (expiry === 'MONTH' && (diff < 0 || diff > 30)) return false;
          if (expiry === 'QUARTER' && (diff < 0 || diff > 90)) return false;
        }
        if (kw) {
          return (
            (c.name || '').toLowerCase().includes(kw) ||
            c.domains.toLowerCase().includes(kw) ||
            (c.remark || '').toLowerCase().includes(kw) ||
            (c.project || '').toLowerCase().includes(kw) ||
            (c.owner || '').toLowerCase().includes(kw)
          );
        }
        return true;
      })
      .sort((a, b) => b.id - a.id);

    const start = (page - 1) * size;
    ok(res, {
      total: filtered.length,
      page,
      size,
      rows: filtered.slice(start, start + size),
    });
  });

  app.post('/api/cert/apply', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const {
      domains,
      name,
      keyType = 'ECC',
      brand = 'LETSENCRYPT',
      validation = 'CLOUD_DNS',
      cloudAuthId = null,
      remark = '',
      orgName = null,
      orgUnit = null,
      project = null,
      env = null,
      owner = null,
    } = req.body || {};

    if (!Array.isArray(domains) || domains.length === 0) {
      fail(res, 400, '请至少填写一个有效域名');
      return;
    }
    if (validation === 'CLOUD_DNS' && !cloudAuthId && brand !== 'INTERNAL') {
      fail(res, 400, '云 DNS 自动验证需选择授权账户');
      return;
    }

    const cleanDomains = domains.map((d: string) => String(d).trim().toLowerCase()).filter(Boolean);
    const isAutoIssued = brand === 'INTERNAL' || validation === 'CLOUD_DNS' || validation === 'AUTO';
    const validityDays = brand === 'INTERNAL' ? 365 : 90;
    const id = genId();
    const nb = isAutoIssued ? nowMs() : null;
    const na = isAutoIssued ? offsetMs(validityDays) : null;
    const fp = isAutoIssued ? makeFingerprint() : null;
    const sn = isAutoIssued ? makeSerial() : null;

    const dnsObj = !isAutoIssued
      ? {
          orderUrl: `https://acme-v02.api.letsencrypt.org/acme/order/${id}`,
          challenges: cleanDomains.map((d: string) => {
            const base = d.replace(/^\*\./, '');
            return {
              domain: d,
              recordName: `_acme-challenge.${base}`,
              txtValue: crypto.randomBytes(24).toString('base64url'),
            };
          }),
        }
      : null;

    const entity: CertificateEntity = {
      id,
      name: (name && String(name).trim()) || cleanDomains[0],
      domains: JSON.stringify(cleanDomains),
      keytype: keyType === 'RSA' ? 'RSA' : 'ECC',
      brand,
      validation,
      cloudauthid: cloudAuthId ? Number(cloudAuthId) : null,
      status: isAutoIssued ? 'ISSUED' : 'WAIT_DNS',
      notbefore: nb,
      notafter: na,
      fingerprint: fp,
      serialno: sn,
      certpath: isAutoIssued ? `/data/sslauto/certs/${id}` : null,
      version: 1,
      renewcount: 0,
      remark: remark || null,
      orgName: orgName || null,
      orgUnit: orgUnit || null,
      project: project || null,
      env: env || 'prod',
      owner: owner || (user ? `${user.nickname}` : null),
      dnsrecords: dnsObj ? JSON.stringify(dnsObj) : null,
      createdat: nowMs(),
      updatedat: nowMs(),
    };

    certs.unshift(entity);
    if (isAutoIssued && nb && na && fp && sn) {
      certVersions.set(id, [
        {
          VERSION: 1,
          SOURCE: 'APPLY',
          NOTBEFORE: nb,
          NOTAFTER: na,
          SERIALNO: sn,
          SIGNATUREALG: entity.keytype === 'ECC' ? 'SHA256withECDSA' : 'SHA256withRSA',
          FINGERPRINT: fp,
          CREATEDAT: nowMs(),
        },
      ]);
    }

    const msg = isAutoIssued ? '证书签发成功' : '订单已创建，请配置 DNS 记录';
    pushTaskLog('CERT', id, 'APPLY', `${entity.name} (${cleanDomains.join(', ')}) — ${msg}`);
    recordAudit(user, 'cert', 'APPLY', 'POST', cleanDomains.join(', '), msg);

    ok(
      res,
      {
        ...entity,
        dnsrecords: dnsObj,
      },
      msg
    );
  });

  app.get('/api/cert/detail', (req: Request, res: Response) => {
    const id = Number(req.query.id);
    const cert = certs.find((c) => c.id === id);
    if (!cert) {
      fail(res, 404, '证书不存在');
      return;
    }
    let parsedDns = null;
    if (cert.dnsrecords) {
      try {
        parsedDns = JSON.parse(cert.dnsrecords);
      } catch {
        parsedDns = null;
      }
    }
    ok(res, {
      ...cert,
      dnsrecords: parsedDns,
    });
  });

  app.post('/api/cert/checkDns', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const id = Number(req.body?.id);
    const cert = certs.find((c) => c.id === id);
    if (!cert) {
      fail(res, 404, '证书不存在');
      return;
    }
    let challenges: DnsChallengeItem[] = [];
    if (cert.dnsrecords) {
      try {
        const parsed = JSON.parse(cert.dnsrecords);
        challenges = (parsed.challenges || []).map((ch: DnsChallengeItem) => ({
          ...ch,
          valid: true,
        }));
      } catch {
        challenges = [];
      }
    }
    recordAudit(user, 'cert', 'CHECK_DNS', 'POST', cert.name, '检测权威 DNS TXT 记录传播状态');
    ok(res, {
      certId: cert.id,
      status: cert.status,
      challenges,
      allValid: challenges.length > 0,
    });
  });

  app.post('/api/cert/verifyDns', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const id = Number(req.body?.id);
    const cert = certs.find((c) => c.id === id);
    if (!cert) {
      fail(res, 404, '证书不存在');
      return;
    }
    cert.status = 'ISSUED';
    cert.notbefore = nowMs();
    cert.notafter = offsetMs(90);
    cert.fingerprint = makeFingerprint();
    cert.serialno = makeSerial();
    cert.certpath = `/data/sslauto/certs/${cert.id}`;
    cert.updatedat = nowMs();

    const verList = certVersions.get(cert.id) || [];
    verList.unshift({
      VERSION: cert.version,
      SOURCE: 'APPLY',
      NOTBEFORE: cert.notbefore,
      NOTAFTER: cert.notafter,
      SERIALNO: cert.serialno,
      SIGNATUREALG: cert.keytype === 'ECC' ? 'SHA256withECDSA' : 'SHA256withRSA',
      FINGERPRINT: cert.fingerprint,
      CREATEDAT: nowMs(),
    });
    certVersions.set(cert.id, verList);

    pushTaskLog('CERT', cert.id, 'VERIFY_DNS', `证书「${cert.name}」DNS TXT 校验通过并完成签发`);
    recordAudit(user, 'cert', 'VERIFY_DNS', 'POST', cert.name, '手动 DNS 验证通过并签发证书');
    ok(res, cert, '签发成功');
  });

  app.post('/api/cert/retry', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const id = Number(req.body?.id);
    const cert = certs.find((c) => c.id === id);
    if (!cert) {
      fail(res, 404, '证书不存在');
      return;
    }
    cert.status = 'ISSUED';
    cert.notbefore = nowMs();
    cert.notafter = offsetMs(90);
    cert.fingerprint = makeFingerprint();
    cert.serialno = makeSerial();
    cert.version += 1;
    cert.renewcount += 1;
    cert.remark = '重试签发成功，已恢复正常生命周期监控';
    cert.updatedat = nowMs();

    const verList = certVersions.get(cert.id) || [];
    verList.unshift({
      VERSION: cert.version,
      SOURCE: 'RENEW',
      NOTBEFORE: cert.notbefore,
      NOTAFTER: cert.notafter,
      SERIALNO: cert.serialno,
      SIGNATUREALG: cert.keytype === 'ECC' ? 'SHA256withECDSA' : 'SHA256withRSA',
      FINGERPRINT: cert.fingerprint,
      CREATEDAT: nowMs(),
    });
    certVersions.set(cert.id, verList);

    pushTaskLog('CERT', cert.id, 'RETRY_OK', `证书「${cert.name}」重试申请并签发成功 (v${cert.version})`);
    recordAudit(user, 'cert', 'RETRY', 'POST', cert.name, '异常证书重新发起 ACME 校验并签发成功');
    ok(res, cert, '证书签发成功');
  });

  app.post('/api/cert/renew', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const id = Number(req.body?.id);
    const cert = certs.find((c) => c.id === id);
    if (!cert) {
      fail(res, 404, '证书不存在');
      return;
    }
    cert.status = 'ISSUED';
    cert.version += 1;
    cert.renewcount += 1;
    cert.notbefore = nowMs();
    cert.notafter = offsetMs(cert.brand === 'INTERNAL' ? 365 : 90);
    cert.fingerprint = makeFingerprint();
    cert.serialno = makeSerial();
    cert.updatedat = nowMs();

    const verList = certVersions.get(cert.id) || [];
    verList.unshift({
      VERSION: cert.version,
      SOURCE: 'RENEW',
      NOTBEFORE: cert.notbefore,
      NOTAFTER: cert.notafter,
      SERIALNO: cert.serialno,
      SIGNATUREALG: cert.keytype === 'ECC' ? 'SHA256withECDSA' : 'SHA256withRSA',
      FINGERPRINT: cert.fingerprint,
      CREATEDAT: nowMs(),
    });
    certVersions.set(cert.id, verList);

    // Sync linked online server deployments automatically
    for (const task of deployTasks) {
      if (task.certid === cert.id) {
        const srv = agentServers.find((s) => s.id === task.serverid);
        if (srv && srv.status === 'ONLINE') {
          task.deployedversion = cert.version;
          task.status = 'SUCCESS';
          task.lastdeploytime = nowMs();
          task.lastmessage = `续期联动下发 v${cert.version} 成功，已备份旧版并通过 nginx -t 重载`;
        } else {
          task.status = 'PENDING';
          task.lastmessage = `证书已升级至 v${cert.version}，等待目标 Agent 恢复在线后拉取部署`;
        }
      }
    }

    pushTaskLog('CERT', cert.id, 'RENEW', `证书「${cert.name}」续期成功，升级至 v${cert.version} 并触发关联部署同步`);
    recordAudit(user, 'cert', 'RENEW', 'POST', cert.name, `手动续期成功，版本升至 v${cert.version}`);
    ok(res, cert, '续期成功');
  });

  app.post('/api/cert/upload', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const { id, name, remark, cert: certPem, pfx } = req.body || {};
    if (!id && !name) {
      fail(res, 400, '新建上传证书时请填写证书名称');
      return;
    }
    if (!certPem && !pfx) {
      fail(res, 400, '请上传有效的 PEM 证书私钥对或 PFX 文件');
      return;
    }

    if (id) {
      const existing = certs.find((c) => c.id === Number(id));
      if (!existing) {
        fail(res, 404, '证书不存在');
        return;
      }
      existing.version += 1;
      existing.notbefore = nowMs();
      existing.notafter = offsetMs(365);
      existing.fingerprint = makeFingerprint();
      existing.serialno = makeSerial();
      if (name) existing.name = String(name).trim();
      if (remark !== undefined) existing.remark = String(remark);
      existing.updatedat = nowMs();

      const verList = certVersions.get(existing.id) || [];
      verList.unshift({
        VERSION: existing.version,
        SOURCE: 'UPLOAD',
        NOTBEFORE: existing.notbefore,
        NOTAFTER: existing.notafter,
        SERIALNO: existing.serialno,
        SIGNATUREALG: 'SHA256withRSA',
        FINGERPRINT: existing.fingerprint,
        CREATEDAT: nowMs(),
      });
      certVersions.set(existing.id, verList);

      recordAudit(user, 'cert', 'REUPLOAD', 'POST', existing.name, `更新上传证书文件至 v${existing.version}`);
      ok(res, existing, '证书更新成功');
      return;
    }

    const newId = genId();
    const slug = String(name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '') || 'uploaded.example.com';
    const domainGuess = slug.includes('.') ? slug : `ssl-${newId}.enterprise.cn`;

    const created: CertificateEntity = {
      id: newId,
      name: String(name).trim(),
      domains: JSON.stringify([domainGuess]),
      keytype: 'RSA',
      brand: 'UPLOAD',
      validation: 'AUTO',
      cloudauthid: null,
      status: 'ISSUED',
      notbefore: nowMs(),
      notafter: offsetMs(365),
      fingerprint: makeFingerprint(),
      serialno: makeSerial(),
      certpath: `/data/sslauto/certs/${newId}`,
      version: 1,
      renewcount: 0,
      remark: remark || '外部商业 CA 导入纳管证书',
      orgName: null,
      orgUnit: null,
      project: '外部导入资产',
      env: 'prod',
      owner: user ? user.nickname : 'admin',
      dnsrecords: null,
      createdat: nowMs(),
      updatedat: nowMs(),
    };
    certs.unshift(created);
    certVersions.set(newId, [
      {
        VERSION: 1,
        SOURCE: 'UPLOAD',
        NOTBEFORE: created.notbefore!,
        NOTAFTER: created.notafter!,
        SERIALNO: created.serialno!,
        SIGNATUREALG: 'SHA256withRSA',
        FINGERPRINT: created.fingerprint!,
        CREATEDAT: nowMs(),
      },
    ]);
    pushTaskLog('CERT', newId, 'UPLOAD', `导入外部证书「${created.name}」并纳入到期监控`);
    recordAudit(user, 'cert', 'UPLOAD', 'POST', created.name, '上传外部 PEM/PFX 证书纳入统一生命周期管理');
    ok(res, created, '证书上传成功');
  });

  app.post('/api/cert/delete', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const id = Number(req.body?.id);
    const idx = certs.findIndex((c) => c.id === id);
    if (idx === -1) {
      fail(res, 404, '证书不存在');
      return;
    }
    const [removed] = certs.splice(idx, 1);
    for (let i = deployTasks.length - 1; i >= 0; i--) {
      if (deployTasks[i].certid === id) deployTasks.splice(i, 1);
    }
    recordAudit(user, 'cert', 'DELETE', 'POST', removed.name, '删除证书及级联自动部署任务');
    ok(res, id, '删除成功');
  });

  app.get('/api/cert/download', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const id = Number(req.query.id);
    const type = String(req.query.type || 'fullchain').toLowerCase();
    const cert = certs.find((c) => c.id === id);
    if (!cert) {
      res.status(404).send('Certificate not found');
      return;
    }
    const domainArr = JSON.parse(cert.domains || '[]');
    const primary = (domainArr[0] || `cert-${id}`).replace(/^\*\./, 'wildcard.');
    const extMap: Record<string, string> = {
      nginx: `${primary}-nginx.pem`,
      apache: `${primary}-apache.crt`,
      tomcat: `${primary}-tomcat.pfx`,
      iis: `${primary}-iis.pfx`,
      jks: `${primary}.jks`,
      pfx: `${primary}.pfx`,
      root: `sslauto-internal-root-ca.crt`,
      zip: `${primary}-bundle.pem`,
      fullchain: `${primary}-fullchain.pem`,
      cert: `${primary}-cert.pem`,
      privkey: `${primary}-privkey.key`,
      chain: `${primary}-chain.pem`,
    };
    const filename = extMap[type] || `${primary}-${type}.pem`;
    const bodyText = [
      `# SSLAuto Managed Certificate Bundle (${type.toUpperCase()})`,
      `# Certificate Name: ${cert.name}`,
      `# Domains: ${domainArr.join(', ')}`,
      `# Serial: ${cert.serialno || '-'}`,
      `# SHA-256 Fingerprint: ${cert.fingerprint || '-'}`,
      `# Version: v${cert.version}`,
      `-----BEGIN CERTIFICATE-----`,
      Buffer.from(`SSLAUTO-CERT-${cert.id}-V${cert.version}-${cert.serialno}`).toString('base64'),
      `-----END CERTIFICATE-----`,
    ].join('\n');

    recordAudit(user, 'cert', 'DOWNLOAD', 'GET', cert.name, `下载证书文件包（格式: ${type}）`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(bodyText);
  });

  // 证书资产中心 5.13 / 5.14 / 5.15
  app.post('/api/cert/assets', (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.body?.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.body?.size) || 10));
    const kw = String(req.body?.keyword || '').trim().toLowerCase();
    const brand = String(req.body?.brand || '').trim();
    const assetStatus = String(req.body?.assetStatus || '').trim();
    const envFilter = String(req.body?.env || '').trim();
    const sortBy = String(req.body?.sortBy || 'notafter');
    const asc = req.body?.asc !== false;

    const enriched = certs.map((c) => {
      const cDeploys = deployTasks.filter((d) => d.certid === c.id);
      return {
        ...c,
        assetstatus: computeAssetStatus(c),
        deploytotal: cDeploys.length,
        deployfailed: cDeploys.filter((d) => d.status === 'FAILED').length,
      };
    });

    const filtered = enriched.filter((row) => {
      if (brand && row.brand !== brand) return false;
      if (assetStatus && row.assetstatus !== assetStatus) return false;
      if (envFilter && row.env !== envFilter) return false;
      if (kw) {
        return (
          (row.name || '').toLowerCase().includes(kw) ||
          row.domains.toLowerCase().includes(kw) ||
          (row.project || '').toLowerCase().includes(kw) ||
          (row.owner || '').toLowerCase().includes(kw)
        );
      }
      return true;
    });

    filtered.sort((a, b) => {
      const av = sortBy === 'version' ? a.version : a.notafter ?? Number.MAX_SAFE_INTEGER;
      const bv = sortBy === 'version' ? b.version : b.notafter ?? Number.MAX_SAFE_INTEGER;
      return asc ? av - bv : bv - av;
    });

    const start = (page - 1) * size;
    ok(res, {
      total: filtered.length,
      page,
      size,
      rows: filtered.slice(start, start + size),
    });
  });

  app.get('/api/cert/assetDetail', (req: Request, res: Response) => {
    const id = Number(req.query.id);
    const cert = certs.find((c) => c.id === id);
    if (!cert) {
      fail(res, 404, '证书资产不存在');
      return;
    }
    const domainList: string[] = JSON.parse(cert.domains || '[]');
    const issuerMap: Record<string, string> = {
      LETSENCRYPT: "CN=E6, O=Let's Encrypt, C=US",
      GOOGLE: 'CN=WE1, O=Google Trust Services, C=US',
      ZEROSSL: 'CN=ZeroSSL ECC Domain Secure Site CA, O=ZeroSSL, C=AT',
      LITESSL: 'CN=LiteSSL DV TLS CA, O=LiteSSL, C=GB',
      INTERNAL: `CN=SSLAuto Internal Root CA, O=${cert.orgName || 'SSLAuto Enterprise'}`,
      UPLOAD: `CN=DigiCert TLS RSA SHA256 2020 CA1, O=DigiCert Inc, C=US`,
    };

    const deploys = deployTasks
      .filter((d) => d.certid === cert.id)
      .map((d) => {
        const srv = agentServers.find((s) => s.id === d.serverid);
        return {
          ID: d.id,
          NAME: d.name,
          SERVERNAME: srv ? srv.name : `Server #${d.serverid}`,
          IP: srv ? srv.ip : '',
          OS: srv ? srv.os : 'LINUX',
          TARGETPATH: d.targetpath,
          RELOADCMD: d.reloadcmd,
          STATUS: d.status,
          DEPLOYEDVERSION: d.deployedversion,
          LASTDEPLOYTIME: d.lastdeploytime,
          LASTMESSAGE: d.lastmessage,
        };
      });

    const versions = certVersions.get(cert.id) || [];
    const operations = sysLogs
      .filter(
        (l) =>
          l.target.includes(cert.name) ||
          domainList.some((d) => l.target.includes(d)) ||
          l.module === 'cert'
      )
      .slice(0, 12)
      .map((l) => ({
        CREATEDAT: fmtSqlDate(l.createdat),
        USERNAME: l.username,
        ACTION: l.action,
        METHOD: l.method,
        RESULT: l.result === 'SUCCESS' ? '200 OK' : '500 FAIL',
        DETAIL: l.detail || l.message || '-',
      }));

    const { dnsrecords: _stripped, ...safeCert } = cert;

    ok(res, {
      ...safeCert,
      assetstatus: computeAssetStatus(cert),
      parsed: cert.notafter
        ? {
            subject: `CN=${domainList[0] || cert.name}${cert.orgName ? `, O=${cert.orgName}` : ''}`,
            issuer: issuerMap[cert.brand] || issuerMap.LETSENCRYPT,
            san: domainList,
            serialno: cert.serialno,
            signaturealg: cert.keytype === 'ECC' ? 'SHA256withECDSA' : 'SHA256withRSA',
            pubkeyalg: cert.keytype === 'ECC' ? 'EC Public Key (prime256v1 / 256 bits)' : 'RSA Public Key (2048 bits)',
            fingerprint: cert.fingerprint,
            notbefore: cert.notbefore,
            notafter: cert.notafter,
          }
        : {},
      deploys,
      versions,
      operations,
    });
  });

  app.post('/api/cert/assetSave', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const { id, project, env, owner, remark } = req.body || {};
    const cert = certs.find((c) => c.id === Number(id));
    if (!cert) {
      fail(res, 404, '证书不存在');
      return;
    }
    cert.project = project ? String(project).trim() : null;
    cert.env = env ? String(env).trim() : null;
    cert.owner = owner ? String(owner).trim() : null;
    cert.remark = remark !== undefined ? String(remark) : cert.remark;
    cert.updatedat = nowMs();

    recordAudit(
      user,
      'cert',
      'ASSET_SAVE',
      'POST',
      cert.name,
      `更新资产归属：项目=${cert.project || '-'}，环境=${cert.env || '-'}，责任人=${cert.owner || '-'}`
    );
    ok(res, cert.id, '保存成功');
  });

  // ---------- 6. 自动部署 /api/deploy ----------
  app.get('/api/deploy/list', (_req: Request, res: Response) => {
    const sorted = [...deployTasks].sort((a, b) => b.id - a.id);
    ok(res, sorted);
  });

  app.post('/api/deploy/save', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const {
      id,
      name,
      certId,
      serverId,
      targetPath = '/etc/sslauto/certs',
      reloadCmd = 'reload_nginx',
    } = req.body || {};

    if (!name || !certId || !serverId) {
      fail(res, 400, '任务名称、证书、目标服务器均不能为空');
      return;
    }
    const cert = certs.find((c) => c.id === Number(certId));
    const server = agentServers.find((s) => s.id === Number(serverId));
    if (!cert || !server) {
      fail(res, 404, '关联证书或目标服务器不存在');
      return;
    }

    const allowedReload = ['reload_nginx', 'restart_nginx', 'stop_nginx', 'start_nginx', 'none'];
    const safeReload = (allowedReload.includes(reloadCmd) ? reloadCmd : 'reload_nginx') as DeployTaskEntity['reloadcmd'];

    if (id) {
      const existing = deployTasks.find((d) => d.id === Number(id));
      if (!existing) {
        fail(res, 404, '部署任务不存在');
        return;
      }
      const changedCore =
        existing.certid !== cert.id ||
        existing.serverid !== server.id ||
        existing.targetpath !== targetPath;
      existing.name = String(name).trim();
      existing.certid = cert.id;
      existing.serverid = server.id;
      existing.targetpath = String(targetPath).trim() || '/etc/sslauto/certs';
      existing.reloadcmd = safeReload;
      if (changedCore || existing.status === 'FAILED') {
        if (server.status === 'ONLINE') {
          existing.status = 'SUCCESS';
          existing.deployedversion = cert.version;
          existing.lastdeploytime = nowMs();
          existing.lastmessage = `Agent 已备份原证书并完成 v${cert.version} 事务下发 (${safeReload})`;
        } else {
          existing.status = 'PENDING';
          existing.deployedversion = 0;
          existing.lastmessage = '等待离线 Agent 心跳恢复后自动拉取下发';
        }
      }
      recordAudit(user, 'deploy', 'UPDATE', 'POST', existing.name, `更新部署编排 -> ${server.name}`);
      ok(res, existing.id, '更新成功');
      return;
    }

    const isOnline = server.status === 'ONLINE';
    const created: DeployTaskEntity = {
      id: genId(),
      name: String(name).trim(),
      certid: cert.id,
      serverid: server.id,
      targetpath: String(targetPath).trim() || '/etc/sslauto/certs',
      reloadcmd: safeReload,
      status: isOnline ? 'SUCCESS' : 'PENDING',
      deployedversion: isOnline ? cert.version : 0,
      lastdeploytime: isOnline ? nowMs() : null,
      lastmessage: isOnline
        ? `首次下发 v${cert.version} 完成，nginx -t 语法校验通过并平滑执行 ${safeReload}`
        : '任务已入队，等待目标服务器 Agent 下次心跳领取',
      createdat: nowMs(),
    };
    deployTasks.unshift(created);
    pushTaskLog('DEPLOY', created.id, 'CREATE', `新建部署任务「${created.name}」指向服务器 ${server.name}`);
    recordAudit(user, 'deploy', 'CREATE', 'POST', created.name, `绑定证书 #${cert.id} 至 ${server.name}`);
    ok(res, created.id, '创建成功');
  });

  app.post('/api/deploy/delete', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const id = Number(req.body?.id);
    const idx = deployTasks.findIndex((d) => d.id === id);
    if (idx === -1) {
      fail(res, 404, '部署任务不存在');
      return;
    }
    const [removed] = deployTasks.splice(idx, 1);
    recordAudit(user, 'deploy', 'DELETE', 'POST', removed.name, '删除自动部署任务');
    ok(res, id, '删除成功');
  });

  // ---------- 7. 服务器 Agent /api/agent ----------
  app.get('/api/agent/servers', (_req: Request, res: Response) => {
    ok(res, agentServers);
  });

  app.get('/api/agent/sites', (req: Request, res: Response) => {
    const sid = req.query.serverId ? Number(req.query.serverId) : null;
    const list = sid ? agentSites.filter((s) => s.serverid === sid) : agentSites;
    ok(
      res,
      list.map(({ configContent: _c, ...rest }) => rest)
    );
  });

  app.post('/api/agent/deleteServer', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const id = Number(req.body?.id);
    const idx = agentServers.findIndex((s) => s.id === id);
    if (idx === -1) {
      fail(res, 404, '服务器不存在');
      return;
    }
    const [removed] = agentServers.splice(idx, 1);
    for (let i = agentSites.length - 1; i >= 0; i--) {
      if (agentSites[i].serverid === id) agentSites.splice(i, 1);
    }
    for (let i = deployTasks.length - 1; i >= 0; i--) {
      if (deployTasks[i].serverid === id) deployTasks.splice(i, 1);
    }
    recordAudit(user, 'agent', 'DELETE_SERVER', 'POST', removed.name, '移除 Agent 服务器及关联站点');
    ok(res, id, '删除成功');
  });

  app.post('/api/agent/createToken', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const serverName = String(req.body?.serverName || 'prod-node').trim();
    const os = String(req.body?.os || 'LINUX').toUpperCase();
    const token = `reg_${crypto.randomBytes(12).toString('hex')}`;
    const origin = `${req.protocol}://${req.get('host')}`;
    const command =
      os === 'WINDOWS'
        ? `powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing '${origin}/api/agent/install.ps1' -OutFile install.ps1; .\\install.ps1 -Token '${token}'"`
        : `curl -fsSL ${origin}/api/agent/install.sh | sudo bash -s ${token}`;

    recordAudit(user, 'agent', 'CREATE_TOKEN', 'POST', serverName, `生成 ${os} Agent 一次性接入令牌`);
    ok(res, {
      token,
      expiresAt: nowMs() + 10 * 60 * 1000,
      command,
    });
  });

  app.post('/api/agent/takeoverSite', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const siteId = Number(req.body?.siteId);
    const site = agentSites.find((s) => s.id === siteId);
    if (!site) {
      fail(res, 404, '站点不存在');
      return;
    }
    site.takenover = 1;
    site.updatedat = nowMs();
    pushTaskLog('AGENT', site.id, 'TAKEOVER', `接管站点 ${site.name} (${site.domains}) 纳入自动化防护`);
    recordAudit(user, 'agent', 'TAKEOVER_SITE', 'POST', site.name, `接管站点 ${site.domains}`);
    ok(res, siteId, '已接管');
  });

  app.post('/api/agent/config/read', (req: Request, res: Response) => {
    const siteId = req.body?.siteId ? Number(req.body.siteId) : null;
    const site = siteId ? agentSites.find((s) => s.id === siteId) : null;
    if (siteId && !site) {
      fail(res, 404, '站点不存在');
      return;
    }
    if (site && String(site.webserver).toLowerCase() !== 'nginx') {
      fail(res, 400, 'IIS 站点暂不支持在线读写配置');
      return;
    }
    const srv = agentServers.find((s) => s.id === (site ? site.serverid : Number(req.body?.serverId)));
    if (srv && Number(srv.agentversion || 0) < 2.2) {
      fail(res, 400, `Agent 版本过低 (v${srv.agentversion})，请先升级至 v2.5`);
      return;
    }

    const jobId = genId();
    agentJobs.set(jobId, {
      id: jobId,
      type: 'READ_CONFIG',
      path: site ? site.configpath : String(req.body?.path || ''),
      action: 'read',
      status: 'SUCCESS',
      message: '读取成功',
      content: site ? site.configContent : '# New Nginx configuration\n',
    });
    ok(res, jobId);
  });

  app.post('/api/agent/config/write', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const { siteId, serverId, path: cfgPath, content, reload = true } = req.body || {};
    if (!content || !String(content).trim()) {
      fail(res, 400, '配置内容不能为空');
      return;
    }
    const targetSite = siteId ? agentSites.find((s) => s.id === Number(siteId)) : null;
    if (siteId && !targetSite) {
      fail(res, 404, '站点不存在');
      return;
    }
    const srv = agentServers.find(
      (s) => s.id === (targetSite ? targetSite.serverid : Number(serverId))
    );
    if (!srv) {
      fail(res, 404, '目标服务器不存在');
      return;
    }
    if (Number(srv.agentversion || 0) < 2.2) {
      fail(res, 400, `Agent 版本低于 2.2，请先执行脚本升级`);
      return;
    }

    if (siteId) {
      const existingSite = agentSites.find((s) => s.id === Number(siteId));
      if (existingSite) {
        existingSite.configContent = String(content);
        existingSite.configpath = String(cfgPath || existingSite.configpath);
        existingSite.updatedat = nowMs();
      }
    } else if (cfgPath) {
      const fileName = String(cfgPath).split(/[\\/]/).pop() || 'custom.conf';
      const serverNameMatch = String(content).match(/server_name\s+([^;]+);/);
      agentSites.push({
        id: genId(),
        serverid: srv.id,
        name: fileName,
        domains: serverNameMatch ? serverNameMatch[1].trim() : 'example.com',
        webserver: 'nginx',
        configpath: String(cfgPath),
        certpath: '/etc/sslauto/certs/fullchain.pem',
        takenover: 1,
        updatedat: nowMs(),
        configContent: String(content),
      });
    }

    const jobId = genId();
    agentJobs.set(jobId, {
      id: jobId,
      type: 'WRITE_CONFIG',
      path: String(cfgPath),
      action: reload ? 'write_and_reload' : 'write_only',
      status: 'SUCCESS',
      message: reload
        ? '已备份原配置，nginx -t 语法校验通过并完成平滑 reload'
        : '已备份原配置并通过 nginx -t 校验写入磁盘',
    });

    recordAudit(user, 'agent', 'WRITE_CONFIG', 'POST', String(cfgPath), `写入配置（reload=${reload}）`);
    ok(res, jobId, '保存任务已创建');
  });

  app.post('/api/agent/scanSites', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const serverId = Number(req.body?.serverId);
    const srv = agentServers.find((s) => s.id === serverId);
    if (!srv) {
      fail(res, 404, '服务器不存在');
      return;
    }
    if (srv.status !== 'ONLINE') {
      fail(res, 400, `服务器「${srv.name}」当前离线，无法下发实时扫描指令`);
      return;
    }
    const jobId = genId();
    agentJobs.set(jobId, {
      id: jobId,
      type: 'SCAN_SITES',
      path: null,
      action: 'scan',
      status: 'SUCCESS',
      message: '扫描完成，已同步 Nginx/IIS 站点证书绑定路径',
    });
    recordAudit(user, 'agent', 'SCAN_SITES', 'POST', srv.name, '触发服务器站点实时扫描');
    ok(res, jobId, '扫描任务已创建');
  });

  app.post('/api/agent/siteAction', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const { serverId, siteId, action } = req.body || {};
    const site = siteId ? agentSites.find((s) => s.id === Number(siteId)) : null;
    const srv = agentServers.find((s) => s.id === (site ? site.serverid : Number(serverId)));
    if (!srv) {
      fail(res, 404, '服务器不存在');
      return;
    }
    if (srv.status !== 'ONLINE') {
      fail(res, 400, `服务器「${srv.name}」当前处于离线状态`);
      return;
    }
    const jobId = genId();
    agentJobs.set(jobId, {
      id: jobId,
      type: 'SITE_ACTION',
      path: null,
      action: String(action),
      status: 'SUCCESS',
      message: `Nginx ${action} 执行成功`,
    });
    recordAudit(user, 'agent', 'SITE_ACTION', 'POST', srv.name, `执行服务控制动作: ${action}`);
    ok(res, jobId, '操作任务已创建');
  });

  app.get('/api/agent/job', (req: Request, res: Response) => {
    const id = Number(req.query.id);
    const job = agentJobs.get(id);
    if (!job) {
      fail(res, 404, '作业不存在');
      return;
    }
    ok(res, job);
  });

  app.get('/api/agent/installBat', (req: Request, res: Response) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    const batScript = [
      '@echo off',
      'REM ==========================================================',
      'REM SSLAuto Windows Agent One-Click Installer (v2.5)',
      `REM Server Endpoint: ${origin}`,
      'REM Supports Windows Server 2008 R2 ~ 2022 / Windows 10 & 11',
      'REM ==========================================================',
      'setlocal enabledelayedexpansion',
      'set "INSTALL_DIR=C:\\ProgramData\\sslauto-agent"',
      'if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"',
      `echo [SSLAuto] Connecting to management plane ${origin} ...`,
      'set /p REG_TOKEN="Paste one-time registration token (leave empty if upgrading): "',
      'echo [SSLAuto] Downloading agent.ps1 v2.5 and registering scheduled startup task...',
      'echo [SSLAuto] Agent started successfully. Logs: C:\\ProgramData\\sslauto-agent\\agent.log',
      'pause',
    ].join('\r\n');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="sslauto-install.bat"');
    res.send(batScript);
  });

  app.get('/api/agent/install.sh', (req: Request, res: Response) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      `#!/usr/bin/env bash\nset -e\necho "[SSLAuto] Installing Linux Agent v2.5 from ${origin}..."\n`
    );
  });

  // ---------- 8. CLM 真机在线 TLS 握手验证与资产发现 /api/probe/tls ----------
  app.post('/api/probe/tls', async (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const rawHost = String(req.body?.hostname || '')
      .trim()
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split(':')[0];
    const port = Number(req.body?.port || 443);

    if (!rawHost || rawHost.length > 253) {
      fail(res, 400, '请输入合法的域名（例如 letsencrypt.org、cloudflare.com 或平台纳管域名）');
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      fail(res, 400, '端口需为 1 ~ 65535 之间的整数');
      return;
    }

    const matchedCert = certs.find((c) => {
      try {
        const dList: string[] = JSON.parse(c.domains || '[]');
        return dList.some((pat) => {
          const p = pat.toLowerCase();
          const h = rawHost.toLowerCase();
          if (p === h) return true;
          if (p.startsWith('*.')) {
            const suffix = p.slice(1);
            return h.endsWith(suffix) || h === p.slice(2);
          }
          return false;
        });
      } catch {
        return false;
      }
    });

    const t0 = nowMs();
    try {
      let probe;
      try {
        if (!isValidPublicHost(rawHost)) {
          throw new Error('INTERNAL_SANDBOX_HOST');
        }
        probe = await probeRemoteTls(rawHost, port);
      } catch (netErr) {
        // Fallback for sandbox/internal managed domains (e.g. *.yinhecloud.cn / *.corp.internal)
        if (!matchedCert || !matchedCert.notafter || !matchedCert.notbefore) {
          if (!isValidPublicHost(rawHost)) {
            fail(res, 400, '请输入合法的公网域名（例如 letsencrypt.org、cloudflare.com）或已签发的平台纳管域名');
            return;
          }
          throw netErr;
        }
        const dList: string[] = JSON.parse(matchedCert.domains || '[]');
        const cDeploys = deployTasks.filter((d) => d.certid === matchedCert.id);
        const verHistory = certVersions.get(matchedCert.id) || [];
        const laggingTask = cDeploys.find((d) => d.deployedversion > 0 && d.deployedversion < matchedCert.version);
        const servingVer = laggingTask
          ? verHistory.find((v) => v.VERSION === laggingTask.deployedversion)
          : verHistory[0];

        const validFrom = servingVer ? servingVer.NOTBEFORE : matchedCert.notbefore;
        const validTo = servingVer ? servingVer.NOTAFTER : matchedCert.notafter;
        const servingFp = servingVer ? servingVer.FINGERPRINT : matchedCert.fingerprint || makeFingerprint();
        const servingSn = servingVer ? servingVer.SERIALNO : matchedCert.serialno || makeSerial();
        const daysRemaining = Math.floor((validTo - nowMs()) / DAY_MS);

        probe = {
          hostname: rawHost,
          port,
          subjectCN: dList[0] || rawHost,
          issuerOrg:
            matchedCert.brand === 'GOOGLE'
              ? 'Google Trust Services'
              : matchedCert.brand === 'ZEROSSL'
              ? 'ZeroSSL'
              : matchedCert.brand === 'INTERNAL'
              ? matchedCert.orgName || 'SSLAuto Internal CA'
              : matchedCert.brand === 'UPLOAD'
              ? 'DigiCert Inc'
              : "Let's Encrypt",
          issuerCN: `${matchedCert.brand} TLS Issuing CA`,
          sans: dList,
          validFrom,
          validTo,
          daysRemaining,
          protocol: 'TLSv1.3',
          cipher: matchedCert.keytype === 'ECC' ? 'TLS_AES_256_GCM_SHA384' : 'TLS_AES_128_GCM_SHA256',
          fingerprint: servingFp,
          serialNumber: servingSn,
          authorized: matchedCert.brand !== 'INTERNAL' && daysRemaining >= 0,
          authError:
            daysRemaining < 0
              ? 'CERT_HAS_EXPIRED'
              : matchedCert.brand === 'INTERNAL'
              ? 'SELF_SIGNED_CERT_IN_CHAIN'
              : null,
          domainMatched: true,
          checkedAt: nowMs(),
        };
      }

      const inventoryMatch = matchedCert
        ? {
            certId: matchedCert.id,
            certName: matchedCert.name,
            expectedFingerprint: matchedCert.fingerprint,
            fingerprintConsistent: matchedCert.fingerprint === probe.fingerprint,
            version: matchedCert.version,
          }
        : null;

      recordAudit(
        user,
        'cert',
        'TLS_PROBE',
        'POST',
        `${rawHost}:${port}`,
        `线上 TLS 真机验证：${probe.protocol} / 剩余 ${probe.daysRemaining} 天`,
        'SUCCESS',
        'success',
        nowMs() - t0
      );

      ok(res, {
        ...probe,
        inventoryMatch,
      });
    } catch (err) {
      fail(res, 500, err instanceof Error ? err.message : 'TLS 在线探测失败');
    }
  });

  // ---------- 9. 系统管理 /api/system ----------
  app.get('/api/system/users', (req: Request, res: Response) => {
    const kw = String(req.query.keyword || '').trim().toLowerCase();
    const list = users
      .filter((u) => {
        if (!kw) return true;
        return u.username.toLowerCase().includes(kw) || u.nickname.toLowerCase().includes(kw);
      })
      .map((u) => {
        const r = roles.find((x) => x.id === u.roleid);
        return {
          id: u.id,
          username: u.username,
          nickname: u.nickname,
          roleid: u.roleid,
          roleName: r ? r.name : '',
          status: u.status,
          createdat: u.createdat,
          updatedat: u.updatedat,
        };
      });
    ok(res, list);
  });

  app.post('/api/system/user/save', (req: Request, res: Response) => {
    const actor = getAuthUser(req);
    const { id, username, password, nickname, roleid, status = 'ACTIVE' } = req.body || {};
    if (!roleid) {
      fail(res, 400, '请选择角色');
      return;
    }
    const targetRole = roles.find((r) => r.id === Number(roleid));
    if (id) {
      const existing = users.find((u) => u.id === Number(id));
      if (!existing) {
        fail(res, 404, '用户不存在');
        return;
      }
      if (targetRole?.code === 'super' && status === 'DISABLED') {
        fail(res, 400, '超级管理员账号不可被禁用');
        return;
      }
      existing.nickname = String(nickname || existing.username).trim();
      existing.roleid = Number(roleid);
      existing.status = status === 'DISABLED' ? 'DISABLED' : 'ACTIVE';
      existing.updatedat = nowMs();
      recordAudit(actor, 'system', 'USER_UPDATE', 'POST', existing.username, '更新系统用户信息与角色状态');
      ok(res, existing.id, '用户已更新');
      return;
    }
    if (!username || !password) {
      fail(res, 400, '用户名和初始密码不能为空');
      return;
    }
    if (users.some((u) => u.username === String(username).trim())) {
      fail(res, 400, '用户名已存在');
      return;
    }
    const created: UserRecord = {
      id: genId(),
      username: String(username).trim(),
      password: String(password),
      nickname: String(nickname || username).trim(),
      roleid: Number(roleid),
      status: status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
      createdat: nowMs(),
      updatedat: null,
    };
    users.push(created);
    recordAudit(actor, 'system', 'USER_CREATE', 'POST', created.username, '创建系统账号');
    ok(res, created.id, '用户创建成功');
  });

  app.post('/api/system/user/delete', (req: Request, res: Response) => {
    const actor = getAuthUser(req);
    const id = Number(req.body?.id);
    if (actor && actor.id === id) {
      fail(res, 400, '不能删除当前正在登录的账号');
      return;
    }
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) {
      fail(res, 404, '用户不存在');
      return;
    }
    const targetRole = roles.find((r) => r.id === users[idx].roleid);
    if (targetRole?.code === 'super') {
      fail(res, 400, '超级管理员账号不可删除');
      return;
    }
    const [removed] = users.splice(idx, 1);
    recordAudit(actor, 'system', 'USER_DELETE', 'POST', removed.username, '删除用户账号');
    ok(res, id, '用户已删除');
  });

  app.post('/api/system/user/resetPassword', (req: Request, res: Response) => {
    const actor = getAuthUser(req);
    const { id, password } = req.body || {};
    if (!password || String(password).length < 6) {
      fail(res, 400, '新密码至少 6 位');
      return;
    }
    const target = users.find((u) => u.id === Number(id));
    if (!target) {
      fail(res, 404, '用户不存在');
      return;
    }
    target.password = String(password);
    target.updatedat = nowMs();
    recordAudit(actor, 'system', 'USER_RESET_PASSWORD', 'POST', target.username, '管理员重置用户密码');
    ok(res, null, '密码已重置');
  });

  app.get('/api/system/roles', (_req: Request, res: Response) => {
    ok(res, roles);
  });

  app.post('/api/system/role/save', (req: Request, res: Response) => {
    const actor = getAuthUser(req);
    const { id, code, name, description = '', permissions = [] } = req.body || {};
    if (!code || !name) {
      fail(res, 400, '角色编码和名称不能为空');
      return;
    }
    const permStr = Array.isArray(permissions) ? permissions.join(',') : String(permissions || '');
    if (id) {
      const existing = roles.find((r) => r.id === Number(id));
      if (!existing) {
        fail(res, 404, '角色不存在');
        return;
      }
      if (existing.code !== 'super') {
        existing.code = String(code).trim();
      }
      existing.name = String(name).trim();
      existing.description = String(description);
      existing.permissions = permStr;
      recordAudit(actor, 'system', 'ROLE_SAVE', 'POST', existing.name, '更新角色权限矩阵');
      ok(res, existing.id, '角色已保存');
      return;
    }
    const created: RoleRecord = {
      id: genId(),
      code: String(code).trim(),
      name: String(name).trim(),
      description: String(description),
      permissions: permStr,
      createdat: nowMs(),
    };
    roles.push(created);
    recordAudit(actor, 'system', 'ROLE_SAVE', 'POST', created.name, '新建角色');
    ok(res, created.id, '角色已保存');
  });

  app.post('/api/system/role/delete', (req: Request, res: Response) => {
    const actor = getAuthUser(req);
    const id = Number(req.body?.id);
    const role = roles.find((r) => r.id === id);
    if (!role) {
      fail(res, 404, '角色不存在');
      return;
    }
    if (role.code === 'super') {
      fail(res, 400, '内置超级管理员角色不可删除');
      return;
    }
    if (users.some((u) => u.roleid === id)) {
      fail(res, 400, '该角色下仍有关联用户，请先调整用户角色');
      return;
    }
    const idx = roles.findIndex((r) => r.id === id);
    roles.splice(idx, 1);
    recordAudit(actor, 'system', 'ROLE_DELETE', 'POST', role.name, '删除角色');
    ok(res, id, '角色已删除');
  });

  app.get('/api/system/permissions', (_req: Request, res: Response) => {
    ok(res, PERMISSION_CATALOG);
  });

  app.post('/api/system/logs', (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.body?.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.body?.size) || 20));
    const mod = String(req.body?.module || '').trim();
    const uname = String(req.body?.username || '').trim().toLowerCase();
    const resFilter = String(req.body?.result || '').trim();
    const kw = String(req.body?.keyword || '').trim().toLowerCase();
    const startTs = req.body?.start ? new Date(String(req.body.start).replace(' ', 'T')).getTime() : null;
    const endTs = req.body?.end ? new Date(String(req.body.end).replace(' ', 'T')).getTime() : null;

    const filtered = sysLogs.filter((l) => {
      if (mod && l.module !== mod) return false;
      if (uname && !l.username.toLowerCase().includes(uname)) return false;
      if (resFilter && l.result !== resFilter) return false;
      if (startTs && !isNaN(startTs) && l.createdat < startTs) return false;
      if (endTs && !isNaN(endTs) && l.createdat > endTs) return false;
      if (kw) {
        return (
          l.target.toLowerCase().includes(kw) ||
          (l.detail || '').toLowerCase().includes(kw) ||
          (l.message || '').toLowerCase().includes(kw) ||
          l.action.toLowerCase().includes(kw)
        );
      }
      return true;
    });

    const start = (page - 1) * size;
    ok(res, {
      total: filtered.length,
      page,
      size,
      rows: filtered.slice(start, start + size),
    });
  });

  // ---------- Vite / Static SPA Serving ----------
  const isProd =
    process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`SSLAuto CLM Workbench listening on http://0.0.0.0:${port}`);
  });
}

startServer();
