# 📚 作者自用词表功能说明

## 功能概述

"作者自用词表"功能允许你预设多个词汇表，用户可以一键加载使用。这个功能包含：

- 📋 词表索引管理
- 🎨 美观的卡片式展示界面
- 🔧 自动化的词表添加脚本
- 📊 自动统计和元数据生成

## 文件结构

```
wordlists/
├── index.json          # 词表索引文件
├── cet4_core.csv      # 示例：四级核心词汇
├── cet6_advanced.csv  # 示例：六级进阶词汇（待添加）
└── ...                # 其他词表文件

add-wordlist.sh        # 词表管理脚本
```

## 使用方法

### 1. 添加新词表（推荐方式）

使用提供的脚本来添加新词表：

```bash
# 交互模式（推荐新手使用）
./add-wordlist.sh

# 命令行模式
./add-wordlist.sh -f my_words.csv -i my_vocab -n "我的词汇" -d "个人整理的词汇表" --difficulty 中级 --tags "个人,学习"
```

#### 脚本参数说明：
- `-f, --file`: CSV文件路径
- `-i, --id`: 词表唯一标识符（建议使用英文和下划线）
- `-n, --name`: 词表显示名称
- `-d, --desc`: 词表描述
- `--difficulty`: 难度等级（初级/中级/中高级/高级）
- `--tags`: 标签（用逗号分隔）

### 2. 手动添加词表

如果你不想使用脚本，也可以手动操作：

1. 将CSV文件复制到 `wordlists/` 目录
2. 手动编辑 `wordlists/index.json` 添加词表信息

### 3. CSV文件格式要求

词表CSV文件必须遵循以下格式：

```csv
AI 智能单词陪练 - 词表标题
单词,常见含义,词性,考研高频考法,巧记方法（仅供参考）
abandon,放弃;抛弃,v,abandon oneself to沉溺于,a(一个)+band(乐队)+on(在)→一个乐队在台上被抛弃
ability,能力;才能,n,have the ability to do有能力做,able(能够的)+ity(名词后缀)
...
```

**重要要求：**
- 第一行：标题行
- 第二行：表头行（必须包含"单词"列）
- 第三行及以后：数据行

## 索引文件格式

`wordlists/index.json` 的结构：

```json
{
  "wordlists": [
    {
      "id": "cet4_core",
      "name": "大学英语四级核心词汇",
      "description": "精选四级考试最核心的高频词汇，适合快速突破",
      "filename": "cet4_core.csv",
      "wordCount": 10,
      "difficulty": "初级",
      "tags": ["四级", "核心", "高频"],
      "createdAt": "2025-01-02",
      "updatedAt": "2025-01-02"
    }
  ]
}
```

## 前端展示

词表会在首页下方以卡片形式展示，包含：

- 📖 词表名称和描述
- 🏷️ 难度标签和分类标签
- 📊 单词数量统计
- 📅 更新时间
- 🎯 一键加载功能

## 技术实现

### JavaScript模块
- `js/wordlist-manager.js`: 词表管理核心逻辑
- 集成到现有的模块化架构中

### CSS样式
- 响应式卡片布局
- 悬停效果和渐变装饰
- 移动端适配

### Shell脚本功能
- CSV格式验证
- 自动单词统计
- JSON索引更新
- 交互式和命令行两种模式

## 使用示例

### 添加四级词汇表
```bash
./add-wordlist.sh -f cet4_words.csv -i cet4_essential -n "大学英语四级必备词汇" -d "涵盖四级考试所有核心词汇" --difficulty 初级 --tags "四级,必备,考试"
```

### 添加专业词汇表
```bash
./add-wordlist.sh -f tech_terms.csv -i tech_vocabulary -n "计算机专业词汇" -d "计算机科学相关的专业术语" --difficulty 高级 --tags "专业,计算机,技术"
```

## 注意事项

1. **依赖要求**: 脚本需要 `jq` 工具来处理JSON文件
   - macOS: `brew install jq`
   - Ubuntu: `sudo apt-get install jq`

2. **文件编码**: 确保CSV文件使用UTF-8编码

3. **ID唯一性**: 每个词表的ID必须唯一，建议使用描述性的英文标识符

4. **备份**: 添加新词表前建议备份现有的 `index.json` 文件

## 故障排除

### 常见问题

1. **脚本无法执行**
   ```bash
   chmod +x add-wordlist.sh
   ```

2. **jq命令未找到**
   ```bash
   # macOS
   brew install jq
   
   # Ubuntu/Debian
   sudo apt-get install jq
   ```

3. **CSV格式错误**
   - 检查是否有"单词"列
   - 确保至少有3行内容
   - 验证文件编码为UTF-8

4. **词表不显示**
   - 检查浏览器控制台是否有错误
   - 确认 `wordlists/index.json` 格式正确
   - 检查网络请求是否成功

## 扩展功能

未来可以考虑添加的功能：

- 🔍 词表搜索和筛选
- 📈 学习进度统计
- 🏆 词表完成度排行
- 📤 词表分享功能
- 🔄 在线词表同步

---

如有问题或建议，请通过GitHub Issues或反馈渠道联系作者。
