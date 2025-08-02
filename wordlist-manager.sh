#!/bin/bash

# AI 智能单词陪练 - 词表管理工具
# 用于管理词表文件：添加、删除、更新、查看、搜索等操作

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 配置
INDEX_FILE="wordlists/index.json"
WORDLISTS_DIR="wordlists"

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 显示主菜单
show_main_menu() {
    clear
    print_message $BLUE "╔══════════════════════════════════════════════════════════════╗"
    print_message $BLUE "║              AI 智能单词陪练 - 词表管理工具                    ║"
    print_message $BLUE "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    print_message $CYAN "请选择操作："
    echo "  1) 📋 查看所有词表"
    echo "  2) ➕ 添加新词表"
    echo "  3) 🔍 搜索词表"
    echo "  4) ✏️  更新词表信息"
    echo "  5) 🗑️  删除词表"
    echo "  6) 📊 词表统计"
    echo "  7) 🔄 刷新词表索引"
    echo "  8) 📤 导出词表列表"
    echo "  9) ❓ 帮助信息"
    echo "  0) 🚪 退出"
    echo ""
}

# 显示使用说明
show_usage() {
    echo "用法: $0 [命令] [选项]"
    echo ""
    echo "命令:"
    echo "  list                  列出所有词表"
    echo "  add                   添加新词表"
    echo "  search <关键词>       搜索词表"
    echo "  update <ID>           更新词表信息"
    echo "  delete <ID>           删除词表"
    echo "  stats                 显示词表统计"
    echo "  refresh               刷新词表索引"
    echo "  export                导出词表列表"
    echo "  help                  显示帮助信息"
    echo ""
    echo "添加词表选项:"
    echo "  -f, --file FILE       指定要添加的CSV文件路径"
    echo "  -i, --id ID          指定词表ID（唯一标识符）"
    echo "  -n, --name NAME      指定词表名称"
    echo "  -d, --desc DESC      指定词表描述"
    echo "  --difficulty LEVEL   指定难度等级（初级/中级/中高级/高级）"
    echo "  --tags TAGS          指定标签（用逗号分隔）"
    echo ""
    echo "示例:"
    echo "  $0 add -f words.csv -i my_vocab -n \"我的词汇\" --difficulty 中级"
    echo "  $0 list"
    echo "  $0 search 四级"
    echo "  $0 delete my_vocab"
    echo ""
    echo "交互模式:"
    echo "  $0  (不带参数运行将进入交互模式)"
}

# 初始化环境
init_environment() {
    # 创建wordlists目录
    mkdir -p "$WORDLISTS_DIR"
    
    # 如果索引文件不存在，创建基本结构
    if [[ ! -f "$INDEX_FILE" ]]; then
        echo '{"wordlists": []}' > "$INDEX_FILE"
        print_message $YELLOW "已创建新的词表索引文件"
    fi
}

# 验证CSV文件格式
validate_csv() {
    local file=$1
    
    if [[ ! -f "$file" ]]; then
        print_message $RED "❌ 错误: 文件 '$file' 不存在"
        return 1
    fi
    
    if [[ ! "$file" =~ \.csv$ ]]; then
        print_message $RED "❌ 错误: 文件必须是CSV格式（.csv扩展名）"
        return 1
    fi
    
    # 检查文件是否至少有3行
    local line_count=$(wc -l < "$file")
    if [[ $line_count -lt 3 ]]; then
        print_message $RED "❌ 错误: CSV文件至少需要3行（标题、表头、数据）"
        return 1
    fi
    
    # 检查是否包含"单词"列
    local header_line=$(sed -n '2p' "$file")
    if [[ ! "$header_line" =~ "单词" ]]; then
        print_message $RED "❌ 错误: CSV文件必须包含'单词'列"
        return 1
    fi
    
    print_message $GREEN "✅ CSV文件格式验证通过"
    return 0
}

# 统计单词数量
count_words() {
    local file=$1
    local word_count=$(($(wc -l < "$file") - 2))
    echo $word_count
}

