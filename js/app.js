/**
 * 主应用入口 v2.2
 * - 卡片式功能区布局（蓝色边框 + 左侧logo+描述 + 右侧2列按钮网格）
 * - 可拖拽分割线（输入/结果区宽度调整）
 * - 输出区行号显示
 * - 高频按钮 Google 色边框指示（top-4）
 * - 全局字号等比例缩放
 * - 使用统计埋点 + 暂存重命名 + 导入导出
 */
class DevToolBoxApp {
    constructor() {
        this.currentRenameId = null;
        // diff 模式状态: 'normal' | 'diff-edit' | 'diff-result'
        this.diffMode = 'normal';
        this.diffType = null;       // 'line' | 'word' | 'char'
        this.diffOriginalText = '';
        this.diffModifiedText = '';
        this.init();
    }

    async init() {
        this.bindElements();
        this.initTheme();
        this.initFontSize();
        this.bindGlobalEvents();
        this.initSplitter();
        this.updateLineNumbers();
        this.updateCharCount();
        await this.renderFunctionArea();
        this.bindFunctionEvents();
        await this.renderStorageList();
        // 默认进入文本比对编辑模式
        this.enterDiffEditMode('line', true);
    }

    // 绑定DOM元素
    bindElements() {
        this.inputArea = document.getElementById('input-area');
        this.inputLineNumbers = document.getElementById('input-line-numbers');
        this.outputArea = document.getElementById('output-area');
        this.outputCode = document.getElementById('output-code');
        this.outputLineNumbers = document.getElementById('output-line-numbers');
        this.status = document.getElementById('status');
        this.inputCount = document.getElementById('input-count');
        this.toast = document.getElementById('toast');
        this.functionArea = document.getElementById('function-area-container');
        this.inputPanel = document.getElementById('input-panel');
        this.outputPanel = document.getElementById('output-panel');
        this.splitter = document.getElementById('splitter');

        // 存储抽屉
        this.storageDrawer = document.getElementById('storage-drawer');
        this.drawerOverlay = document.getElementById('drawer-overlay');
        this.storageList = document.getElementById('storage-list');
        this.storageSearch = document.getElementById('storage-search');
        this.storageCount = document.getElementById('storage-count');

        // 重命名弹窗
        this.renameModal = document.getElementById('rename-modal');
        this.renameInput = document.getElementById('rename-input');

        // diff 模式元素
        this.outputTextarea = document.getElementById('output-textarea');
        this.inputDiffView = document.getElementById('input-diff-view');
        this.inputDiffCode = document.getElementById('input-diff-code');
        this.inputPanelTitle = document.getElementById('input-panel-title');
        this.outputPanelTitle = document.getElementById('output-panel-title');
        this.diffStatsWrapper = document.getElementById('diff-stats-wrapper');
        this.btnDiffReset = document.getElementById('btn-diff-reset');
    }

