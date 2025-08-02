# 词表管理工具使用指南

## 概述

`wordlist-manager.sh` 是 AI 智能单词陪练的完整词表管理工具，提供了词表的添加、删除、更新、查看、搜索等全方位管理功能。

## 功能特性

### 🎯 核心功能
- **📋 查看词表**: 列出所有词表，支持表格化显示
- **➕ 添加词表**: 支持交互式和命令行两种添加方式
- **🔍 搜索词表**: 按名称、标签、难度等关键词搜索
- **✏️ 更新词表**: 修改词表的名称、描述、难度、标签等信息
- **🗑️ 删除词表**: 安全删除词表文件和索引记录
- **📊 统计分析**: 显示词表数量、单词总数、难度分布、热门标签等
- **🔄 索引维护**: 自动检查和修复索引文件
- **📤 数据导出**: 导出词表列表为JSON格式

### 🎨 界面特性
- **彩色输出**: 使用颜色区分不同类型的信息
- **表格显示**: 整齐的表格格式展示词表信息
- **交互友好**: 清晰的提示和确认机制
- **错误处理**: 完善的错误提示和异常处理

## 安装和依赖

### 系统要求
- Unix/Linux/macOS 系统
- Bash shell
- `jq` 工具（用于JSON处理）

### 安装依赖
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# CentOS/RHEL
sudo yum install jq
```

### 设置权限
```bash
chmod +x wordlist-manager.sh
```

## 使用方法

### 交互模式（推荐）
直接运行脚本进入交互式菜单：
```bash
./wordlist-manager.sh
```

交互模式提供了直观的菜单界面：
```
╔══════════════════════════════════════════════════════════════╗
║              AI 智能单词陪练 - 词表管理工具                    ║
╚══════════════════════════════════════════════════════════════╝

请选择操作：
  1) 📋 查看所有词表
  2) ➕ 添加新词表
  3) 🔍 搜索词表
  4) ✏️  更新词表信息
  5) 🗑️  删除词表
  6) 📊 词表统计
  7) 🔄 刷新词表索引
  8) 📤 导出词表列表
  9) ❓ 帮助信息
  0) 🚪 退出
```

### 命令行模式
也可以直接使用命令行参数：

#### 查看所有词表
```bash
./wordlist-manager.sh list
```

#### 搜索词表
```bash
./wordlist-manager.sh search 四级
./wordlist-manager.sh search 高频
```

#### 添加新词表
```bash
# 交互式添加
./wordlist-manager.sh add

# 命令行添加
./wordlist-manager.sh add \
  -f my_words.csv \
  -i my_vocab \
  -n "我的词汇表" \
  -d "个人整理的词汇" \
  --difficulty 中级 \
  --tags "个人,学习,备考"
```

#### 更新词表信息
```bash
./wordlist-manager.sh update my_vocab
```

#### 删除词表
```bash
./wordlist-manager.sh delete my_vocab
```

#### 查看统计信息
```bash
./wordlist-manager.sh stats
```

#### 刷新索引
```bash
./wordlist-manager.sh refresh
```

#### 导出词表列表
```bash
./wordlist-manager.sh export
```

## 词表文件格式

### CSV文件要求
词表文件必须是UTF-8编码的CSV格式，包含以下结构：

```csv
AI 智能单词陪练 - 单词导入模板
单词,常见含义,词性,考研高频考法,巧记方法（仅供参考）
example,an instance serving for illustration;a particular case,n,This is a frequent usage.,e.g.
word,meaning,part of speech,usage,memory tip
...
```

### 格式要求
1. **第一行**: 标题行（可选）
2. **第二行**: 表头，必须包含"单词"列
3. **第三行及以后**: 数据行
4. **编码**: UTF-8
5. **分隔符**: 英文逗号

### 字段说明
- **单词**: 必填，要学习的英文单词
- **常见含义**: 单词的中文释义，多个释义用分号分隔
- **词性**: 词性标注（如 n, v, adj 等）
- **考研高频考法**: 考试中的常见用法
- **巧记方法**: 记忆技巧或助记符

## 目录结构

```
wordlists/
├── index.json          # 词表索引文件
├── cet4_core.csv      # 四级核心词汇
├── cet6_advanced.csv  # 六级进阶词汇
├── toefl_essential.csv # 托福必备词汇
└── gre_vocabulary.csv  # GRE词汇精选
```

## 索引文件格式

`wordlists/index.json` 包含所有词表的元数据：

```json
{
  "wordlists": [
    {
      "id": "cet4_core",
      "name": "大学英语四级核心词汇",
      "description": "精选四级考试最核心的高频词汇",
      "filename": "cet4_core.csv",
      "wordCount": 500,
      "difficulty": "初级",
      "tags": ["四级", "核心", "高频"],
      "createdAt": "2025-01-02",
      "updatedAt": "2025-01-02"
    }
  ]
}
```

## 高级功能

### 批量操作
可以编写脚本批量添加词表：

```bash
#!/bin/bash
# 批量添加词表示例

