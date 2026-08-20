# HiAPI 商品口播视频 Skill

通过 [HiAPI](https://www.hiapi.ai) 生成商品口播、品牌介绍、虚拟代言人和经授权的真人出镜广告视频。

[获取 API Key](https://www.hiapi.ai/zh/register) | [价格](https://www.hiapi.ai/zh/pricing) | [HiAPI 文档](https://docs.hiapi.ai) | [全部 HiAPI Skills](https://github.com/HiAPIAI/hiapi-skills)

语言：[English](README.md) | [简体中文](README.zh-CN.md)

> AI Agent 请先阅读 [llms-install.md](llms-install.md)，其中包含安装步骤和执行规则。

## 功能

这是一个面向短视频生成的专用工作流，根据用途选择对应的 HiAPI 模型，生成 3-15 秒的全新单镜头视频：

| 场景 | 模型 | 输入 | 时长 |
| --- | --- | --- | --- |
| 虚拟口播人 | Kling 3.0 Omni 文生视频 | 提示词，可选口播文案 | 3-15 秒 |
| 真人口播 | Kling 3.0 Omni 图生视频 | 一张经授权的人物图片、提示词和授权确认 | 3-15 秒 |
| 商品介绍 | Seedance 2.0 Fast | 提示词和 1-9 张商品图片 | 4-15 秒 |
| 品牌宣传 | Seedance 2.0 Fast | 提示词和 1-9 张品牌或商品图片 | 4-15 秒 |

本 Skill 只生成新视频，不编辑现有视频、不替换现有视频中的主体，也不拼接已有素材。

## 安装

推荐命令：

```bash
npx -y github:HiAPIAI/hiapi-product-spokesperson-video-skill -y
```

安装器会识别 Codex（`~/.codex/skills`）和 Claude Code（`~/.claude/skills`）。也可以指定目标：

```bash
npx -y github:HiAPIAI/hiapi-product-spokesperson-video-skill --codex
npx -y github:HiAPIAI/hiapi-product-spokesperson-video-skill --claude
npx -y github:HiAPIAI/hiapi-product-spokesperson-video-skill --target=/path/to/skills
```

OpenClaw：

```bash
openclaw skills add https://github.com/HiAPIAI/hiapi-product-spokesperson-video-skill
```

手动安装：

```bash
git clone https://github.com/HiAPIAI/hiapi-product-spokesperson-video-skill.git
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R hiapi-product-spokesperson-video-skill "${CODEX_HOME:-$HOME/.codex}/skills/hiapi-product-spokesperson-video"
```

如果 Agent 会缓存 Skills，安装后请重启 Agent。

## 配置

在运行 Agent 的环境中设置 Key：

```bash
export HIAPI_API_KEY="your_hiapi_api_key_here"
```

也可以把 Key 放入已被 Git 忽略的环境文件，再通过 `--env-file` 读取。不要提交或输出 Key。

先执行零费用鉴权和实时价格检查：

```bash
node scripts/hiapi-product-spokesperson-video.mjs --check --env-file "/path/to/.env.local"
```

## 必须遵守的流程

1. 选择一个生成场景。
2. 询问并确认视频时长。Kling 支持 3-15 秒，Seedance 支持 4-15 秒。
3. 使用真人图片时，必须确认用户拥有授权，并加入 `--consent-confirmed`。
4. 先用 `--dry-run` 校验请求并获取实时公开价格估算。
5. 只有用户明确同意价格和预算后，才使用 `--spend` 创建一次付费任务。

预算限制是客户端估算保护。账户分组价格系数可能影响最终预扣费，因此应保留预算余量。

## 示例

虚拟口播人价格预估：

```bash
node scripts/hiapi-product-spokesperson-video.mjs \
  --scenario synthetic-spokesperson \
  --prompt "虚拟主持人在整洁影棚内面对镜头，固定机位" \
  --dialogue "全新便携咖啡机现已上市。" \
  --duration 3 \
  --max-cost-usd 0.50 \
  --dry-run
```

经授权的真人口播价格预估：

```bash
node scripts/hiapi-product-spokesperson-video.mjs \
  --scenario talking-head \
  --image-file "/path/to/authorized-person.jpg" \
  --prompt "自然看向镜头，动作克制" \
  --dialogue "我们的最新系列现已发布。" \
  --duration 3 \
  --consent-confirmed \
  --dry-run
```

商品介绍价格预估：

```bash
node scripts/hiapi-product-spokesperson-video.mjs \
  --scenario product-intro \
  --reference-image-file "/path/to/product-front.jpg" \
  --reference-image-file "/path/to/product-detail.jpg" \
  --prompt "竖屏商品介绍，准确保持材质和比例" \
  --duration 4 \
  --dry-run
```

用户确认后，复用已审核的命令，把 `--dry-run` 改为 `--spend`，并使用已配置的 Key 或加入 `--env-file`。

成功后会在 `outputs/` 中保存 `final.mp4`、文案与字幕、已脱敏的提示词、任务清单和质检清单。发布前必须人工检查语音、口型、画面一致性和宣传内容准确性。

## 开发验证

```bash
npm test
node --check scripts/hiapi-product-spokesperson-video.mjs
node --check scripts/install.mjs
```

## 许可证

[MIT](LICENSE)
