/**
 * 设置页面逻辑 v1.3.5
 * 独立外部JS文件，符合Manifest V3 CSP要求
 * 优化：功能行整体拖拽，按钮排序弹窗
 */
class SettingsPage {
    constructor() {
        this.draggedElement = null;
        this.currentEditingRow = null; // 当前正在编辑按钮的行ID
        this.tempButtonsConfig = null; // 弹窗里临时的按钮配置
        this.init();
    }

    async init() {
        if (typeof UsageStats === 'undefined' || typeof StorageTools === 'undefined') {
            setTimeout(() => this.init(), 100);
            return;
        }
        await this.loadSettings();
        this.bindEvents();
        this.bindModalEvents();
        this.bindAutoSortToggle();
    }

    async loadSettings() {
        const storageSettings = await StorageTools.getSettings();
        document.getElementById('max-items').value = storageSettings.maxItems;
        document.getElementById('max-size').value = (storageSettings.maxSize / 1048576).toFixed(1);

        const stats = await UsageStats.getStats();
        document.getElementById('auto-sort').checked = stats.autoSort !== false;
        document.getElementById('sort-threshold').value = stats.sortThreshold || 100;

        await this.renderRowSortList();
        this.updateSortTip();
    }

    updateSortTip() {
        const autoSort = document.getElementById('auto-sort').checked;
        const tip = document.getElementById('sort-tip');
        if (autoSort) {
            tip.innerHTML = '💡 已开启自动排序：功能将按使用频率自动排序，使用越多越靠前。关闭自动排序后可拖拽功能行调整顺序，点击「按钮排序」调整每行按钮。';
        } else {
            tip.innerHTML = '💡 已关闭自动排序：可拖拽 ⋮⋮ 图标调整功能行整体顺序，点击每行的「按钮排序」按钮，在弹窗中点击按钮调整顺序和显示隐藏。';
        }
    }

    bindAutoSortToggle() {
        document.getElementById('auto-sort').addEventListener('change', () => {
            this.updateSortTip();
        });
    }

