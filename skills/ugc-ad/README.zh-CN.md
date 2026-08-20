# HiAPI Seedance 2.0 UGC 广告视频技能

![HiAPI Seedance 2.0 UGC 广告视频技能参考图](assets/social-preview-ugc-ad-video.png)

通过 HiAPI Seedance 2.0 生成有事实依据、面向 TikTok 和 Instagram Reels 的创作者风格产品广告。

**UGC brief → 卖点与授权检查 → 9:16 Seedance 视频 → 成片质检**

[获取 HiAPI API Key](https://www.hiapi.ai/en/dashboard/api-keys) · [Seedance 2.0 模型](https://www.hiapi.ai/en/models/seedance-2-0) · [HiAPI 文档](https://docs.hiapi.ai)

语言：[English](README.md) | [简体中文](README.zh-CN.md)

> AI Agent 请先读 [llms-install.md](llms-install.md)，安装后按 `SKILL.md` 执行。

## 它解决什么问题

这是给电商卖家、UGC 创作者和广告投放团队使用的工作流技能。它复用现有的 [HiAPI Seedance 2.0 视频技能](https://github.com/HiAPIAI/hiapi-seedance-2-0-video-skill)，在其上增加：

- TikTok/Reels 优先的 `9:16` 创意规划
- 开箱、首次试用、真人口播、痛点解决、试穿和对比
- 有来源的产品卖点台账
- 真人授权与合成人物检查
- 精确台词与语速检查
- 首帧、多模态参考和纯文本三种生成模式
- 付费生成保护及成片质检

提交、轮询和下载逻辑直接复用相邻的 Seedance 技能，不重复造轮子。

## 真实出片示例

这是一条已通过生产环境鉴权 E2E 的真实 Seedance 2.0 输出。人物为合成成人，产品为虚构无品牌夹灯；它是创作者演示，不是真实顾客评价。

[![合成创作者演示白色夹灯的动态预览](assets/examples/ugc-clip-light-e2e-preview.gif)](assets/examples/ugc-clip-light-e2e.mp4)

**[▶ 打开 10 秒 MP4，观看原生英语口播](assets/examples/ugc-clip-light-e2e.mp4)**

`Seedance 2.0` · `10 秒` · `720 × 1280` · `9:16` · 原生音频 · 首帧图生视频

首页 GIF 为静音压缩预览；链接中的 H.264 MP4 保留原生成音频。完整鉴权、成片和 QC 证据及验收保留项见 [E2E 验证记录](docs/e2e-validation.md)。

## GitHub 调研基础

该技能基于成熟开源项目的工作流结构设计：

- [SamurAIGPT/Generative-Media-Skills](https://github.com/SamurAIGPT/Generative-Media-Skills)：人物与产品参考图、先验证 hero frame、再生成短竖屏 Seedance 视频。
- [mutonby/openshorts](https://github.com/mutonby/openshorts)：产品调研、Hook/痛点/演示/CTA、依据音频生成字幕和最终质检。

完整的星标快照、许可证和采用边界见 [references/github-foundations.md](references/github-foundations.md)。仓库不包含 OpenShorts `cloud/` 代码。

## 安装

```bash
npx -y github:HiAPIAI/hiapi-seedance-2-0-ugc-ad-video-skill -y
```

安装器会识别 Codex 与 Claude Code 的技能目录；如果缺少基础 Seedance 2.0 技能，会一并安装。

```bash
npx -y github:HiAPIAI/hiapi-seedance-2-0-ugc-ad-video-skill --codex
npx -y github:HiAPIAI/hiapi-seedance-2-0-ugc-ad-video-skill --claude
npx -y github:HiAPIAI/hiapi-seedance-2-0-ugc-ad-video-skill --target=/path/to/skills
```

在启动 Agent 的环境中设置：

```bash
export HIAPI_API_KEY="your_hiapi_api_key"
export HIAPI_BASE_URL="https://api.hiapi.ai"
```

不要提交 `.env` 或 API Key。

## 快速开始

复制可校验的 brief：

```bash
cp assets/ugc-brief.example.json /absolute/path/to/ugc-brief.json
```

替换全部演示字段和素材 URL。示例文件故意使用 `example.com`，真实付费生成会拒绝这些占位地址。

先校验：

```bash
node scripts/validate-ugc-brief.mjs /absolute/path/to/ugc-brief.json
```

不消耗积分检查真实请求体：

```bash
node scripts/run-ugc-seedance.mjs /absolute/path/to/ugc-brief.json --dry-run
```

确认 brief、卖点来源、人物授权、素材、费用和披露后，再真实生成：

```bash
node scripts/run-ugc-seedance.mjs /absolute/path/to/ugc-brief.json
```

任务创建成功后，runner 会立即输出 HiAPI task ID。如果本地轮询因网络中断，请恢复同一任务，不要重复付费创建：

```bash
node scripts/run-ugc-seedance.mjs /absolute/path/to/ugc-brief.json \
  --resume-task-id "tk-hiapi-..."
```

## 默认参数

| 项目 | 默认值 |
| --- | --- |
| 平台 | TikTok 和 Instagram Reels |
| 形式 | 单镜头创作者产品演示 |
| 时长 | 10 秒 |
| 比例 | `9:16` |
| 分辨率 | `720p` 草稿 |
| 音频 | 开启原生对白 |
| 存储 | 临时存储并下载本地 |
| 批量策略 | 三条仅改变 Hook 的受控变体 |

单个任务限制为 4–15 秒。20–30 秒广告应拆成多个独立通过质检的片段后再组装。

## 安全与真实性

- 只有获得授权时才可使用真人肖像。
- 合成人物必须在 brief 中明确标注，发布前核对当前平台披露规则。
- 不得编造个人体验、用户评价、效果、价格、折扣或稀缺性。
- 医疗、保健、金融等受监管品类需要当前政策调研和合规批准。
- `4k` 与付费持久存储需要用户明确确认费用。
- 本技能只生成并验证媒体；除非用户另行明确要求，否则不会发布。

## 测试

```bash
npm test
npm run check
```

`npm test` 会检查卖点、授权、素材和费用门禁。Dry-run 成功不等于真实出片成功；必须检查已下载的 MP4 和完整音频。

仓库已使用合成人物和虚构无品牌产品完成生产环境鉴权 E2E。成片、转写、运行时修复和 QC 证据见 [docs/e2e-validation.md](docs/e2e-validation.md)。

## 许可证

MIT。上游项目保留各自许可证与商标。
