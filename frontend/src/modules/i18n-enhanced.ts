// DBNexus — i18n Enhanced Module (TypeScript)

const additionalI18nKeys: Record<string, Record<string, string>> = {
    zh: {
        'ssl_encryption': 'SSL/TLS 加密连接', 'ssl_skip_verify': '跳过证书验证', 'ssl_ca_path': 'CA 证书路径',
        'ssl_cert_path': '客户端证书路径', 'ssl_key_path': '客户端密钥路径', 'ssl_min_version': '最低 TLS 版本',
        'system_info': '系统信息', 'cpu_usage': 'CPU 使用率', 'memory_usage': '内存使用率',
        'pool_status': '连接池状态', 'slow_queries_top': '慢查询 Top 10', 'active_queries': '活跃查询',
        'search_history': '搜索历史...', 'clear_history': '清空',
        'select_repo': '选择仓库...', 'pull': 'Pull', 'push': 'Push', 'commit': 'Commit',
        'report_designer': '报表设计器', 'select_template': '选择模板...', 'save_template': '保存模板',
        'role_management': '权限角色管理', 'plugin_management': '插件管理',
        'ai_diagnose': 'AI 错误诊断', 'generated_sql': '生成的 SQL：', 'insert_to_editor': '插入编辑器',
        'loading': '加载中...', 'no_data': '无数据', 'refresh': '刷新', 'save': '保存', 'cancel': '取消',
        'delete': '删除', 'close': '关闭', 'copy': '复制', 'browse': '浏览', 'ok': '确定',
        'success': '成功', 'failed': '失败', 'warning': '警告', 'error': '错误', 'info': '信息',
    },
    en: {
        'ssl_encryption': 'SSL/TLS Encrypted Connection', 'ssl_skip_verify': 'Skip Certificate Verification',
        'ssl_ca_path': 'CA Certificate Path', 'ssl_cert_path': 'Client Certificate Path',
        'ssl_key_path': 'Client Key Path', 'ssl_min_version': 'Minimum TLS Version',
        'system_info': 'System Info', 'cpu_usage': 'CPU Usage', 'memory_usage': 'Memory Usage',
        'pool_status': 'Connection Pool Status', 'slow_queries_top': 'Slow Queries Top 10',
        'active_queries': 'Active Queries', 'search_history': 'Search history...', 'clear_history': 'Clear',
        'select_repo': 'Select repository...', 'pull': 'Pull', 'push': 'Push', 'commit': 'Commit',
        'report_designer': 'Report Designer', 'select_template': 'Select template...', 'save_template': 'Save Template',
        'role_management': 'Role Management', 'plugin_management': 'Plugin Management',
        'ai_diagnose': 'AI Error Diagnosis', 'generated_sql': 'Generated SQL:', 'insert_to_editor': 'Insert to Editor',
        'loading': 'Loading...', 'no_data': 'No data', 'refresh': 'Refresh', 'save': 'Save', 'cancel': 'Cancel',
        'delete': 'Delete', 'close': 'Close', 'copy': 'Copy', 'browse': 'Browse', 'ok': 'OK',
        'success': 'Success', 'failed': 'Failed', 'warning': 'Warning', 'error': 'Error', 'info': 'Info',
    }
};

export function mergeAdditionalI18n(): void {
    if (typeof i18n === 'undefined') return;
    for (const lang of ['zh', 'en']) {
        if (i18n.messages && i18n.messages[lang]) {
            Object.assign(i18n.messages[lang], additionalI18nKeys[lang]);
        }
    }
}

if (typeof i18n !== 'undefined') {
    setTimeout(mergeAdditionalI18n, 100);
}
