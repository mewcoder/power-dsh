# 网页搜索与抓取后端免费额度调研（2026-11-16）

> 研究材料，不是功能 Spec。用于 [第三方网页搜索](../src/features/web-search/spec.md) 的选型依据，不构成新增后端的实现授权。
>
> 数据口径：额度与端点取自各服务**官方定价页与 API 文档**，抓取于 2026-11-16。无法从官方源确认的写「未确认」，不推断补全。额度由供应商单方调整，本文只是选型时点快照。
>
> 后续产品决定：按用户要求，插件已撤销免密钥调用，所有第三方服务均须配置 API Key；本文的免密钥信息与实测仅作历史研究记录，当前行为以主 Spec 为准。

## 收录原则

本功能只收录**有官方免费额度**的后端。免费额度的含义限于「注册后可零成本调用」，包括需要绑卡但按月返还额度的形式；一次性试用额度与需要企业邮箱门槛的也记录，但排在后面。没有任何免费层的服务不接入——本功能存在的理由就是让用户不付费也能搜索。

首版实际收录三家（搜索与抓取都支持）：Tavily、Firecrawl、TinyFish。

## 已收录后端

| 后端 | 搜索 | 抓取 | 免费额度 | 免密钥 | 认证 | 关键限制 |
| --- | --- | --- | --- | --- | --- | --- |
| Tavily | ✓ | ✓ | 1,000 credits/月 | 是（`X-Tavily-Access-Mode: keyless`） | `Authorization: Bearer` | 免费档只能建 Development key，100 RPM，无 PAYGO |
| Firecrawl | ✓ | ✓ | 1,000 credits/月（≈500 次搜索或 1,000 页） | 是（省略 `Authorization`，按 IP 限流） | `Authorization: Bearer` | 2 并发、search 10 RPM、无 PAYGO，超额 402；免密钥模式拒绝 VPN／代理出口 IP |
| TinyFish | ✓ | ✓ | Search 与 Fetch 在限速内免费 | 否 | `X-API-Key` | 官方两处口径不一致：30/min＋500/hour 与 12,000/天，按更严者理解；超额 402 |

### 端点与响应

- **Tavily**：`POST https://api.tavily.com/search`，body `{ query, search_depth, max_results, include_answer }`，响应 `results[].title/url/content/published_date` 与 `answer`。抓取 `POST https://api.tavily.com/extract`，body `{ urls }`，响应 `results[].raw_content`，**部分失败在 `failed_results[]`**，两个数组都要判。
- **Firecrawl**：`POST https://api.firecrawl.dev/v2/search`，body `{ query, limit, sources: [{ type: 'web' }] }`，响应 `data.web[].title/description/url/markdown`。抓取 `POST https://api.firecrawl.dev/v2/scrape`，body `{ url, formats: ['markdown'] }`，响应 `data.markdown`；截断通过 `warning` 字段表达，且该字段位置在 API 修订间移动过，两处都读。
- **TinyFish**：搜索与抓取在**不同子域**且字段名不一致。搜索 `GET https://api.search.tinyfish.ai?query=...`，响应 `results[].title/snippet/url/published_at`；抓取 `POST https://api.fetch.tinyfish.ai`，body `{ urls: [url], format: 'markdown' }`，响应 `results[].text` 与 `errors[]`。

## 其他有免费额度、未收录

| 服务 | 类型 | 免费额度 | 未收录原因 |
| --- | --- | --- | --- |
| Exa | 两者 | $10 credits/月＋一次性 bonus | 官方称无需卡，但实际 dashboard 常要求绑卡验证，行为不确定 |
| Brave Search | 搜索 | 每计划 $5 credits/月（≈1,000 次） | 必须绑卡并做 $0/$1 预授权；且禁止留存返回数据 |
| Serper.dev | 搜索 | 2,500 次一次性 | 一次性额度，用完即需付费，不适合作为长期免费通道 |
| SerpApi | 搜索 | 250 次/月 | 额度太小；是否需卡未确认 |
| Jina Reader／Search | 两者 | 无 key 20 RPM；新 key 送 10M tokens | 搜索每次固定消耗 ≥10,000 tokens，免费池用尽不重置 |
| Keenable | 两者 | 100,000 req/月 | 额度充裕，但接入尚未核对；可作为后续候选 |
| Parallel | 两者 | MCP 免账号；Build 档 $5/月＋注册奖励 | 主要额度需绑卡；MCP 限额未公布 |
| Valyu | 两者 | 2,000 credits/月 | 需企业邮箱门槛 |
| Linkup | 两者 | $20/月 | 需专业邮箱门槛 |
| Search1API | 两者 | 100 credits 一次性 | 一次性额度 |
| Zenserp | 搜索 | 50 次/月 | 额度仅够连通性验证 |
| Marginalia | 搜索 | 免费非商用 key | 需邮件申请；结果许可 CC-BY-NC-SA，非商用 |
| Wikipedia | 搜索 | 免费（带合规 UA 200 req/min） | 仅百科内容，不适合通用检索 |
| markdown.new | 抓取 | 500 req/天/IP | 作为兜底候选，未纳入首版 |
| Cloudflare Browser Rendering | 抓取 | Workers Free 每天 10 分钟浏览器 | 额度极小，只适合兜底 |
| You.com | 两者 | MCP 免 key 100 次/天；注册送 $10 | 未核对 MCP 接入方式 |
| SearXNG（自建） | 搜索 | 不限量 | 需要用户自建实例，不属于第三方托管服务 |

## 明确排除

| 服务 | 原因 |
| --- | --- |
| Perplexity API | 完全没有免费层，Pro 订阅不含 API credits |
| Google Custom Search JSON API | 名义 100 次/天，但已对新客户关闭，且 2027-01-01 停止服务 |
| Bing Search API | 2025-08-11 已退役 |
| Startpage／Ecosia | 无官方搜索 API，且明确反爬 |
| DuckDuckGo HTML | 无官方 API 与授权，数据中心 IP 极易触发人机挑战 |
| SearXNG 公共实例 | 无额度概念，`format=json` 普遍关闭，limiter 直接 429/403 |

## 实测记录

2026-11-16 在本机以**免密钥模式**实测两个后端（出口为代理网络）：

- Tavily 免密钥搜索成功，返回 3 条带 snippet 的结果。
- Firecrawl 免密钥搜索返回 **HTTP 403**，响应正文说明出口 IP 疑似 VPN／代理，需用 API key；回退链随即转向 Tavily。
- 以「Firecrawl → Tavily」顺序的聚合抓取链抓取 `https://example.com` 成功（Firecrawl 失败后由 Tavily 返回正文），验证了回退行为。

TinyFish 需密钥，未做无凭据实测。

## 与仓库的关系

本文只记录选型依据与实测事实。后端清单、回退语义、密钥存储与验收条件以[主 Spec](../src/features/web-search/spec.md)为准；参考过的社区插件实现记录在[参考研究](reference-research.md)。
