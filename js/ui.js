import { appState } from './state.js';
import { selectMeaning } from './learning.js';
import { getWordPhonetics } from './dictionary-api.js';

const wordListContainer = document.getElementById('word-list-container');
const loadingModal = document.getElementById('loading-modal');
const loadingText = document.getElementById('loading-text');
const views = {
    home: document.getElementById('home-view'),
    learning: document.getElementById('learning-view'),
    test: document.getElementById('test-view')
};

let toastCounter = 0;

export function showToast(message, type = 'info', options = {}) {
    const {
        duration = type === 'error' ? 6000 : 4000,
        persistent = false,
        title = null
    } = options;
    
    const toastContainer = document.getElementById('toast-container');
    const toastId = `toast-${++toastCounter}`;
    
    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };
    
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast toast-${type}`;
    
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-content">
            ${title ? `<div class="toast-title">${title}</div>` : ''}
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="hideToast('${toastId}')">&times;</button>
        ${!persistent ? `<div class="toast-progress" style="width: 100%"></div>` : ''}
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    if (!persistent && duration > 0) {
        const progressBar = toast.querySelector('.toast-progress');
        if (progressBar) {
            progressBar.style.transition = `width ${duration}ms linear`;
            setTimeout(() => {
                progressBar.style.width = '0%';
            }, 50);
        }
        
        setTimeout(() => {
            hideToast(toastId);
        }, duration);
    }
    
    return toastId;
}

export function hideToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
        toast.classList.add('hide');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

export function hideAllToasts() {
    const toasts = document.querySelectorAll('.toast');
    toasts.forEach(toast => {
        hideToast(toast.id);
    });
}

export function setLoading(isLoading, text = 'AI 正在思考中...') {
    appState.isLoading = isLoading;
    if (isLoading) {
        loadingText.textContent = text;
        loadingModal.style.display = 'flex';
    } else {
        loadingModal.style.display = 'none';
    }
}

export function switchView(viewName) {
    appState.currentView = viewName;
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
}

export function renderWordList() {
    wordListContainer.innerHTML = '';
    appState.allWords.forEach(wordObj => {
        const word = wordObj['单词'];
        const details = document.createElement('details');
        details.className = 'group';
        
        const summary = document.createElement('summary');
        summary.className = 'cursor-pointer p-2 rounded-md hover:bg-slate-100 list-none font-semibold flex justify-between items-center';
        
        const summaryContent = document.createElement('div');
        summaryContent.className = 'flex items-center gap-2';

        const wordSpan = document.createElement('span');
        
        const mastery = appState.masteryState[word];
        const totalMeanings = Object.keys(mastery).length;
        const masteredCount = Object.values(mastery).filter(Boolean).length;
        
        let statusClass = '';
        if (totalMeanings > 0) {
            if (masteredCount === totalMeanings) statusClass = 'word-item-mastered';
            else if (masteredCount > 0) statusClass = 'word-item-in-progress';
        }
        wordSpan.className = statusClass;
        wordSpan.textContent = word;
        summaryContent.appendChild(wordSpan);

        const masterySpan = document.createElement('span');
        masterySpan.className = 'text-sm text-slate-400';
        masterySpan.textContent = `${masteredCount}/${totalMeanings}`;

        summary.appendChild(summaryContent);
        summary.appendChild(masterySpan);

        details.addEventListener('toggle', (event) => {
            if (event.target.open) {
                const existingDetails = summaryContent.querySelector('.phonetic-details');
                if (!existingDetails) { // 只在第一次展开时加载
                    getWordPhonetics(word).then(phonetics => {
                        if (phonetics && (phonetics.phonetic || phonetics.audioUrl)) {
                            const phoneticDetails = document.createElement('div');
                            phoneticDetails.className = 'phonetic-details flex items-center gap-1';
                            if (phonetics.phonetic) {
                                const phoneticEl = document.createElement('span');
                                phoneticEl.className = 'phonetic-text text-sm';
                                phoneticEl.textContent = `[${phonetics.phonetic}]`;
                                phoneticDetails.appendChild(phoneticEl);
                            }
                            if (phonetics.audioUrl) {
                                const audioBtn = document.createElement('button');
                                audioBtn.className = 'audio-btn';
                                audioBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg>`;
                                audioBtn.onclick = (e) => {
                                    e.preventDefault(); e.stopPropagation();
                                    new Audio(phonetics.audioUrl).play().catch(err => console.error(err));
                                };
                                phoneticDetails.appendChild(audioBtn);
                            }
                            summaryContent.appendChild(phoneticDetails);
                        }
                    });
                }
            }
        });
        
        const meaningsList = document.createElement('ul');
        meaningsList.className = 'pl-6 mt-1 space-y-1';
        Object.keys(mastery).forEach((meaning, index) => {
            const meaningItem = document.createElement('li');
            const meaningBtn = document.createElement('button');
            meaningBtn.textContent = meaning;
            meaningBtn.className = 'w-full text-left p-1 text-sm rounded hover:bg-blue-50';
            if (mastery[meaning]) meaningBtn.classList.add('meaning-item-mastered');
            meaningBtn.onclick = () => selectMeaning(word, index);
            meaningItem.appendChild(meaningBtn);
            meaningsList.appendChild(meaningItem);
        });
        
        details.appendChild(summary);
        details.appendChild(meaningsList);
        wordListContainer.appendChild(details);
    });
}

export function updateUnmasteredCount() {
    let unmasteredCount = 0;
    Object.values(appState.masteryState).forEach(meanings => {
        unmasteredCount += Object.values(meanings).filter(m => !m).length;
    });
    document.getElementById('unmastered-count').textContent = `当前有 ${unmasteredCount} 个考点待掌握。`;
}

// Expose functions to global scope for inline event handlers
window.hideToast = hideToast;
