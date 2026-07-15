/**
 * SQL处理工具模块 v2.1
 * SQL美化（格式化）、净化（标准化+去注释）
 * 零依赖原生实现，不改变SQL语义
 * 美化保留注释，净化移除注释，两者均带语法高亮
 *
 * v2.1 变更：
 *  1. 新增 highlight() 方法，单遍正则实现 SQL 语法高亮
 *  2. format/clean 返回 highlighted HTML 字段
 *  3. clean() 移除注释（-- # 块注释）
 *  4. 移除 minify 按钮（与 clean 效果重叠）
 */
const SqlTools = {
    // 主关键字（在 format 时必须独占一行/换行）
    majorKeywords: [
        'ON DUPLICATE KEY UPDATE',
        'CREATE TABLE IF NOT EXISTS', 'CREATE TABLE',
        'IF NOT EXISTS', 'IF EXISTS',
        'ALTER TABLE', 'DELETE FROM', 'INSERT INTO', 'REPLACE INTO',
        'DROP TABLE IF EXISTS', 'DROP TABLE', 'TRUNCATE TABLE',
        'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN',
        'GROUP BY', 'ORDER BY', 'PARTITION BY',
        'SHOW CREATE TABLE', 'SHOW COLUMNS FROM', 'SHOW TABLES',
        'UNION ALL', 'UNION',
        'SELECT', 'FROM', 'WHERE', 'HAVING', 'LIMIT', 'OFFSET',
        'VALUES', 'SET', 'SHOW'
    ],

    // 全部 SQL 关键字（用于大写转换）
    upperKeywords: [
        'GROUP_CONCAT', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES',
        'IS NOT NULL', 'IS NULL', 'NOT EXISTS', 'NOT IN', 'NOT BETWEEN', 'NOT LIKE',
        'ON DUPLICATE KEY UPDATE',
        'CREATE TABLE IF NOT EXISTS', 'CREATE TABLE',
        'IF NOT EXISTS', 'IF EXISTS',
        'ALTER TABLE', 'DELETE FROM', 'INSERT INTO', 'REPLACE INTO',
        'DROP TABLE IF EXISTS', 'DROP TABLE', 'TRUNCATE TABLE',
        'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN',
        'GROUP BY', 'ORDER BY', 'PARTITION BY',
        'SHOW CREATE TABLE', 'SHOW COLUMNS FROM', 'SHOW TABLES',
        'UNION ALL', 'UNION',
        'BETWEEN', 'DISTINCT', 'DEFAULT', 'CONSTRAINT', 'AUTO_INCREMENT',
        'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ON', 'NOT', 'EXISTS',
        'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'JOIN',
        'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET',
        'ALL', 'ASC', 'DESC',
        'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'REPLACE',
        'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'TRUNCATE', 'SHOW',
        'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
        'LIKE', 'IS', 'NULL', 'TRUE', 'FALSE',
        'UNIQUE', 'CHECK', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'AS', 'IN',
        'INT', 'VARCHAR', 'DATETIME', 'TIMESTAMP', 'TEXT', 'BIGINT', 'TINYINT',
        'ENGINE', 'CHARSET', 'COMMENT', 'KEY', 'INDEX', 'AFTER', 'COLUMN',
        'RENAME', 'TO', 'CURRENT_TIMESTAMP', 'NOW', 'DATE', 'TIME'
    ],

    // DDL 专用关键字（不含数据类型 bigint/varchar/tinyint/datetime 等）
    // 用于 CREATE TABLE / ALTER TABLE 格式化时大写，数据类型保持原样
    _ddlKeywords: [
        'ON UPDATE', 'ON DELETE',
        'CURRENT_TIMESTAMP', 'CHARACTER SET',
        'PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE KEY', 'UNIQUE INDEX',
        'NOT NULL', 'IF NOT EXISTS', 'IF EXISTS',
        'AUTO_INCREMENT', 'USING BTREE', 'USING HASH',
        'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE',
        'CREATE', 'TABLE', 'ALTER', 'DROP', 'IF', 'NOT', 'EXISTS',
        'PRIMARY', 'KEY', 'FOREIGN', 'UNIQUE', 'INDEX',
        'NULL', 'DEFAULT', 'COMMENT', 'COLLATE', 'CHARACTER', 'SET',
        'ENGINE', 'CHARSET', 'ON', 'UPDATE', 'DELETE',
        'USING', 'BTREE', 'HASH',
        'CONSTRAINT', 'REFERENCES', 'ADD', 'MODIFY', 'CHANGE',
        'COLUMN', 'RENAME', 'TO', 'AFTER',
        'UNSIGNED', 'ZEROFILL',
        'ROW_FORMAT', 'PACK_KEYS'
    ],

    // ====== 字符串 / 注释保护机制 ======

    _protectStrings(sql) {
        const strings = [];
        sql = sql.replace(/('(?:[^']|'')*'|"(?:[^"]|"")*"|`(?:[^`]|``)*`)/g, (match) => {
            strings.push(match);
            return `\u0000SQL_STR_${strings.length - 1}\u0000`;
        });
        return { sql, strings };
    },

    _restoreStrings(sql, strings) {
        for (let i = strings.length - 1; i >= 0; i--) {
            sql = sql.split(`\u0000SQL_STR_${i}\u0000`).join(strings[i]);
        }
        return sql;
    },

    // 提取注释，转换为占位符。占位符在 format 时会换行隔离
    _protectComments(sql) {
        const comments = [];
        sql = sql.replace(/(--[^\r\n]*|#[^\r\n]*)/g, (match) => {
            comments.push(match);
            return `\u0001SQL_CMT_${comments.length - 1}\u0001`;
        });
        sql = sql.replace(/\/\*[\s\S]*?\*\//g, (match) => {
            comments.push('/*' + match.slice(2, -2).trim() + '*/');
            return `\u0001SQL_CMT_${comments.length - 1}\u0001`;
        });
        return { sql, comments };
    },

    _restoreComments(sql, comments) {
        for (let i = comments.length - 1; i >= 0; i--) {
            sql = sql.split(`\u0001SQL_CMT_${i}\u0001`).join(comments[i]);
        }
        return sql;
    },

    // 规范化运算符两侧空格（不动括号，避免 now() 变 now () 这类问题）
    _fixSpaces(sql) {
        sql = sql.replace(/\s*=\s*/g, ' = ');
        sql = sql.replace(/\s*<>\s*/g, ' <> ');
        sql = sql.replace(/\s*!=\s*/g, ' != ');
        sql = sql.replace(/\s*>=\s*/g, ' >= ');
        sql = sql.replace(/\s*<=\s*/g, ' <= ');
        sql = sql.replace(/\s*>\s*/g, ' > ');
        sql = sql.replace(/\s*<\s*/g, ' < ');
        sql = sql.replace(/\s*,\s*/g, ', ');
        sql = sql.replace(/\s*;\s*/g, '; ');
        return sql.replace(/\s+/g, ' ').trim();
    },

    // 逗号换行：括号外（顶层字段/列）换行+缩进，括号内（VALUES/IN/CREATE TABLE 列定义）仅加空格
    // 字符串和注释此时已被替换为占位符（不含括号/逗号），不会干扰深度计数
    _replaceCommas(sql) {
        let result = '';
        let depth = 0;
        for (let i = 0; i < sql.length; i++) {
            const c = sql[i];
            if (c === '(') {
                depth++;
                result += c;
            } else if (c === ')') {
                depth = Math.max(0, depth - 1);
                result += c;
            } else if (c === ',') {
                result += (depth === 0) ? ',\n  ' : ', ';
                // 跳过紧跟的空格，避免 ,  'a' 双空格
                while (i + 1 < sql.length && sql[i + 1] === ' ') i++;
            } else {
                result += c;
            }
        }
        return result;
    },

    // AND/OR 前置换行：仅在括号外（depth=0）拆分 AND/OR
    _replaceAndOr(sql) {
        let result = '';
        let depth = 0;
        const regex = /\b(AND|OR)\b/gi;
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(sql)) !== null) {
            for (let i = lastIndex; i < match.index; i++) {
                if (sql[i] === '(') depth++;
                else if (sql[i] === ')') depth = Math.max(0, depth - 1);
            }
            if (depth === 0) {
                result += sql.substring(lastIndex, match.index).trimEnd();
                result += '\n' + match[0].toUpperCase() + ' ';
                lastIndex = regex.lastIndex;
                while (lastIndex < sql.length && sql[lastIndex] === ' ') lastIndex++;
                regex.lastIndex = lastIndex;
            } else {
                result += sql.substring(lastIndex, regex.lastIndex);
                lastIndex = regex.lastIndex;
            }
        }
        result += sql.substring(lastIndex);
        return result;
    },

    // SELECT 逗号前置：第一个深度0逗号保持内联，后续逗号前置换行
    _replaceCommasCommaFirst(sql) {
        let result = '';
        let depth = 0;
        let depth0CommaCount = 0;
        for (let i = 0; i < sql.length; i++) {
            const c = sql[i];
            if (c === '(') {
                depth++;
                result += c;
            } else if (c === ')') {
                depth = Math.max(0, depth - 1);
                result += c;
            } else if (c === ',' && depth === 0) {
                depth0CommaCount++;
                if (depth0CommaCount === 1) {
                    result += ', ';
                } else {
                    result += '\n, ';
                }
                while (i + 1 < sql.length && sql[i + 1] === ' ') i++;
            } else {
                result += c;
            }
        }
        return result;
    },

    // CASE WHEN 展开：WHEN/ELSE/END 各自独立成行
    _expandCaseWhen(sql) {
        sql = sql.replace(/\s+WHEN\s+/g, '\nWHEN ');
        sql = sql.replace(/\s+ELSE\s+/g, '\nELSE ');
        sql = sql.replace(/\s+END\b/g, '\nEND');
        return sql;
    },

    // 按子句区分逗号处理：SELECT=逗号前置，ORDER BY/GROUP BY/HAVING=内联，其他=深度感知拆行
    _processCommas(sql) {
        const lines = sql.split('\n');
        const result = [];
        for (let line of lines) {
            const trimmed = line.trim();
            if (/^SELECT\b/i.test(trimmed)) {
                result.push(this._replaceCommasCommaFirst(line));
            } else if (/^(ORDER\s+BY|GROUP\s+BY|HAVING)\b/i.test(trimmed)) {
                result.push(line);
            } else {
                result.push(this._replaceCommas(line));
            }
        }
        return result.join('\n');
    },

    // 关键字大写转换（不影响保护起来的字符串/注释/标识符）
    _uppercaseKeywords(sql) {
        const keywordPattern = this.upperKeywords.map(k =>
            k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        ).join('|');
        const keywordRegex = new RegExp('\\b(' + keywordPattern + ')\\b', 'gi');
        return sql.replace(keywordRegex, (match) => match.toUpperCase());
    },

    // DDL 关键字大写（不含数据类型，保护 bigint/varchar 等保持原样）
    _uppercaseDDLKeywords(sql) {
        const keywordPattern = this._ddlKeywords.map(k =>
            k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
        ).join('|');
        const keywordRegex = new RegExp('\\b(' + keywordPattern + ')\\b', 'gi');
        return sql.replace(keywordRegex, (match) => {
            return match.toUpperCase().replace(/\s+/g, ' ');
        });
    },

    // 按顶层逗号拆分列定义（括号内逗号不拆）
    _splitColumns(sql) {
        const parts = [];
        let current = '';
        let depth = 0;
        for (let i = 0; i < sql.length; i++) {
            const c = sql[i];
            if (c === '(') depth++;
            else if (c === ')') depth = Math.max(0, depth - 1);
            if (c === ',' && depth === 0) {
                parts.push(current.trim());
                current = '';
            } else {
                current += c;
            }
        }
        if (current.trim()) parts.push(current.trim());
        return parts;
    },

    // USING BTREE/HASH 从括号后移到括号前：PRIMARY KEY (cols) USING BTREE → PRIMARY KEY USING BTREE (cols)
    _fixUsingBtree(col) {
        const m = col.match(/^(.*?\S)\s*\((.*)\)\s*USING\s+(BTREE|HASH)\s*$/i);
        if (m && /\b(PRIMARY\s+KEY|UNIQUE|KEY|INDEX)\b/i.test(m[1])) {
            return m[1].trim() + ' USING ' + m[3].toUpperCase() + ' (' + m[2].trim() + ')';
        }
        return col;
    },

    // 列定义标准化：COMMENT='xxx' → COMMENT 'xxx'，逗号后加空格
    _normalizeColumnDef(col) {
        col = col.replace(/\s+/g, ' ').trim();
        col = col.replace(/\bCOMMENT\s*=\s*/gi, 'COMMENT ');
        col = col.replace(/,\s*/g, ', ');
        return col;
    },

    // 表选项格式化：DEFAULT CHARSET→CHARSET，= 加空格，COMMENT= → COMMENT
    _formatTableOptions(suffix) {
        if (!suffix || !suffix.trim()) return '';
        let opts = suffix.trim();

        opts = opts.replace(/\bDEFAULT\s+CHARACTER\s+SET\b/gi, 'CHARSET');
        opts = opts.replace(/\bDEFAULT\s+CHARSET\b/gi, 'CHARSET');
        opts = opts.replace(/\bDEFAULT\s+COLLATE\b/gi, 'COLLATE');

        opts = opts.replace(/\s*=\s*/g, ' = ');
        opts = opts.replace(/\bCOMMENT\s+=\s+/gi, 'COMMENT ');
        opts = opts.replace(/\s+/g, ' ').trim();

        opts = opts.replace(/\b(ENGINE|CHARSET|COLLATE|COMMENT|AUTO_INCREMENT|ROW_FORMAT|PACK_KEYS|CHARACTER|SET)\b/gi,
            (w) => w.toUpperCase());

        return opts;
    },

    // DDL 专用格式化（CREATE TABLE / ALTER TABLE）
    _formatDDL(sql, strings, comments) {
        // 1) 压缩空白
        let processed = sql.replace(/[\r\n\t]+/g, ' ');
        processed = processed.replace(/\s+/g, ' ').trim();

        // 2) 定位主括号对
        const parenOpen = processed.indexOf('(');
        if (parenOpen === -1) return null;
        let depth = 0;
        let parenClose = -1;
        for (let i = parenOpen; i < processed.length; i++) {
            if (processed[i] === '(') depth++;
            else if (processed[i] === ')') {
                depth--;
                if (depth === 0) { parenClose = i; break; }
            }
        }
        if (parenClose === -1) return null;

        // 3) 拆分前缀 / 列定义 / 后缀
        let prefix = processed.substring(0, parenOpen).trim();
        let columnsPart = processed.substring(parenOpen + 1, parenClose).trim();
        let suffix = processed.substring(parenClose + 1).trim();
        let trailingSemi = '';
        if (suffix.endsWith(';')) {
            trailingSemi = ';';
            suffix = suffix.slice(0, -1).trim();
        }

        // 4) 前缀大写 DDL 关键字
        prefix = this._uppercaseDDLKeywords(prefix);

        // 5) 拆分列定义
        const columnDefs = this._splitColumns(columnsPart);

        // 6) 格式化每列
        const formattedColumns = columnDefs.map(col => {
            if (!col) return null;
            col = col.replace(/\s+/g, ' ').trim();
            col = this._uppercaseDDLKeywords(col);
            col = this._fixUsingBtree(col);
            col = this._normalizeColumnDef(col);
            return '\t' + col;
        }).filter(c => c !== null);

        // 7) 表选项
        let formattedSuffix = this._formatTableOptions(suffix);

        // 8) 组装
        let result = prefix + ' (\n' +
            formattedColumns.join(',\n') + '\n' +
            ')' + (formattedSuffix ? ' ' + formattedSuffix : '') + trailingSemi;

        // 9) 还原
        result = this._restoreStrings(result, strings);
        result = this._restoreComments(result, comments);
        return result;
    },

    // ====== 语法高亮 ======

    // 用于高亮的单字关键字列表（多字关键字在视觉上逐词高亮即可）
    highlightKeywords: [
        'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN',
        'LIKE', 'IS', 'NULL', 'TRUE', 'FALSE', 'AS', 'ON', 'JOIN', 'INNER', 'LEFT',
        'RIGHT', 'FULL', 'OUTER', 'CROSS', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT',
        'OFFSET', 'ASC', 'DESC', 'ALL', 'DISTINCT', 'INSERT', 'INTO', 'VALUES',
        'UPDATE', 'SET', 'DELETE', 'REPLACE', 'CREATE', 'ALTER', 'DROP', 'TABLE',
        'INDEX', 'VIEW', 'TRUNCATE', 'SHOW', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
        'UNION', 'DEFAULT', 'CONSTRAINT', 'UNIQUE', 'CHECK', 'PRIMARY', 'FOREIGN',
        'KEY', 'REFERENCES', 'AUTO_INCREMENT', 'ENGINE', 'CHARSET', 'IF', 'WITH',
        'PARTITION', 'OVER', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'NOW', 'DATE',
        'TIME', 'CURRENT_TIMESTAMP', 'COMMENT', 'COLUMN', 'RENAME', 'TO', 'AFTER',
        'INT', 'VARCHAR', 'DATETIME', 'TIMESTAMP', 'TEXT', 'BIGINT', 'TINYINT',
        'DECIMAL', 'FLOAT', 'DOUBLE', 'CHAR', 'BLOB', 'IFNULL', 'COALESCE',
        'CAST', 'CONVERT', 'SUBSTRING', 'CONCAT', 'TRIM', 'LENGTH', 'UPPER', 'LOWER',
        'COLLATE', 'CHARACTER', 'BTREE', 'HASH', 'UNSIGNED', 'ZEROFILL',
        'ROW_FORMAT', 'PACK_KEYS'
    ],

    /**
     * SQL 语法高亮：单遍正则，comments → strings → numbers → keywords → functions
     * 返回 HTML 字符串，使用 .sql-* CSS 类
     */
    highlight(sql) {
        if (!sql) return '';

        // 1) HTML 转义
        let text = sql.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // 2) 构建组合正则（顺序即优先级）
        const kwPattern = this.highlightKeywords
            .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|');

        const combined = [
            '(--[^\\r\\n]*|#[^\\r\\n]*|\\/\\*[\\s\\S]*?\\*\\/)',          // 1: comments
            '(\'(?:[^\']|\'\')*\'|"(?:[^"]|"")*"|`(?:[^`]|``)*`)',        // 2: strings
            '(\\b\\d+\\.?\\d*\\b)',                                        // 3: numbers
            '(\\b(?:' + kwPattern + ')\\b)',                               // 4: keywords
            '(\\b[a-zA-Z_]\\w*)(?=\\s*\\()'                                // 5: functions
        ].join('|');

        const regex = new RegExp(combined, 'gi');

        let result = '';
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            result += text.substring(lastIndex, match.index);

            if (match[1] !== undefined) {
                result += '<span class="sql-comment">' + match[1] + '</span>';
            } else if (match[2] !== undefined) {
                result += '<span class="sql-string">' + match[2] + '</span>';
            } else if (match[3] !== undefined) {
                result += '<span class="sql-number">' + match[3] + '</span>';
            } else if (match[4] !== undefined) {
                result += '<span class="sql-keyword">' + match[4] + '</span>';
            } else if (match[5] !== undefined) {
                result += '<span class="sql-function">' + match[5] + '</span>';
            }

            lastIndex = regex.lastIndex;
        }
        result += text.substring(lastIndex);

        return result;
    },

    // ====== 核心功能 ======

    /**
     * 压缩：清除换行、多余空格，整合成单行
     * 保留注释（SQL行尾或上方），单行展示
     */
    minify(sql) {
        try {
            if (!sql || !sql.trim()) {
                return { success: false, error: 'SQL内容不能为空' };
            }
            const { sql: cmtProtected, comments } = this._protectComments(sql);
            const { sql: protectedSql, strings } = this._protectStrings(cmtProtected);

            // 规范化空白
            let minified = protectedSql.replace(/[\r\n\t]+/g, ' ');
            minified = minified.replace(/\s+/g, ' ').trim();
            minified = this._fixSpaces(minified);

            minified = this._restoreStrings(minified, strings);
            minified = this._restoreComments(minified, comments);

            // 注释保护符周围的多余空白去掉（注释内部保留原样）
            minified = minified.replace(/[ \t]+/g, ' ');
            minified = minified.replace(/\s*;\s*/g, '; ');
            minified = minified.replace(/\s+/g, ' ').trim();

            return { success: true, result: minified };
        } catch (e) {
            return { success: false, error: `SQL压缩失败: ${e.message}` };
        }
    },

    /**
     * 美化（格式化）v3：
     *  - Tab 缩进
     *  - SELECT 逗号前置（首个逗号内联，后续逗号换行前置）
     *  - AND/OR 前置换行（仅括号外 depth=0）
     *  - CASE WHEN 展开多行
     *  - ORDER BY / GROUP BY 逗号保持内联
     *  - 括号嵌套智能缩进，闭合括号独立成行
     *  - 注释单独成行，关键字大写，标识符保留原大小写
     */
    format(sql) {
        try {
            if (!sql || !sql.trim()) {
                return { success: false, error: 'SQL内容不能为空' };
            }

            // 1) 保护字符串和注释
            const { sql: cmtProtected, comments } = this._protectComments(sql);
            const { sql: protectedSql, strings } = this._protectStrings(cmtProtected);

            // 1.5) DDL 检测：CREATE TABLE / ALTER TABLE 走专用格式化器
            if (/^\s*(CREATE\s+TABLE|ALTER\s+TABLE)\b/i.test(protectedSql)) {
                const ddlResult = this._formatDDL(protectedSql, strings, comments);
                if (ddlResult) {
                    return { success: true, result: ddlResult, highlighted: this.highlight(ddlResult) };
                }
                // DDL 格式化失败则回退到通用格式化
            }

            // 2) 压缩所有空白为单空格
            let processed = protectedSql.replace(/[\r\n\t]+/g, ' ');
            processed = processed.replace(/\s+/g, ' ').trim();

            // 3) 主关键字前加换行
            const majorPattern = this.majorKeywords
                .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'))
                .join('|');
            const majorRegex = new RegExp('\\s*\\b(' + majorPattern + ')\\b', 'gi');
            processed = processed.replace(majorRegex, (match, kw) => {
                return '\n' + kw.toUpperCase();
            });

            // 4) 关键字大写
            processed = this._uppercaseKeywords(processed);

            // 5) AND/OR 前置换行（仅括号外）
            processed = this._replaceAndOr(processed);

            // 6) CASE WHEN 展开
            processed = this._expandCaseWhen(processed);

            // 7) 逗号处理（按子句区分）
            processed = this._processCommas(processed);

            // 8) 注释占位符前后换行
            processed = processed.replace(/\s*(\u0001SQL_CMT_\d+\u0001)\s*/g, '\n$1\n');

            // 9) 缩进处理：Tab 缩进 + 括号深度 + CASE 深度 + 续行 +1
            const lines = processed.split('\n');
            let indent = 0;
            let caseDepth = 0;
            const result = [];
            const findFirstUnmatchedClose = (line) => {
                let balance = 0;
                for (let i = 0; i < line.length; i++) {
                    if (line[i] === '(') balance++;
                    else if (line[i] === ')') {
                        balance--;
                        if (balance < 0) return i;
                    }
                }
                return -1;
            };
            for (let line of lines) {
                line = line.trim();
                if (!line) continue;

                // 注释独立成行
                if (/^\u0001SQL_CMT_\d+\u0001$/.test(line)) {
                    result.push('\t'.repeat(indent + caseDepth) + line);
                    continue;
                }

                // 续行标记：逗号前置 / AND / OR → +1 缩进
                let extraIndent = 0;
                if (line.startsWith(',') || line.startsWith('AND ') || line.startsWith('OR ')) {
                    extraIndent = 1;
                }

                const openCount = (line.match(/\(/g) || []).length;
                const closeCount = (line.match(/\)/g) || []).length;
                const caseCount = (line.match(/\bCASE\b/g) || []).length;
                const endCount = (line.match(/\bEND\b/g) || []).length;

                // 行内有未配对的 ）且不以 END 开头 → 拆出闭合段
                if (!line.startsWith('END') && closeCount > openCount) {
                    const splitAt = findFirstUnmatchedClose(line);
                    if (splitAt > 0) {
                        const before = line.substring(0, splitAt).trim();
                        const after = line.substring(splitAt).trim();
                        if (before) {
                            result.push('\t'.repeat(indent + caseDepth + extraIndent) + before);
                        }
                        const closeIndent = Math.max(0, indent - 1);
                        result.push('\t'.repeat(closeIndent + caseDepth) + after);
                        indent = Math.max(0, indent + openCount - closeCount);
                        caseDepth = Math.max(0, caseDepth + caseCount - endCount);
                        continue;
                    }
                }

                // 行首是 ) → 减 bracket indent
                if (line.startsWith(')')) {
                    indent = Math.max(0, indent - 1);
                }
                // 行首是 END → 减 case depth
                if (line.startsWith('END')) {
                    caseDepth = Math.max(0, caseDepth - 1);
                }

                result.push('\t'.repeat(indent + caseDepth + extraIndent) + line);

                // 计算本行括号 + CASE 平衡
                indent = Math.max(0, indent + openCount - closeCount);
                caseDepth = Math.max(0, caseDepth + caseCount - endCount);
            }

            let finalSql = result.join('\n').trim();

            // 10) 还原字符串和注释
            finalSql = this._restoreStrings(finalSql, strings);
            finalSql = this._restoreComments(finalSql, comments);

            // 11) 清理多余空行
            finalSql = finalSql.replace(/\n{3,}/g, '\n\n').trim();

            return { success: true, result: finalSql, highlighted: this.highlight(finalSql) };
        } catch (e) {
            return { success: false, error: `SQL格式化失败: ${e.message}` };
        }
    },

    /**
     * 净化：移除注释，统一关键字大写、运算符空格规整，单行输出
     * 不动标识符大小写，不动 SQL 语义
     */
    clean(sql) {
        try {
            if (!sql || !sql.trim()) {
                return { success: false, error: 'SQL内容不能为空' };
            }

            // 1) 移除所有注释（-- # /* */），替换为空格避免拼接问题
            let cleaned = sql.replace(/--[^\r\n]*/g, ' ');
            cleaned = cleaned.replace(/#[^\r\n]*/g, ' ');
            cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ' ');

            // 2) 保护字符串
            const { sql: protectedSql, strings } = this._protectStrings(cleaned);

            // 3) 压缩空白 + 标准化运算符 + 关键字大写
            cleaned = protectedSql.replace(/[\r\n\t]+/g, ' ');
            cleaned = cleaned.replace(/\s+/g, ' ').trim();
            cleaned = this._fixSpaces(cleaned);
            cleaned = this._uppercaseKeywords(cleaned);

            cleaned = this._restoreStrings(cleaned, strings);
            cleaned = cleaned.replace(/\s+/g, ' ').trim();

            return { success: true, result: cleaned, highlighted: this.highlight(cleaned) };
        } catch (e) {
            return { success: false, error: `SQL净化失败: ${e.message}` };
        }
    },

    getButtons() {
        return [
            { id: 'sql-format', text: '美化', action: 'format', primary: true },
            { id: 'sql-clean', text: '净化', action: 'clean' }
        ];
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SqlTools;
}