# 检查ID是否已存在
check_id_exists() {
    local id=$1
    if [[ -f "$INDEX_FILE" ]]; then
        if jq -e ".wordlists[] | select(.id == \"$id\")" "$INDEX_FILE" > /dev/null 2>&1; then
            return 0  # ID已存在
        fi
    fi
    return 1  # ID不存在
}

# 获取词表信息
get_wordlist_info() {
    local id=$1
    jq -r ".wordlists[] | select(.id == \"$id\")" "$INDEX_FILE" 2>/dev/null
}

# 列出所有词表
list_wordlists() {
    local filter=$1
    
    if [[ ! -f "$INDEX_FILE" ]]; then
        print_message $YELLOW "📝 暂无词表数据"
        return
    fi
    
    local count=$(jq '.wordlists | length' "$INDEX_FILE")
    if [[ $count -eq 0 ]]; then
        print_message $YELLOW "📝 暂无词表数据"
        return
    fi
    
    print_message $BLUE "📚 词表列表 (共 $count 个):"
    echo ""
    
    # 表头
    printf "%-15s %-25s %-10s %-8s %-15s %-12s\n" "ID" "名称" "难度" "单词数" "标签" "更新日期"
    printf "%-15s %-25s %-10s %-8s %-15s %-12s\n" "───────────────" "─────────────────────────" "──────────" "────────" "───────────────" "────────────"
    
    # 数据行
    jq -r '.wordlists[] | "\(.id)|\(.name)|\(.difficulty)|\(.wordCount)|\(.tags | join(","))|\(.updatedAt)"' "$INDEX_FILE" | \
    while IFS='|' read -r id name difficulty wordCount tags updatedAt; do
        # 截断过长的文本
        name_short=$(echo "$name" | cut -c1-23)
        tags_short=$(echo "$tags" | cut -c1-13)
        
        if [[ -z "$filter" ]] || [[ "$name" =~ $filter ]] || [[ "$tags" =~ $filter ]] || [[ "$difficulty" =~ $filter ]]; then
            printf "%-15s %-25s %-10s %-8s %-15s %-12s\n" "$id" "$name_short" "$difficulty" "$wordCount" "$tags_short" "$updatedAt"
        fi
    done
}

# 显示词表详细信息
show_wordlist_details() {
    local id=$1
    
    if ! check_id_exists "$id"; then
        print_message $RED "❌ 词表 '$id' 不存在"
        return 1
    fi
    
    local info=$(get_wordlist_info "$id")
    
    print_message $BLUE "📖 词表详细信息:"
    echo ""
    echo "ID:       $(echo "$info" | jq -r '.id')"
    echo "名称:     $(echo "$info" | jq -r '.name')"
    echo "描述:     $(echo "$info" | jq -r '.description')"
    echo "文件名:   $(echo "$info" | jq -r '.filename')"
    echo "单词数:   $(echo "$info" | jq -r '.wordCount')"
    echo "难度:     $(echo "$info" | jq -r '.difficulty')"
    echo "标签:     $(echo "$info" | jq -r '.tags | join(", ")')"
    echo "创建时间: $(echo "$info" | jq -r '.createdAt')"
    echo "更新时间: $(echo "$info" | jq -r '.updatedAt')"
    
    local filepath="$WORDLISTS_DIR/$(echo "$info" | jq -r '.filename')"
    if [[ -f "$filepath" ]]; then
        print_message $GREEN "✅ 文件存在: $filepath"
    else
        print_message $RED "❌ 文件缺失: $filepath"
    fi
}

# 搜索词表
search_wordlists() {
    local keyword=$1
    
    if [[ -z "$keyword" ]]; then
        read -p "请输入搜索关键词: " keyword
    fi
    
    if [[ -z "$keyword" ]]; then
        print_message $YELLOW "⚠️ 搜索关键词不能为空"
        return
    fi
    
    print_message $BLUE "🔍 搜索结果 (关键词: '$keyword'):"
    echo ""
    
    list_wordlists "$keyword"
}

