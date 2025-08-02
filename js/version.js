import { APP_VERSION } from './config.js';
import { showToast } from './ui.js';

const VERSION_STORAGE_KEY = 'app_version';
const CHANGELOG_SHOWN_KEY = 'changelog_shown';

// 检查版本更新
export async function checkVersionUpdate() {
    const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
    const changelogShown = localStorage.getItem(CHANGELOG_SHOWN_KEY);
    
    // 如果是新用户或版本有更新
    if (!storedVersion || storedVersion !== APP_VERSION) {
        // 更新存储的版本号
        localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
        
        // 如果不是首次安装且changelog还未显示过
        if (storedVersion && changelogShown !== APP_VERSION) {
            await showChangelogModal();
            localStorage.setItem(CHANGELOG_SHOWN_KEY, APP_VERSION);
        }
    }
}

// 显示changelog模态框
async function showChangelogModal() {
    try {
        // 获取changelog索引
        const indexResponse = await fetch('/changelog/index.json');
        if (!indexResponse.ok) {
            console.warn('无法加载changelog索引');
            return;
        }
        
        const changelogIndex = await indexResponse.json();
        const currentVersionInfo = changelogIndex.versions.find(v => v.version === APP_VERSION);
        
        if (!currentVersionInfo) {
            console.warn(`未找到版本 ${APP_VERSION} 的changelog信息`);
            return;
        }
        
        // 获取changelog内容
        const changelogResponse = await fetch(`/changelog/${currentVersionInfo.file}`);
        if (!changelogResponse.ok) {
            console.warn('无法加载changelog内容');
            return;
        }
        
        const changelogContent = await changelogResponse.text();
        
        // 创建并显示模态框
        createChangelogModal(currentVersionInfo, changelogContent);
        
    } catch (error) {
        console.error('加载changelog时出错:', error);
    }
}

// 创建changelog模态框
function createChangelogModal(versionInfo, content) {
    // 创建模态框HTML
    const modalHTML = `
        <div id="changelog-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <div class="p-6 border-b border-slate-200">
                    <div class="flex justify-between items-center">
                        <div>
                            <h2 class="text-2xl font-bold text-slate-900">🎉 应用已更新</h2>
                            <p class="text-slate-600 mt-1">${versionInfo.title} - v${versionInfo.version}</p>
                        </div>
                        <button onclick="closeChangelogModal()" class="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="p-6 overflow-y-auto max-h-[60vh]">
                    <div id="changelog-content" class="prose prose-slate max-w-none">
                        ${formatChangelogContent(content)}
                    </div>
                </div>
                <div class="p-6 border-t border-slate-200 bg-slate-50">
                    <div class="flex justify-end gap-3">
                        <button onclick="closeChangelogModal()" class="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                            知道了
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 添加到页面
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 添加关闭函数到全局作用域
    window.closeChangelogModal = closeChangelogModal;
}

// 格式化changelog内容（简单的markdown到HTML转换）
function formatChangelogContent(content) {
    return content
        // 标题转换
        .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mb-4 text-slate-900">$1</h1>')
        .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mb-3 mt-6 text-slate-800">$1</h2>')
        .replace(/^### (.+)$/gm, '<h3 class="text-lg font-medium mb-2 mt-4 text-slate-700">$1</h3>')
        // 列表转换
        .replace(/^- (.+)$/gm, '<li class="mb-1">$1</li>')
        // 代码块转换
        .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-2 py-1 rounded text-sm font-mono">$1</code>')
        // 粗体转换
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // 分隔线转换
        .replace(/^---$/gm, '<hr class="my-6 border-slate-200">')
        // 段落转换
        .replace(/\n\n/g, '</p><p class="mb-3">')
        // 包装段落
        .replace(/^(?!<[h|l|c|s])/gm, '<p class="mb-3">')
        // 清理多余的段落标签
        .replace(/<p class="mb-3"><\/p>/g, '')
        // 包装列表
        .replace(/(<li class="mb-1">.*<\/li>)/gs, '<ul class="list-disc list-inside mb-4 space-y-1">$1</ul>')
        // 修复嵌套问题
        .replace(/<\/ul>\s*<ul class="list-disc list-inside mb-4 space-y-1">/g, '');
}

// 关闭changelog模态框
function closeChangelogModal() {
    const modal = document.getElementById('changelog-modal');
    if (modal) {
        modal.remove();
    }
    delete window.closeChangelogModal;
}

// 手动显示changelog（用于设置菜单等）
export async function showChangelogManually() {
    await showChangelogModal();
}
