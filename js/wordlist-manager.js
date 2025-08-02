import { appState } from './state.js';
import { showToast, renderWordList, updateUnmasteredCount } from './ui.js';
import { initializeMasteryState } from './learning.js';
import { parseCSV } from './file-handler.js';

let wordlistsData = null;

// 加载词表索引
export async function loadWordlistsIndex() {
    try {
        const response = await fetch('/wordlists/index.json');
        if (!response.ok) {
            throw new Error('无法加载词表索引');
        }
        wordlistsData = await response.json();
        return wordlistsData;
    } catch (error) {
        console.error('加载词表索引失败:', error);
        showToast('加载词表索引失败，请检查网络连接', 'error');
        return null;
    }
}

// 加载指定词表
export async function loadWordlist(wordlistId) {
    if (!wordlistsData) {
        await loadWordlistsIndex();
    }
    
    const wordlist = wordlistsData?.wordlists.find(w => w.id === wordlistId);
    if (!wordlist) {
        showToast('未找到指定的词表', 'error');
        return false;
    }

    try {
        showToast('正在加载词表...', 'info');
        
        const response = await fetch(`/wordlists/${wordlist.filename}`);
        if (!response.ok) {
            throw new Error('无法加载词表文件');
        }
        
        const csvText = await response.text();
        
        // 使用现有的CSV解析逻辑
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 3) {
            throw new Error('词表文件格式不正确');
        }
        
        appState.headers = lines[1].split(',').map(h => h.trim());
        const wordIndex = appState.headers.indexOf('单词');
        if (wordIndex === -1) {
            throw new Error('词表文件必须包含 "单词" 列');
        }
        
        appState.allWords = lines.slice(2).map(line => {
            const values = line.split(',');
            const wordObject = {};
            appState.headers.forEach((header, i) => { 
                wordObject[header] = values[i] ? values[i].trim() : ''; 
            });
            return wordObject;
        }).filter(wordObj => wordObj['单词']);
        
        initializeMasteryState();
        renderWordList();
        updateUnmasteredCount();
        
        // 显示控制按钮
        document.getElementById('test-controls').classList.remove('hidden');
        document.getElementById('data-controls').classList.remove('hidden');
        
        showToast(`成功加载词表"${wordlist.name}"，共 ${appState.allWords.length} 个单词！`, 'success');
        
        // 更新文件信息显示
        const fileInfo = document.getElementById('file-info');
        if (fileInfo) {
            fileInfo.textContent = `已加载词表：${wordlist.name} (${appState.allWords.length} 个单词)`;
        }
        
        return true;
    } catch (error) {
        console.error('加载词表失败:', error);
        showToast(`加载词表失败: ${error.message}`, 'error');
        return false;
    }
}

// 获取难度对应的颜色类
export function getDifficultyColor(difficulty) {
    const colorMap = {
        '初级': 'bg-green-100 text-green-800',
        '中级': 'bg-blue-100 text-blue-800',
        '中高级': 'bg-purple-100 text-purple-800',
        '高级': 'bg-red-100 text-red-800'
    };
    return colorMap[difficulty] || 'bg-gray-100 text-gray-800';
}

// 渲染词表卡片
export function renderWordlistCard(wordlist) {
    const difficultyColor = getDifficultyColor(wordlist.difficulty);
    const tagsHtml = wordlist.tags.map(tag => 
        `<span class="inline-block bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full">${tag}</span>`
    ).join(' ');
    
    return `
        <div class="wordlist-card bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group" 
             onclick="loadWordlistById('${wordlist.id}')">
            <div class="flex justify-between items-start mb-3">
                <h3 class="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">${wordlist.name}</h3>
                <span class="text-xs px-2 py-1 rounded-full ${difficultyColor}">${wordlist.difficulty}</span>
            </div>
            <p class="text-slate-600 text-sm mb-4 line-clamp-2">${wordlist.description}</p>
            <div class="flex justify-between items-center mb-3">
                <span class="text-sm font-medium text-slate-700">${wordlist.wordCount} 个单词</span>
                <div class="flex items-center text-xs text-slate-500">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    ${wordlist.updatedAt}
                </div>
            </div>
            <div class="flex flex-wrap gap-1 mb-4">
                ${tagsHtml}
            </div>
            <div class="flex items-center justify-between">
                <button class="text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors">
                    立即使用 →
                </button>
                <div class="flex items-center text-xs text-slate-400">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                    点击加载
                </div>
            </div>
        </div>
    `;
}

// 全局函数，供HTML调用
window.loadWordlistById = loadWordlist;
