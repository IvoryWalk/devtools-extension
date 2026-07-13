/**
 * 主应用入口 v1.3
 * - 动态渲染功能行和按钮（按配置和使用频率）
 * - 使用统计埋点
 * - 暂存重命名
 * - 导入导出支持
 */
class DevToolBoxApp {
    constructor() {
        this.currentRenameId = null;
        this.init();
    }

    async init() {
        this.bindElements();
        this.initTheme();
        this.bindGlobalEvents();
        this.updateLineNumbers();
        this.updateCharCount();
        await this.renderFunctionArea();
        this.bindFunctionEvents();
        await this.renderStorageList();
    }

    // 绑定DOM元素
    bindElements() {
        this.inputArea = document.getElementById('input-area');
        this.inputLineNumbers = document.getElementById('input-line-numbers');
        this.outputArea = document.getElementById('output-area');
        this.outputCode = document.getElementById('output-code');
        this.status = document.getElementById('status');
        this.inputCount = document.getElementById('input-count');
        this.toast = document.getElementById('toast');
        this.functionArea = document.getElementById('function-area-container');
        
        // 存储抽屉
        this.storageDrawer = document.getElementById('storage-drawer');
        this.drawerOverlay = document.getElementById('drawer-overlay');
        this.storageList = document.getElementById('storage-list');
        this.storageSearch = document.getElementById('storage-search');
        this.storageCount = document.getElementById('storage-count');

        // 重命名弹窗
        this.renameModal = document.getElementById('rename-modal');
        this.renameInput = document.getElementById('rename-input');
    }

    // 动态渲染功能区
    async renderFunctionArea() {
        const rows = await UsageStats.getRowsConfig();
        let html = '';

        // 功能行提示
        const tips = {
            cron: '提示：Linux:5位, Spring:6位, Quartz:6-7位，自动识别格式解析最近5次执行时间'
        };

        for (const row of rows) {
            const defaultRow = UsageStats.defaultRows.find(r => r.id === row.id);
            if (!defaultRow) continue;

            const buttons = await UsageStats.getButtonsConfig(row.id);
            
            html += `<div class="func-row" data-row-id="${row.id}">`;
            html += `<span class="func-label">${defaultRow.label}</span>`;
            html += `<div class="func-btns">`;

            for (const btn of buttons) {
                const defaultBtn = UsageStats.defaultButtons.find(b => b.id === btn.id);
                if (!defaultBtn) continue;
                const isPrimary = defaultBtn.primary ? 'primary' : '';
                const title = defaultBtn.title ? `title="${defaultBtn.title}"` : '';
                html += `<button class="func-btn ${isPrimary}" data-action="${btn.id}" ${title}>${defaultBtn.label}</button>`;
            }

            // JSON行添加Key输入框
            if (row.id === 'json') {
                html += `<input type="text" id="json-keys-input" class="func-input" placeholder="多个key用英文逗号分隔,如: id,name,createTime">`;
            }

            html += `</div>`;

            // 提示文字
            if (tips[row.id]) {
                html += `<span class="func-tip">${tips[row.id]}</span>`;
            }

            html += `</div>`;
        }

        this.functionArea.innerHTML = html;
    }

    // 初始化主题
    initTheme() {
        const savedTheme = localStorage.getItem('devtoolbox_theme') || 'auto';
        this.setTheme(savedTheme);
    }

