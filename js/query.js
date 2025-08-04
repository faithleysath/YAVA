import { showTranslationTooltip, isValidWord as isValidQuery } from './word-translation.js';
import { showToast } from './ui.js';

export function initQuery() {
    const openBtn = document.getElementById('open-query-modal-btn');
    const queryModal = document.getElementById('query-modal');
    const queryInput = document.getElementById('query-input');
    const queryButton = document.getElementById('query-button');

    if (!openBtn || !queryModal || !queryInput || !queryButton) {
        console.error('Query modal elements not found');
        return;
    }

    const openModal = () => {
        queryModal.classList.remove('hidden');
        // 使用一个微小的延迟来确保浏览器渲染初始状态，从而触发过渡动画
        requestAnimationFrame(() => {
            queryModal.classList.add('show');
        });
        setTimeout(() => {
            queryInput.focus();
            queryInput.select();
        }, 100); // Delay focus to allow for transition
    };

    const closeModal = () => {
        queryModal.classList.remove('show');
        setTimeout(() => {
            queryModal.classList.add('hidden');
        }, 200); // Match transition duration
    };

    const performQuery = () => {
        const queryText = queryInput.value.trim();
        if (!queryText) {
            showToast('请输入要查询的单词或词组', 'warning');
            return;
        }

        if (!isValidQuery(queryText)) {
            showToast('输入内容无效，请检查是否包含非英文字符或格式错误', 'error');
            return;
        }
        
        closeModal();
        showTranslationTooltip(queryText);
    };

    openBtn.addEventListener('click', openModal);
    queryButton.addEventListener('click', performQuery);

    queryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            performQuery();
        } else if (e.key === 'Escape') {
            closeModal();
        }
    });

    // Close modal when clicking on the background overlay
    queryModal.addEventListener('click', (e) => {
        if (e.target === queryModal) {
            closeModal();
        }
    });

    // Expose openModal to global scope for shortcuts
    window.openQueryModal = openModal;
}