# 添加词表
add_wordlist() {
    local csv_file=$1
    local wordlist_id=$2
    local wordlist_name=$3
    local wordlist_desc=$4
    local difficulty=$5
    local tags=$6
    
    # 如果参数不完整，进入交互模式
    if [[ -z "$csv_file" || -z "$wordlist_id" || -z "$wordlist_name" ]]; then
        add_wordlist_interactive
        return
    fi
    
    # 验证CSV文件
    if ! validate_csv "$csv_file"; then
        return 1
    fi
    
    # 检查ID是否已存在
    if check_id_exists "$wordlist_id"; then
        print_message $RED "❌ 错误: ID '$wordlist_id' 已存在"
        return 1
    fi
    
    # 设置默认值
    [[ -z "$wordlist_desc" ]] && wordlist_desc="暂无描述"
    [[ -z "$difficulty" ]] && difficulty="中级"
    [[ -z "$tags" ]] && tags="通用"
    
    # 处理词表
    process_add_wordlist "$csv_file" "$wordlist_id" "$wordlist_name" "$wordlist_desc" "$difficulty" "$tags"
}

# 交互式添加词表
add_wordlist_interactive() {
    print_message $BLUE "➕ 添加新词表"
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
            print_message $YELLOW "⚠️ ID不能为空"
            continue
        fi
        if check_id_exists "$wordlist_id"; then
            print_message $YELLOW "⚠️ ID '$wordlist_id' 已存在，请使用其他ID"
            continue
        fi
        break
    done
    
    # 获取词表名称
    read -p "请输入词表名称: " wordlist_name
    [[ -z "$wordlist_name" ]] && wordlist_name="未命名词表"
    
    # 获取词表描述
    read -p "请输入词表描述: " wordlist_desc
    [[ -z "$wordlist_desc" ]] && wordlist_desc="暂无描述"
    
    # 获取难度等级
    echo ""
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
    [[ -z "$tags" ]] && tags="通用"
    
    # 处理文件
    process_add_wordlist "$csv_file" "$wordlist_id" "$wordlist_name" "$wordlist_desc" "$difficulty" "$tags"
}

# 处理添加词表
process_add_wordlist() {
    local csv_file=$1
    local wordlist_id=$2
    local wordlist_name=$3
    local wordlist_desc=$4
    local difficulty=$5
    local tags=$6
    
    print_message $BLUE "🔄 开始处理词表..."
    
    # 统计单词数量
    local word_count=$(count_words "$csv_file")
    print_message $GREEN "✅ 统计到 $word_count 个单词"
    
    # 生成目标文件名
    local target_filename="${wordlist_id}.csv"
    local target_path="$WORDLISTS_DIR/$target_filename"
    
    # 复制文件到wordlists目录
    cp "$csv_file" "$target_path"
    print_message $GREEN "✅ 文件已复制到 $target_path"
    
    # 更新索引文件
    update_index_add "$wordlist_id" "$wordlist_name" "$wordlist_desc" "$target_filename" "$word_count" "$difficulty" "$tags"
    
    print_message $GREEN "🎉 词表添加成功！"
    echo ""
    print_message $BLUE "📋 词表信息:"
    echo "  ID: $wordlist_id"
    echo "  名称: $wordlist_name"
    echo "  描述: $wordlist_desc"
    echo "  单词数量: $word_count"
    echo "  难度: $difficulty"
    echo "  标签: $tags"
    echo "  文件: $target_path"
}

# 更新索引文件（添加）
update_index_add() {
    local id=$1
    local name=$2
    local desc=$3
    local filename=$4
    local word_count=$5
    local difficulty=$6
    local tags=$7
    
    local current_date=$(date +"%Y-%m-%d")
    
    # 构建标签数组
    local tags_json=$(echo "$tags" | jq -R 'split(",") | map(gsub("^\\s+|\\s+$"; ""))')
    
    # 创建新的词表条目
    local new_entry=$(jq -n \
        --arg id "$id" \
        --arg name "$name" \
        --arg desc "$desc" \
        --arg filename "$filename" \
        --argjson wordCount "$word_count" \
        --arg difficulty "$difficulty" \
        --argjson tags "$tags_json" \
        --arg createdAt "$current_date" \
        --arg updatedAt "$current_date" \
        '{
            id: $id,
            name: $name,
            description: $desc,
            filename: $filename,
            wordCount: $wordCount,
            difficulty: $difficulty,
            tags: $tags,
            createdAt: $createdAt,
            updatedAt: $updatedAt
        }')
    
    # 更新索引文件
    local temp_file=$(mktemp)
    jq ".wordlists += [$new_entry]" "$INDEX_FILE" > "$temp_file"
    mv "$temp_file" "$INDEX_FILE"
    
    print_message $GREEN "✅ 索引文件已更新"
}

