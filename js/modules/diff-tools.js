/**
 * 文本比对工具模块 v1.0
 * 零依赖实现 Myers O(ND) diff 算法
 * 支持行级 / 词级 / 字符级三种粒度
 * 输出左右双栏 HTML + 变更统计
 *
 * 用法：
 *   DiffTools.compare(originalText, modifiedText, 'line' | 'word' | 'char')
 *   → { leftHtml, rightHtml, stats: { additions, deletions, equals } }
 */
const DiffTools = {

    // ========== 分词器 ==========

    splitLines(text) {
        return text.split('\n');
    },

    // 按词切分，保留空白符作为独立 token
    splitWords(text) {
        return text.split(/(\s+)/).filter(s => s.length > 0);
    },

    splitChars(text) {
        return Array.from(text);
    },

    // ========== Myers O(ND) Diff 算法 ==========

    /**
     * @param {string[]} a - 原始序列
     * @param {string[]} b - 修改序列
     * @returns {{op:'equal'|'delete'|'insert', value:string}[]}
     */
    myersDiff(a, b) {
        const n = a.length;
        const m = b.length;

        if (n === 0 && m === 0) return [];
        if (n === 0) return b.map(v => ({ op: 'insert', value: v }));
        if (m === 0) return a.map(v => ({ op: 'delete', value: v }));

        const max = n + m;
        const offset = max;
        const v = new Int32Array(2 * max + 1);
        const trace = [];

        let foundD = -1;

        outer: for (let d = 0; d <= max; d++) {
            trace.push(Int32Array.from(v));
            for (let k = -d; k <= d; k += 2) {
                let x;
                if (k === -d || (k !== d && v[k - 1 + offset] < v[k + 1 + offset])) {
                    x = v[k + 1 + offset];       // 向下走 (insert)
                } else {
                    x = v[k - 1 + offset] + 1;   // 向右走 (delete)
                }
                let y = x - k;
                // 贪心延伸对角线
                while (x < n && y < m && a[x] === b[y]) {
                    x++;
                    y++;
                }
                v[k + offset] = x;
                if (x >= n && y >= m) {
                    foundD = d;
                    break outer;
                }
            }
        }

        // 回溯生成操作序列
        const ops = [];
        let x = n, y = m;

        for (let d = foundD; d > 0; d--) {
            const tv = trace[d];
            const k = x - y;
            let prevK;
            if (k === -d || (k !== d && tv[k - 1 + offset] < tv[k + 1 + offset])) {
                prevK = k + 1;
            } else {
                prevK = k - 1;
            }
            const prevX = tv[prevK + offset];
            const prevY = prevX - prevK;

            // 对角线上的 equal 段
            while (x > prevX && y > prevY) {
                ops.push({ op: 'equal', value: a[x - 1] });
                x--; y--;
            }

            if (x === prevX) {
                ops.push({ op: 'insert', value: b[y - 1] });
                y--;
            } else {
                ops.push({ op: 'delete', value: a[x - 1] });
                x--;
            }
        }

        // d=0 时剩余的对角线
        while (x > 0 && y > 0) {
            ops.push({ op: 'equal', value: a[x - 1] });
            x--; y--;
        }
        while (x > 0) {
            ops.push({ op: 'delete', value: a[x - 1] });
            x--;
        }
        while (y > 0) {
            ops.push({ op: 'insert', value: b[y - 1] });
            y--;
        }

        return ops.reverse();
    },

    // ========== HTML 转义 ==========

    escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return text.replace(/[&<>"']/g, ch => map[ch]);
    },

    // ========== 比对主入口 ==========

    /**
     * @param {string} originalText
     * @param {string} modifiedText
     * @param {'line'|'word'|'char'} type
     * @returns {{leftHtml, rightHtml, stats, typeLabel}}
     */
    compare(originalText, modifiedText, type) {
        let a, b;

        switch (type) {
            case 'line':
                a = this.splitLines(originalText);
                b = this.splitLines(modifiedText);
                return this._renderLineDiff(a, b);
            case 'word':
                a = this.splitWords(originalText);
                b = this.splitWords(modifiedText);
                return this._renderInlineDiff(a, b, '词');
            case 'char':
                a = this.splitChars(originalText);
                b = this.splitChars(modifiedText);
                return this._renderInlineDiff(a, b, '字符');
            default:
                a = this.splitLines(originalText);
                b = this.splitLines(modifiedText);
                return this._renderLineDiff(a, b);
        }
    },

    // ========== 行级 diff 渲染（逐行对齐） ==========

    _renderLineDiff(a, b) {
        const ops = this.myersDiff(a, b);

        let leftHtml = '';
        let rightHtml = '';
        let stats = { additions: 0, deletions: 0, equals: 0 };

        for (const op of ops) {
            const text = this.escapeHtml(op.value);

            switch (op.op) {
                case 'equal':
                    leftHtml  += `<span class="diff-line diff-eq">${text || '&nbsp;'}</span>`;
                    rightHtml += `<span class="diff-line diff-eq">${text || '&nbsp;'}</span>`;
                    stats.equals++;
                    break;
                case 'delete':
                    leftHtml  += `<span class="diff-line diff-del">- ${text || '&nbsp;'}</span>`;
                    rightHtml += `<span class="diff-line diff-placeholder">&nbsp;</span>`;
                    stats.deletions++;
                    break;
                case 'insert':
                    leftHtml  += `<span class="diff-line diff-placeholder">&nbsp;</span>`;
                    rightHtml += `<span class="diff-line diff-add">+ ${text || '&nbsp;'}</span>`;
                    stats.additions++;
                    break;
            }
        }

        if (leftHtml === '') leftHtml = '<span class="diff-empty">（空）</span>';
        if (rightHtml === '') rightHtml = '<span class="diff-empty">（空）</span>';

        return { leftHtml, rightHtml, stats, typeLabel: '行比对' };
    },

    // ========== 词/字符级 diff 渲染（内联高亮） ==========

    _renderInlineDiff(a, b, typeLabel) {
        const ops = this.myersDiff(a, b);

        let leftHtml = '';
        let rightHtml = '';
        let stats = { additions: 0, deletions: 0, equals: 0 };

        for (const op of ops) {
            const text = this.escapeHtml(op.value);

            switch (op.op) {
                case 'equal':
                    leftHtml  += `<span class="diff-eq-inline">${text}</span>`;
                    rightHtml += `<span class="diff-eq-inline">${text}</span>`;
                    stats.equals++;
                    break;
                case 'delete':
                    leftHtml  += `<span class="diff-del-inline">${text}</span>`;
                    stats.deletions++;
                    break;
                case 'insert':
                    rightHtml += `<span class="diff-add-inline">${text}</span>`;
                    stats.additions++;
                    break;
            }
        }

        if (leftHtml === '') leftHtml = '<span class="diff-empty">（空）</span>';
        if (rightHtml === '') rightHtml = '<span class="diff-empty">（空）</span>';

        return { leftHtml, rightHtml, stats, typeLabel: typeLabel + '比对' };
    },

    // ========== 统计栏 HTML ==========

    renderStatsBar(stats, typeLabel) {
        const total = stats.additions + stats.deletions + stats.equals;
        return `<div class="diff-stats-bar">
            <span class="diff-stats-type">${typeLabel}</span>
            <span class="diff-stats-item diff-stats-add">+${stats.additions} 新增</span>
            <span class="diff-stats-item diff-stats-del">-${stats.deletions} 删除</span>
            <span class="diff-stats-item diff-stats-eq">=${stats.equals} 相同</span>
            <span class="diff-stats-item diff-stats-total">${total} 总计</span>
        </div>`;
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiffTools;
}
