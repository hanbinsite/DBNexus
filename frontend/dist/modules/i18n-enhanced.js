/**
 * i18n Enhancement Module
 * Completes internationalization coverage for all UI elements
 */

// Additional i18n keys for uncovered UI elements
const additionalI18nKeys = {
    zh: {
        // Connection dialog
        'ssl_encryption': 'SSL/TLS 加密连接',
        'ssl_skip_verify': '跳过证书验证 (自签名证书)',
        'ssl_ca_path': 'CA 证书路径 (可选)',
        'ssl_cert_path': '客户端证书路径 (可选)',
        'ssl_key_path': '客户端密钥路径 (可选)',
        'ssl_min_version': '最低 TLS 版本',
        'ssl_test': '测试 SSL 连接',
        'cloud_provider': '云厂商',
        'cloud_region': '区域',
        'cloud_instance_id': '实例 ID (可选)',

        // Performance panel
        'system_info': '系统信息',
        'cpu_usage': 'CPU 使用率',
        'memory_usage': '内存使用率',
        'disk_usage': '磁盘使用率',
        'uptime': '运行时间',
        'pool_status': '连接池状态',
        'total_connections': '总连接数',
        'active_connections': '活跃连接',
        'idle_connections': '空闲连接',
        'max_connections': '最大连接数',
        'slow_queries_top': '慢查询 Top 10',
        'active_queries': '活跃查询',
        'cancel_query': '取消查询',

        // History panel
        'search_history': '搜索历史...',
        'filter_all': '全部',
        'filter_slow': '慢查询',
        'filter_error': '错误',
        'clear_history': '清空',

        // Git panel
        'select_repo': '选择仓库...',
        'add_repo': '添加',
        'pull': 'Pull',
        'push': 'Push',
        'commit': 'Commit',
        'new_branch': '新建分支',
        'file_changes': '文件变更',
        'commit_history': '提交历史',
        'enter_commit_msg': '请输入提交信息:',
        'enter_branch_name': '请输入新分支名称:',

        // Report designer
        'report_designer': '报表设计器',
        'select_template': '选择模板...',
        'template_name': '模板名称',
        'template_desc': '报表描述',
        'report_sections': '报表区块 (Sections)',
        'add_section': '+ 添加区块',
        'save_template': '保存模板',
        'execute_report': '执行报表',
        'report_result': '报表结果',
        'section_title': '区块标题',
        'section_type_table': '表格',
        'section_type_chart': '图表',
        'section_type_summary': '摘要',
        'section_type_text': '文本',
        'sql_query': 'SQL查询 (文本类型填内容)',
        'label_column': '标签列',
        'value_column': '数值列',

        // Settings - permissions
        'role_management': '权限角色管理',
        'role_name': '角色名称',
        'create_role': '创建角色',
        'connection_role_assign': '连接角色分配',
        'select_connection': '选择连接...',
        'select_role': '选择角色...',
        'assign': '分配',

        // Settings - plugins
        'plugin_management': '插件管理',
        'plugin_name': '插件名称',
        'plugin_version': '版本',
        'plugin_type': '类型',
        'register_plugin': '注册',
        'available_hooks': '可用钩子类型',
        'plugin_enabled': '启用',
        'plugin_disabled': '禁用',

        // AI panel
        'ai_diagnose': 'AI 错误诊断',
        'ai_generate_sql': '自然语言转 SQL',
        'nl2sql_placeholder': '例如：查询最近30天内订单金额大于1000的客户姓名和总金额',
        'generated_sql': '生成的 SQL：',
        'insert_to_editor': '插入编辑器',

        // Chart
        'chart_type_bar': '柱状图',
        'chart_type_line': '折线图',
        'chart_type_pie': '饼图',
        'select_label_col': '标签列...',
        'select_value_col': '数值列...',

        // Misc
        'loading': '加载中...',
        'no_data': '无数据',
        'refresh': '刷新',
        'save': '保存',
        'cancel': '取消',
        'delete': '删除',
        'close': '关闭',
        'copy': '复制',
        'browse': '浏览',
        'ok': '确定',
        'confirm': '确认',
        'success': '成功',
        'failed': '失败',
        'warning': '警告',
        'error': '错误',
        'info': '信息',
    },
    en: {
        'ssl_encryption': 'SSL/TLS Encrypted Connection',
        'ssl_skip_verify': 'Skip Certificate Verification (Self-signed)',
        'ssl_ca_path': 'CA Certificate Path (Optional)',
        'ssl_cert_path': 'Client Certificate Path (Optional)',
        'ssl_key_path': 'Client Key Path (Optional)',
        'ssl_min_version': 'Minimum TLS Version',
        'ssl_test': 'Test SSL Connection',
        'cloud_provider': 'Cloud Provider',
        'cloud_region': 'Region',
        'cloud_instance_id': 'Instance ID (Optional)',

        'system_info': 'System Info',
        'cpu_usage': 'CPU Usage',
        'memory_usage': 'Memory Usage',
        'disk_usage': 'Disk Usage',
        'uptime': 'Uptime',
        'pool_status': 'Connection Pool Status',
        'total_connections': 'Total Connections',
        'active_connections': 'Active Connections',
        'idle_connections': 'Idle Connections',
        'max_connections': 'Max Connections',
        'slow_queries_top': 'Slow Queries Top 10',
        'active_queries': 'Active Queries',
        'cancel_query': 'Cancel Query',

        'search_history': 'Search history...',
        'filter_all': 'All',
        'filter_slow': 'Slow',
        'filter_error': 'Error',
        'clear_history': 'Clear',

        'select_repo': 'Select repository...',
        'add_repo': 'Add',
        'pull': 'Pull',
        'push': 'Push',
        'commit': 'Commit',
        'new_branch': 'New Branch',
        'file_changes': 'File Changes',
        'commit_history': 'Commit History',
        'enter_commit_msg': 'Enter commit message:',
        'enter_branch_name': 'Enter new branch name:',

        'report_designer': 'Report Designer',
        'select_template': 'Select template...',
        'template_name': 'Template Name',
        'template_desc': 'Report Description',
        'report_sections': 'Report Sections',
        'add_section': '+ Add Section',
        'save_template': 'Save Template',
        'execute_report': 'Execute Report',
        'report_result': 'Report Result',
        'section_title': 'Section Title',
        'section_type_table': 'Table',
        'section_type_chart': 'Chart',
        'section_type_summary': 'Summary',
        'section_type_text': 'Text',
        'sql_query': 'SQL Query (or text content)',
        'label_column': 'Label Column',
        'value_column': 'Value Column',

        'role_management': 'Role Management',
        'role_name': 'Role Name',
        'create_role': 'Create Role',
        'connection_role_assign': 'Connection Role Assignment',
        'select_connection': 'Select connection...',
        'select_role': 'Select role...',
        'assign': 'Assign',

        'plugin_management': 'Plugin Management',
        'plugin_name': 'Plugin Name',
        'plugin_version': 'Version',
        'plugin_type': 'Type',
        'register_plugin': 'Register',
        'available_hooks': 'Available Hook Types',
        'plugin_enabled': 'Enabled',
        'plugin_disabled': 'Disabled',

        'ai_diagnose': 'AI Error Diagnosis',
        'ai_generate_sql': 'Natural Language to SQL',
        'nl2sql_placeholder': 'e.g. Show top 10 customers by revenue in last 30 days',
        'generated_sql': 'Generated SQL:',
        'insert_to_editor': 'Insert to Editor',

        'chart_type_bar': 'Bar Chart',
        'chart_type_line': 'Line Chart',
        'chart_type_pie': 'Pie Chart',
        'select_label_col': 'Label column...',
        'select_value_col': 'Value column...',

        'loading': 'Loading...',
        'no_data': 'No data',
        'refresh': 'Refresh',
        'save': 'Save',
        'cancel': 'Cancel',
        'delete': 'Delete',
        'close': 'Close',
        'copy': 'Copy',
        'browse': 'Browse',
        'ok': 'OK',
        'confirm': 'Confirm',
        'success': 'Success',
        'failed': 'Failed',
        'warning': 'Warning',
        'error': 'Error',
        'info': 'Info',
    }
};

// Merge additional keys into i18n
function mergeAdditionalI18n() {
    if (typeof i18n === 'undefined') return;

    for (const lang of ['zh', 'en']) {
        if (i18n.messages && i18n.messages[lang]) {
            Object.assign(i18n.messages[lang], additionalI18nKeys[lang]);
        } else if (i18n[lang]) {
            Object.assign(i18n[lang], additionalI18nKeys[lang]);
        }
    }
}

// Auto-merge on load
if (typeof i18n !== 'undefined') {
    setTimeout(mergeAdditionalI18n, 100);
}