    // 设置主题
    setTheme(theme) {
        let actualTheme = theme;
        if (theme === 'auto') {
            actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', actualTheme);
        localStorage.setItem('devtoolbox_theme', theme);
        
        const themeBtn = document.getElementById('btn-theme');
        themeBtn.textContent = theme === 'light' ? '☀️ 浅色' : theme === 'dark' ? '🌙 深色' : '🌓 跟随系统';
    }

    // 切换主题
    toggleTheme() {
        const current = localStorage.getItem('devtoolbox_theme') || 'auto';
        const themes = ['dark', 'light', 'auto'];
        const nextIndex = (themes.indexOf(current) + 1) % themes.length;
        this.setTheme(themes[nextIndex]);
        this.showToast(`已切换到${themes[nextIndex] === 'dark' ? '深色' : themes[nextIndex] === 'light' ? '浅色' : '跟随系统'}主题`, 'success');
    }

    // 绑定全局事件
    bindGlobalEvents() {
        // 主题切换
        document.getElementById('btn-theme').addEventListener('click', () => {
            this.toggleTheme();
        });

        // 存储抽屉
        document.getElementById('btn-storage').addEventListener('click', () => {
            this.openStorageDrawer();
        });
        document.getElementById('storage-close').addEventListener('click', () => {
            this.closeStorageDrawer();
        });
        this.drawerOverlay.addEventListener('click', () => {
            this.closeStorageDrawer();
        });

        // 存储操作
        document.getElementById('storage-save').addEventListener('click', () => {
            this.saveCurrentToStorage();
        });
        document.getElementById('storage-clear-all').addEventListener('click', async () => {
            if (confirm('确定要清空所有暂存数据吗？此操作不可恢复！')) {
                await StorageTools.clear();
                this.showToast('已清空所有暂存数据', 'success');
                this.renderStorageList();
            }
        });

        // 存储搜索
        this.storageSearch.addEventListener('input', () => {
            this.renderStorageList(this.storageSearch.value);
        });

        // 输入区按钮
        document.getElementById('btn-input-copy').addEventListener('click', () => {
            this.copyToClipboard(this.inputArea.value);
        });
        document.getElementById('btn-input-save').addEventListener('click', () => {
            this.saveContentToStorage(this.inputArea.value, '输入内容');
        });
        document.getElementById('btn-input-clear').addEventListener('click', () => {
            this.inputArea.value = '';
            this.updateLineNumbers();
            this.updateCharCount();
            this.showToast('已清空输入', 'success');
        });

        // 输出区按钮
        document.getElementById('btn-output-copy').addEventListener('click', () => {
            this.copyResult();
        });
        document.getElementById('btn-output-save').addEventListener('click', () => {
            const content = this.outputCode.textContent;
            this.saveContentToStorage(content, '结果内容');
        });
        document.getElementById('btn-output-clear').addEventListener('click', () => {
            this.outputCode.textContent = '';
            this.setStatus('已清空结果');
            this.showToast('已清空结果', 'success');
        });

        // 输入框事件
        this.inputArea.addEventListener('input', () => {
            this.updateLineNumbers();
            this.updateCharCount();
        });

        this.inputArea.addEventListener('scroll', () => {
            this.inputLineNumbers.scrollTop = this.inputArea.scrollTop;
        });

        // Tab键插入空格
        this.inputArea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.inputArea.selectionStart;
                const end = this.inputArea.selectionEnd;
                this.inputArea.value = this.inputArea.value.substring(0, start) + '  ' + this.inputArea.value.substring(end);
                this.inputArea.selectionStart = this.inputArea.selectionEnd = start + 2;
                this.updateLineNumbers();
                this.updateCharCount();
            }
        });

        // 点击结果中的值复制
        this.outputArea.addEventListener('click', (e) => {
            if (e.target.classList.contains('timestamp-value') || e.target.classList.contains('cron-result-item')) {
                const text = e.target.dataset.copy || e.target.textContent.trim();
                this.copyToClipboard(text);
            }
        });

        // 存储列表操作（事件委托）
        this.storageList.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            if (!id) return;

            if (e.target.classList.contains('load-btn')) {
                this.loadStorageItem(id);
            } else if (e.target.classList.contains('copy-btn')) {
                this.copyStorageItem(id);
            } else if (e.target.classList.contains('rename-btn')) {
                this.openRenameModal(id);
            } else if (e.target.classList.contains('delete-btn')) {
                this.deleteStorageItem(id);
            } else if (e.target.closest('.storage-item')) {
                this.loadStorageItem(id);
            }
        });

        // 重命名弹窗事件
        document.getElementById('rename-cancel').addEventListener('click', () => {
            this.closeRenameModal();
        });
        document.getElementById('rename-confirm').addEventListener('click', () => {
            this.confirmRename();
        });
        this.renameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.confirmRename();
            if (e.key === 'Escape') this.closeRenameModal();
        });
        this.renameModal.addEventListener('click', (e) => {
            if (e.target === this.renameModal) this.closeRenameModal();
        });

        // 快捷键
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter 执行格式化
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.executeAction('json-format');
            }
            // Escape关闭弹窗
            if (e.key === 'Escape') {
                this.closeStorageDrawer();
                this.closeRenameModal();
            }
        });
    }

    // 绑定功能按钮事件（动态渲染后绑定）
    bindFunctionEvents() {
        document.querySelectorAll('.func-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset.action;
                // 记录使用次数
                await UsageStats.recordButtonClick(action);
                // 执行功能
                this.executeAction(action);
                // 检查是否需要重排（达到阈值才重排，不实时重排）
                const needResort = await UsageStats.checkNeedResort();
                if (needResort) {
                    await this.renderFunctionArea();
                    this.bindFunctionEvents();
                }
            });
        });
    }

    // 更新行号
    updateLineNumbers() {
        const lines = this.inputArea.value.split('\n');
        const lineCount = lines.length;
        let lineNumbersHtml = '';
        for (let i = 1; i <= lineCount; i++) {
            lineNumbersHtml += i + '\n';
        }
        this.inputLineNumbers.textContent = lineNumbersHtml;
    }

    // 执行功能
    async executeAction(action) {
        const input = this.inputArea.value;
        
        try {
            let result;

            switch (action) {
                // JSON工具
                case 'json-format':
                    result = JsonTools.format(input);
                    break;
                case 'json-minify':
                    result = JsonTools.minify(input);
                    break;
                case 'json-escape':
                    result = JsonTools.escape(input);
                    break;
                case 'json-unescape':
                    result = JsonTools.unescape(input);
                    break;
                case 'json-sort':
                    result = JsonTools.sortKeys(input);
                    break;
                case 'json-validate':
                    result = JsonTools.validate(input);
                    if (result.valid) {
                        this.showToast(result.message, 'success');
                        this.setStatus(result.message, 'success');
                    } else {
                        this.showToast(result.message, 'error');
                        this.setStatus(result.message, 'error');
                    }
                    return;
                case 'json-extract-keys':
                    const extractKeys = document.getElementById('json-keys-input')?.value || '';
                    result = JsonTools.extractKeys(input, extractKeys);
                    break;
                case 'json-exclude-keys':
                    const excludeKeys = document.getElementById('json-keys-input')?.value || '';
                    result = JsonTools.excludeKeys(input, excludeKeys);
                    break;

                // 编解码
                case 'url-encode':
                    result = CodecTools.urlEncode(input);
                    break;
                case 'url-decode':
                    result = CodecTools.urlDecode(input);
                    break;
                case 'unicode-encode':
                    result = CodecTools.unicodeEncode(input);
                    break;
                case 'unicode-decode':
                    result = CodecTools.unicodeDecode(input);
                    break;
                case 'gbk-encode':
                    result = CodecTools.gbkEncode(input);
                    break;
                case 'gbk-decode':
                    result = CodecTools.gbkDecode(input);
                    break;
                case 'base64-encode':
                    result = CodecTools.base64Encode(input);
                    break;
                case 'base64-decode':
                    result = CodecTools.base64Decode(input);
                    break;

                // 时间戳
                case 'ts-current':
                    result = TimestampTools.getCurrent();
                    break;
                case 'ts-to-date':
                    result = TimestampTools.timestampToDate(input);
                    break;
                case 'date-to-ts':
                    result = TimestampTools.dateToTimestamp(input);
                    break;

                // Cron
                case 'cron-linux':
                    result = CronParser.getNextTimes(input, 5, new Date(), 'linux');
                    break;
                case 'cron-spring':
                    result = CronParser.getNextTimes(input, 5, new Date(), 'spring');
                    break;
                case 'cron-quartz':
                    result = CronParser.getNextTimes(input, 5, new Date(), 'quartz');
                    break;

                default:
                    this.showToast('未知功能', 'error');
                    return;
            }

            // 处理结果
            if (result && result.success) {
                this.displayResult(result, action);
                this.setStatus('执行成功 ✓', 'success');
            } else if (result && result.error) {
                this.showError(result.error);
            }
        } catch (e) {
            this.showError(`执行出错: ${e.message}`);
        }
    }

    // 显示结果
    displayResult(result, action) {
        // 时间戳和Cron结果显示HTML
        if ((action.startsWith('ts') || action === 'date-to-ts') && result.result) {
            this.outputCode.innerHTML = TimestampTools.formatResultHtml(result.result);
            return;
        }

        if (action.startsWith('cron-') && result.result) {
            this.outputCode.innerHTML = CronParser.formatResultHtml(result.result);
            return;
        }

        // JSON高亮
        if (action.startsWith('json-') && result.highlighted) {
            this.outputCode.innerHTML = result.highlighted;
            return;
        }

        // 普通文本结果
        const text = result.result !== undefined ? 
            (typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2)) 
            : '';
        this.outputCode.textContent = text;
    }

    // 显示错误
    showError(message) {
        this.outputCode.textContent = '❌ ' + message;
        this.setStatus('执行失败 ✗', 'error');
        this.showToast(message, 'error');
    }

    // 设置状态
    setStatus(text, type = '') {
        this.status.textContent = text;
        this.status.className = 'status ' + type;
    }

    // 更新字数统计
    updateCharCount() {
        const lines = this.inputArea.value.split('\n').length;
        const chars = this.inputArea.value.length;
        this.inputCount.textContent = `${lines} 行, ${chars} 字符`;
    }

    // 复制结果
    copyResult() {
        let text = '';
        if (this.outputCode.textContent) {
            text = this.outputCode.textContent;
        }
        if (!text || text === '就绪') {
            this.showToast('没有可复制的内容', 'error');
            return;
        }
        this.copyToClipboard(text);
    }

    // 复制到剪贴板
    copyToClipboard(text) {
        if (!text) {
            this.showToast('没有可复制的内容', 'error');
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('已复制到剪贴板 ✓', 'success');
        }).catch(() => {
            // 降级方案
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('已复制到剪贴板 ✓', 'success');
        });
    }

    // 显示Toast
    showToast(message, type = '') {
        this.toast.textContent = message;
        this.toast.className = 'toast show ' + type;
        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 2000);
    }

    // ========== 存储抽屉 ==========
    openStorageDrawer() {
        this.storageDrawer.classList.add('open');
        this.drawerOverlay.classList.add('open');
        this.renderStorageList();
    }

    closeStorageDrawer() {
        this.storageDrawer.classList.remove('open');
        this.drawerOverlay.classList.remove('open');
    }

    async saveCurrentToStorage() {
        const content = this.inputArea.value;
        await this.saveContentToStorage(content, '输入内容');
    }

    async saveContentToStorage(content, prefix = '内容') {
        if (!content || !content.trim()) {
            this.showToast('内容不能为空', 'error');
            return;
        }
        const result = await StorageTools.save(content);
        if (result.success) {
            this.showToast(`保存成功！当前共 ${result.count} 条`, 'success');
            this.renderStorageList();
        }
    }

    async renderStorageList(keyword = '') {
        const items = keyword ? 
            await StorageTools.search(keyword) : 
            await StorageTools.getAll();
        
        const settings = await StorageTools.getSettings();
        this.storageList.innerHTML = StorageTools.renderListHtml(items);
        this.storageCount.textContent = `${items.length}/${settings.maxItems}`;
    }

    async loadStorageItem(id) {
        const items = await StorageTools.getAll();
        const item = items.find(i => i.id === id);
        if (item) {
            this.inputArea.value = item.content;
            this.updateLineNumbers();
            this.updateCharCount();
            this.closeStorageDrawer();
            this.showToast('已加载到输入框', 'success');
        }
    }

    async copyStorageItem(id) {
        const items = await StorageTools.getAll();
        const item = items.find(i => i.id === id);
        if (item) {
            this.copyToClipboard(item.content);
        }
    }

    async deleteStorageItem(id) {
        if (confirm('确定要删除这条记录吗？')) {
            await StorageTools.delete(id);
            this.renderStorageList(this.storageSearch.value);
            this.showToast('已删除', 'success');
        }
    }

    // ========== 重命名功能 ==========
    openRenameModal(id) {
        this.currentRenameId = id;
        this.renameModal.style.display = 'flex';
        this.renameInput.value = '';
        this.renameInput.focus();
    }

    closeRenameModal() {
        this.renameModal.style.display = 'none';
        this.currentRenameId = null;
    }

    async confirmRename() {
        if (!this.currentRenameId) return;
        const newName = this.renameInput.value.trim();
        const result = await StorageTools.rename(this.currentRenameId, newName);
        if (result.success) {
            this.showToast('重命名成功', 'success');
            this.closeRenameModal();
            this.renderStorageList(this.storageSearch.value);
        } else {
            this.showToast(result.error, 'error');
        }
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DevToolBoxApp();
});