# 删除词表
delete_wordlist() {
    local id=$1
    
    if [[ -z "$id" ]]; then
        read -p "请输入要删除的词表ID: " id
    fi
    
    if [[ -z "$id" ]]; then
        print_message $YELLOW "⚠️ 词表ID不能为空"
        return
    fi
    
    if ! check_id_exists "$id"; then
        print_message $RED "❌ 词表 '$id' 不存在"
        return 1
    fi
    
    # 显示词表信息
    echo ""
    show_wordlist_details "$id"
    echo ""
    
    # 确认删除
    read -p "确定要删除这个词表吗？(y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        print_message $YELLOW "⚠️ 取消删除操作"
        return
    fi
    
    # 获取文件名
    local filename=$(jq -r ".wordlists[] | select(.id == \"$id\") | .filename" "$INDEX_FILE")
    local filepath="$WORDLISTS_DIR/$filename"
    
    # 删除文件
    if [[ -f "$filepath" ]]; then
        rm "$filepath"
        print_message $GREEN "✅ 已删除文件: $filepath"
    fi
    
    # 从索引中删除
    local temp_file=$(mktemp)
    jq ".wordlists |= map(select(.id != \"$id\"))" "$INDEX_FILE" > "$temp_file"
    mv "$temp_file" "$INDEX_FILE"
    
    print_message $GREEN "🗑️ 词表 '$id' 删除成功！"
}

# 更新词表信息
update_wordlist() {
    local id=$1
    
    if [[ -z "$id" ]]; then
        read -p "请输入要更新的词表ID: " id
    fi
    
    if [[ -z "$id" ]]; then
        print_message $YELLOW "⚠️ 词表ID不能为空"
        return
    fi
    
    if ! check_id_exists "$id"; then
        print_message $RED "❌ 词表 '$id' 不存在"
        return 1
    fi
    
    # 显示当前信息
    echo ""
    show_wordlist_details "$id"
    echo ""
    
    # 获取当前信息
    local info=$(get_wordlist_info "$id")
    local current_name=$(echo "$info" | jq -r '.name')
    local current_desc=$(echo "$info" | jq -r '.description')
    local current_difficulty=$(echo "$info" | jq -r '.difficulty')
    local current_tags=$(echo "$info" | jq -r '.tags | join(",")')
    
    print_message $BLUE "✏️ 更新词表信息 (直接回车保持原值):"
    echo ""
    
    # 更新名称
    read -p "名称 [$current_name]: " new_name
    [[ -z "$new_name" ]] && new_name="$current_name"
    
    # 更新描述
    read -p "描述 [$current_desc]: " new_desc
    [[ -z "$new_desc" ]] && new_desc="$current_desc"
    
    # 更新难度
    echo ""
    echo "当前难度: $current_difficulty"
    echo "1) 初级  2) 中级  3) 中高级  4) 高级"
    read -p "选择新难度 (1-4，直接回车保持原值): " difficulty_choice
    
    case $difficulty_choice in
        1) new_difficulty="初级" ;;
        2) new_difficulty="中级" ;;
        3) new_difficulty="中高级" ;;
        4) new_difficulty="高级" ;;
        *) new_difficulty="$current_difficulty" ;;
    esac
    
    # 更新标签
    read -p "标签 [$current_tags]: " new_tags
    [[ -z "$new_tags" ]] && new_tags="$current_tags"
    
    # 确认更新
    echo ""
    print_message $BLUE "📋 更新预览:"
    echo "  名称: $current_name → $new_name"
    echo "  描述: $current_desc → $new_desc"
    echo "  难度: $current_difficulty → $new_difficulty"
    echo "  标签: $current_tags → $new_tags"
    echo ""
    
    read -p "确定要更新吗？(y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        print_message $YELLOW "⚠️ 取消更新操作"
        return
    fi
    
    # 执行更新
    local current_date=$(date +"%Y-%m-%d")
    local tags_json=$(echo "$new_tags" | jq -R 'split(",") | map(gsub("^\\s+|\\s+$"; ""))')
    
    local temp_file=$(mktemp)
    jq "(.wordlists[] | select(.id == \"$id\")) |= (
        .name = \"$new_name\" |
        .description = \"$new_desc\" |
        .difficulty = \"$new_difficulty\" |
        .tags = $tags_json |
        .updatedAt = \"$current_date\"
    )" "$INDEX_FILE" > "$temp_file"
    mv "$temp_file" "$INDEX_FILE"
    
    print_message $GREEN "✅ 词表信息更新成功！"
}

