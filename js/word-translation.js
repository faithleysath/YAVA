import { callLLM } from './api.js';
import { showToast } from './ui.js';

// 翻译状态管理
const translationState = {
    currentTooltip: null,
    isTranslating: false,
    translationCache: new Map(),
    tooltipVisible: false,
    debounceTimer: null
};

// 初始化划词翻译功能
export function initWordTranslation() {
    // 监听文本选择事件
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('touchend', handleTextSelection);
    
    // 监听点击事件，用于关闭悬浮框
    document.addEventListener('click', handleDocumentClick);
    
    // 监听键盘事件，ESC键关闭悬浮框
    document.addEventListener('keydown', handleKeyDown);
    
    console.log('划词翻译功能已初始化');
}

// 处理文本选择事件
function handleTextSelection(event) {
    // 清除之前的防抖定时器
    if (translationState.debounceTimer) {
        clearTimeout(translationState.debounceTimer);
    }
    
    // 防抖处理，避免频繁触发
    translationState.debounceTimer = setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        // 如果没有选中文本或正在翻译中，直接返回
        if (!selectedText || translationState.isTranslating) {
            return;
        }
        
        // 验证是否为有效的英文单词
        if (isValidWord(selectedText)) {
            showTranslationTooltip(selectedText, event);
        } else {
            hideTooltip();
        }
    }, 300);
}

// 验证是否为有效的英文单词
function isValidWord(text) {
    // 检查是否为单个英文单词（只包含字母，长度在1-20之间）
    const wordRegex = /^[a-zA-Z]{1,20}$/;
    return wordRegex.test(text);
}

// 显示翻译悬浮框
async function showTranslationTooltip(word, event) {
    // 如果已经有悬浮框显示，先隐藏
    hideTooltip();
    
    // 创建悬浮框元素
    const tooltip = createTooltipElement(word);
    document.body.appendChild(tooltip);
    translationState.currentTooltip = tooltip;
    translationState.tooltipVisible = true;
    
    // 计算并设置位置
    const position = calculateTooltipPosition(event, tooltip);
    tooltip.style.left = `${position.x}px`;
    tooltip.style.top = `${position.y}px`;
    
    // 显示加载状态
    showLoadingState(tooltip);
    
    // 获取翻译结果
    try {
        translationState.isTranslating = true;
        const translationResult = await getTranslation(word);
        
        if (translationResult && translationState.tooltipVisible) {
            displayTranslationResult(tooltip, translationResult);
        }
    } catch (error) {
        console.error('翻译失败:', error);
        if (translationState.tooltipVisible) {
            showErrorState(tooltip, '翻译失败，请稍后重试');
        }
    } finally {
        translationState.isTranslating = false;
    }
}

// 创建悬浮框元素
function createTooltipElement(word) {
    const tooltip = document.createElement('div');
    tooltip.className = 'word-tooltip';
    tooltip.innerHTML = `
        <div class="word-tooltip-header">
            <div class="word-tooltip-word">${word}</div>
        </div>
        <div class="word-tooltip-content">
            <div class="word-tooltip-loading">
                <div class="loader !w-4 !h-4 !border-2"></div>
                <span class="ml-2 text-sm text-slate-500">AI 正在翻译...</span>
            </div>
        </div>
    `;
    
    // 添加淡入动画
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translateY(-10px)';
    
    // 使用 requestAnimationFrame 确保元素已添加到DOM后再应用动画
    requestAnimationFrame(() => {
        tooltip.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateY(0)';
    });
    
    return tooltip;
}

// 计算悬浮框位置
function calculateTooltipPosition(event, tooltipElement) {
    const rect = tooltipElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    let x = event.pageX || (event.clientX + scrollX);
    let y = event.pageY || (event.clientY + scrollY);
    
    // 默认显示在鼠标上方
    y = y - rect.height - 10;
    
    // 水平边界检测
    if (x + rect.width > viewportWidth + scrollX) {
        x = viewportWidth + scrollX - rect.width - 10;
    }
    if (x < scrollX + 10) {
        x = scrollX + 10;
    }
    
    // 垂直边界检测
    if (y < scrollY + 10) {
        // 如果上方空间不够，显示在鼠标下方
        y = (event.pageY || (event.clientY + scrollY)) + 10;
    }
    
    return { x, y };
}

