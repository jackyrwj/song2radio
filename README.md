# 电台情歌

把网易云音乐和 QQ 音乐的网页歌单，变成一档带口播串场的私人电台。

[官方网站](https://jackyrwj.github.io/song2radio/) · [隐私政策](https://jackyrwj.github.io/song2radio/privacy.html) · [帮助与支持](https://jackyrwj.github.io/song2radio/support.html)

我做它的原因很简单：歌单很好，但歌和歌之间太“硬切”了。上一首刚结束，下一首马上进来，有时候还没来得及看歌名、歌手和专辑，音乐就已经变成背景音了。

电台情歌会在每首歌播放前先停一下，用一小段中文口播介绍接下来要听的歌，然后再恢复播放。你可以把它当成一个很轻的小 DJ。
<img width="2541" height="1318" alt="image" src="https://github.com/user-attachments/assets/67803471-40c1-42e9-b6a1-6b967bec9788" />


## 它能做什么

- 支持网易云音乐网页版和 QQ 音乐网页版。
- 每首歌播放前自动播报歌名、歌手、专辑等信息。
- 新专辑第一次出现时，可联网查询发行背景、风格和影响并生成专辑口播。
- 第一首歌会有开场白，最后一首歌会有收尾语。
- 用户无需填写 API Key，AI 文案和专辑查询由电台情歌服务统一提供。
- 网易云和 QQ 音乐的播放进度条会显示 AI 口播准备进度。
- 提供多种普通话和方言云端主持音色，默认使用 Maia。
- AI 或语音接口失败时会自动降级，不会卡住播放器。

## 安装

目前还没有上架 Chrome 应用商店，需要手动加载插件。

1. 下载或克隆这个仓库。
2. 如果你下载的是 `diantai-qingge-extension.zip`，先解压。
3. 打开 Chrome / Edge 扩展页面：

```text
chrome://extensions/
edge://extensions/
```

4. 打开右上角「开发者模式」。
5. 点击「加载已解压的扩展程序」。
6. 选择 `netease-intro-extension/` 文件夹。

装好后，浏览器右上角会出现「电台情歌」。音色和其他选项都可以在插件弹窗中调整。

## 使用

打开网易云音乐或 QQ 音乐网页版，正常播放歌单就行。

```text
网易云音乐：https://music.163.com/
QQ 音乐：https://y.qq.com/
```

插件会在新歌开始前接管播放：先暂停音乐，播报介绍，再继续播放歌曲。

等待 AI 生成文案或查询专辑时，播放器的原进度条上会显示准备进度。进度条会跟随播放器一起显示或隐藏，不会额外遮挡页面。

如果刚装完没有生效，刷新音乐页面，或者回到扩展程序页面点一次「重新加载」。

## 设置怎么选

点击插件图标，可以看到几个开关。

`播放前语音播报` 是总开关。关掉后，音乐网站恢复原样。

`AI 生成介绍` 决定文案是不是交给模型来写。不开 AI 时，会使用简单模板，比如“接下来为您播放：歌曲名，演唱：歌手名”。

`专辑资料播报` 会在一张专辑本次首次出现时，通过百炼联网查询相关资料并生成一段专辑介绍。同一张专辑的后续歌曲不会重复介绍。

`音色` 提供多种百炼云端主持音色，默认使用 Maia。系统语音不再作为可选音色，只在云端服务暂时不可用时自动兜底，避免播报流程中断。

## 推荐配置

推荐日常使用：

```text
播放前语音播报：开
AI 生成介绍：开
专辑资料播报：开
音色：Maia · 知性温柔女声
```

更像电台：

```text
播放前语音播报：开
AI 生成介绍：开
音色：Neil · 新闻主持男声
```

云端音色使用服务端共享额度；系统语音只在服务异常时兜底。

## 常见问题

**没有播报怎么办？**

先确认插件已开启，然后刷新网易云/QQ 音乐页面。如果还不行，到 `chrome://extensions/` 里重新加载插件。

**为什么只有简单播报？**

通常是共享服务暂时不可用、达到当日额度，或者关闭了「AI 生成介绍」。插件会自动退回简单文案，不会中断音乐播放。

**为什么云端音色没声音？**

云端音色使用服务端共享额度。额度用完或语音接口失败时，插件会临时使用系统语音完成当前播报。

**QQ 音乐为什么比网易云难适配？**

网易云可以比较稳定地拦截网页里的音频播放。QQ 音乐的播放器页面和首页结构不一样，切歌时歌名、按钮状态、真实媒体播放不一定同步，所以代码里做了媒体播放拦截 + DOM 观察的混合处理。

**为什么不再需要 API Key？**

API Key 只配置在 Vercel 的服务端环境变量中。扩展不会保存、接收或返回 Key；从旧版本升级时，也会删除浏览器本地遗留的 Key。

## 项目结构

```text
api/
  intro.js              受限的文案与 TTS 服务接口
  health.js             部署配置健康检查
lib/server/
  song2radio.js         输入校验、模型、联网搜索与 TTS
  rate-limit.js         Upstash Redis 限流
netease-intro-extension/
  manifest.json          插件配置
  background.js          调用 Song2Radio 服务，不接触供应商 Key
  popup.html / popup.js  插件弹窗
  bridge.js              页面和插件后台的桥
  intercept.js           播放拦截和口播流程
  adapters/
    netease.js           网易云适配
    qq.js                QQ 音乐适配
```

整体流程是：

```text
读取歌曲和专辑信息 -> Vercel 接口限流与缓存 -> 百炼生成文案/TTS -> 语音播报 -> 恢复歌曲播放
```

客户端会为每次安装生成一个随机匿名标识，只用于限流，不包含账号或音乐历史。服务端同时按匿名安装、IP 和全局预算限制调用，并使用 Upstash Redis 缓存文案。接口只接受受限的歌曲字段和预定义音色，不接受任意 prompt。

## 部署免费服务

需要准备一个 Vercel 项目、百炼 API Key，以及通过 Vercel Marketplace 创建的 Upstash Redis。用户免费使用产生的模型、搜索和语音费用由服务维护者承担。

1. 安装依赖并登录 Vercel：

```bash
npm install
vercel login
vercel link
```

2. 在 Vercel Marketplace 为项目添加 Upstash Redis。当前集成会自动注入 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN`；代码也兼容 Upstash 直连时使用的 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`。

3. 配置服务端密钥和限流盐值：

```bash
vercel env add DASHSCOPE_API_KEY
vercel env add RATE_LIMIT_SALT
```

建议将两个变量都配置到 Production、Preview 和 Development。`RATE_LIMIT_SALT` 应使用足够长的随机字符串。

4. 部署并检查状态：

```bash
vercel --prod
curl https://song2radio.vercel.app/api/health
```

健康检查返回 `status: ok` 后服务才可用。扩展默认连接 `https://song2radio.vercel.app`；如果实际域名不同，需要同步修改 `background.js` 中的 `SERVICE_ENDPOINT` 和 `manifest.json` 的 `host_permissions`，然后重新打包扩展。

可在 Vercel 环境变量中调整 `HOURLY_IP_LIMIT`、`DAILY_INSTALL_LIMIT`、`DAILY_ALBUM_LIMIT` 和 `GLOBAL_DAILY_LIMIT`。设置 `ENABLE_CLOUD_TTS=false` 可以紧急关闭高成本云端语音，而不影响文案和系统语音。

## 开发

扩展没有构建步骤，源码目录就是插件本体。Vercel 服务端固定使用 Node.js 24 LTS。

运行测试和完整性校验：

```bash
npm test
npm run validate:extension
```

重新打包：

```powershell
Compress-Archive -Path .\netease-intro-extension\* -DestinationPath .\diantai-qingge-extension.zip -Force
```

检查语法：

```bash
node --check netease-intro-extension/background.js
node --check netease-intro-extension/intercept.js
node --check netease-intro-extension/adapters/netease.js
node --check netease-intro-extension/adapters/qq.js
node --check netease-intro-extension/bridge.js
node --check netease-intro-extension/popup.js
```

提交前建议扫一下是否误放 API Key：

```bash
rg -n "sk-[A-Za-z0-9]|DEFAULT_API_KEY|freeCallsUsed|quotaAnnounced|FREE_CALL_LIMIT" .
```

## 说明

这个项目主要用于个人学习。公开提供免费服务前，请设置合理的限流、预算告警和 Vercel 防火墙规则，并留意百炼、Vercel 与 Upstash 的计费和服务条款。
