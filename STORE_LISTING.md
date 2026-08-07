# 电台情歌 Chrome Web Store 上架填写稿

更新时间：2026-08-07

本文严格按照 Chrome Web Store 开发者后台左侧标签页顺序整理：

1. Package
2. Store listing
3. Privacy practices
4. Distribution
5. Test instructions
6. Submit for review

> 提交前注意：当前扩展会把歌曲、歌手和专辑信息发送到服务端。Chrome 用户数据政策要求在扩展界面内进行显著披露，并在首次处理数据前取得用户主动同意。这个要求不是后台表单字段；3.1.3 版本还需要补上首次使用同意页后再提交审核。

---

## 1. Package

### Add new item

选择文件并上传：

```text
diantai-qingge-extension.zip
```

本地文件：`diantai-qingge-extension.zip`

### 上传后核对

Package 标签页首次上传后不可编辑，只需确认：

- Name：`电台情歌`
- Version：`3.1.3`
- Manifest version：`3`
- Description：`把网页歌单和专辑变成一档有故事、有串场的私人电台`

名称和简短说明来自 `manifest.json`，不需要在 Store listing 中重复填写。

---

## 2. Store listing

进入左侧 `Store listing` 标签页，从上往下填写。

### 2.1 Product details

#### Detailed description

粘贴以下内容：

```text
电台情歌把网易云音乐和 QQ 音乐网页版的歌单，变成一档带中文口播串场的私人电台。

正常播放歌单即可。每首歌开始前，电台情歌会短暂停止歌曲，根据当前作品生成一段自然的中文介绍，播报完成后自动恢复音乐。

主要功能：
• 根据歌曲、歌手和专辑生成电台式中文串场
• 新专辑第一次出现时，可介绍发行背景、风格与相关资料
• 提供多种普通话和方言云端主持音色
• 在原播放器进度条中显示 AI 口播准备进度
• AI 或云端语音不可用时自动降级，不阻塞音乐播放
• 无需填写 API Key

支持网站：
• 网易云音乐网页版
• QQ 音乐网页版

数据使用说明：为生成口播，扩展会读取当前播放歌曲的歌名、歌手、专辑等必要信息，并通过 HTTPS 发送到电台情歌服务。扩展不会读取网易云音乐或 QQ 音乐的账号、密码、Cookie、支付信息或完整播放历史，不出售数据，也不将数据用于广告。完整说明请查看隐私政策。
```

#### Category

选择：

```text
Entertainment
```

#### Language

选择：

```text
中文（简体）
```

当前扩展没有 `_locales` 多语言目录，不需要添加其他本地化版本。

### 2.2 Graphic assets

按照页面顺序上传：

#### Store icon

```text
store-assets/icon-128.png
```

尺寸：128 × 128。

#### Screenshots

依次上传：

```text
store-assets/screenshot-1-popup.png
store-assets/screenshot-2-progress.png
```

两张图片尺寸都是 1280 × 800。第一张展示扩展设置，第二张展示嵌入播放器的等待进度条。

#### Promo video

当前没有 YouTube 演示视频，留空。

#### Small promo tile

```text
store-assets/small-promo-440x280.png
```

尺寸：440 × 280。

#### Marquee promo tile

留空。该图片为可选项，只有需要争取商店精选展示时再制作 1400 × 560 版本。

### 2.3 Additional fields

#### Official URL

如果下拉框里没有已经通过 Google Search Console 验证的网址，留空。不要把未验证的 GitHub Pages 地址硬填进这里。

#### Homepage URL

```text
https://jackyrwj.github.io/song2radio/
```

#### Support URL

```text
https://jackyrwj.github.io/song2radio/support.html
```

#### Mature content

保持关闭，不勾选。

填写完后选择 `Save draft`。

---

## 3. Privacy practices

进入左侧 `Privacy practices` 标签页，从上往下填写。

### 3.1 Single purpose description

```text
在网易云音乐和 QQ 音乐网页版播放歌曲前，根据当前歌曲和专辑信息生成并播报电台式中文串场。
```

### 3.2 Permission justification

后台会根据 `manifest.json` 自动显示需要解释的权限。

#### storage justification

```text
用于在浏览器本地保存播报开关、AI 与专辑介绍开关、所选音色，以及仅用于服务限流的随机匿名安装标识。扩展不保存账号密码、Cookie 或供应商 API Key。
```

#### Host permission justification

如果后台只显示一个 Host permission 输入框，粘贴以下合并说明：

