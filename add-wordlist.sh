#!/bin/bash

# AI 智能单词陪练 - 词表管理脚本
# 用于添加新的词表文件并自动生成元数据

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 显示使用说明
show_usage() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -f, --file FILE        指定要添加的CSV文件路径"
    echo "  -i, --id ID           指定词表ID（唯一标识符）"
    echo "  -n, --name NAME       指定词表名称"
    echo "  -d, --desc DESC       指定词表描述"
    echo "  --difficulty LEVEL    指定难度等级（初级/中级/中高级/高级）"
    echo "  --tags TAGS           指定标签（用逗号分隔）"
    echo "  -h, --help            显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 -f my_words.csv -i my_vocab -n \"我的词汇\" -d \"个人整理的词汇表\" --difficulty 中级 --tags \"个人,学习\""
    echo ""
    echo "交互模式:"
    echo "  $0  (不带参数运行将进入交互模式)"
}

# 验证CSV文件格式
validate_csv() {
    local file=$1
    
    if [[ ! -f "$file" ]]; then
        print_message $RED "错误: 文件 '$file' 不存在"
        return 1
    fi
    
    if [[ ! "$file" =~ \.csv$ ]]; then
        print_message $RED "错误: 文件必须是CSV格式（.csv扩展名）"
        return 1
    fi
    
    # 检查文件是否至少有3行
    local line_count=$(wc -l < "$file")
    if [[ $line_count -lt 3 ]]; then
        print_message $RED "错误: CSV文件至少需要3行（标题、表头、数据）"
        return 1
    fi
    
    # 检查是否包含"单词"列
    local header_line=$(sed -n '2p' "$file")
    if [[ ! "$header_line" =~ "单词" ]]; then
        print_message $RED "错误: CSV文件必须包含'单词'列"
        return 1
    fi
    
    print_message $GREEN "✓ CSV文件格式验证通过"
    return 0
}

# 统计单词数量
count_words() {
    local file=$1
    # 减去标题行和表头行，只统计数据行
    local word_count=$(($(wc -l < "$file") - 2))
    echo $word_count
}

# 检查ID是否已存在
check_id_exists() {
    local id=$1
    local index_file="wordlists/index.json"
    
    if [[ -f "$index_file" ]]; then
        if grep -q "\"id\": \"$id\"" "$index_file"; then
            return 0  # ID已存在
        fi
    fi
    return 1  # ID不存在
}

# 更新索引文件
update_index() {
    local id=$1
    local name=$2
    local desc=$3
    local filename=$4
    local word_count=$5
    local difficulty=$6
    local tags=$7
    
    local index_file="wordlists/index.json"
    local current_date=$(date +"%Y-%m-%d")
    
    # 创建wordlists目录（如果不存在）
    mkdir -p wordlists
    
    # 如果索引文件不存在，创建基本结构
    if [[ ! -f "$index_file" ]]; then
        echo '{"wordlists": []}' > "$index_file"
    fi
    
    # 构建标签数组
    local tags_array="["
    IFS=',' read -ra TAG_ARRAY <<< "$tags"
    for i in "${!TAG_ARRAY[@]}"; do
        if [[ $i -gt 0 ]]; then
            tags_array+=", "
        fi
        tags_array+="\"${TAG_ARRAY[$i]}\""
    done
    tags_array+="]"
    
    # 创建新的词表条目
    local new_entry=$(cat <<EOF
{
  "id": "$id",
  "name": "$name",
  "description": "$desc",
  "filename": "$filename",
  "wordCount": $word_count,
  "difficulty": "$difficulty",
  "tags": $tags_array,
  "createdAt": "$current_date",
  "updatedAt": "$current_date"
}
EOF
)
    
    # 使用临时文件来更新JSON
    local temp_file=$(mktemp)
    
    # 如果是第一个词表
    if [[ $(jq '.wordlists | length' "$index_file") -eq 0 ]]; then
        jq ".wordlists += [$new_entry]" "$index_file" > "$temp_file"
    else
        jq ".wordlists += [$new_entry]" "$index_file" > "$temp_file"
    fi
    
    mv "$temp_file" "$index_file"
    print_message $GREEN "✓ 索引文件已更新"
}