    async renderRowSortList() {
        const stats = await UsageStats.getStats();
        const customRows = stats.customRows || [...UsageStats.defaultRows];
        const customButtons = stats.customButtons || [...UsageStats.defaultButtons];

        customRows.sort((a, b) => (a.order || 0) - (b.order || 0));

        const container = document.getElementById('rows-sort-list');
        container.innerHTML = '';

        for (let rowIndex = 0; rowIndex < customRows.length; rowIndex++) {
            const row = customRows[rowIndex];
            const defaultRow = UsageStats.defaultRows.find(r => r.id === row.id);
            if (!defaultRow) continue;

            const rowCount = stats.rows[row.id]?.count || 0;
            const rowButtons = customButtons.filter(b => b.row === row.id);
            const visibleCount = rowButtons.filter(b => b.visible !== false).length;

            const rowEl = document.createElement('div');
            rowEl.className = 'sort-item';
            rowEl.draggable = true;
            rowEl.dataset.rowId = row.id;
            rowEl.dataset.type = 'row';
            rowEl.innerHTML = `
                <span class="drag-handle">⋮⋮</span>
                <span class="sort-item-name">${defaultRow.label}</span>
                <span class="sort-item-count">使用 ${rowCount} 次 · 显示 ${visibleCount}/${rowButtons.length} 个按钮</span>
                <button class="btn-sort-buttons" data-row-id="${row.id}">按钮排序</button>
                <label class="switch">
                    <input type="checkbox" class="row-visible" ${row.visible !== false ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            `;

            this.bindDragEvents(rowEl);
            container.appendChild(rowEl);
        }

        // 绑定按钮排序点击事件
        container.querySelectorAll('.btn-sort-buttons').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openButtonSortModal(btn.dataset.rowId);
            });
        });
    }

    async openButtonSortModal(rowId) {
        this.currentEditingRow = rowId;
        const stats = await UsageStats.getStats();
        this.currentStats = stats; // 保存当前stats用于显示使用次数
        const defaultRow = UsageStats.defaultRows.find(r => r.id === rowId);
        const customButtons = stats.customButtons || [...UsageStats.defaultButtons];
        
        // 获取该行的按钮，按order排序
        this.tempButtonsConfig = customButtons
            .filter(b => b.row === rowId)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(b => ({...b})); // 深拷贝

        document.getElementById('modal-title').textContent = `${defaultRow.label} 按钮排序`;
        this.renderModalButtonList();
        document.getElementById('button-sort-modal').classList.add('show');
    }

    renderModalButtonList() {
        const stats = this.currentStats || { buttons: {} };
        const container = document.getElementById('modal-buttons-list');
        container.innerHTML = '';

        for (let index = 0; index < this.tempButtonsConfig.length; index++) {
            const btn = this.tempButtonsConfig[index];
            const defaultBtn = UsageStats.defaultButtons.find(b => b.id === btn.id);
            if (!defaultBtn) continue;
            const btnCount = stats.buttons?.[btn.id]?.count || 0;
            const isFirst = index === 0;
            const isLast = index === this.tempButtonsConfig.length - 1;
            
            const btnEl = document.createElement('div');
            btnEl.className = 'sub-item';
            btnEl.dataset.btnId = btn.id;
            btnEl.innerHTML = `
                <span class="item-name">${defaultBtn.label}</span>
                <span class="item-count">使用 ${btnCount} 次</span>
                <div class="sort-btn-group">
                    <button class="sort-btn" data-action="top" data-index="${index}" title="置顶" ${isFirst ? 'disabled' : ''}>⏫</button>
                    <button class="sort-btn" data-action="up" data-index="${index}" title="上移" ${isFirst ? 'disabled' : ''}>⬆️</button>
                    <button class="sort-btn" data-action="down" data-index="${index}" title="下移" ${isLast ? 'disabled' : ''}>⬇️</button>
                    <button class="sort-btn" data-action="bottom" data-index="${index}" title="置底" ${isLast ? 'disabled' : ''}>⏬</button>
                </div>
                <label class="switch">
                    <input type="checkbox" class="btn-visible" ${btn.visible !== false ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            `;
            container.appendChild(btnEl);
        }

        // 绑定排序按钮事件
        container.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const index = parseInt(btn.dataset.index);
                this.moveButton(index, action);
            });
        });
    }

    moveButton(index, action) {
        const arr = this.tempButtonsConfig;
        const item = arr[index];
        
        switch(action) {
            case 'top':
                arr.splice(index, 1);
                arr.unshift(item);
                break;
            case 'up':
                if (index > 0) {
                    arr.splice(index, 1);
                    arr.splice(index - 1, 0, item);
                }
                break;
            case 'down':
                if (index < arr.length - 1) {
                    arr.splice(index, 1);
                    arr.splice(index + 1, 0, item);
                }
                break;
            case 'bottom':
                arr.splice(index, 1);
                arr.push(item);
                break;
        }
        
        this.renderModalButtonList();
    }

    closeModal() {
        document.getElementById('button-sort-modal').classList.remove('show');
        this.currentEditingRow = null;
        this.tempButtonsConfig = null;
    }

    bindModalEvents() {
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-cancel').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-confirm').addEventListener('click', () => {
            this.saveModalButtonConfig();
            this.closeModal();
        });
        // 点击遮罩关闭
        document.getElementById('button-sort-modal').addEventListener('click', (e) => {
            if (e.target.id === 'button-sort-modal') {
                this.closeModal();
            }
        });
        // Esc关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentEditingRow) {
                this.closeModal();
            }
        });
    }

    saveModalButtonConfig() {
        if (!this.currentEditingRow || !this.tempButtonsConfig) return;
        
        // 从DOM读取开关状态
        const container = document.getElementById('modal-buttons-list');
        const buttonEls = container.querySelectorAll('.sub-item');
        
        buttonEls.forEach((el, index) => {
            const btnId = el.dataset.btnId;
            const btnConfig = this.tempButtonsConfig.find(b => b.id === btnId);
            if (btnConfig) {
                btnConfig.visible = el.querySelector('.btn-visible').checked;
            }
        });

        // 更新临时配置，保存时统一写入
        this.updatedRowButtons = this.updatedRowButtons || {};
        this.updatedRowButtons[this.currentEditingRow] = [...this.tempButtonsConfig];
        
        // 更新显示的数量
        this.renderRowSortList();
        this.showToast('按钮配置已更新，记得点击保存设置生效', 'success');
    }

    bindDragEvents(el) {
        el.addEventListener('dragstart', (e) => {
            this.draggedElement = el;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => el.classList.add('dragging'), 0);
        });

        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            document.querySelectorAll('.sort-item, .sub-item').forEach(item => {
                item.classList.remove('drag-over');
            });
            this.draggedElement = null;
        });

        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!this.draggedElement) return;
            
            // 只能同类型拖拽
            if (el.dataset.type !== this.draggedElement.dataset.type) return;
            
            // 弹窗里的按钮拖拽只能在弹窗内
            if (this.draggedElement.dataset.type === 'button') {
                const inModal = el.closest('#modal-buttons-list');
                const draggedInModal = this.draggedElement.closest('#modal-buttons-list');
                if (!inModal || !draggedInModal) return;
            }
            
            e.dataTransfer.dropEffect = 'move';
            el.classList.add('drag-over');
        });

        el.addEventListener('dragleave', () => {
            el.classList.remove('drag-over');
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
            el.classList.remove('drag-over');
            
            if (!this.draggedElement || el === this.draggedElement) return;
            if (el.dataset.type !== this.draggedElement.dataset.type) return;

            // 按钮只能在弹窗内排序
            if (this.draggedElement.dataset.type === 'button') {
                const inModal = el.closest('#modal-buttons-list');
                const draggedInModal = this.draggedElement.closest('#modal-buttons-list');
                if (!inModal || !draggedInModal) return;
            }

            // 交换位置
            const parent = el.parentNode;
            const children = Array.from(parent.children);
            const draggedIndex = children.indexOf(this.draggedElement);
            const dropIndex = children.indexOf(el);

            if (draggedIndex < dropIndex) {
                parent.insertBefore(this.draggedElement, el.nextSibling);
            } else {
                parent.insertBefore(this.draggedElement, el);
            }
        });
    }

    bindEvents() {
        document.getElementById('btn-save').addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('btn-export').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('btn-import').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        document.getElementById('import-file').addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
        });

        document.getElementById('btn-reset-stats').addEventListener('click', async () => {
            if (confirm('确定要重置所有使用统计数据吗？')) {
                await UsageStats.resetStats();
                this.showToast('使用统计已重置', 'success');
                await this.renderRowSortList();
            }
        });

        document.getElementById('btn-reset-all').addEventListener('click', async () => {
            if (confirm('确定要恢复所有默认设置吗？暂存数据会保留。')) {
                await UsageStats.resetAll();
                this.updatedRowButtons = null;
                this.showToast('已恢复默认设置', 'success');
                await this.loadSettings();
            }
        });
    }

    async saveSettings() {
        try {
            // 保存暂存设置
            const maxItems = parseInt(document.getElementById('max-items').value) || 100;
            const maxSizeMB = parseFloat(document.getElementById('max-size').value) || 1;
            await StorageTools.saveSettings({
                maxItems: Math.max(10, Math.min(500, maxItems)),
                maxSize: Math.floor(maxSizeMB * 1048576)
            });

            // 保存自动排序设置
            const autoSort = document.getElementById('auto-sort').checked;
            await UsageStats.setAutoSort(autoSort);

            // 保存排序阈值
            const sortThreshold = parseInt(document.getElementById('sort-threshold').value) || 100;
            await UsageStats.setSortThreshold(sortThreshold);

            // 保存功能行顺序和显示状态
            const customRows = [];
            document.querySelectorAll('#rows-sort-list > .sort-item').forEach((rowEl, index) => {
                const rowId = rowEl.dataset.rowId;
                const visible = rowEl.querySelector('.row-visible').checked;
                customRows.push({ id: rowId, order: index, visible: visible });
            });
            await UsageStats.saveRowsConfig(customRows);

            // 保存按钮配置：合并弹窗修改的和其他行的
            const stats = await UsageStats.getStats();
            let customButtons = stats.customButtons ? [...stats.customButtons] : [...UsageStats.defaultButtons];
            
            // 如果有弹窗修改的按钮配置，更新对应行
            if (this.updatedRowButtons) {
                for (const [rowId, buttons] of Object.entries(this.updatedRowButtons)) {
                    // 移除该行旧的按钮配置
                    customButtons = customButtons.filter(b => b.row !== rowId);
                    // 添加新的配置
                    customButtons.push(...buttons);
                }
            }
            
            // 重新计算全局order
            let btnOrder = 0;
            for (const row of customRows) {
                const rowButtons = customButtons.filter(b => b.row === row.id).sort((a, b) => (a.order || 0) - (b.order || 0));
                for (const btn of rowButtons) {
                    btn.order = btnOrder++;
                }
            }
            
            await UsageStats.saveButtonsConfig(customButtons);
            this.updatedRowButtons = null;

            this.showToast('设置保存成功！', 'success');
        } catch (e) {
            this.showToast('保存失败: ' + e.message, 'error');
            console.error(e);
        }
    }

    async exportData() {
        try {
            const storageData = await StorageTools.exportStorage();
            const usageData = await UsageStats.export();
            
            const data = {
                version: '1.3.5',
                exportTime: Date.now(),
                data: { ...storageData, usage: usageData }
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `DevToolBox-backup-${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast('导出成功！', 'success');
        } catch (e) {
            this.showToast('导出失败: ' + e.message, 'error');
            console.error(e);
        }
    }

    async importData(file) {
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const merge = confirm('是否合并现有数据？\n点击"确定"合并，点击"取消"覆盖现有数据。');
            
            if (data.data) {
                await StorageTools.importStorage(data.data, merge);
                if (data.data.usage) {
                    await UsageStats.import(data.data.usage, merge);
                }
                this.updatedRowButtons = null;
                this.showToast('导入成功！', 'success');
                await this.loadSettings();
            } else {
                this.showToast('无效的备份文件格式', 'error');
            }
        } catch (e) {
            this.showToast('导入失败: ' + e.message, 'error');
            console.error(e);
        }
        document.getElementById('import-file').value = '';
    }

    showToast(message, type = '') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast show ' + type;
        setTimeout(() => { toast.classList.remove('show'); }, 2000);
    }
}

window.addEventListener('load', () => {
    window.settings = new SettingsPage();
});
