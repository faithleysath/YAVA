import { appState } from './state.js';
import { showToast, renderWordList, updateUnmasteredCount } from './ui.js';
import { initializeMasteryState } from './learning.js';

const VOCAB_STORAGE_KEY = 'vocabulary_book';

// 从 localStorage 加载生词本
export function loadVocabularyBook() {
    const storedVocab = localStorage.getItem(VOCAB_STORAGE_KEY);
    if (storedVocab) {
        try {
            appState.vocabularyBook = JSON.parse(storedVocab);
        } catch (e) {
            console.error("Failed to parse vocabulary book from localStorage", e);
            appState.vocabularyBook = [];
        }
    }
    renderVocabularyBook();
}

// 保存生词本到 localStorage
function saveVocabularyBook() {
    localStorage.setItem(VOCAB_STORAGE_KEY, JSON.stringify(appState.vocabularyBook));
}

// 添加单词到生词本
export function addWordToVocab(wordData) {
    if (!wordData || !wordData.word) {
        showToast('无法添加无效的单词', 'error');
        return;
    }
    
    const isAlreadyAdded = appState.vocabularyBook.some(item => item.word.toLowerCase() === wordData.word.toLowerCase());
    
    if (isAlreadyAdded) {
        showToast(`单词 "${wordData.word}" 已在生词本中`, 'warning');
        return;
    }
    
    // 创建一个干净的对象进行存储
    const vocabItem = {
        word: wordData.word,
        partOfSpeech: wordData.partOfSpeech || '',
        allMeanings: wordData.allMeanings || '',
        examUsage: wordData.examUsage || '',
        exampleSentence: wordData.exampleSentence || '',
        memoryTip: wordData.memoryTip || ''
    };

    appState.vocabularyBook.push(vocabItem);
    saveVocabularyBook();
    renderVocabularyBook();
    showToast(`成功添加 "${wordData.word}" 到生词本`, 'success');
}

// 从生词本移除单词
export function removeWordFromVocab(word) {
    appState.vocabularyBook = appState.vocabularyBook.filter(item => item.word.toLowerCase() !== word.toLowerCase());
    saveVocabularyBook();
    renderVocabularyBook();
    showToast(`已从生词本中移除 "${word}"`, 'info');
}

// 将生词本加载为当前学习列表
export function loadVocabAsWordlist() {
    if (appState.vocabularyBook.length === 0) {
        showToast('生词本是空的，无法加载', 'warning');
        return;
    }

    // 将生词本数据转换为 allWords 格式
    appState.headers = ['单词', '常见含义', '词性', '考研高频考法', '巧记方法（仅供参考）'];
    appState.allWords = appState.vocabularyBook.map(item => ({
        '单词': item.word,
        '常见含义': item.allMeanings || '',
        '词性': item.partOfSpeech || '',
        '考研高频考法': item.examUsage || '',
        '巧记方法（仅供参考）': item.memoryTip || ''
    }));

    initializeMasteryState();
    renderWordList();
    updateUnmasteredCount();
    
    document.getElementById('test-controls').classList.remove('hidden');
    document.getElementById('data-controls').classList.remove('hidden');
    
    showToast(`已从生词本加载 ${appState.allWords.length} 个单词`, 'success');
    
    const fileInfo = document.getElementById('file-info');
    if (fileInfo) {
        fileInfo.textContent = `已加载生词本 (${appState.allWords.length} 个单词)`;
    }
}

// 渲染生词本 UI
export function renderVocabularyBook() {
    const container = document.getElementById('vocabulary-book-container');
    if (!container) return;

    const vocabList = document.getElementById('vocabulary-book-list');
    const loadButton = document.getElementById('load-vocab-button');

    if (appState.vocabularyBook.length === 0) {
        vocabList.innerHTML = `<p class="text-slate-400 text-center py-8">生词本是空的，通过划词翻译添加新单词吧！</p>`;
        if(loadButton) loadButton.classList.add('hidden');
        return;
    }

    if(loadButton) loadButton.classList.remove('hidden');

    const listHtml = appState.vocabularyBook.map(item => `
        <div class="vocab-item group flex items-center justify-between p-3 bg-white rounded-lg hover:bg-slate-50 transition-colors">
            <div>
                <p class="font-bold text-slate-800">${item.word}</p>
                <p class="text-sm text-slate-500">${item.allMeanings || '暂无释义'}</p>
            </div>
            <button onclick="removeWordFromVocab('${item.word}')" title="从生词本移除" 
                    class="vocab-delete-btn opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </button>
        </div>
    `).join('');

    vocabList.innerHTML = `<div class="space-y-2">${listHtml}</div>`;
}