    // 动态渲染功能区（卡片式布局 + top-4 高频标记）
    async renderFunctionArea() {
        const rows = await UsageStats.getRowsConfig();
        const stats = await UsageStats.getStats();

        // 计算使用频率 top-4 按钮
        const allButtons = UsageStats.defaultButtons;
        const buttonCounts = allButtons.map(btn => ({
            id: btn.id,
            count: stats.buttons?.[btn.id]?.count || 0,
            order: btn.order || 0
        }));
        buttonCounts.sort((a, b) => b.count - a.count || a.order - b.order);
        const top4Ids = buttonCounts.slice(0, 4).map(b => b.id);
        const top4Map = {};
        top4Ids.forEach((id, i) => { top4Map[id] = `top-${i + 1}`; });

        let html = '';

        for (const row of rows) {
            const defaultRow = UsageStats.defaultRows.find(r => r.id === row.id);
            if (!defaultRow) continue;

            const buttons = await UsageStats.getButtonsConfig(row.id);

            // 根据按钮数量计算列数：所有块总高对齐到 3 行
            // 公式：cols = ceil(btnCount / 3)，最少 1 列
            //   1-3 个 → 1 列 3 行；4-6 个 → 2 列 3 行；7-9 个 → 3 列 3 行
            // JSON 块（8 按钮 + 输入框跨整行）：强制 4 列 → 4×2 按钮 + 1 输入框 = 3 行总高
            const btnCount = buttons.length;
            const cols = row.id === 'json' ? 4 : Math.max(1, Math.ceil(btnCount / 3));

            // 卡片式：左侧 logo+描述，右侧动态列数按钮网格
            html += `<div class="func-block" data-row-id="${row.id}">`;
            html += `<div class="func-block-info">`;
            html += `<div class="func-block-logo">${defaultRow.logo || ''}</div>`;
            html += `<div class="func-block-desc">${defaultRow.desc || defaultRow.label}</div>`;
            html += `</div>`;
            html += `<div class="func-block-btns" style="--btn-cols: ${cols}">`;

            for (const btn of buttons) {
                const defaultBtn = UsageStats.defaultButtons.find(b => b.id === btn.id);
                if (!defaultBtn) continue;
                const topClass = top4Map[btn.id] || '';
                const title = defaultBtn.title ? `title="${defaultBtn.title}"` : '';
                html += `<button class="func-btn ${topClass}" data-action="${btn.id}" ${title}>${defaultBtn.label}</button>`;
            }

            // JSON行添加Key输入框（跨整行占满）
            if (row.id === 'json') {
                html += `<input type="text" id="json-keys-input" class="func-input func-input-full" placeholder="key用逗号分隔">`;
            }

            html += `</div></div>`;
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

    // 初始化全局字号
    initFontSize() {
        const scale = parseFloat(localStorage.getItem('devtoolbox_font_scale') || '1');
        document.documentElement.style.setProperty('--font-scale', scale);
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
            if (this.diffMode === 'diff-result') {
                this.copyToClipboard(this.inputDiffCode.textContent);
            } else {
                this.copyToClipboard(this.inputArea.value);
            }
        });
        document.getElementById('btn-input-save').addEventListener('click', () => {
            const content = this.diffMode === 'diff-result' ? this.inputDiffCode.textContent : this.inputArea.value;
            this.saveContentToStorage(content, '原始文本');
        });
        document.getElementById('btn-input-clear').addEventListener('click', () => {
            if (this.diffMode === 'diff-result') {
                this.exitDiffToEdit();
            }
            this.inputArea.value = '';
            this.diffOriginalText = '';
            this.updateLineNumbers();
            this.updateCharCount();
            this.showToast('已清空原始文本', 'success');
        });

        // 输出区按钮
        document.getElementById('btn-output-copy').addEventListener('click', () => {
            this.copyResult();
        });
        document.getElementById('btn-output-save').addEventListener('click', () => {
            let content;
            if (this.diffMode === 'diff-edit') {
                content = this.outputTextarea.value;
            } else {
                content = this.outputCode.textContent;
            }
            this.saveContentToStorage(content, '结果内容');
        });
        document.getElementById('btn-output-clear').addEventListener('click', () => {
            if (this.diffMode === 'diff-edit') {
                this.outputTextarea.value = '';
                this.updateOutputLineNumbers();
                this.updateDiffEditStatus();
                this.showToast('已清空修改文本', 'success');
            } else if (this.diffMode === 'diff-result') {
                this.exitDiffToEdit();
                this.outputTextarea.value = '';
                this.updateOutputLineNumbers();
                this.updateDiffEditStatus();
                this.showToast('已清空修改文本', 'success');
            } else {
                this.outputCode.textContent = '';
                this.outputLineNumbers.textContent = '1';
                this.setStatus('已清空结果');
                this.showToast('已清空结果', 'success');
            }
        });

        // 输入框事件
        this.inputArea.addEventListener('input', () => {
            this.updateLineNumbers();
            this.updateCharCount();
        });

        this.inputArea.addEventListener('scroll', () => {
            this.inputLineNumbers.scrollTop = this.inputArea.scrollTop;
        });

        // diff 视图滚动同步行号
        this.inputDiffView.addEventListener('scroll', () => {
            this.inputLineNumbers.scrollTop = this.inputDiffView.scrollTop;
        });

        // 输出区滚动同步行号
        this.outputArea.addEventListener('scroll', () => {
            this.outputLineNumbers.scrollTop = this.outputArea.scrollTop;
        });

        // diff 模式：输出区 textarea 事件
        this.outputTextarea.addEventListener('input', () => {
            this.updateOutputLineNumbers();
            this.updateDiffEditStatus();
        });
        this.outputTextarea.addEventListener('scroll', () => {
            this.outputLineNumbers.scrollTop = this.outputTextarea.scrollTop;
        });
        this.outputTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.outputTextarea.selectionStart;
                const end = this.outputTextarea.selectionEnd;
                this.outputTextarea.value = this.outputTextarea.value.substring(0, start) + '  ' + this.outputTextarea.value.substring(end);
                this.outputTextarea.selectionStart = this.outputTextarea.selectionEnd = start + 2;
                this.updateOutputLineNumbers();
                this.updateDiffEditStatus();
            }
        });

        // diff 重新编辑按钮
        this.btnDiffReset.addEventListener('click', () => {
            this.exitDiffToEdit();
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
                // 活跃状态指示
                document.querySelectorAll('.func-btn.active').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
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

    // 更新输出区行号
    updateOutputLineNumbers() {
        let text;
        if (this.diffMode === 'diff-edit') {
            text = this.outputTextarea.value;
        } else {
            text = this.outputCode.textContent || '';
        }
        const lines = text.split('\n');
        const lineCount = lines.length;
        let html = '';
        for (let i = 1; i <= lineCount; i++) {
            html += i + '\n';
        }
        this.outputLineNumbers.textContent = html || '1';
    }

    // 初始化可拖拽分割线
    initSplitter() {
        const splitter = this.splitter;
        const inputPanel = this.inputPanel;
        const outputPanel = this.outputPanel;
        const mainContent = document.querySelector('.main-content');

        // 恢复保存的比例
        const savedRatio = localStorage.getItem('devtoolbox_split_ratio');
        if (savedRatio) {
            const ratio = parseFloat(savedRatio);
            inputPanel.style.flex = `${ratio} 1 0`;
            outputPanel.style.flex = `${1 - ratio} 1 0`;
        }

        let isDragging = false;

        const startDrag = (e) => {
            isDragging = true;
            splitter.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        };

        const onDrag = (e) => {
            if (!isDragging) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const rect = mainContent.getBoundingClientRect();
            const ratio = (clientX - rect.left) / rect.width;
            const clamped = Math.max(0.15, Math.min(0.85, ratio));
            inputPanel.style.flex = `${clamped} 1 0`;
            outputPanel.style.flex = `${1 - clamped} 1 0`;
        };

        const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            splitter.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            // 保存比例
            const rect = mainContent.getBoundingClientRect();
            const inputRect = inputPanel.getBoundingClientRect();
            const ratio = inputRect.width / rect.width;
            localStorage.setItem('devtoolbox_split_ratio', ratio);
        };

        splitter.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', endDrag);

        // 触摸支持
        splitter.addEventListener('touchstart', startDrag, { passive: false });
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('touchend', endDrag);
    }

    // 执行功能
    async executeAction(action) {
        // diff 模式路由
        if (action.startsWith('diff-')) {
            this.executeDiffCompare(action.replace('diff-', ''));
            return;
        }

        // 非 diff 按钮：如果当前在 diff 模式，先退出
        if (this.diffMode !== 'normal') {
            this.exitDiffMode();
        }

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

                // SQL处理
                case 'sql-format':
                    result = SqlTools.format(input);
                    break;
                case 'sql-clean':
                    result = SqlTools.clean(input);
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
            this.updateOutputLineNumbers();
            return;
        }

        if (action.startsWith('cron-') && result.result) {
            this.outputCode.innerHTML = CronParser.formatResultHtml(result.result);
            this.updateOutputLineNumbers();
            return;
        }

        // JSON高亮
        if (action.startsWith('json-') && result.highlighted) {
            this.outputCode.innerHTML = result.highlighted;
            this.updateOutputLineNumbers();
            return;
        }

        // SQL高亮
        if (action.startsWith('sql-') && result.highlighted) {
            this.outputCode.innerHTML = result.highlighted;
            this.updateOutputLineNumbers();
            return;
        }

        // 普通文本结果
        const text = result.result !== undefined ? 
            (typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2)) 
            : '';
        this.outputCode.textContent = text;
        this.updateOutputLineNumbers();
    }

    // 显示错误
    showError(message) {
        this.outputCode.textContent = '❌ ' + message;
        this.updateOutputLineNumbers();
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
        if (this.diffMode === 'diff-edit') {
            text = this.outputTextarea.value;
        } else if (this.diffMode === 'diff-result') {
            text = this.outputCode.textContent;
        } else if (this.outputCode.textContent) {
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

    // ========== 文本比对（Diff）模式 ==========

    _diffTypeLabel(type) {
        return type === 'line' ? '行比对' : type === 'word' ? '词比对' : '字符比对';
    }

    // diff 比对主入口
    executeDiffCompare(type) {
        if (this.diffMode === 'normal') {
            // 首次点击：进入 diff 编辑模式
            this.enterDiffEditMode(type);
            this.showToast(`已进入文本比对模式，请输入文本后再次点击「${this._diffTypeLabel(type)}」`, 'success');
            return;
        }

        if (this.diffMode === 'diff-edit') {
            // 编辑态 → 计算并渲染 diff
            this.diffOriginalText = this.inputArea.value;
            this.diffModifiedText = this.outputTextarea.value;

            if (!this.diffOriginalText.trim() && !this.diffModifiedText.trim()) {
                this.showToast('请先输入要比对的文本', 'error');
                return;
            }

            this.diffType = type;
            this.renderDiffResult();
            return;
        }

        if (this.diffMode === 'diff-result') {
            // 结果态 → 切换比对类型重新计算
            this.diffType = type;
            this.renderDiffResult();
            return;
        }
    }

    // 进入 diff 编辑模式
    enterDiffEditMode(type, isInitial = false) {
        this.diffMode = 'diff-edit';
        this.diffType = type;

        // 保存当前输入区内容
        this.diffOriginalText = this.inputArea.value;
        this.diffModifiedText = '';

        // 输出区：隐藏 pre/code，显示 textarea
        this.outputTextarea.style.display = '';
        this.outputArea.style.display = 'none';
        this.outputTextarea.value = '';

        // 输入区：保持 textarea 可见，隐藏 diff 视图
        this.inputArea.style.display = '';
        this.inputDiffView.style.display = 'none';

        // 更新 placeholder
        this.inputArea.placeholder = '在此输入原始文本...';
        this.outputTextarea.placeholder = '在此输入修改后的文本...\n\n输入完成后，点击上方「行比对」「词比对」「字符比对」按钮查看差异';

        // 更新 panel 标题
        this.inputPanelTitle.textContent = '📝 原始文本';
        this.inputPanelTitle.classList.add('diff-mode');
        this.outputPanelTitle.textContent = '✏️ 修改文本';
        this.outputPanelTitle.classList.add('diff-mode');

        // 隐藏重新编辑按钮，隐藏统计栏
        this.btnDiffReset.style.display = 'none';
        this.diffStatsWrapper.style.display = 'none';
        this.diffStatsWrapper.innerHTML = '';

        // 更新行号和状态
        this.updateLineNumbers();
        this.updateCharCount();
        this.updateOutputLineNumbers();
        this.updateDiffEditStatus();

        // 聚焦：初始加载聚焦输入区，按钮触发聚焦输出区
        if (isInitial) {
            this.inputArea.focus();
        } else {
            this.outputTextarea.focus();
        }
    }

    // 渲染 diff 结果
    renderDiffResult() {
        const result = DiffTools.compare(
            this.diffOriginalText,
            this.diffModifiedText,
            this.diffType
        );

        this.diffMode = 'diff-result';

        // 输入区：隐藏 textarea，显示 diff 视图
        this.inputArea.style.display = 'none';
        this.inputDiffView.style.display = '';
        this.inputDiffCode.innerHTML = result.leftHtml;

        // 输出区：隐藏 textarea，显示 pre/code
        this.outputTextarea.style.display = 'none';
        this.outputArea.style.display = '';
        this.outputCode.innerHTML = result.rightHtml;

        // 显示统计栏
        this.diffStatsWrapper.style.display = '';
        this.diffStatsWrapper.innerHTML = DiffTools.renderStatsBar(result.stats, result.typeLabel);

        // 显示重新编辑按钮
        this.btnDiffReset.style.display = '';

        // 更新 panel 标题
        this.inputPanelTitle.textContent = `📝 原始文本（${result.typeLabel}）`;
        this.outputPanelTitle.textContent = `✏️ 修改文本（${result.typeLabel}）`;

        // 更新行号
        this.updateOutputLineNumbers();
        this.updateInputDiffLineNumbers();

        // 更新状态
        const total = result.stats.additions + result.stats.deletions + result.stats.equals;
        this.setStatus(`${result.typeLabel}: +${result.stats.additions} -${result.stats.deletions} =${result.stats.equals}`, 'success');
    }

    // 重新编辑：从结果态回到编辑态
    exitDiffToEdit() {
        this.diffMode = 'diff-edit';

        // 输入区：显示 textarea，隐藏 diff 视图
        this.inputArea.style.display = '';
        this.inputDiffView.style.display = 'none';
        this.inputArea.value = this.diffOriginalText;

        // 输出区：显示 textarea，隐藏 pre/code
        this.outputTextarea.style.display = '';
        this.outputArea.style.display = 'none';
        this.outputTextarea.value = this.diffModifiedText;

        // 隐藏重新编辑按钮，隐藏统计栏
        this.btnDiffReset.style.display = 'none';
        this.diffStatsWrapper.style.display = 'none';
        this.diffStatsWrapper.innerHTML = '';

        // 更新 panel 标题
        this.inputPanelTitle.textContent = '📝 原始文本';
        this.outputPanelTitle.textContent = '✏️ 修改文本';

        // 更新行号和状态
        this.updateLineNumbers();
        this.updateCharCount();
        this.updateOutputLineNumbers();
        this.updateDiffEditStatus();

        this.showToast('已切换到编辑模式', 'success');
        this.inputArea.focus();
    }

    // 退出 diff 模式（点击非 diff 按钮时调用）
    exitDiffMode() {
        this.diffMode = 'normal';
        this.diffType = null;

        // 输入区：恢复 textarea，隐藏 diff 视图
        this.inputArea.style.display = '';
        this.inputDiffView.style.display = 'none';

        // 输出区：恢复 pre/code，隐藏 textarea
        this.outputTextarea.style.display = 'none';
        this.outputArea.style.display = '';

        // 恢复 placeholder
        this.inputArea.placeholder = '在此输入内容...\n\n支持JSON格式化、各类编解码、时间戳转换、Cron解析、SQL美化等功能\n点击上方按钮即可执行对应操作';

        // 恢复 panel 标题
        this.inputPanelTitle.textContent = '📝 输入';
        this.inputPanelTitle.classList.remove('diff-mode');
        this.outputPanelTitle.textContent = '✅ 结果';
        this.outputPanelTitle.classList.remove('diff-mode');

        // 隐藏重新编辑按钮和统计栏
        this.btnDiffReset.style.display = 'none';
        this.diffStatsWrapper.style.display = 'none';
        this.diffStatsWrapper.innerHTML = '';

        // 清空 diff 视图内容
        this.inputDiffCode.innerHTML = '';
        this.outputCode.innerHTML = '';

        // 更新行号
        this.updateLineNumbers();
        this.updateCharCount();
        this.updateOutputLineNumbers();
        this.setStatus('就绪');
    }

    // diff 编辑态状态更新
    updateDiffEditStatus() {
        const lines = this.outputTextarea.value.split('\n').length;
        const chars = this.outputTextarea.value.length;
        this.setStatus(`${lines} 行, ${chars} 字符`);
    }

    // 更新输入区 diff 视图行号
    updateInputDiffLineNumbers() {
        // diff 结果的行号基于 diff-line span 数量或文本行数
        const text = this.inputDiffCode.textContent || '';
        const lines = text.split('\n');
        let html = '';
        for (let i = 1; i <= lines.length; i++) {
            html += i + '\n';
        }
        this.inputLineNumbers.textContent = html || '1';
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DevToolBoxApp();
});
