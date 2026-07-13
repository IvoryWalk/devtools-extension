/**
 * Cron表达式解析模块 v1.1
 * 支持三种格式：
 * - Linux Crontab: 5位 (分 时 日 月 周)
 * - Spring @Scheduled: 6位 (秒 分 时 日 月 周)
 * - Quartz: 6-7位 (秒 分 时 日 月 周 [年])
 */
const CronParser = {
    // Cron格式类型
    FORMAT: {
        LINUX: 'linux',      // 5位
        SPRING: 'spring',    // 6位
        QUARTZ: 'quartz'     // 6-7位
    },

    // 字段范围
    ranges: {
        second: { min: 0, max: 59 },
        minute: { min: 0, max: 59 },
        hour: { min: 0, max: 23 },
        dayOfMonth: { min: 1, max: 31 },
        month: { min: 1, max: 12 },
        dayOfWeek: { min: 0, max: 6 }, // 0=周日, Quartz 1=周日...这里统一处理
        year: { min: 2020, max: 2099 }
    },

    // 月份名称映射
    monthNames: {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
    },

    // 星期名称映射
    weekNames: {
        sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
    },

    // 自动检测Cron格式
    detectFormat(parts) {
        if (parts.length === 5) return this.FORMAT.LINUX;
        if (parts.length === 6) return this.FORMAT.SPRING;
        if (parts.length === 7) return this.FORMAT.QUARTZ;
        throw new Error(`Cron表达式位数错误，支持5/6/7位，当前${parts.length}位`);
    },

    // 解析单个字段
    parseField(field, range) {
        const result = new Set();
        const { min, max } = range;

        // 处理问号?（Quartz中日和周可以用?表示不指定）
        if (field === '?') {
            for (let i = min; i <= max; i++) result.add(i);
            return Array.from(result).sort((a, b) => a - b);
        }

        // 处理L（最后一天标记，特殊处理，matches中判断是否是当月最后一天）
        if (field === 'L') {
            if (range === this.ranges.dayOfMonth) {
                // 用特殊值-1标记L，在matches方法中判断是否是当月最后一天
                result.add(-1);
                return Array.from(result).sort((a, b) => a - b);
            }
        }

        // 处理通配符
        if (field === '*') {
            for (let i = min; i <= max; i++) result.add(i);
            return Array.from(result).sort((a, b) => a - b);
        }

        // 处理逗号分隔的多个值
        const parts = field.split(',');
        for (const part of parts) {
            // 处理步长 */5 或 1-10/2
            let [rangePart, step] = part.split('/');
            step = step ? parseInt(step, 10) : 1;

            let start, end;

            if (rangePart === '*' || rangePart === '?') {
                start = min;
                end = max;
            } else if (rangePart === 'L') {
                start = 28;
                end = 31;
            } else if (rangePart.includes('-')) {
                // 范围 1-5
                const [s, e] = rangePart.split('-');
                start = this.parseValue(s, range);
                end = this.parseValue(e, range);
            } else {
                // 单个值
                start = this.parseValue(rangePart, range);
                end = step > 1 ? max : start;
            }

            // 验证范围
            start = Math.max(start, min);
            end = Math.min(end, max);

            for (let i = start; i <= end; i += step) {
                if (i >= min && i <= max) {
                    result.add(i);
                }
            }
        }

        return Array.from(result).sort((a, b) => a - b);
    },

    // 解析值（处理名称别名）
    parseValue(val, range) {
        val = val.toLowerCase().trim();
        
        // 月份名称
        if (this.monthNames[val]) return this.monthNames[val];
        // 星期名称
        if (this.weekNames[val] !== undefined) return this.weekNames[val];
        
        const num = parseInt(val, 10);
        if (isNaN(num)) throw new Error(`无效的值: ${val}`);
        
        // Quartz周日是1，转成0
        if (range === this.ranges.dayOfWeek && num === 7) return 0;
        
        return num;
    },

    // 解析Cron表达式
    parse(expression, format = null) {
        const parts = expression.trim().split(/\s+/);
        
        // 自动检测格式
        const detectedFormat = format || this.detectFormat(parts);

        let second, minute, hour, dayOfMonth, month, dayOfWeek, year;

        switch (detectedFormat) {
            case this.FORMAT.LINUX:
                // 分 时 日 月 周 → 秒=0
                [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
                second = '0';
                year = '*';
                break;
            case this.FORMAT.SPRING:
                // 秒 分 时 日 月 周
                [second, minute, hour, dayOfMonth, month, dayOfWeek] = parts;
                year = '*';
                break;
            case this.FORMAT.QUARTZ:
                // 秒 分 时 日 月 周 [年]
                [second, minute, hour, dayOfMonth, month, dayOfWeek, year = '*'] = parts;
                break;
        }

        try {
            return {
                second: this.parseField(second, this.ranges.second),
                minute: this.parseField(minute, this.ranges.minute),
                hour: this.parseField(hour, this.ranges.hour),
                dayOfMonth: this.parseField(dayOfMonth, this.ranges.dayOfMonth),
                month: this.parseField(month, this.ranges.month),
                dayOfWeek: this.parseField(dayOfWeek, this.ranges.dayOfWeek),
                year: this.parseField(year, this.ranges.year),
                format: detectedFormat,
                raw: expression
            };
        } catch (e) {
            throw new Error(`解析失败: ${e.message}`);
        }
    },

    // 获取月份最后一天
    getLastDayOfMonth(year, month) {
        return new Date(year, month, 0).getDate();
    }

    // 检查日期是否匹配
    ,
    matches(date, parsed) {
        const second = date.getSeconds();
        const minute = date.getMinutes();
        const hour = date.getHours();
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const dow = date.getDay();

        // 检查年、月、时、分、秒
        if (!parsed.year.includes(year) && parsed.year[0] !== '*') return false;
        if (!parsed.month.includes(month)) return false;
        if (!parsed.hour.includes(hour)) return false;
        if (!parsed.minute.includes(minute)) return false;
        if (!parsed.second.includes(second)) return false;

        // 处理日和星期（标准Cron：两者是OR关系）
        const hasL = parsed.dayOfMonth.includes(-1);
        const domIsWildcard = parsed.dayOfMonth.length >= 28 && !hasL; // 包含?或*，不包含L
        const dowIsWildcard = parsed.dayOfWeek.length === 7;

        // 处理L（最后一天）
        let dayMatch = parsed.dayOfMonth.includes(day);
        if (hasL) {
            // L标记，检查是否是当月最后一天
            const lastDay = this.getLastDayOfMonth(year, month);
            if (day === lastDay) dayMatch = true;
        }

        if (domIsWildcard && dowIsWildcard) {
            return true;
        } else if (domIsWildcard) {
            return parsed.dayOfWeek.includes(dow);
        } else if (dowIsWildcard) {
            return dayMatch;
        } else {
            // 两者都指定，满足任一即可
            return dayMatch || parsed.dayOfWeek.includes(dow);
        }
    }

    // 获取下N次执行时间
    ,
    getNextTimes(expression, count = 5, startDate = new Date(), format = null) {
        try {
            const parsed = this.parse(expression, format);
            const results = [];
            
            // 从下一秒开始
            let current = new Date(startDate);
            current.setMilliseconds(0);
            current = new Date(current.getTime() + 1000);

            // 最多查找2年，防止无限循环
            const maxIterations = 366 * 24 * 60 * 60 * 2;
            let iterations = 0;

            while (results.length < count && iterations < maxIterations) {
                if (this.matches(current, parsed)) {
                    results.push(new Date(current));
                }
                current = new Date(current.getTime() + 1000);
                iterations++;
            }

            if (results.length === 0) {
                return { success: false, error: '未找到匹配的执行时间，请检查Cron表达式' };
            }

            return {
                success: true,
                result: {
                    expression,
                    format: parsed.format,
                    times: results,
                    count: results.length
                }
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // 格式化日期
    ,
    formatDate(date) {
        const pad = n => String(n).padStart(2, '0');
        const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${weekDays[date.getDay()]}`;
    }

    // 格式化结果HTML
    ,
    formatResultHtml(data) {
        const formatNames = {
            linux: 'Linux Crontab (5位)',
            spring: 'Spring Cron (6位)',
            quartz: 'Quartz Cron'
        };

        let html = '<div class="cron-result">';
        html += `<div class="cron-next-label">📅 Cron表达式: <code>${data.expression}</code></div>`;
        html += `<div class="cron-next-label">格式: ${formatNames[data.format] || '自动识别'}</div>`;
        html += `<div class="cron-next-label">接下来 ${data.count} 次执行时间：</div>`;
        
        data.times.forEach((time, index) => {
            html += `<div class="cron-result-item" data-copy="${this.formatDate(time)}">
                ${index + 1}. ${this.formatDate(time)}
            </div>`;
        });

        html += '</div>';
        return html;
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CronParser;
}
