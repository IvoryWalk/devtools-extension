/**
 * 时间戳转换模块
 * 支持秒/毫秒时间戳与日期格式互转
 */
const TimestampTools = {
    // 补零函数
    padZero(num, length = 2) {
        return String(num).padStart(length, '0');
    },

    // 格式化日期
    formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
        const year = date.getFullYear();
        const month = this.padZero(date.getMonth() + 1);
        const day = this.padZero(date.getDate());
        const hours = this.padZero(date.getHours());
        const minutes = this.padZero(date.getMinutes());
        const seconds = this.padZero(date.getSeconds());

        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    },

    // 获取当前时间信息
    getCurrent() {
        const now = new Date();
        const timestampSec = Math.floor(now.getTime() / 1000);
        const timestampMs = now.getTime();

        return {
            success: true,
            result: {
                timestampSec,
                timestampMs,
                readable: this.formatDate(now, 'YYYY年MM月DD日 HH:mm:ss 星期' + ['日','一','二','三','四','五','六'][now.getDay()]),
                database: this.formatDate(now)
            }
        };
    },

    // 时间戳转日期
    timestampToDate(input) {
        try {
            let ts = input.trim();
            if (!ts) {
                return { success: false, error: '请输入时间戳' };
            }

            // 处理纯数字
            ts = ts.replace(/[^0-9]/g, '');
            if (!/^\d+$/.test(ts)) {
                return { success: false, error: '时间戳格式不正确，请输入数字' };
            }

            let timestamp = parseInt(ts, 10);
            
            // 判断是秒还是毫秒（10位是秒，13位是毫秒）
            if (ts.length === 10) {
                timestamp = timestamp * 1000;
            } else if (ts.length === 13) {
                // 已经是毫秒
            } else if (ts.length < 10) {
                // 可能是秒级时间戳太短
                timestamp = timestamp * 1000;
            }

            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                return { success: false, error: '无效的时间戳' };
            }

            return {
                success: true,
                result: {
                    input: ts,
                    timestampSec: Math.floor(timestamp / 1000),
                    timestampMs: timestamp,
                    readable: this.formatDate(date, 'YYYY年MM月DD日 HH:mm:ss 星期' + ['日','一','二','三','四','五','六'][date.getDay()]),
                    database: this.formatDate(date),
                    iso: date.toISOString(),
                    utc: date.toUTCString()
                }
            };
        } catch (e) {
            return { success: false, error: `转换失败: ${e.message}` };
        }
    },

    // 日期转时间戳
    dateToTimestamp(input) {
        try {
            let dateStr = input.trim();
            if (!dateStr) {
                return { success: false, error: '请输入日期' };
            }

            // 处理数据库格式 YYYY-MM-DD HH:mm:ss
            let date;
            if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
                // 替换空格为T，兼容ISO格式
                if (!dateStr.includes('T')) {
                    dateStr = dateStr.replace(' ', 'T');
                }
                date = new Date(dateStr);
            } else {
                date = new Date(dateStr);
            }

            if (isNaN(date.getTime())) {
                return { success: false, error: '日期格式不正确，请使用 YYYY-MM-DD HH:mm:ss 格式' };
            }

            return {
                success: true,
                result: {
                    input: input,
                    timestampSec: Math.floor(date.getTime() / 1000),
                    timestampMs: date.getTime(),
                    database: this.formatDate(date),
                    readable: this.formatDate(date, 'YYYY年MM月DD日 HH:mm:ss 星期' + ['日','一','二','三','四','五','六'][date.getDay()])
                }
            };
        } catch (e) {
            return { success: false, error: `转换失败: ${e.message}` };
        }
    },

    // 格式化输出HTML
    formatResultHtml(data) {
        let html = '<div class="timestamp-result">';
        
        if (data.timestampSec !== undefined) {
            html += `<div class="timestamp-row">
                <span class="timestamp-label">时间戳(秒):</span>
                <span class="timestamp-value" data-copy="${data.timestampSec}">${data.timestampSec}</span>
            </div>`;
        }
        if (data.timestampMs !== undefined) {
            html += `<div class="timestamp-row">
                <span class="timestamp-label">时间戳(毫秒):</span>
                <span class="timestamp-value" data-copy="${data.timestampMs}">${data.timestampMs}</span>
            </div>`;
        }
        if (data.readable) {
            html += `<div class="timestamp-row">
                <span class="timestamp-label">易读格式:</span>
                <span class="timestamp-value" data-copy="${data.readable}">${data.readable}</span>
            </div>`;
        }
        if (data.database) {
            html += `<div class="timestamp-row">
                <span class="timestamp-label">数据库格式:</span>
                <span class="timestamp-value" data-copy="${data.database}">${data.database}</span>
            </div>`;
        }
        if (data.iso) {
            html += `<div class="timestamp-row">
                <span class="timestamp-label">ISO格式:</span>
                <span class="timestamp-value" data-copy="${data.iso}">${data.iso}</span>
            </div>`;
        }
        if (data.utc) {
            html += `<div class="timestamp-row">
                <span class="timestamp-label">UTC时间:</span>
                <span class="timestamp-value" data-copy="${data.utc}">${data.utc}</span>
            </div>`;
        }

        html += '</div>';
        return html;
    },

    // 获取功能按钮配置
    getButtons() {
        return [
            { id: 'ts-current', text: '获取当前时间', action: 'getCurrent', primary: true },
            { id: 'ts-to-date', text: '时间戳转日期', action: 'timestampToDate' },
            { id: 'date-to-ts', text: '日期转时间戳', action: 'dateToTimestamp' }
        ];
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimestampTools;
}