// 显示加载状态
function showLoadingState(tooltip) {
    const content = tooltip.querySelector('.word-tooltip-content');
    content.innerHTML = `
        <div class="word-tooltip-loading flex items-center">
            <div class="loader !w-4 !h-4 !border-2"></div>
            <span class="ml-2 text-sm text-slate-500">AI 正在翻译...</span>
        </div>
    `;
}

// 显示错误状态
function showErrorState(tooltip, errorMessage) {
    const content = tooltip.querySelector('.word-tooltip-content');
    content.innerHTML = `
        <div class="word-tooltip-error text-center py-4">
            <div class="text-red-500 text-sm">${errorMessage}</div>
        </div>
    `;
}

// 获取翻译结果
async function getTranslation(word) {
    // 检查缓存
    if (translationState.translationCache.has(word.toLowerCase())) {
        return translationState.translationCache.get(word.toLowerCase());
    }
    
    const prompt = `请为英文单词 "${word}" 提供详细的翻译信息。

要求：
1. 如果这不是一个有效的英文单词，请在 "error" 字段中说明
2. 如果是有效单词，请提供完整的学习信息

输出格式要求：请严格按照以下 JSON 格式返回，不要包含任何额外的解释、注释或 markdown 标记：

{
  "word": "${word}",
  "partOfSpeech": "词性（如：n./v./adj.等）",
  "commonMeanings": "常见含义（用分号分隔多个含义）",
  "examUsage": "考研高频考法，如embrace new ideas（接受新观点）、embrace challenges（迎接挑战）",
  "exampleSentence": "She embraced the challenge with confidence.",
  "memoryTip": "embrace挑战，需要你brave（勇敢的）",
  "error": null
}

如果单词无效，返回：
{
  "error": "这不是一个有效的英文单词"
}`;

    try {
        const result = await callLLM(prompt, { useGlobalLoader: false });
        
        if (result) {
            // 如果有错误，返回错误信息
            if (result.error) {
                return { error: result.error };
            }
            
            // 缓存翻译结果
            translationState.translationCache.set(word.toLowerCase(), result);
            return result;
        }
        
        return null;
    } catch (error) {
        console.error('API调用失败:', error);
        throw error;
    }
}

// 显示翻译结果
function displayTranslationResult(tooltip, result) {
    if (result.error) {
        showErrorState(tooltip, result.error);
        return;
    }
    
    const content = tooltip.querySelector('.word-tooltip-content');
    content.innerHTML = `
        <div class="word-tooltip-sections space-y-3">
            ${result.partOfSpeech ? `
                <div class="word-tooltip-section">
                    <div class="word-tooltip-label">词性</div>
                    <div class="word-tooltip-text">${result.partOfSpeech}</div>
                </div>
            ` : ''}
            
            ${result.commonMeanings ? `
                <div class="word-tooltip-section">
                    <div class="word-tooltip-label">常见含义</div>
                    <div class="word-tooltip-text">${result.commonMeanings}</div>
                </div>
            ` : ''}
            
            ${result.examUsage ? `
                <div class="word-tooltip-section">
                    <div class="word-tooltip-label">考研高频考法</div>
                    <div class="word-tooltip-text">${result.examUsage}</div>
                </div>
            ` : ''}
            
            ${result.exampleSentence ? `
                <div class="word-tooltip-section">
                    <div class="word-tooltip-label">自测例句</div>
                    <div class="word-tooltip-text italic">"${result.exampleSentence}"</div>
                </div>
            ` : ''}
            
            ${result.memoryTip ? `
                <div class="word-tooltip-section">
                    <div class="word-tooltip-label">巧记方法（仅供参考）</div>
                    <div class="word-tooltip-text text-blue-600">${result.memoryTip}</div>
                </div>
            ` : ''}
        </div>
    `;
}

// 隐藏悬浮框
function hideTooltip() {
    if (translationState.currentTooltip) {
        const tooltip = translationState.currentTooltip;
        
        // 添加淡出动画
        tooltip.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        }, 300);
        
        translationState.currentTooltip = null;
        translationState.tooltipVisible = false;
    }
}

// 处理文档点击事件
function handleDocumentClick(event) {
    if (translationState.currentTooltip && !translationState.currentTooltip.contains(event.target)) {
        // 如果点击的不是悬浮框内部，则隐藏悬浮框
        hideTooltip();
    }
}

// 处理键盘事件
function handleKeyDown(event) {
    if (event.key === 'Escape' && translationState.tooltipVisible) {
        hideTooltip();
    }
}

// 导出函数供全局使用
window.hideWordTooltip = hideTooltip;

// 导出主要函数
export { hideTooltip };
