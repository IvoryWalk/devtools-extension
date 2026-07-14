/**
 * 编解码工具模块
 * URL、Unicode、Base64 编解码
 * 使用浏览器原生API，无需第三方库
 */
const CodecTools = {
    // URL编码
    urlEncode(input) {
        try {
            return {
                success: true,
                result: encodeURIComponent(input)
            };
        } catch (e) {
            return { success: false, error: `URL编码失败: ${e.message}` };
        }
    },

    // URL解码
    urlDecode(input) {
        try {
            return {
                success: true,
                result: decodeURIComponent(input)
            };
        } catch (e) {
            return { success: false, error: `URL解码失败: ${e.message}` };
        }
    },

    // Unicode编码 (\uXXXX格式)
    unicodeEncode(input) {
        try {
            let result = '';
            for (let i = 0; i < input.length; i++) {
                const code = input.charCodeAt(i);
                if (code < 128) {
                    result += input[i];
                } else {
                    result += '\\u' + code.toString(16).padStart(4, '0');
                }
            }
            return { success: true, result };
        } catch (e) {
            return { success: false, error: `Unicode编码失败: ${e.message}` };
        }
    },

    // Unicode解码
    unicodeDecode(input) {
        try {
            const result = input.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
                return String.fromCharCode(parseInt(hex, 16));
            });
            return { success: true, result };
        } catch (e) {
            return { success: false, error: `Unicode解码失败: ${e.message}` };
        }
    },

    // Base64编码（支持中文）
    base64Encode(input) {
        try {
            // 先将字符串转为UTF-8字节，再编码
            const bytes = new TextEncoder().encode(input);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return {
                success: true,
                result: btoa(binary)
            };
        } catch (e) {
            return { success: false, error: `Base64编码失败: ${e.message}` };
        }
    },

    // Base64解码（支持中文）
    base64Decode(input) {
        try {
            const binary = atob(input.trim());
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return {
                success: true,
                result: new TextDecoder().decode(bytes)
            };
        } catch (e) {
            return { success: false, error: `Base64解码失败: ${e.message}，请检查输入是否为有效Base64` };
        }
    },

    // 获取功能按钮配置
    getButtons() {
        return [
            { id: 'url-encode', text: 'URL编码', action: 'urlEncode' },
            { id: 'url-decode', text: 'URL解码', action: 'urlDecode' },
            { id: 'unicode-encode', text: 'Unicode编码', action: 'unicodeEncode' },
            { id: 'unicode-decode', text: 'Unicode解码', action: 'unicodeDecode' },
            { id: 'base64-encode', text: 'Base64编码', action: 'base64Encode' },
            { id: 'base64-decode', text: 'Base64解码', action: 'base64Decode' }
        ];
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodecTools;
}
