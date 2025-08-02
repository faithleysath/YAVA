import { callLLM } from './api.js';
import { showToast } from './ui.js';

// 翻译状态管理
const translationState = {
    currentTooltip: null,
    isTranslating: false,
    translationCache: new Map(),
    tooltipVisible: false,
    debounceTimer: null,
    selectionRange: null, // 保存选中文本的范围信息
    scrollThrottle: null // 滚动事件节流定时器
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
    
    // 监听窗口大小变化事件
    window.addEventListener('resize', handleResize);
    
    // 监听页面滚动事件
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    
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
    
    // 保存选中文本的范围信息
    saveSelectionRange();
    
    // 创建悬浮框元素
    const tooltip = createTooltipElement(word);
    document.body.appendChild(tooltip);
    translationState.currentTooltip = tooltip;
    translationState.tooltipVisible = true;
    
    // 等待DOM渲染完成后设置位置
    requestAnimationFrame(() => {
        updateTooltipPosition();
    });
    
    // 显示加载状态
    showLoadingState(tooltip);
    
    // 获取翻译结果
    try {
        translationState.isTranslating = true;
        const translationResult = await getTranslation(word);
        
        if (translationResult && translationState.tooltipVisible) {
            displayTranslationResult(tooltip, translationResult);
            // 内容更新后重新计算位置
            requestAnimationFrame(() => {
                updateTooltipPosition();
            });
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

// 保存选中文本的范围信息
function saveSelectionRange() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) {
        translationState.selectionRange = null;
        return;
    }
    
    try {
        const range = selection.getRangeAt(0);
        // 保存范围的详细信息，用于后续位置计算
        translationState.selectionRange = {
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset,
            // 保存初始的边界矩形信息作为备用
            initialRect: range.getBoundingClientRect()
        };
    } catch (error) {
        console.error('保存选中范围失败:', error);
        translationState.selectionRange = null;
    }
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
    
    // 清理选中范围信息
    translationState.selectionRange = null;
    
    // 清理滚动节流定时器
    if (translationState.scrollThrottle) {
        clearTimeout(translationState.scrollThrottle);
        translationState.scrollThrottle = null;
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


// 处理滚动事件
function handleScroll(event) {
    if (!translationState.currentTooltip || !translationState.tooltipVisible) {
        return;
    }
    
    // 使用节流来优化性能
    if (translationState.scrollThrottle) {
        clearTimeout(translationState.scrollThrottle);
    }
    
    translationState.scrollThrottle = setTimeout(() => {
        updateTooltipPosition();
    }, 16); // 约60fps的更新频率
}

// 处理窗口大小变化事件
function handleResize(event) {
    if (translationState.currentTooltip && translationState.tooltipVisible) {
        // 窗口大小变化时重新计算位置
        updateTooltipPosition();
    }
}

// 更新悬浮框位置
function updateTooltipPosition() {
    if (!translationState.currentTooltip || !translationState.tooltipVisible) {
        return;
    }
    
    const tooltip = translationState.currentTooltip;
    let targetRect = null;
    
    // 优先尝试重建选中范围来获取位置
    if (translationState.selectionRange) {
        try {
            const range = document.createRange();
            range.setStart(translationState.selectionRange.startContainer, translationState.selectionRange.startOffset);
            range.setEnd(translationState.selectionRange.endContainer, translationState.selectionRange.endOffset);
            targetRect = range.getBoundingClientRect();
        } catch (error) {
            console.error('重建选中范围失败:', error);
            // 使用备用的初始矩形信息
            if (translationState.selectionRange.initialRect) {
                targetRect = translationState.selectionRange.initialRect;
            }
        }
    }
    
    // 如果没有保存的范围信息，尝试使用当前选中的文本
    if (!targetRect) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            try {
                const range = selection.getRangeAt(0);
                targetRect = range.getBoundingClientRect();
            } catch (error) {
                console.error('获取当前选中范围失败:', error);
                return;
            }
        } else {
            return;
        }
    }
    
    // 如果目标矩形无效（可能是因为元素不在视口中），直接返回
    if (!targetRect || (targetRect.width === 0 && targetRect.height === 0)) {
        return;
    }
    
    // 计算悬浮框的最佳位置
    const position = calculateOptimalPosition(targetRect, tooltip);
    
    // 应用位置
    tooltip.style.transition = 'left 0.2s ease, top 0.2s ease';
    tooltip.style.left = `${position.x}px`;
    tooltip.style.top = `${position.y}px`;
}

// 计算悬浮框的最佳位置
function calculateOptimalPosition(targetRect, tooltip) {
    const tooltipRect = tooltip.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 目标元素的绝对位置
    const targetX = targetRect.left + scrollX;
    const targetY = targetRect.top + scrollY;
    const targetWidth = targetRect.width;
    const targetHeight = targetRect.height;
    
    // 悬浮框尺寸
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;
    
    // 紧贴文本的小间距
    const gap = 5;
    // 视口边界的安全边距
    const safeMargin = 10;
    
    let x, y;
    
    // 默认水平位置：与选中文本居中对齐
    x = targetX + (targetWidth / 2) - (tooltipWidth / 2);
    
    // 垂直位置：优先放在上方，紧贴文本
    const preferredTopY = targetY - tooltipHeight - gap;
    const preferredBottomY = targetY + targetHeight + gap;
    
    // 检查上方是否有足够空间且不会越界
    if (preferredTopY >= scrollY + safeMargin) {
        // 放在上方
        y = preferredTopY;
    } else if (preferredBottomY + tooltipHeight <= scrollY + viewportHeight - safeMargin) {
        // 放在下方，确保不会溢出下边界
        y = preferredBottomY;
    } else {
        // 两边都不够空间，选择能完全显示的位置
        const availableSpaceAbove = targetRect.top - safeMargin;
        const availableSpaceBelow = viewportHeight - targetRect.bottom - safeMargin;
        
        if (availableSpaceAbove >= tooltipHeight) {
            // 上方有足够空间
            y = scrollY + safeMargin;
        } else if (availableSpaceBelow >= tooltipHeight) {
            // 下方有足够空间
            y = scrollY + viewportHeight - tooltipHeight - safeMargin;
        } else {
            // 都不够，选择空间较大的一侧，允许部分内容超出但确保主要内容可见
            if (availableSpaceAbove > availableSpaceBelow) {
                y = scrollY + safeMargin;
            } else {
                y = scrollY + viewportHeight - tooltipHeight - safeMargin;
            }
        }
    }
    
    // 水平边界检测：只有在会越界时才调整
    const leftBoundary = scrollX + safeMargin;
    const rightBoundary = scrollX + viewportWidth - tooltipWidth - safeMargin;
    
    if (x < leftBoundary) {
        x = leftBoundary;
    } else if (x > rightBoundary) {
        x = rightBoundary;
    }
    
    // 确保位置不为负数
    x = Math.max(x, scrollX + safeMargin);
    y = Math.max(y, scrollY + safeMargin);
    
    return { x, y };
}

// 导出函数供全局使用
window.hideWordTooltip = hideTooltip;

// 导出主要函数
export { hideTooltip };