# 显示统计信息
show_stats() {
    if [[ ! -f "$INDEX_FILE" ]]; then
        print_message $YELLOW "📝 暂无词表数据"
        return
    fi
    
    local total_count=$(jq '.wordlists | length' "$INDEX_FILE")
    local total_words=$(jq '[.wordlists[].wordCount] | add // 0' "$INDEX_FILE")
    
    print_message $BLUE "📊 词表统计信息:"
    echo ""
    echo "总词表数量: $total_count"
    echo "总单词数量: $total_words"
    echo ""
    
    # 按难度统计
    print_message $CYAN "📈 按难度分布:"
    jq -r '.wordlists | group_by(.difficulty) | .[] | "\(.[0].difficulty): \(length) 个词表"' "$INDEX_FILE" | sort
    echo ""
    
    # 按标签统计（显示前10个最常用标签）
    print_message $CYAN "🏷️ 热门标签 (前10):"
    jq -r '.wordlists[].tags[]' "$INDEX_FILE" | sort | uniq -c | sort -nr | head -10 | \
    while read count tag; do
        printf "  %-15s %s 个词表\n" "$tag" "$count"
    done
}

# 刷新词表索引
refresh_index() {
    print_message $BLUE "🔄 刷新词表索引..."
    
    # 检查wordlists目录中的所有CSV文件
    local csv_files=($(find "$WORDLISTS_DIR" -name "*.csv" 2>/dev/null))
    local index_files=($(jq -r '.wordlists[].filename' "$INDEX_FILE" 2>/dev/null))
    
    local updated=false
    
    # 检查缺失的文件
    for indexed_file in "${index_files[@]}"; do
        if [[ ! -f "$WORDLISTS_DIR/$indexed_file" ]]; then
            local id=$(jq -r ".wordlists[] | select(.filename == \"$indexed_file\") | .id" "$INDEX_FILE")
            print_message $YELLOW "⚠️ 发现缺失文件: $indexed_file (词表ID: $id)"
            
            read -p "是否从索引中删除此词表？(y/N): " confirm
            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                local temp_file=$(mktemp)
                jq ".wordlists |= map(select(.filename != \"$indexed_file\"))" "$INDEX_FILE" > "$temp_file"
                mv "$temp_file" "$INDEX_FILE"
                print_message $GREEN "✅ 已从索引中删除: $id"
                updated=true
            fi
        fi
    done
    
    # 更新单词数量
    for csv_file in "${csv_files[@]}"; do
        local filename=$(basename "$csv_file")
        local current_count=$(jq -r ".wordlists[] | select(.filename == \"$filename\") | .wordCount" "$INDEX_FILE" 2>/dev/null)
        
        if [[ "$current_count" != "null" && -n "$current_count" ]]; then
            local actual_count=$(count_words "$csv_file")
            
            if [[ "$current_count" != "$actual_count" ]]; then
                local id=$(jq -r ".wordlists[] | select(.filename == \"$filename\") | .id" "$INDEX_FILE")
                print_message $YELLOW "⚠️ 词表 '$id' 单词数量不匹配: 索引中为 $current_count，实际为 $actual_count"
                
                local current_date=$(date +"%Y-%m-%d")
                local temp_file=$(mktemp)
                jq "(.wordlists[] | select(.filename == \"$filename\")) |= (
                    .wordCount = $actual_count |
                    .updatedAt = \"$current_date\"
                )" "$INDEX_FILE" > "$temp_file"
                mv "$temp_file" "$INDEX_FILE"
                print_message $GREEN "✅ 已更新词表 '$id' 的单词数量"
                updated=true
            fi
        fi
    done
    
    if [[ "$updated" == true ]]; then
        print_message $GREEN "🔄 索引刷新完成，发现并修复了问题"
    else
        print_message $GREEN "✅ 索引检查完成，一切正常"
    fi
}

