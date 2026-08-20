# HiAPI 餐饮食品广告视频 Skill

通过 HiAPI 生成咖啡、饮料、餐饮、食品和电商商品的单镜头广告短片。

[获取 API Key](https://www.hiapi.ai/zh/dashboard/api-keys) | [查看价格](https://www.hiapi.ai/zh/pricing) | [HiAPI 文档](https://docs.hiapi.ai) | [全部 HiAPI Skills](https://github.com/HiAPIAI/hiapi-skills)

Languages: [English](README.md) | [简体中文](README.zh-CN.md)

> AI Agent 请先读 [llms-install.md](llms-install.md)，里面包含安装步骤和付费保护规则。

## 功能

这个 Skill 会规划、预览、估价并生成一个连续的食品广告镜头，并根据素材自动选择模型：

| 输入 | 路线 | 模型 | 时长 |
| --- | --- | --- | --- |
| 只有文字 | 文生视频 | Kling 3.0 Omni | 3-15 秒之间的任意整数 |
| 1 张主视觉图 | 图生视频 | Kling 3.0 Omni | 3-15 秒之间的任意整数 |
| 1-9 张参考图 | 多参考图生视频 | Seedance 2.0 Fast | 4-15 秒之间的任意整数 |

内置商品英雄镜头、咖啡倾倒、饮品飞溅、食品微距和餐厅氛围配方。整个工作流坚持一个主要动作、一个镜头运动、可信的食品物理效果和真实的包装外观。

真人口播、参考视频动作迁移、已有视频编辑、多镜头拼接、字幕、Logo 或 CTA 合成应使用其他 Skill 或后期工具。

## 安装

推荐一行安装：

```bash
npx -y github:HiAPIAI/hiapi-food-commercial-video-skill -y
```

指定运行环境：

```bash
npx -y github:HiAPIAI/hiapi-food-commercial-video-skill --codex
npx -y github:HiAPIAI/hiapi-food-commercial-video-skill --claude
npx -y github:HiAPIAI/hiapi-food-commercial-video-skill --target=/path/to/skills
```

安装器会先下载并校验新副本，再替换现有的干净安装目录。本地文件、被忽略的配置或输出、本地分支提交和 stash 都会视为本地改动；交换目录前后还会再次检查，如果下载期间出现改动则保留旧副本。请先保留本地内容，或显式传入 `--force` 才进行替换。

OpenClaw：

```bash
openclaw skills add https://github.com/HiAPIAI/hiapi-food-commercial-video-skill
```

手动安装到 Codex：

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
git clone https://github.com/HiAPIAI/hiapi-food-commercial-video-skill.git "${CODEX_HOME:-$HOME/.codex}/skills/hiapi-food-commercial-video"
```

## 配置

```bash
export HIAPI_API_KEY="your_hiapi_api_key_here"
```

也可以在环境文件中设置相同变量，但不要提交真实 API Key。

检查配置且不创建付费任务：

```bash
node scripts/hiapi-food-commercial-video.mjs --check
```

## 付费保护流程

1. 先用 `--preview` 在离线状态查看完整的脱敏请求。
2. 执行 `--check` 前说明它会访问 HiAPI，但不会创建付费任务。
3. 用 `--dry-run` 获取公开价格、费用估算和请求哈希；它不会创建付费任务。
4. 只有用户明确批准该估价、预算和哈希后，才能执行 `--spend --approved-request-hash HASH`。

默认客户端估价上限为 `$0.50`。它是客户端审批保护，不是服务端最终扣费上限。

离线预览：

```bash
node scripts/hiapi-food-commercial-video.mjs \
  --recipe coffee-pour \
  --prompt "一只陶瓷杯中的精品深烘咖啡" \
  --duration 6 \
  --ratio 9:16 \
  --preview
```

给商品主视觉图估价：

```bash
node scripts/hiapi-food-commercial-video.mjs \
  --recipe product-hero \
  --hero-image-file "/path/to/product.jpg" \
  --prompt "使用提供的气泡水罐，在干净冰凉的台面上拍摄" \
  --duration 5 \
  --dry-run
```

完整 Agent 流程见 [SKILL.md](SKILL.md)，请求约束见 [references/api.md](references/api.md)。

## 验证

```bash
npm test
```

测试全部离线运行，不会创建付费任务。

## 许可证

MIT
