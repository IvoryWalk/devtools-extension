/**
 * JSON 工具模块
 * 提供格式化、压缩、转义、去转义、Key排序、语法高亮功能
 */
const JsonTools = {
    // JSON格式化（美化）
    format(input, indent = 2) {
        try {
            const obj = JSON.parse(input);
            return {
                success: true,
                result: JSON.stringify(obj, null, indent),
                highlighted: this.highlight(JSON.stringify(obj, null, indent))
            };
        } catch (e) {
            return {
                success: false,
                error: `JSON解析错误: ${e.message}`
            };
        }
    },

    // JSON压缩（去除空白）
    minify(input) {
        try {
            const obj = JSON.parse(input);
            return {
                success: true,
                result: JSON.stringify(obj)
            };
        } catch (e) {
            return {
                success: false,
                error: `JSON解析错误: ${e.message}`
            };
        }
    },

    // 字符串转义（将JSON转为转义字符串）
    escape(input) {
        try {
            // 先尝试解析JSON，如果成功则转义
            let str = input;
            try {
                const obj = JSON.parse(input);
                str = JSON.stringify(obj);
            } catch (e) {
                // 不是有效JSON，直接转义原字符串
            }
            const escaped = JSON.stringify(str).slice(1, -1);
            return {
                success: true,
                result: escaped
            };
        } catch (e) {
            return {
                success: false,
                error: `转义失败: ${e.message}`
            };
        }
    },

    // 字符串去除转义
    unescape(input) {
        try {
            // 处理转义字符串
            const unescaped = input.replace(/\\(.)/g, (match, char) => {
                const map = {
                    '"': '"',
                    '\\': '\\',
                    '/': '/',
                    'b': '\b',
                    'f': '\f',
                    'n': '\n',
                    'r': '\r',
                    't': '\t'
                };
                if (map[char]) return map[char];
                if (char === 'u') {
                    // Unicode转义由codec模块处理，这里原样返回
                    return match;
                }
                return match;
            });
            return {
                success: true,
                result: unescaped
            };
        } catch (e) {
            return {
                success: false,
                error: `去转义失败: ${e.message}`
            };
        }
    },

    // Key按字母排序
    sortKeys(input) {
        try {
            const obj = JSON.parse(input);
            const sorted = this.sortObjectKeys(obj);
            return {
                success: true,
                result: JSON.stringify(sorted, null, 2),
                highlighted: this.highlight(JSON.stringify(sorted, null, 2))
            };
        } catch (e) {
            return {
                success: false,
                error: `JSON解析错误: ${e.message}`
            };
        }
    },

    // 递归排序对象Key
    sortObjectKeys(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.sortObjectKeys(item));
        } else if (obj !== null && typeof obj === 'object') {
            return Object.keys(obj)
                .sort()
                .reduce((result, key) => {
                    result[key] = this.sortObjectKeys(obj[key]);
                    return result;
                }, {});
        }
        return obj;
    },

    // 语法高亮
    highlight(json) {
        if (!json) return '';
        
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
            let cls = 'json-number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'json-key';
                    match = match.replace(/:$/, '');
                    return `<span class="${cls}">${match}</span>:`;
                } else {
                    cls = 'json-string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'json-boolean';
            } else if (/null/.test(match)) {
                cls = 'json-null';
            }
            return `<span class="${cls}">${match}</span>`;
        });
    },

    // 验证JSON是否有效
    validate(input) {
        try {
            JSON.parse(input);
            return { valid: true, message: '✓ JSON格式有效' };
        } catch (e) {
            return { valid: false, message: `✗ ${e.message}` };
        }
    },

    // 解析Key列表（逗号分隔）
    parseKeys(keysStr) {
        if (!keysStr) return [];
        return keysStr.split(',')
            .map(k => k.trim())
            .filter(k => k.length > 0);
    },

    // 提取指定Key（只保留这些Key）
    extractKeys(input, keysStr) {
        try {
            const keys = this.parseKeys(keysStr);
            if (keys.length === 0) {
                return { success: false, error: '请输入要提取的Key，多个用英文逗号分隔' };
            }

            const obj = JSON.parse(input);
            const result = this.extractKeysRecursive(obj, keys);
            return {
                success: true,
                result: JSON.stringify(result, null, 2),
                highlighted: this.highlight(JSON.stringify(result, null, 2))
            };
        } catch (e) {
            return { success: false, error: `提取Key失败: ${e.message}` };
        }
    },

    // 递归提取Key
    extractKeysRecursive(obj, keys) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.extractKeysRecursive(item, keys));
        } else if (obj !== null && typeof obj === 'object') {
            const result = {};
            for (const key of keys) {
                if (obj.hasOwnProperty(key)) {
                    result[key] = obj[key];
                }
            }
            // 递归处理嵌套对象
            for (const key in result) {
                if (typeof result[key] === 'object' && result[key] !== null) {
                    result[key] = this.extractKeysRecursive(result[key], keys);
                }
            }
            return result;
        }
        return obj;
    },

    // 排除指定Key（删除这些Key）
    excludeKeys(input, keysStr) {
        try {
            const keys = this.parseKeys(keysStr);
            if (keys.length === 0) {
                return { success: false, error: '请输入要排除的Key，多个用英文逗号分隔' };
            }

            const obj = JSON.parse(input);
            const result = this.excludeKeysRecursive(obj, keys);
            return {
                success: true,
                result: JSON.stringify(result, null, 2),
                highlighted: this.highlight(JSON.stringify(result, null, 2))
            };
        } catch (e) {
            return { success: false, error: `排除Key失败: ${e.message}` };
        }
    },

    // 递归排除Key
    excludeKeysRecursive(obj, keys) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.excludeKeysRecursive(item, keys));
        } else if (obj !== null && typeof obj === 'object') {
            const result = {};
            for (const key in obj) {
                if (!keys.includes(key)) {
                    result[key] = this.excludeKeysRecursive(obj[key], keys);
                }
            }
            return result;
        }
        return obj;
    },

    // HTML 转义
    escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    // 构建 JSON 树（用于结构统计视图）
    // 节点结构: { key, depth, type, value, children[], keyCount, length, objCount }
    buildTree(value, key = null, depth = 0) {
        const node = {
            key,
            depth,
            type: '',
            value: null,
            children: [],
            keyCount: 0,
            length: 0,
            objCount: 0
        };

        if (Array.isArray(value)) {
            node.type = 'array';
            node.length = value.length;
            node.children = value.map((item, i) => this.buildTree(item, String(i), depth + 1));
            node.objCount = node.children.filter(c => c.type === 'object').length;
        } else if (value !== null && typeof value === 'object') {
            node.type = 'object';
            const keys = Object.keys(value);
            node.keyCount = keys.length;
            node.children = keys.map(k => this.buildTree(value[k], k, depth + 1));
        } else {
            node.type = typeof value; // string | number | boolean | null
            node.value = value;
        }

        return node;
    },

    // 聚合统计：最大层级 / 各层直接子 key 数 / 数组数与对象数
    statsSummary(root) {
        const levelKeys = {};      // depth -> 该层直接子 key 数累加
        let maxDepth = 0;
        let arrayCount = 0;
        let totalElements = 0;
        let totalObj = 0;

        const walk = (node) => {
            if (node.depth > maxDepth) maxDepth = node.depth;
            if (node.type === 'object') {
                levelKeys[node.depth] = (levelKeys[node.depth] || 0) + node.keyCount;
            }
            if (node.type === 'array') {
                arrayCount++;
                totalElements += node.length;
                totalObj += node.objCount;
            }
            node.children.forEach(walk);
        };
        walk(root);

        const levelBreakdown = [];
        for (let d = 0; d <= maxDepth; d++) {
            levelBreakdown.push(`L${d + 1}:${levelKeys[d] || 0}`);
        }
        // 去掉末尾无 key 的冗余层级（纯数组/叶子层），至少保留一级
        while (levelBreakdown.length > 1 && levelBreakdown[levelBreakdown.length - 1].endsWith(':0')) {
            levelBreakdown.pop();
        }

        const totalKeys = Object.values(levelKeys).reduce((a, b) => a + b, 0);

        return {
            maxDepth,
            arrayCount,
            totalElements,
            totalObj,
            totalKeys,
            levelBreakdown
        };
    },

    // 获取功能按钮配置
    getButtons() {
        return [
            { id: 'json-format', text: '格式化', action: 'format', primary: true },
            { id: 'json-minify', text: '压缩', action: 'minify' },
            { id: 'json-escape', text: '转义', action: 'escape' },
            { id: 'json-unescape', text: '去转义', action: 'unescape' },
            { id: 'json-sort', text: 'Key排序', action: 'sortKeys' },
            { id: 'json-validate', text: '验证', action: 'validate' }
        ];
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JsonTools;
}
