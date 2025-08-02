#!/bin/bash

# AI 智能单词陪练 - 版本发布脚本
# 使用方法: ./release.sh 2.2 "新功能描述"

set -e  # 遇到错误时退出

# 检查参数
if [ $# -lt 2 ]; then
    echo "❌ 使用方法: $0 <版本号> <版本描述>"
    echo "   示例: $0 2.2 \"新增语音功能\""
    exit 1
fi

VERSION=$1
DESCRIPTION=$2
DATE=$(date +%Y-%m-%d)

echo "🚀 开始发布版本 v$VERSION..."

# 检查是否在正确的目录
if [ ! -f "js/config.js" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 1. 更新版本号
echo "📝 更新版本号..."
sed -i.bak "s/APP_VERSION = '[^']*'/APP_VERSION = '$VERSION'/" js/config.js
sed -i.bak "s/(V[^)]*)/V$VERSION)/" index.html

# 2. 创建更新日志文件
echo "📋 创建更新日志模板..."
cp changelog/template.txt changelog/v$VERSION.txt
sed -i.bak "s/v2\.X/v$VERSION/g" changelog/v$VERSION.txt
sed -i.bak "s/2025年X月X日/$DATE/" changelog/v$VERSION.txt

# 3. 更新索引文件（需要手动编辑）
echo "📚 请手动更新 changelog/index.json 文件："
echo "   - 添加新版本记录"
echo "   - 更新 latest 字段为 '$VERSION'"
echo ""
echo "示例格式："
echo "{"
echo "  \"versions\": ["
echo "    {"
echo "      \"version\": \"$VERSION\","
echo "      \"date\": \"$DATE\","
echo "      \"file\": \"v$VERSION.txt\","
echo "      \"title\": \"$DESCRIPTION\""
echo "    },"
echo "    ..."
echo "  ],"
echo "  \"latest\": \"$VERSION\""
echo "}"

# 4. 显示需要编辑的文件
echo ""
echo "✅ 版本号已更新完成！"
echo ""
echo "📝 接下来请手动完成以下步骤："
echo "   1. 编辑 changelog/v$VERSION.txt - 填写详细的更新内容"
echo "   2. 编辑 changelog/index.json - 添加新版本记录"
echo "   3. 测试所有功能是否正常"
echo "   4. 提交更改: git add . && git commit -m \"Release v$VERSION\""
echo "   5. 创建标签: git tag -a v$VERSION -m \"Release version $VERSION\""
echo "   6. 推送到远程: git push origin main && git push origin v$VERSION"
echo ""
echo "🎉 版本 v$VERSION 准备就绪！"

# 清理备份文件
rm -f js/config.js.bak index.html.bak changelog/v$VERSION.txt.bak

# 显示修改的文件
echo ""
echo "📄 已修改的文件："
echo "   - js/config.js (版本号: $VERSION)"
echo "   - index.html (标题版本号: V$VERSION)"
echo "   - changelog/v$VERSION.txt (新建)"
echo ""
echo "⚠️  还需要手动编辑："
echo "   - changelog/index.json"
