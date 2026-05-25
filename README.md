# 歌单电台 Song2Radio

把网易云音乐和 QQ 音乐的网页歌单，变成一档带口播串场的私人电台。

我做它的原因很简单：歌单很好，但歌和歌之间太“硬切”了。上一首刚结束，下一首马上进来，有时候还没来得及看歌名、歌手和专辑，音乐就已经变成背景音了。

歌单电台会在每首歌播放前先停一下，用一小段中文口播介绍接下来要听的歌，然后再恢复播放。你可以把它当成一个很轻的小 DJ。
<img width="2541" height="1318" alt="image" src="https://github.com/user-attachments/assets/67803471-40c1-42e9-b6a1-6b967bec9788" />


## 它能做什么

- 支持网易云音乐网页版和 QQ 音乐网页版。
- 每首歌播放前自动播报歌名、歌手、专辑等信息。
- 第一首歌会有开场白，最后一首歌会有收尾语。
- 不填 API Key 也能用：简单文案 + 浏览器/系统语音。
- 填百炼 API Key 后，可以用通义千问生成文案，也可以用百炼云端音色。
- 也可以用 DeepSeek 生成文案，语音仍然可选系统语音或百炼音色。
- AI 或语音接口失败时会自动降级，不会卡住播放器。

## 安装

目前还没有上架 Chrome 应用商店，需要手动加载插件。

1. 下载或克隆这个仓库。
2. 如果你下载的是 `netease-intro-extension.zip`，先解压。
3. 打开 Chrome / Edge 扩展页面：

```text
chrome://extensions/
edge://extensions/
```

4. 打开右上角「开发者模式」。
5. 点击「加载已解压的扩展程序」。
6. 选择 `netease-intro-extension/` 文件夹。

装好后，浏览器右上角会出现「歌单电台」。建议把它固定到工具栏，方便开关和配置。

## 使用

打开网易云音乐或 QQ 音乐网页版，正常播放歌单就行。

```text
网易云音乐：https://music.163.com/
QQ 音乐：https://y.qq.com/
```

插件会在新歌开始前接管播放：先暂停音乐，播报介绍，再继续播放歌曲。

如果刚装完没有生效，刷新音乐页面，或者回到扩展程序页面点一次「重新加载」。

## 设置怎么选

点击插件图标，可以看到几个开关。

`播放前语音播报` 是总开关。关掉后，音乐网站恢复原样。

`AI 生成介绍` 决定文案是不是交给模型来写。不开 AI 时，会使用简单模板，比如“接下来为您播放：歌曲名，演唱：歌手名”。

`音色` 可以选浏览器默认、系统语音或百炼云端音色。系统语音免费、快，适合日常用；百炼云端音色更像主持人，但需要百炼 API Key。我自己最喜欢 `Maia · 知性温柔女声`，所以插件默认推荐它。没填百炼 Key 时，云端音色不会生效，插件会退回系统语音或简单播报。

`百炼 API Key` 用来生成通义千问文案和百炼云端语音。插件不会内置作者 Key，也不建议你把自己的 Key 写进源码里公开发布。

`用 DeepSeek 替代生成文案` 只影响文案生成。如果你选的是百炼云端音色，语音合成仍然需要百炼 Key。

## 推荐配置

先体验：

```text
播放前语音播报：开
AI 生成介绍：关
音色：浏览器默认或系统语音
API Key：不填
```

更像电台：

```text
播放前语音播报：开
AI 生成介绍：开
音色：Maia · 知性温柔女声
百炼 API Key：填写自己的
```

想省一点云端语音成本：

```text
播放前语音播报：开
AI 生成介绍：开
音色：系统语音
百炼 API Key 或 DeepSeek API Key：填一个
```

## 常见问题

**没有播报怎么办？**

先确认插件已开启，然后刷新网易云/QQ 音乐页面。如果还不行，到 `chrome://extensions/` 里重新加载插件。

**为什么只有简单播报？**

通常是没填 API Key，或者模型接口失败了。填入百炼或 DeepSeek Key，并打开「AI 生成介绍」即可。

**为什么云端音色没声音？**

云端音色需要百炼 API Key，也需要账户有可用额度。失败时插件会退回系统语音。

**QQ 音乐为什么比网易云难适配？**

网易云可以比较稳定地拦截网页里的音频播放。QQ 音乐的播放器页面和首页结构不一样，切歌时歌名、按钮状态、真实媒体播放不一定同步，所以代码里做了媒体播放拦截 + DOM 观察的混合处理。

**API Key 会上传到哪里？**

Key 保存在浏览器扩展本地存储里，只用于请求你选择的模型或语音服务。项目不内置公共 Key。

## 项目结构

```text
netease-intro-extension/
  manifest.json          插件配置
  background.js          调用模型和 TTS
  popup.html / popup.js  插件弹窗
  bridge.js              页面和插件后台的桥
  intercept.js           播放拦截和口播流程
  adapters/
    netease.js           网易云适配
    qq.js                QQ 音乐适配
```

整体流程是：

```text
读取歌曲信息 -> 生成/准备口播文案 -> 语音播报 -> 恢复歌曲播放
```

## 开发

这个项目没有构建步骤，源码目录就是插件本体。

重新打包：

```powershell
Compress-Archive -Path .\netease-intro-extension\* -DestinationPath .\netease-intro-extension.zip -Force
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

这个项目主要是个人学习和自用体验。使用百炼、DeepSeek 等服务时，请留意各平台的计费和服务条款。
