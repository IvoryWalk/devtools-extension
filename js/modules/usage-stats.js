/**
 * 使用统计模块 v1.3
 * 统计功能行和按钮的使用次数，持久化到chrome.storage
 * 支持按使用频率排序
 */
const UsageStats = {
    STATS_KEY: 'devtoolbox_usage_stats',

    // 默认功能行定义
    defaultRows: [
        { id: 'json', label: '📋 JSON：', order: 0, visible: true },
        { id: 'codec', label: '🔐 编解码：', order: 1, visible: true },
        { id: 'timestamp', label: '⏰ 时间戳：', order: 2, visible: true },
        { id: 'cron', label: '⏱️ Cron：', order: 3, visible: true }
    ],

    // 默认按钮定义
    defaultButtons: [
        // JSON行
        { id: 'json-format', row: 'json', label: '格式化', order: 0, visible: true, primary: true },
        { id: 'json-minify', row: 'json', label: '压缩', order: 1, visible: true },
        { id: 'json-escape', row: 'json', label: '转义', order: 2, visible: true },
        { id: 'json-unescape', row: 'json', label: '去转义', order: 3, visible: true },
        { id: 'json-sort', row: 'json', label: 'Key排序', order: 4, visible: true },
        { id: 'json-validate', row: 'json', label: '验证', order: 5, visible: true },
        { id: 'json-extract-keys', row: 'json', label: '提取Key', order: 6, visible: true },
        { id: 'json-exclude-keys', row: 'json', label: '排除Key', order: 7, visible: true },
        
        // 编解码行
        { id: 'url-encode', row: 'codec', label: 'URL编码', order: 0, visible: true },
        { id: 'url-decode', row: 'codec', label: 'URL解码', order: 1, visible: true },
        { id: 'unicode-encode', row: 'codec', label: 'Unicode编码', order: 2, visible: true },
        { id: 'unicode-decode', row: 'codec', label: 'Unicode解码', order: 3, visible: true },
        { id: 'base64-encode', row: 'codec', label: 'Base64编码', order: 4, visible: true },
        { id: 'base64-decode', row: 'codec', label: 'Base64解码', order: 5, visible: true },
        
        // 时间戳行
        { id: 'ts-current', row: 'timestamp', label: '获取当前时间', order: 0, visible: true },
        { id: 'ts-to-date', row: 'timestamp', label: '时间戳→日期', order: 1, visible: true },
        { id: 'date-to-ts', row: 'timestamp', label: '日期→时间戳', order: 2, visible: true },
        
        // Cron行
        { id: 'cron-linux', row: 'cron', label: 'Linux Cron', order: 0, visible: true },
        { id: 'cron-spring', row: 'cron', label: 'Spring Cron', order: 1, visible: true },
        { id: 'cron-quartz', row: 'cron', label: 'Quartz Cron', order: 2, visible: true }
    ],

    // 获取统计数据
    async getStats() {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get(this.STATS_KEY, (result) => {
                    const stats = result[this.STATS_KEY] || { 
                        rows: {}, 
                        buttons: {}, 
                        customRows: null, 
                        customButtons: null, 
                        autoSort: true,
                        sortThreshold: 100,  // 默认每100次点击重排一次
                        clickCount: 0,       // 当前点击计数
                        needResort: false    // 是否需要重排
                    };
                    // 初始化默认值
                    if (!stats.rows) stats.rows = {};
                    if (!stats.buttons) stats.buttons = {};
                    if (stats.autoSort === undefined) stats.autoSort = true;
                    if (stats.sortThreshold === undefined) stats.sortThreshold = 100;
                    if (stats.clickCount === undefined) stats.clickCount = 0;
                    if (stats.needResort === undefined) stats.needResort = false;
                    resolve(stats);
                });
            } catch (e) {
                const stats = JSON.parse(localStorage.getItem(this.STATS_KEY) || '{"rows":{},"buttons":{}}');
                stats.autoSort = stats.autoSort !== false;
                stats.sortThreshold = stats.sortThreshold || 100;
                stats.clickCount = stats.clickCount || 0;
                stats.needResort = stats.needResort || false;
                resolve(stats);
            }
        });
    },

    // 保存统计数据
    async saveStats(stats) {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.set({ [this.STATS_KEY]: stats }, resolve);
            } catch (e) {
                localStorage.setItem(this.STATS_KEY, JSON.stringify(stats));
                resolve();
            }
        });
    },

    // 记录按钮使用
    async recordButtonClick(buttonId) {
        const stats = await this.getStats();
        const button = this.defaultButtons.find(b => b.id === buttonId);
        if (!button) return;

        // 记录按钮使用次数
        if (!stats.buttons[buttonId]) {
            stats.buttons[buttonId] = { count: 0, lastUsed: null };
        }
        stats.buttons[buttonId].count++;
        stats.buttons[buttonId].lastUsed = Date.now();

        // 记录功能行使用次数
        const rowId = button.row;
        if (!stats.rows[rowId]) {
            stats.rows[rowId] = { count: 0, lastUsed: null };
        }
        stats.rows[rowId].count++;
        stats.rows[rowId].lastUsed = Date.now();

        // 点击计数，达到阈值标记需要重排
        stats.clickCount++;
        if (stats.clickCount >= stats.sortThreshold) {
            stats.needResort = true;
            stats.clickCount = 0;
        }

        await this.saveStats(stats);
    },

    // 检查是否需要重排，调用后重置标记
    async checkNeedResort() {
        const stats = await this.getStats();
        if (stats.needResort) {
            stats.needResort = false;
            await this.saveStats(stats);
            return true;
        }
        return false;
    },

    // 设置排序阈值
    async setSortThreshold(threshold) {
        const stats = await this.getStats();
        stats.sortThreshold = Math.max(10, Math.min(1000, threshold));
        await this.saveStats(stats);
    },

    // 获取功能行配置（合并自定义配置，按使用频率排序）
    async getRowsConfig() {
        const stats = await this.getStats();
        let rows = stats.customRows ? [...stats.customRows] : [...this.defaultRows];
        
        // 自动按使用频率排序
        if (stats.autoSort !== false) {
            rows.sort((a, b) => {
                const countA = stats.rows[a.id]?.count || 0;
                const countB = stats.rows[b.id]?.count || 0;
                if (countB !== countA) return countB - countA;
                return a.order - b.order;
            });
        } else {
            // 手动排序：按order字段排序
            rows.sort((a, b) => (a.order || 0) - (b.order || 0));
        }

        return rows.filter(r => r.visible !== false);
    },

    // 获取按钮配置（按行分组，按使用频率排序）
    async getButtonsConfig(rowId) {
        const stats = await this.getStats();
        let buttons = stats.customButtons ? 
            stats.customButtons.filter(b => b.row === rowId) : 
            this.defaultButtons.filter(b => b.row === rowId);
        
        // 自动按使用频率排序
        if (stats.autoSort !== false) {
            buttons.sort((a, b) => {
                const countA = stats.buttons[a.id]?.count || 0;
                const countB = stats.buttons[b.id]?.count || 0;
                if (countB !== countA) return countB - countA;
                return a.order - b.order;
            });
        } else {
            // 手动排序：按order字段排序
            buttons.sort((a, b) => (a.order || 0) - (b.order || 0));
        }

        return buttons.filter(b => b.visible !== false);
    },

    // 获取所有按钮配置
    async getAllButtonsConfig() {
        const stats = await this.getStats();
        return stats.customButtons ? [...stats.customButtons] : [...this.defaultButtons];
    },

    // 保存自定义行配置
    async saveRowsConfig(rows) {
        const stats = await this.getStats();
        stats.customRows = rows;
        await this.saveStats(stats);
    },

    // 保存自定义按钮配置
    async saveButtonsConfig(buttons) {
        const stats = await this.getStats();
        stats.customButtons = buttons;
        await this.saveStats(stats);
    },

    // 设置自动排序
    async setAutoSort(enabled) {
        const stats = await this.getStats();
        stats.autoSort = enabled;
        await this.saveStats(stats);
    },

    // 获取按钮使用次数
    async getButtonCount(buttonId) {
        const stats = await this.getStats();
        return stats.buttons[buttonId]?.count || 0;
    },

    // 获取功能行使用次数
    async getRowCount(rowId) {
        const stats = await this.getStats();
        return stats.rows[rowId]?.count || 0;
    },

    // 重置统计数据
    async resetStats() {
        const stats = await this.getStats();
        stats.rows = {};
        stats.buttons = {};
        await this.saveStats(stats);
    },

    // 重置所有配置（恢复默认）
    async resetAll() {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.remove(this.STATS_KEY, resolve);
            } catch (e) {
                localStorage.removeItem(this.STATS_KEY);
                resolve();
            }
        });
    },

    // 导出统计数据
    async export() {
        const stats = await this.getStats();
        return {
            rows: stats.rows,
            buttons: stats.buttons,
            customRows: stats.customRows,
            customButtons: stats.customButtons,
            autoSort: stats.autoSort
        };
    },

    // 导入统计数据
    async import(data, merge = true) {
        const current = await this.getStats();
        
        if (merge) {
            // 合并使用次数
            if (data.rows) {
                for (const [rowId, rowData] of Object.entries(data.rows)) {
                    if (!current.rows[rowId]) {
                        current.rows[rowId] = { count: 0, lastUsed: null };
                    }
                    current.rows[rowId].count += rowData.count || 0;
                    if (rowData.lastUsed && (!current.rows[rowId].lastUsed || rowData.lastUsed > current.rows[rowId].lastUsed)) {
                        current.rows[rowId].lastUsed = rowData.lastUsed;
                    }
                }
            }
            if (data.buttons) {
                for (const [btnId, btnData] of Object.entries(data.buttons)) {
                    if (!current.buttons[btnId]) {
                        current.buttons[btnId] = { count: 0, lastUsed: null };
                    }
                    current.buttons[btnId].count += btnData.count || 0;
                    if (btnData.lastUsed && (!current.buttons[btnId].lastUsed || btnData.lastUsed > current.buttons[btnId].lastUsed)) {
                        current.buttons[btnId].lastUsed = btnData.lastUsed;
                    }
                }
            }
            // 自定义配置优先用导入的
            if (data.customRows) current.customRows = data.customRows;
            if (data.customButtons) current.customButtons = data.customButtons;
            if (data.autoSort !== undefined) current.autoSort = data.autoSort;
        } else {
            // 覆盖
            current.rows = data.rows || {};
            current.buttons = data.buttons || {};
            current.customRows = data.customRows;
            current.customButtons = data.customButtons;
            current.autoSort = data.autoSort !== false;
        }

        await this.saveStats(current);
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UsageStats;
}
