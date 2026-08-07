# 电台情歌 Chrome Web Store 上架填写稿

更新时间：2026-08-07

下面的文字可以直接复制到 Chrome Web Store 开发者后台。隐私勾选项需要和提交版本的代码保持一致；以后新增权限或数据用途时，应同步更新商店披露和隐私政策。

## 1. Package / 软件包

- 上传文件：`diantai-qingge-extension.zip`
- 当前版本：`3.1.3`
- Manifest V3：是
- 需要登录测试账号：否

## 2. Store Listing / 商品详情

### Product details / 产品详情

- 名称：`电台情歌`
- 摘要：`把网页歌单和专辑变成一档有故事、有串场的私人电台`
- 类别：`Entertainment（娱乐）`
- 语言：`中文（简体）`

### Detailed description / 详细说明

```text
电台情歌把网易云音乐和 QQ 音乐网页版的歌单，变成一档带中文口播串场的私人电台。

正常播放歌单即可。每首歌开始前，电台情歌会短暂停止歌曲，根据当前作品生成一段自然的中文介绍，播报完成后自动恢复音乐。

主要功能：
• 根据歌曲、歌手和专辑生成电台式中文串场
• 新专辑第一次出现时，可介绍发行背景、风格与相关资料
• 提供多种普通话和方言云端主持音色
• 在原播放器进度条中显示 AI 口播准备进度
• AI 或云端语音不可用时自动降级，不阻塞音乐播放
• 用户无需填写 API Key

支持网站：
• 网易云音乐网页版
• QQ 音乐网页版

数据使用说明：为生成口播，扩展会读取当前播放歌曲的歌名、歌手、专辑等必要信息，并通过 HTTPS 发送到电台情歌服务。扩展不会读取网易云音乐或 QQ 音乐的账号、密码、Cookie、支付信息或完整播放历史，不出售数据，也不将数据用于广告。完整说明请查看隐私政策。
```

### Graphic assets / 图片素材

- 商店图标：`store-assets/icon-128.png`（128 × 128）
- 截图 1：`store-assets/screenshot-1-popup.png`（1280 × 800）
- 截图 2：`store-assets/screenshot-2-progress.png`（1280 × 800）
- 小宣传图：`store-assets/small-promo-440x280.png`（440 × 280）
- Marquee 宣传图：留空即可；如以后需要精选曝光，再准备 1400 × 560 图片
- YouTube 视频：留空

### Additional fields / 网址

- 官方网站：`https://jackyrwj.github.io/song2radio/`
- 支持网站：`https://jackyrwj.github.io/song2radio/support.html`
- 隐私政策：`https://jackyrwj.github.io/song2radio/privacy.html`

## 3. Privacy / 隐私

### Single purpose / 单一用途

```text
在网易云音乐和 QQ 音乐网页版播放歌曲前，根据当前歌曲和专辑信息生成并播报电台式中文串场。
```

### Permission justifications / 权限理由

`storage`：

```text
用于在浏览器本地保存播报开关、AI 与专辑介绍开关、所选音色，以及仅用于服务限流的随机匿名安装标识。扩展不保存账号密码、Cookie 或供应商 API Key。
```

`music.163.com`：

```text
仅在网易云音乐网页版读取当前播放歌曲、歌手和专辑等必要页面信息，识别切歌，并在播报期间暂停及恢复当前音乐、显示准备进度。这是核心功能所必需的站点访问。
```

`*.y.qq.com` 与 `y.qq.com`：

```text
仅在 QQ 音乐网页版读取当前播放歌曲、歌手和专辑等必要页面信息，识别切歌，并在播报期间暂停及恢复当前音乐、显示准备进度。这是核心功能所必需的站点访问。
```

`song2radio.vercel.app`：

```text
通过 HTTPS 调用电台情歌自有服务，发送当前歌曲和专辑的必要元数据并接收生成的文案与音频。扩展不直接接触或接收供应商 API Key。
```

### Remote code / 远程代码

- 选择：`No, I am not using remote code（否）`
- 说明（如果后台提供文本框）：

```text
扩展包包含全部可执行逻辑，不下载或执行远程 JavaScript、WebAssembly 或其他代码。服务端只返回生成的文本、状态和音频数据，不返回可执行代码。
```

### Data usage / 数据使用

建议从严勾选以下类型（后台中文名称可能略有差异）：

- `Web history / Web browsing activity`：扩展识别用户正在网易云音乐或 QQ 音乐播放的页面与曲目。
- `Website content`：扩展读取当前歌曲、歌手、专辑、发行信息和页面可提供的歌曲/专辑 ID。
- `User identifiers`：扩展生成随机匿名安装标识用于限流。它不关联账号，但按较保守口径申报为用户标识。

不要勾选：个人身份信息、健康信息、财务与支付信息、认证信息、个人通讯、位置、键盘/鼠标记录。

数据用途只勾选与以下含义相符的项目：

- 提供扩展的核心功能
- 安全、防滥用与服务限流（如果后台单列）

以下认证均应确认：

- 不出售或转移用户数据给第三方，必要服务提供商及政策允许的例外除外。
- 不将用户数据用于与单一用途无关的目的。
- 不将用户数据用于信用评估或借贷。
- 不允许人工读取用户数据，安全、法律和用户明确同意的支持场景等政策例外除外。

隐私政策网址：

```text
https://jackyrwj.github.io/song2radio/privacy.html
```

## 4. Distribution / 发布范围

- Visibility：`Public`
- Pricing：`Free`
- Regions：`All regions`（功能界面与口播以中文为主）
- Mature content：`No`

首次提交建议选择“审核通过后手动发布 / Deferred publishing”，先检查公开商店页，再点击发布。

## 5. Test instructions / 测试说明

如果后台要求测试说明，填写：

```text
无需账号、付费或额外 API Key。

1. 安装扩展并打开 https://music.163.com/ 或 https://y.qq.com/。
2. 正常播放任意歌曲或歌单。
3. 切换到另一首歌曲；扩展会暂停音乐，生成并播报中文介绍，随后恢复播放。
4. 点击浏览器工具栏中的“电台情歌”，可测试开关、专辑资料播报和不同音色。

若音乐网站自身要求登录才能播放某些受版权限制的曲目，请改用网站提供的可直接试听曲目；扩展本身不需要登录凭据。
```

## 6. 提交前最后检查

- 确认后台显示版本 `3.1.3`，没有额外或不认识的权限。
- 确认三条公开网址均能在无痕窗口访问。
- 确认详细说明中的数据披露在折叠前或靠前位置仍清晰可见。
- 确认截图展示当前版本界面，没有旧名称、旧音色或 API Key 输入框。
- 保存每个标签页后再提交审核；提交后不要立即删除 GitHub Pages 或 Vercel 服务。