./wordlist-manager.sh add -f vocab1.csv -i vocab1 -n "词汇表1" --difficulty 初级
./wordlist-manager.sh add -f vocab2.csv -i vocab2 -n "词汇表2" --difficulty 中级
./wordlist-manager.sh add -f vocab3.csv -i vocab3 -n "词汇表3" --difficulty 高级
```

### 数据备份
定期导出词表列表进行备份：

```bash
# 创建备份脚本
echo '#!/bin/bash
./wordlist-manager.sh export
cp wordlists/index.json "backup/index_$(date +%Y%m%d).json"
tar -czf "backup/wordlists_$(date +%Y%m%d).tar.gz" wordlists/' > backup.sh

chmod +x backup.sh
```

### 索引维护
定期运行索引刷新以保持数据一致性：

```bash
# 添加到定时任务
echo "0 2 * * * cd /path/to/project && ./wordlist-manager.sh refresh" | crontab -
```

## 故障排除

### 常见问题

1. **jq 命令未找到**
   ```bash
   # 安装 jq
   brew install jq  # macOS
   sudo apt-get install jq  # Ubuntu
   ```

2. **权限不足**
   ```bash
   chmod +x wordlist-manager.sh
   ```

3. **CSV文件格式错误**
   - 确保文件是UTF-8编码
   - 检查是否包含"单词"列
   - 确保至少有3行内容

4. **索引文件损坏**
   ```bash
   # 重新创建索引文件
   echo '{"wordlists": []}' > wordlists/index.json
   ./wordlist-manager.sh refresh
   ```

### 调试模式
如需调试，可以在脚本开头添加：
```bash
set -x  # 显示执行的命令
```

## 最佳实践

### 词表命名规范
- **ID**: 使用英文和下划线，如 `cet4_core`
- **名称**: 简洁明了，如 "大学英语四级核心词汇"
- **标签**: 使用有意义的标签，便于搜索和分类

### 文件管理
- 定期备份 `wordlists` 目录
- 使用版本控制管理词表文件
- 保持索引文件的完整性

### 性能优化
- 大型词表（>5000词）建议分割成多个小文件
- 定期清理不用的词表文件
- 使用搜索功能快速定位词表

## 更新日志

### v1.0.0 (2025-01-02)
- 🎉 初始版本发布
- ✅ 支持词表的增删改查
- ✅ 交互式和命令行两种操作模式
- ✅ 完整的统计和搜索功能
- ✅ 自动索引维护和数据导出

## 技术支持

如遇到问题或有改进建议，请：
1. 查看本文档的故障排除部分
2. 检查 GitHub Issues
3. 提交新的 Issue 或 Pull Request

---

**AI 智能单词陪练** - 让词汇管理更简单，让学习更高效！
