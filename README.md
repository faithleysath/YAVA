# AI 智能单词陪练 (YAVA)

一个真正懂你的单词学习工具，由大语言模型驱动。

## 功能特性

- 🎯 **智能学习**: AI 根据单词含义生成个性化例句
- 📝 **多种测试模式**: 创意造句、逆向翻译、完形填空
- 🔄 **进度跟踪**: 自动记录学习进度，支持导入导出
- 🌐 **多API支持**: 支持 Gemini、DeepSeek 等多种AI模型
- 🚀 **中转服务**: 通过 Vercel Edge Function 解决 Gemini 访问问题

## 快速开始

### 1. 准备单词文件

下载单词模板或准备包含以下列的CSV文件：
- 单词
- 常见含义
- 词性
- 考研高频考法
- 巧记方法（仅供参考）

### 2. 配置API

点击设置按钮，选择合适的预设：

#### Gemini (直连)
- 需要能够直接访问 Google API
- 适合海外用户或有代理的用户

#### Gemini (中转) ⭐ 推荐
- 通过 Vercel Edge Function 中转
- 解决国内访问 Gemini 的网络问题
- 需要部署到 Vercel

#### DeepSeek
- 国内可直接访问
- 性价比高的选择

### 3. 开始学习

1. 上传单词文件
2. 选择单词开始学习
3. 完成AI生成的挑战任务
4. 查看详细反馈和建议

## 部署到 Vercel

### 前提条件
- GitHub 账号
- Vercel 账号
- Gemini API Key

### 部署步骤

1. **Fork 或上传代码到 GitHub**

2. **连接 Vercel**
   - 登录 [Vercel](https://vercel.com)
   - 点击 "New Project"
   - 选择你的 GitHub 仓库

3. **配置环境变量**（可选）
   - 如果需要在服务端存储 API Key，可以在 Vercel 项目设置中添加环境变量
   - 当前实现中，API Key 由前端传递，无需服务端环境变量

4. **部署**
   - Vercel 会自动检测并部署
   - Edge Function 会自动部署到 `/api/callGemini`

5. **使用中转服务**
   - 部署完成后，在应用设置中选择 "Gemini (中转)" 预设
   - 输入你的 Gemini API Key
   - 开始使用

## 技术架构

### 前端
- 纯 HTML/CSS/JavaScript
- Tailwind CSS 样式框架
- 模块化 ES6 代码结构

### 后端 (Edge Function)
- Vercel Edge Function
- 流式响应处理
- CORS 支持
- 错误处理和重试机制

### API 支持
- **Gemini API**: Google 的生成式AI
- **OpenAI 兼容API**: 如 DeepSeek 等
- **中转代理**: 通过 Edge Function 转发请求

## 文件结构

```
├── api/
│   └── callGemini.js          # Vercel Edge Function
├── css/
│   └── style.css              # 样式文件
├── js/
│   ├── api.js                 # API 调用逻辑
│   ├── file-handler.js        # 文件处理
│   ├── learning.js            # 学习模式
│   ├── main.js                # 主入口
│   ├── settings.js            # 设置管理
│   ├── state.js               # 状态管理
│   ├── testing.js             # 测试模式
│   └── ui.js                  # UI 工具
├── index.html                 # 主页面
├── vercel.json                # Vercel 配置
└── README.md                  # 说明文档
```

## 中转服务详解

### 工作原理
1. 前端发送请求到 `/api/callGemini`
2. Edge Function 接收请求并提取参数
3. 转发请求到 Gemini API
4. 通过流式响应返回结果给前端

### 优势
- ✅ 解决网络访问问题
- ✅ 满足 Vercel 25秒初始响应要求
- ✅ 全球 CDN 加速
- ✅ 自动错误处理
- ✅ 完全兼容现有代码

### 安全性
- API Key 由前端传递，不存储在服务端
- 支持 CORS 跨域请求
- 错误信息不暴露敏感数据

## 常见问题

### Q: 为什么需要中转服务？
A: 由于网络限制，国内用户可能无法直接访问 Gemini API。中转服务通过 Vercel 的全球网络解决这个问题。

### Q: 中转服务安全吗？
A: 是的。API Key 不会存储在服务端，只是简单的请求转发。

### Q: 可以使用其他AI模型吗？
A: 可以。应用支持 OpenAI 兼容的 API，如 DeepSeek、通义千问等。

### Q: 如何获取 Gemini API Key？
A: 访问 [Google AI Studio](https://aistudio.google.com/) 获取免费的 API Key。

## 开发

### 本地开发
```bash
# 安装 Vercel CLI
npm i -g vercel

# 本地运行
vercel dev
```

### 测试 Edge Function
```bash
curl -X POST http://localhost:3000/api/callGemini \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "your-api-key",
    "modelName": "models/gemini-2.5-flash-lite",
    "prompt": "Hello, world!"
  }'
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