# 交互模式
interactive_mode() {
    print_message $BLUE "=== AI 智能单词陪练 - 词表添加工具 ==="
    echo ""
    
    # 获取CSV文件路径
    while true; do
        read -p "请输入CSV文件路径: " csv_file
        if validate_csv "$csv_file"; then
            break
        fi
    done
    
    # 获取词表ID
    while true; do
        read -p "请输入词表ID（唯一标识符，建议使用英文和下划线）: " wordlist_id
        if [[ -z "$wordlist_id" ]]; then
            print_message $YELLOW "ID不能为空"
            continue
        fi
        if check_id_exists "$wordlist_id"; then
            print_message $YELLOW "ID '$wordlist_id' 已存在，请使用其他ID"
            continue
        fi
        break
    done
    
    # 获取词表名称
    read -p "请输入词表名称: " wordlist_name
    if [[ -z "$wordlist_name" ]]; then
        wordlist_name="未命名词表"
    fi
    
    # 获取词表描述
    read -p "请输入词表描述: " wordlist_desc
    if [[ -z "$wordlist_desc" ]]; then
        wordlist_desc="暂无描述"
    fi
    
    # 获取难度等级
    echo "请选择难度等级:"
    echo "1) 初级"
    echo "2) 中级" 
    echo "3) 中高级"
    echo "4) 高级"
    read -p "请输入选择 (1-4): " difficulty_choice
    
    case $difficulty_choice in
        1) difficulty="初级" ;;
        2) difficulty="中级" ;;
        3) difficulty="中高级" ;;
        4) difficulty="高级" ;;
        *) difficulty="中级" ;;
    esac
    
    # 获取标签
    read -p "请输入标签（用逗号分隔，如：四级,核心,高频）: " tags
    if [[ -z "$tags" ]]; then
        tags="通用"
    fi
    
    # 处理文件
    process_wordlist "$csv_file" "$wordlist_id" "$wordlist_name" "$wordlist_desc" "$difficulty" "$tags"
}

# 处理词表文件
process_wordlist() {
    local csv_file=$1
    local wordlist_id=$2
    local wordlist_name=$3
    local wordlist_desc=$4
    local difficulty=$5
    local tags=$6
    
    print_message $BLUE "开始处理词表..."
    
    # 统计单词数量
    local word_count=$(count_words "$csv_file")
    print_message $GREEN "✓ 统计到 $word_count 个单词"
    
    # 生成目标文件名
    local target_filename="${wordlist_id}.csv"
    local target_path="wordlists/$target_filename"
    
    # 复制文件到wordlists目录
    cp "$csv_file" "$target_path"
    print_message $GREEN "✓ 文件已复制到 $target_path"
    
    # 更新索引文件
    update_index "$wordlist_id" "$wordlist_name" "$wordlist_desc" "$target_filename" "$word_count" "$difficulty" "$tags"
    
    print_message $GREEN "🎉 词表添加成功！"
    echo ""
    print_message $BLUE "词表信息:"
    echo "  ID: $wordlist_id"
    echo "  名称: $wordlist_name"
    echo "  描述: $wordlist_desc"
    echo "  单词数量: $word_count"
    echo "  难度: $difficulty"
    echo "  标签: $tags"
    echo "  文件: $target_path"
}

# 主函数
main() {
    # 检查依赖
    if ! command -v jq &> /dev/null; then
        print_message $RED "错误: 需要安装 jq 工具来处理JSON文件"
        print_message $YELLOW "在 macOS 上安装: brew install jq"
        print_message $YELLOW "在 Ubuntu 上安装: sudo apt-get install jq"
        exit 1
    fi
    
    # 解析命令行参数
    local csv_file=""
    local wordlist_id=""
    local wordlist_name=""
    local wordlist_desc=""
    local difficulty="中级"
    local tags="通用"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--file)
                csv_file="$2"
                shift 2
                ;;
            -i|--id)
                wordlist_id="$2"
                shift 2
                ;;
            -n|--name)
                wordlist_name="$2"
                shift 2
                ;;
            -d|--desc)
                wordlist_desc="$2"
                shift 2
                ;;
            --difficulty)
                difficulty="$2"
                shift 2
                ;;
            --tags)
                tags="$2"
                shift 2
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                print_message $RED "未知选项: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # 如果没有提供参数，进入交互模式
    if [[ -z "$csv_file" ]]; then
        interactive_mode
        return
    fi
    
    # 验证必需参数
    if [[ -z "$wordlist_id" || -z "$wordlist_name" ]]; then
        print_message $RED "错误: 必须提供文件路径、ID和名称"
        show_usage
        exit 1
    fi
    
    # 验证CSV文件
    if ! validate_csv "$csv_file"; then
        exit 1
    fi
    
    # 检查ID是否已存在
    if check_id_exists "$wordlist_id"; then
        print_message $RED "错误: ID '$wordlist_id' 已存在"
        exit 1
    fi
    
    # 设置默认值
    if [[ -z "$wordlist_desc" ]]; then
        wordlist_desc="暂无描述"
    fi
    
    # 处理词表
    process_wordlist "$csv_file" "$wordlist_id" "$wordlist_name" "$wordlist_desc" "$difficulty" "$tags"
}

# 运行主函数
main "$@"
