import { appState } from './state.js';
import { selectMeaning } from './learning.js';

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
        
        const mastery = appState.masteryState[word];
        const totalMeanings = Object.keys(mastery).length;
        const masteredCount = Object.values(mastery).filter(Boolean).length;
        
        let statusClass = '';
        if (totalMeanings > 0) {
            if (masteredCount === totalMeanings) statusClass = 'word-item-mastered';
            else if (masteredCount > 0) statusClass = 'word-item-in-progress';
        }
        summary.innerHTML = `<span class="${statusClass}">${word}</span> <span class="text-sm text-slate-400">${masteredCount}/${totalMeanings}</span>`;
        
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