# 导出词表列表
export_wordlists() {
    local output_file="wordlists_export_$(date +%Y%m%d_%H%M%S).json"
    
    if [[ ! -f "$INDEX_FILE" ]]; then
        print_message $YELLOW "📝 暂无词表数据可导出"
        return
    fi
    
    cp "$INDEX_FILE" "$output_file"
    print_message $GREEN "📤 词表列表已导出到: $output_file"
    
    local count=$(jq '.wordlists | length' "$INDEX_FILE")
    print_message $BLUE "📊 导出统计: $count 个词表"
}

# 交互式主循环
interactive_main() {
    while true; do
        show_main_menu
        read -p "请选择操作 (0-9): " choice
        
        case $choice in
            1)
                echo ""
                list_wordlists
                echo ""
                read -p "按回车键继续..." dummy
                ;;
            2)
                echo ""
                add_wordlist_interactive
                echo ""
                read -p "按回车键继续..." dummy
                ;;
            3)
                echo ""
                search_wordlists
                echo ""
                read -p "按回车键继续..." dummy
                ;;
            4)
                echo ""
                update_wordlist
                echo ""
                read -p "按回车键继续..." dummy
                ;;
            5)
                echo ""
                delete_wordlist
                echo ""
                read -p "按回车键继续..." dummy
                ;;
            6)
                echo ""
                show_stats
                echo ""
                read -p "按回车键继续..." dummy
                ;;
            7)
                echo ""
                refresh_index
                echo ""
                read -p "按回车键继续..." dummy
                ;;
            8)
                echo ""
                export_wordlists
                echo ""
                read -p "按回车键继续..." dummy
                ;;
            9)
                echo ""
                show_usage
                echo ""
                read -p "按回车键继续..." dummy
                ;;
            0)
                print_message $GREEN "👋 再见！"
                exit 0
                ;;
            *)
                print_message $RED "❌ 无效选择，请重试"
                sleep 1
                ;;
        esac
    done
}

# 主函数
main() {
    # 检查依赖
    if ! command -v jq &> /dev/null; then
        print_message $RED "❌ 错误: 需要安装 jq 工具来处理JSON文件"
        print_message $YELLOW "💡 在 macOS 上安装: brew install jq"
        print_message $YELLOW "💡 在 Ubuntu 上安装: sudo apt-get install jq"
        exit 1
    fi
    
    # 初始化环境
    init_environment
    
    # 如果没有参数，进入交互模式
    if [[ $# -eq 0 ]]; then
        interactive_main
        return
    fi
    
    # 解析命令
    local command=$1
    shift
    
    case $command in
        list|ls)
            list_wordlists "$1"
            ;;
        add)
            # 解析添加参数
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
                    *)
                        print_message $RED "❌ 未知选项: $1"
                        show_usage
                        exit 1
                        ;;
                esac
            done
            
            add_wordlist "$csv_file" "$wordlist_id" "$wordlist_name" "$wordlist_desc" "$difficulty" "$tags"
            ;;
        search)
            search_wordlists "$1"
            ;;
        update)
            update_wordlist "$1"
            ;;
        delete|rm)
            delete_wordlist "$1"
            ;;
        stats)
            show_stats
            ;;
        refresh)
            refresh_index
            ;;
        export)
            export_wordlists
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            print_message $RED "❌ 未知命令: $command"
            show_usage
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"
