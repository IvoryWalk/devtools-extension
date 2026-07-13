/**
 * 数据暂存模块 v1.3.2
 * - chrome.storage.local持久化存储
 * - 支持重命名
 * - 可配置条数和容量限制
 * - 支持搜索
 * - 不依赖其他模块，避免加载顺序问题
 */
const StorageTools = {
    STORAGE_KEY: 'devtoolbox_snippets',
    SETTINGS_KEY: 'devtoolbox_settings',
    
    // 默认配置
    defaultSettings: {
        maxItems: 100,      // 默认100条
        maxSize: 1048576    // 默认1M容量
    },

    // 生成摘要（取前50个字符）
    generateSummary(content) {
        if (!content) return '空内容';
        // 去除换行和多余空格
        const clean = content.replace(/\s+/g, ' ').trim();
        if (clean.length <= 50) return clean;
        return clean.substring(0, 50) + '...';
    },

    // 获取配置
    async getSettings() {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get(this.SETTINGS_KEY, (result) => {
                    const settings = { ...this.defaultSettings, ...(result[this.SETTINGS_KEY] || {}) };
                    resolve(settings);
                });
            } catch (e) {
                const settings = { ...this.defaultSettings, ...(JSON.parse(localStorage.getItem(this.SETTINGS_KEY) || '{}')) };
                resolve(settings);
            }
        });
    },

    // 保存配置
    async saveSettings(settings) {
        const merged = { ...this.defaultSettings, ...settings };
        return new Promise((resolve) => {
            try {
                chrome.storage.local.set({ [this.SETTINGS_KEY]: merged }, () => {
                    resolve({ success: true, settings: merged });
                });
            } catch (e) {
                localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(merged));
                resolve({ success: true, settings: merged });
            }
        });
    },

    // 计算存储大小（字节）
    calculateSize(items) {
        return new Blob([JSON.stringify(items)]).size;
    },

    // 获取所有暂存项
    async getAll() {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get(this.STORAGE_KEY, (result) => {
                    const items = result[this.STORAGE_KEY] || [];
                    // 按时间倒序
                    resolve(items.sort((a, b) => b.createTime - a.createTime));
                });
            } catch (e) {
                // 降级到localStorage
                const items = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
                resolve(items.sort((a, b) => b.createTime - a.createTime));
            }
        });
    },

    // 保存新项
    async save(content, name = null) {
        if (!content || !content.trim()) {
            return { success: false, error: '内容不能为空' };
        }

        const settings = await this.getSettings();
        const items = await this.getAll();
        
        const newItem = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            content: content,
            name: name,
            summary: name || this.generateSummary(content),
            createTime: Date.now(),
            updateTime: Date.now()
        };

        // 添加到开头
        items.unshift(newItem);

        // 超过最大数量时删除最旧的
        while (items.length > settings.maxItems) {
            items.pop();
        }

        // 超过容量时删除最旧的
        while (this.calculateSize(items) > settings.maxSize && items.length > 0) {
            items.pop();
        }

        return new Promise((resolve) => {
            try {
                chrome.storage.local.set({ [this.STORAGE_KEY]: items }, () => {
                    resolve({ success: true, item: newItem, count: items.length, size: this.calculateSize(items) });
                });
            } catch (e) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
                resolve({ success: true, item: newItem, count: items.length, size: this.calculateSize(items) });
            }
        });
    },

    // 重命名
    async rename(id, newName) {
        const items = await this.getAll();
        const item = items.find(i => i.id === id);
        if (!item) {
            return { success: false, error: '未找到该记录' };
        }
        
        item.name = newName || null;
        item.summary = newName || this.generateSummary(item.content);
        item.updateTime = Date.now();

        return new Promise((resolve) => {
            try {
                chrome.storage.local.set({ [this.STORAGE_KEY]: items }, () => {
                    resolve({ success: true, item });
                });
            } catch (e) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
                resolve({ success: true, item });
            }
        });
    },

    // 删除项
    async delete(id) {
        const items = await this.getAll();
        const newItems = items.filter(item => item.id !== id);
        
        return new Promise((resolve) => {
            try {
                chrome.storage.local.set({ [this.STORAGE_KEY]: newItems }, () => {
                    resolve({ success: true, count: newItems.length });
                });
            } catch (e) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newItems));
                resolve({ success: true, count: newItems.length });
            }
        });
    },

    // 清空所有
    async clear() {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.remove(this.STORAGE_KEY, () => {
                    resolve({ success: true });
                });
            } catch (e) {
                localStorage.removeItem(this.STORAGE_KEY);
                resolve({ success: true });
            }
        });
    },

    // 搜索
    async search(keyword) {
        const items = await this.getAll();
        if (!keyword || !keyword.trim()) {
            return items;
        }
        const kw = keyword.toLowerCase();
        return items.filter(item => 
            item.content.toLowerCase().includes(kw) || 
            (item.name && item.name.toLowerCase().includes(kw)) ||
            item.summary.toLowerCase().includes(kw)
        );
    },

    // 导出暂存和配置
    async exportStorage() {
        const snippets = await this.getAll();
        const settings = await this.getSettings();
        return { snippets, settings };
    },

    // 导入暂存和配置
    async importStorage(importData, merge = true) {
        try {
            let { snippets = [], settings = null } = importData;

            // 处理暂存数据
            if (snippets.length > 0) {
                let existingSnippets = merge ? await this.getAll() : [];
                // 合并去重（按id）
                const idMap = new Map();
                existingSnippets.forEach(s => idMap.set(s.id, s));
                snippets.forEach(s => idMap.set(s.id, s));
                snippets = Array.from(idMap.values()).sort((a, b) => b.createTime - a.createTime);
                
                // 应用数量和容量限制
                const currentSettings = settings || await this.getSettings();
                while (snippets.length > currentSettings.maxItems) snippets.pop();
                while (this.calculateSize(snippets) > currentSettings.maxSize && snippets.length > 0) snippets.pop();

                await new Promise((resolve) => {
                    chrome.storage.local.set({ [this.STORAGE_KEY]: snippets }, resolve);
                });
            }

            // 处理配置
            if (settings) {
                await this.saveSettings(settings);
            }

            return { success: true };
        } catch (e) {
            return { success: false, error: '导入失败: ' + e.message };
        }
    },

    // 格式化时间
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - timestamp;
        
        // 1分钟内
        if (diff < 60000) return '刚刚';
        // 1小时内
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        // 24小时内
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        // 7天内
        if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
        
        // 更早显示日期
        const pad = n => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    },

    // 渲染存储列表HTML
    renderListHtml(items) {
        if (items.length === 0) {
            return `<div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <div>暂无暂存数据</div>
                <div style="font-size: 12px; margin-top: 8px;">点击💾保存按钮保存常用数据</div>
            </div>`;
        }

        return items.map(item => `
            <div class="storage-item" data-id="${item.id}">
                <div class="storage-item-header">
                    <div class="storage-item-summary rename-target" data-id="${item.id}" title="点击重命名">${this.escapeHtml(item.summary)}</div>
                    <div class="storage-item-time">${this.formatTime(item.createTime)}</div>
                </div>
                <div class="storage-item-preview">${this.escapeHtml(item.content.substring(0, 100))}</div>
                <div class="storage-item-actions">
                    <button class="load-btn" data-id="${item.id}">加载</button>
                    <button class="copy-btn" data-id="${item.id}">复制</button>
                    <button class="rename-btn" data-id="${item.id}">重命名</button>
                    <button class="delete-btn delete" data-id="${item.id}">删除</button>
                </div>
            </div>
        `).join('');
    },

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageTools;
}
