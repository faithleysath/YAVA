import { callLLM } from './api.js';
import { showToast } from './ui.js';
import { addWordToVocab } from './vocabulary-book.js';

// 翻译状态管理
const translationState = {
    currentTooltip: null,
    isTranslating: false,
    translationCache: new Map(),
    tooltipVisible: false,
    debounceTimer: null,
    lastSelectionRect: null, // 保存最后一次选中文本的位置
    resizeTimer: null,
    scrollTimer: null
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
    
    // 监听窗口大小变化，重新定位悬浮框
    window.addEventListener('resize', handleWindowResize);
    
    // 监听页面滚动，重新定位悬浮框
    window.addEventListener('scroll', handleWindowScroll);
    
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
    
    // 获取选中文本的位置信息
    const selectionRect = getSelectionPosition();
    if (!selectionRect) {
        console.warn('无法获取选中文本位置');
        return;
    }
    
    // 保存选中文本位置，用于窗口变化时重新定位
    translationState.lastSelectionRect = selectionRect;
    
    // 创建悬浮框元素
    const tooltip = createTooltipElement(word);
    
    // 先设置为不可见，避免闪烁
    tooltip.style.visibility = 'hidden';
    tooltip.style.position = 'absolute';
    
    document.body.appendChild(tooltip);
    translationState.currentTooltip = tooltip;
    translationState.tooltipVisible = true;
    
    // 显示加载状态
    showLoadingState(tooltip);
    
    // 等待DOM渲染完成后再定位
    requestAnimationFrame(() => {
        positionTooltip(tooltip, selectionRect);
        tooltip.style.visibility = 'visible';
    });
    
    // 获取翻译结果
    try {
        translationState.isTranslating = true;
        const translationResult = await getTranslation(word);
        
        if (translationResult && translationState.tooltipVisible) {
            displayTranslationResult(tooltip, translationResult);
            
            // 内容更新后重新定位
            requestAnimationFrame(() => {
                positionTooltip(tooltip, selectionRect);
            });
        }
    } catch (error) {
        console.error('翻译失败:', error);
        if (translationState.tooltipVisible) {
            showErrorState(tooltip, '翻译失败，请稍后重试');
            
            // 错误状态显示后重新定位
            requestAnimationFrame(() => {
                positionTooltip(tooltip, selectionRect);
            });
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
            <button class="word-tooltip-retry" title="重新翻译" style="display: none;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="m3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
            </button>
        </div>
        <div class="word-tooltip-content">
            <div class="word-tooltip-loading">
                <div class="loader !w-4 !h-4 !border-2"></div>
                <span class="ml-2 text-sm text-slate-500">AI 正在翻译...</span>
            </div>
        </div>
    `;
    
    // 添加重试按钮点击事件
    const retryButton = tooltip.querySelector('.word-tooltip-retry');
    retryButton.addEventListener('click', (e) => {
        e.stopPropagation(); // 防止事件冒泡
        handleRetryTranslation(word, tooltip);
    });
    
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

// 获取选中文本的位置信息
function getSelectionPosition() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) {
        return null;
    }
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2
    };
}

// 智能定位悬浮框
function positionTooltip(tooltipElement, selectionRect) {
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    const margin = 10; // 边距
    let bestPosition = null;
    let bestScore = -1;
    
    // 定义可能的位置策略（优先级从高到低）
    const positions = [
        // 上方中央
        {
            name: 'top-center',
            x: selectionRect.centerX - tooltipRect.width / 2,
            y: selectionRect.top - tooltipRect.height - margin,
            priority: 4
        },
        // 下方中央
        {
            name: 'bottom-center',
            x: selectionRect.centerX - tooltipRect.width / 2,
            y: selectionRect.bottom + margin,
            priority: 3
        },
        // 上方左对齐
        {
            name: 'top-left',
            x: selectionRect.left,
            y: selectionRect.top - tooltipRect.height - margin,
            priority: 2
        },
        // 下方左对齐
        {
            name: 'bottom-left',
            x: selectionRect.left,
            y: selectionRect.bottom + margin,
            priority: 2
        },
        // 右侧
        {
            name: 'right',
            x: selectionRect.right + margin,
            y: selectionRect.centerY - tooltipRect.height / 2,
            priority: 1
        },
        // 左侧
        {
            name: 'left',
            x: selectionRect.left - tooltipRect.width - margin,
            y: selectionRect.centerY - tooltipRect.height / 2,
            priority: 1
        }
    ];
    
    // 评估每个位置的可行性
    for (const pos of positions) {
        const score = evaluatePosition(pos, tooltipRect, viewportWidth, viewportHeight, scrollX, scrollY, margin);
        if (score > bestScore) {
            bestScore = score;
            bestPosition = pos;
        }
    }
    
    // 如果没有找到完美位置，使用调整后的位置
    if (bestPosition) {
        const finalPos = adjustPositionToBounds(
            bestPosition, 
            tooltipRect, 
            viewportWidth, 
            viewportHeight, 
            scrollX, 
            scrollY, 
            margin
        );
        
        tooltipElement.style.left = `${finalPos.x}px`;
        tooltipElement.style.top = `${finalPos.y}px`;
    }
}

// 评估位置的可行性得分
function evaluatePosition(position, tooltipRect, viewportWidth, viewportHeight, scrollX, scrollY, margin) {
    let score = position.priority * 10; // 基础优先级分数
    
    // 检查是否在视口内
    const inViewportX = position.x >= scrollX + margin && 
                       position.x + tooltipRect.width <= scrollX + viewportWidth - margin;
    const inViewportY = position.y >= scrollY + margin && 
                       position.y + tooltipRect.height <= scrollY + viewportHeight - margin;
    
    if (inViewportX && inViewportY) {
        score += 50; // 完全在视口内的奖励分数
    } else {
        // 部分超出视口的惩罚
        if (!inViewportX) score -= 20;
        if (!inViewportY) score -= 20;
    }
    
    return score;
}

// 调整位置以适应边界
function adjustPositionToBounds(position, tooltipRect, viewportWidth, viewportHeight, scrollX, scrollY, margin) {
    let { x, y } = position;
    
    // 水平边界调整
    if (x < scrollX + margin) {
        x = scrollX + margin;
    } else if (x + tooltipRect.width > scrollX + viewportWidth - margin) {
        x = scrollX + viewportWidth - tooltipRect.width - margin;
    }
    
    // 垂直边界调整
    if (y < scrollY + margin) {
        y = scrollY + margin;
    } else if (y + tooltipRect.height > scrollY + viewportHeight - margin) {
        y = scrollY + viewportHeight - tooltipRect.height - margin;
    }
    
    return { x, y };
}

// 保留原函数作为备用（已废弃，但保持兼容性）
function calculateTooltipPosition(event, tooltipElement) {
    console.warn('calculateTooltipPosition 已废弃，请使用 positionTooltip');
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
    // 显示重试按钮
    const retryButton = tooltip.querySelector('.word-tooltip-retry');
    if (retryButton) {
        retryButton.style.display = 'block';
    }
    
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
3. 一个单词可能有多种词性，请全部列出（用斜杠分隔，如：n./v./adj.）
4. 提供该单词的所有不同含义，必须用中文表达，确保每个含义都是真正不同的，不能有意思相近的重复含义
5. 含义要按重要性和使用频率排序

一个示例：
{
  "word": "embed",
  "partOfSpeech": "v.",
  "allMeanings": "嵌入；植入",
  "examUsage": "科技、文化类文章，如embed technology（嵌入技术）、embed in culture（融入文化）",
  "exampleSentence": "The reporter was embedded with the troops.",
  "memoryTip": "em（进入）+bed（床），嵌入床里，联想嵌入、使融入，比如钉子嵌入木头像进了床",
  "error": null
}

示例分析：
- "run" 作为动词可以表示"跑步；经营；运行"等完全不同的中文含义
- "bank" 作为名词可以表示"银行；河岸"等完全不同的中文含义
- 避免列出意思相近的含义，如"快乐"和"高兴"应该合并为一个含义

输出格式要求：请严格按照以下 JSON 格式返回，不要包含任何额外的解释、注释或 markdown 标记：

{
  "word": "${word}",
  "partOfSpeech": "所有词性（用斜杠分隔，如：n./v./adj.）",
  "allMeanings": "所有不同的中文含义（用分号分隔，确保每个含义都是真正不同的意思）",
  "examUsage": "考研高频考法，如embed technology（嵌入技术）、embed in culture（融入文化）",
  "exampleSentence": "The reporter was embedded with the troops.",
  "memoryTip": "em（进入）+bed（床），嵌入床里，联想嵌入、使融入，比如钉子嵌入木头像进了床",
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
    // 显示重试按钮
    const retryButton = tooltip.querySelector('.word-tooltip-retry');
    if (retryButton) {
        retryButton.style.display = 'block';
    }
    
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
            
            ${result.allMeanings ? `
                <div class="word-tooltip-section">
                    <div class="word-tooltip-label">所有含义</div>
                    <div class="word-tooltip-text">${result.allMeanings}</div>
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
        <div class="word-tooltip-footer mt-4 pt-3 border-t border-slate-100">
            <button id="add-to-vocab-btn" class="w-full bg-blue-600 text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                添加到生词本
            </button>
        </div>
    `;

    const addToVocabBtn = tooltip.querySelector('#add-to-vocab-btn');
    if (addToVocabBtn) {
        addToVocabBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addWordToVocab(result);
            // 可选：禁用按钮或改变样式表示已添加
            addToVocabBtn.textContent = '已添加';
            addToVocabBtn.disabled = true;
            addToVocabBtn.classList.add('bg-green-600', 'hover:bg-green-600');
        });
    }
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

// 处理窗口大小变化事件
function handleWindowResize() {
    if (!translationState.tooltipVisible || !translationState.currentTooltip || !translationState.lastSelectionRect) {
        return;
    }
    
    // 清除之前的定时器
    if (translationState.resizeTimer) {
        clearTimeout(translationState.resizeTimer);
    }
    
    // 防抖处理，避免频繁重新定位
    translationState.resizeTimer = setTimeout(() => {
        if (translationState.tooltipVisible && translationState.currentTooltip) {
            // 重新获取选中文本位置（可能因为窗口变化而改变）
            const currentSelectionRect = getSelectionPosition();
            if (currentSelectionRect) {
                translationState.lastSelectionRect = currentSelectionRect;
                positionTooltip(translationState.currentTooltip, currentSelectionRect);
            } else if (translationState.lastSelectionRect) {
                // 如果无法获取当前选中位置，使用保存的位置
                positionTooltip(translationState.currentTooltip, translationState.lastSelectionRect);
            }
        }
    }, 150);
}

// 处理页面滚动事件
function handleWindowScroll() {
    if (!translationState.tooltipVisible || !translationState.currentTooltip || !translationState.lastSelectionRect) {
        return;
    }
    
    // 清除之前的定时器
    if (translationState.scrollTimer) {
        clearTimeout(translationState.scrollTimer);
    }
    
    // 防抖处理，避免频繁重新定位
    translationState.scrollTimer = setTimeout(() => {
        if (translationState.tooltipVisible && translationState.currentTooltip) {
            // 重新获取选中文本位置（滚动后位置会改变）
            const currentSelectionRect = getSelectionPosition();
            if (currentSelectionRect) {
                translationState.lastSelectionRect = currentSelectionRect;
                positionTooltip(translationState.currentTooltip, currentSelectionRect);
            } else {
                // 如果选中文本已经不可见（滚动出视口），隐藏悬浮框
                hideTooltip();
            }
        }
    }, 100);
}

// 处理重试翻译
async function handleRetryTranslation(word, tooltip) {
    // 如果正在翻译中，忽略重试请求
    if (translationState.isTranslating) {
        return;
    }
    
    try {
        // 设置翻译状态
        translationState.isTranslating = true;
        
        // 隐藏重试按钮
        const retryButton = tooltip.querySelector('.word-tooltip-retry');
        if (retryButton) {
            retryButton.style.display = 'none';
        }
        
        // 显示加载状态
        showLoadingState(tooltip);
        
        // 清除该单词的缓存，强制重新获取翻译
        translationState.translationCache.delete(word.toLowerCase());
        
        // 重新获取翻译结果
        const translationResult = await getTranslation(word);
        
        if (translationResult && translationState.tooltipVisible) {
            displayTranslationResult(tooltip, translationResult);
            
            // 内容更新后重新定位
            if (translationState.lastSelectionRect) {
                requestAnimationFrame(() => {
                    positionTooltip(tooltip, translationState.lastSelectionRect);
                });
            }
            
            // 显示重试成功提示
            showToast('翻译已重新生成', 'success');
        }
    } catch (error) {
        console.error('重试翻译失败:', error);
        if (translationState.tooltipVisible) {
            showErrorState(tooltip, '重试翻译失败，请稍后再试');
            
            // 显示重试按钮
            const retryButton = tooltip.querySelector('.word-tooltip-retry');
            if (retryButton) {
                retryButton.style.display = 'block';
            }
            
            // 错误状态显示后重新定位
            if (translationState.lastSelectionRect) {
                requestAnimationFrame(() => {
                    positionTooltip(tooltip, translationState.lastSelectionRect);
                });
            }
            
            // 显示错误提示
            showToast('重试翻译失败', 'error');
        }
    } finally {
        translationState.isTranslating = false;
    }
}

// 导出函数供全局使用
window.hideWordTooltip = hideTooltip;

// 导出主要函数
export { hideTooltip };