```text
music.163.com、y.qq.com 和 *.y.qq.com 权限仅用于在网易云音乐与 QQ 音乐网页版读取当前播放歌曲、歌手和专辑等必要页面信息，识别切歌，在口播期间暂停及恢复当前音乐，并在原播放器中显示准备进度。song2radio.vercel.app 权限仅用于通过 HTTPS 发送当前歌曲和专辑的必要元数据，并接收生成的口播文案与音频。扩展不会读取音乐账号密码、Cookie、支付信息或完整播放历史，也不会从服务端接收任何 API Key。
```

如果后台把主机拆成多个输入框，分别填写：

`music.163.com`：

```text
仅在网易云音乐网页版读取当前歌曲、歌手和专辑等必要信息，识别切歌，并在口播期间暂停及恢复音乐、显示准备进度。
```

`*.y.qq.com` 和 `y.qq.com`：

```text
仅在 QQ 音乐网页版读取当前歌曲、歌手和专辑等必要信息，识别切歌，并在口播期间暂停及恢复音乐、显示准备进度。
```

`song2radio.vercel.app`：

```text
仅通过 HTTPS 发送当前歌曲和专辑的必要元数据，并接收生成的口播文案与音频。扩展不发送或接收供应商 API Key。
```

### 3.3 Remote code

选择：

```text
No, I am not using remote code
```

如果出现补充说明框，填写：

```text
扩展包包含全部可执行逻辑，不下载或执行远程 JavaScript、WebAssembly 或其他代码。服务端只返回生成的文本、状态和音频数据，不返回可执行代码。
```

### 3.4 Data usage

#### What user data do you plan to collect?

勾选：

- `Web history`：扩展识别用户正在使用网易云音乐或 QQ 音乐，并处理当前播放曲目信息。
- `Website content`：扩展读取当前歌曲、歌手、专辑、发行信息，以及页面可提供的歌曲或专辑 ID。

如果你的后台还提供 `User identifiers` 选项，也勾选它，因为扩展会生成一个不关联账号的随机匿名安装标识用于限流。

其他类型不要勾选，尤其是：

- Personally identifiable information
- Health information
- Financial and payment information
- Authentication information
- Personal communications
- Location

#### Limited Use certifications

下方四项认证全部勾选：

- 不出售或转移用户数据，提供核心功能所必需的服务提供商和政策允许的例外除外。
- 不将用户数据用于与扩展单一用途无关的目的。
- 不将用户数据用于信用评估或借贷。
- 不允许人工读取用户数据，安全、法律和用户明确同意的支持场景等政策例外除外。

### 3.5 Privacy policy URL

```text
https://jackyrwj.github.io/song2radio/privacy.html
```

填写完后选择 `Save draft`。

---

## 4. Distribution

进入左侧 `Distribution` 标签页，从上往下填写。

### 4.1 Visibility

选择：

```text
Public
```

不要选择 `Unlisted` 或 `Private`。

### 4.2 Geographic distribution

选择：

```text
All regions
```

界面和口播以中文为主，但不需要限制国家或地区。

### 4.3 Pricing

如果后台显示定价选项，选择：

```text
Free
```

填写完后选择 `Save draft`。

---

## 5. Test instructions

该标签页不是发布必填项，但建议提供简短测试路径，减少审核人员摸索时间。

### 5.1 Login credentials

不需要账号或密码，留空。

### 5.2 Test instructions

```text
扩展本身无需账号、付费或额外 API Key。

1. 安装扩展并打开 https://music.163.com/ 或 https://y.qq.com/。
2. 在音乐网站中播放任意可试听歌曲或歌单。
3. 切换到另一首歌曲；扩展会暂停音乐，生成并播报中文介绍，随后恢复播放。
4. 点击浏览器工具栏中的“电台情歌”，可测试语音播报开关、AI 介绍、专辑资料播报和不同音色。

如果某首歌曲因音乐网站版权限制而要求登录，请改用网站提供的其他可直接试听曲目。扩展不会读取或要求音乐网站登录凭据。
```

填写完后选择 `Save draft`。

---

## 6. Submit for review

确认左侧所有必填标签页都显示完成后，选择 `Submit for review`。

在确认弹窗中：

- 取消勾选“审核通过后自动发布”一类的选项，启用 Deferred publishing。
- 确认提交审核。

审核通过后先检查商店公开页面，再手动发布。延期发布最多保留 30 天，超过后需要重新提交审核。

---

## 提交前核对

- 已补充扩展内首次数据处理披露与主动同意流程。
- Package 显示 `电台情歌`、版本 `3.1.3`、Manifest V3。
- Store listing 已上传 128 图标、两张截图和 440 × 280 小宣传图。
- 主页、支持页和隐私政策能在无痕窗口打开。
- Privacy practices 已披露 Web history、Website content 和匿名安装标识。
- Remote code 选择 No。
- Distribution 选择 Public、All regions、Free。
- 没有填写任何音乐账号、Cookie、API Key 或其他敏感信息。
