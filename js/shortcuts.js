import { appState } from './state.js';
import { switchView } from './ui.js';
import { submitTranslation, nextStep } from './learning.js';
import { submitTestAnswer, nextTestQuestion } from './testing.js';
import { openSettingsModal, closeSettingsModal, saveSettings } from './settings.js';
import { hideTooltip } from './word-translation.js';

export function initShortcuts() {
    document.addEventListener('keydown', (e) => {
        // 忽略在输入框、文本域中的快捷键，除非是提交操作
        const activeEl = document.activeElement;
        const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';

        const isSubmitKey = (e.key === 'Enter' && (e.metaKey || e.ctrlKey));

        if (isInput && !isSubmitKey && e.key !== '/') {
            return;
        }

        // 全局快捷键
        if (e.key === '/' && !isInput) {
            e.preventDefault();
            if (window.openQueryModal) {
                window.openQueryModal();
            }
            return;
        }

        if (e.key.toLowerCase() === 's' && !isInput) {
            e.preventDefault();
            const settingsModal = document.getElementById('settings-modal');
            if (settingsModal.style.display === 'flex') {
                closeSettingsModal();
            } else {
                openSettingsModal();
            }
            return;
        }

        if (e.key === 'Escape') {
            const settingsModal = document.getElementById('settings-modal');
            if (settingsModal.style.display === 'flex') {
                e.preventDefault();
                closeSettingsModal();
            } else {
                // 尝试关闭划词翻译悬浮框
                hideTooltip();
            }
            return;
        }

        // 根据当前视图处理快捷键
        switch (appState.currentView) {
            case 'learning':
                handleLearningViewShortcuts(e);
                break;
            case 'test':
                handleTestViewShortcuts(e);
                break;
        }
    });
}

function handleLearningViewShortcuts(e) {
    const feedbackVisible = document.getElementById('feedback-container').style.display !== 'none';

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        // 如果反馈区不可见，说明在输入阶段，提交翻译
        if (!feedbackVisible) {
            const submitButton = document.querySelector('#learning-view button[onclick="submitTranslation()"]');
            if (submitButton) submitButton.click();
        }
    } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        // 如果反馈区可见，说明在反馈阶段，进入下一步
        if (feedbackVisible) {
            e.preventDefault();
            const nextButton = document.querySelector('#learning-view button[onclick="nextStep()"]');
            if (nextButton) nextButton.click();
        }
    }
}

function handleTestViewShortcuts(e) {
    const feedbackVisible = document.getElementById('test-feedback-container').style.display !== 'none';

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!feedbackVisible) {
            const submitButton = document.querySelector('#test-view button[onclick="submitTestAnswer()"]');
            if (submitButton) submitButton.click();
        }
    } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        if (feedbackVisible) {
            e.preventDefault();
            const nextButton = document.querySelector('#test-view button[onclick="nextTestQuestion()"]');
            if (nextButton) nextButton.click();
        }
    } else if (['1', '2', '3', '4'].includes(e.key) && !feedbackVisible) {
        const clozeOptions = document.querySelectorAll('.cloze-option-btn');
        if (clozeOptions.length > 0) {
            e.preventDefault();
            const optionIndex = parseInt(e.key) - 1;
            if (clozeOptions[optionIndex]) {
                clozeOptions[optionIndex].click();
            }
        }
    }
}
