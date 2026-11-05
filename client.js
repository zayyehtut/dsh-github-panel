/**
 * Client half of the GitHub panel.
 *
 * Registers two seats in the running Web UI:
 *   - `sidebar.panellist` id `github`  (rail icon; the sidebar switches the
 *     main column to the matching key by itself)
 *   - `main` key `github`              (the panel)
 *
 * All data and every mutation go through the Host half's loopback JSON route
 * (`/api/github-panel`), which uses the GitHub CLI login stored in the Windows
 * keyring. This module never sees the GitHub token.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-github-panel',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const API = '/api/github-panel'
    const NS = 'dsh-github-panel'
    const PANEL_ID = 'github'
    const MUTATION_HEADER = 'x-dsh-github-panel'

    const EN = {
      panel_title: 'GitHub',
      panel_subtitle:
        'Connect once, then manage your repositories, profile and clean-up tasks from this page. Nothing here asks for a token.',
      loading: 'Loading your GitHub account…',
      error_prefix: 'Something went wrong: ',
      status_connected: 'Connected',
      status_disconnected: 'Not connected',
      connection_connected_as: 'Connected as @{login}',
      connection_via: 'via GitHub CLI on this PC · {version}',
      connection_scopes: 'Access: {scopes}',
      action_recheck: 'Re-check',
      action_disconnect: 'Disconnect',
      action_refresh: 'Refresh',
      action_edit: 'Edit',
      action_archive: 'Archive',
      action_unarchive: 'Unarchive',
      action_rename: 'Rename',
      action_open: 'Open on GitHub',
      action_save: 'Save',
      action_cancel: 'Cancel',
      action_close: 'Close',
      action_show: 'Show',
      action_copy: 'Copy',
      action_copied: 'Copied',
      action_copy_pins: 'Copy pin list',
      action_confirm_archive: 'Archive repository',
      action_confirm_unarchive: 'Unarchive repository',
      action_confirm_rename: 'Rename repository',
      action_confirm_disconnect: 'Disconnect GitHub',
      action_running: 'Working…',
      not_connected_title: 'GitHub is not connected on this PC',
      not_connected_body:
        'This page uses the GitHub CLI login stored in your Windows keyring. The panel never asks for, shows or stores your token.',
      not_connected_install: '1. Install GitHub CLI (one time, only if missing)',
      not_connected_login: '2. Run this command in a terminal, then press Re-check:',
      command_login: 'gh auth login --hostname github.com --git-protocol https --web',
      install_gh: 'Download GitHub CLI',
      reconnect_hint: 'That command opens GitHub in your browser and stores the token in the Windows keyring. Nothing is typed into this page.',
      gh_missing: 'The GitHub CLI (gh) was not found on this PC, so this panel cannot reach GitHub yet.',
      stats_repos: 'Repositories',
      stats_public: 'Public',
      stats_private: 'Private',
      stats_archived: 'Archived',
      stats_descriptions: 'Descriptions',
      stats_topics: 'Topics',
      stats_missing: '{count} missing',
      stats_admin: 'Editable',
      attention_title: 'Needs attention',
      attention_clear: 'Everything looks clean.',
      attention_not_connected: 'GitHub is not connected yet.',
      attention_profile_readme: 'Your profile README is missing.',
      attention_profile_bio: 'Your profile name or bio is empty.',
      attention_pins: 'Only {count} of 6 pinned repositories are chosen.',
      attention_duplicate_gists: '{count} group of duplicate public gists.',
      attention_missing_description: '{count} repositories have no description.',
      attention_missing_topics: '{count} repositories have no topics.',
      attention_empty_repos: '{count} empty repositories can be archived.',
      attention_unused_forks: '{count} unused forks can be archived.',
      repos_title: 'Repositories',
      repos_count: '{count} repositories',
      search_placeholder: 'Search repositories…',
      filter_all: 'All',
      filter_needs: 'Needs attention',
      filter_public: 'Public',
      filter_private: 'Private',
      filter_archived: 'Archived',
      filter_forks: 'Forks',
      filter_shared: 'Shared with me',
      filter_empty: 'Empty',
      filter_missing_description: 'No description',
      filter_missing_topics: 'No topics',
      no_results: 'No repositories match this view.',
      repo_no_description: 'No description',
      repo_empty: 'Empty repository',
      repo_updated: 'Updated {when}',
      badge_public: 'Public',
      badge_private: 'Private',
      badge_archived: 'Archived',
      badge_fork: 'Fork',
      badge_readonly: 'Read only',
      badge_shared: 'Shared',
      empty_archive_hint: 'Empty repository — archive it if you do not need it.',
      edit_title: 'Edit repository details',
      edit_description_label: 'Description',
      edit_description_hint:
        'One short sentence shown on GitHub and in search results. Leave it empty to remove the description.',
      edit_topics_label: 'Topics',
      edit_topics_hint: 'Comma-separated, lowercase, hyphens allowed. Example: react, expo, supabase',
      edit_saving: 'Saving…',
      archive_title: 'Archive repository',
      archive_body:
        '{repo} will become read-only and hidden from most views. You can unarchive it later from this same page.',
      unarchive_title: 'Unarchive repository',
      unarchive_body: '{repo} will become editable and visible again.',
      rename_title: 'Rename repository',
      rename_label: 'New name',
      rename_hint: 'GitHub keeps a redirect from the old name, so existing links keep working.',
      renaming: 'Renaming…',
      disconnect_title: 'Disconnect GitHub',
      disconnect_body:
        'This removes the GitHub CLI login from your Windows keyring. This page will stop working until you sign in again. Your GitHub account itself is not changed.',
      disconnect_hint: 'You can reconnect at any time with: gh auth login',
      disconnecting: 'Disconnecting…',
      toast_saved: 'Repository details saved.',
      toast_archived: 'Repository archived.',
      toast_unarchived: 'Repository unarchived.',
      toast_renamed: 'Repository renamed to {name}.',
      toast_disconnected: 'GitHub disconnected on this PC.',
      toast_copied: 'Copied to the clipboard.',
      profile_title: 'Profile & pins',
      profile_readme_ok: 'Profile README is live',
      profile_readme_missing: 'No profile README yet',
      profile_pins: 'Pinned repositories: {count} of 6',
      profile_suggestions: 'Suggested pins',
      profile_open: 'Open profile',
      profile_settings: 'Open profile settings',
      profile_readme_action: 'Open README repository',
      manual_title: 'Why some things open GitHub',
      manual_body:
        'GitHub does not let apps change pinned repositories or the profile name and bio through the API. These links open the right GitHub page; the panel shows the result after your next refresh.',
      readme_missing_hint:
        'A profile README is a repository named after your username that contains a README.md. I can create it for you on request.',
      log_title: 'Recent actions',
      log_empty: 'No actions yet.',
      log_ok: 'done',
      log_failed: 'failed',
      warnings_title: 'Warnings',
      footer_security:
        'The token stays in the Windows keyring; this page never displays or stores it. All changes run through the GitHub CLI on this PC.',
      footer_loopback: 'This page talks only to the local Harness service on this PC.',
      phase2_note: 'Deep analysis (README, license, CI, tests, stale dependencies) is planned for Phase 2.',
      service_offline: 'The panel service is not answering.',
      repo_admin_only: 'You have write access but not admin rights here, so these details cannot be changed from this panel.',
      time_just_now: 'just now',
      time_seconds: '{count}s ago',
      time_minutes: '{count}m ago',
      time_hours: '{count}h ago',
      time_days: '{count}d ago',
      time_months: '{count}mo ago',
      time_years: '{count}y ago',
      owner_label: 'Owner',
      account_unknown: 'unknown account',
      analysis_title: 'Deep analysis',
      analysis_subtitle:
        'Read-only health check of your repositories: README, license, CI, tests, committed junk and possible secrets. Nothing changes until you press a fix button.',
      analysis_run: 'Analyze repositories',
      analysis_running: 'Analyzing…',
      analysis_empty: 'Run the analysis to see a per-repository report.',
      analysis_grade: 'Grade',
      analysis_repo: 'Repository',
      analysis_findings: 'Findings',
      analysis_fixes: 'Fixes',
      analysis_fix_license: 'Add MIT license',
      analysis_fix_gitignore: 'Add .gitignore',
      analysis_fix_status: 'Add README status',
      analysis_no_fixes: '—',
      analysis_summary: '{count} repositories analyzed · A {a} · B {b} · C {c} · D {d} · F {f}',
      analysis_missing: '{license} missing license · {gitignore} missing .gitignore · {status} missing README status',
      analysis_clean: 'clean',
      analysis_secrets: '{count} possible secrets',
      analysis_failed: 'Analysis failed: {error}',
      toast_license_added: 'MIT license added.',
      toast_gitignore_added: '.gitignore added.',
      toast_status_added: 'README status section added.',
      phase2_note: 'Deep analysis is live in this panel. Fix buttons commit through the GitHub API with the same safety as the actions above.',
    }

    const ZH = {
      panel_title: 'GitHub',
      panel_subtitle: '连接一次后，即可在此页面管理仓库、个人资料与清理任务。这里不需要输入任何令牌。',
      loading: '正在加载 GitHub 账号…',
      error_prefix: '出现问题：',
      status_connected: '已连接',
      status_disconnected: '未连接',
      connection_connected_as: '已连接为 @{login}',
      connection_via: '通过本机的 GitHub CLI · {version}',
      connection_scopes: '权限：{scopes}',
      action_recheck: '重新检查',
      action_disconnect: '断开连接',
      action_refresh: '刷新',
      action_edit: '编辑',
      action_archive: '归档',
      action_unarchive: '取消归档',
      action_rename: '重命名',
      action_open: '在 GitHub 打开',
      action_save: '保存',
      action_cancel: '取消',
      action_close: '关闭',
      action_show: '查看',
      action_copy: '复制',
      action_copied: '已复制',
      action_copy_pins: '复制置顶清单',
      action_confirm_archive: '归档仓库',
      action_confirm_unarchive: '取消归档',
      action_confirm_rename: '重命名仓库',
      action_confirm_disconnect: '断开 GitHub',
      action_running: '处理中…',
      not_connected_title: '此电脑上的 GitHub 尚未连接',
      not_connected_body: '本页面使用 Windows 密钥环中保存的 GitHub CLI 登录信息，面板不会索取、显示或保存你的令牌。',
      not_connected_install: '1. 安装 GitHub CLI（仅缺失时需要，一次即可）',
      not_connected_login: '2. 在终端运行以下命令，然后点击“重新检查”：',
      command_login: 'gh auth login --hostname github.com --git-protocol https --web',
      install_gh: '下载 GitHub CLI',
      reconnect_hint: '该命令会在浏览器中打开 GitHub，并把令牌保存到 Windows 密钥环。无需在此页面输入任何内容。',
      gh_missing: '此电脑未找到 GitHub CLI（gh），面板暂时无法连接 GitHub。',
      stats_repos: '仓库',
      stats_public: '公开',
      stats_private: '私有',
      stats_archived: '已归档',
      stats_descriptions: '描述',
      stats_topics: '主题',
      stats_missing: '缺少 {count} 个',
      stats_admin: '可编辑',
      attention_title: '需要处理',
      attention_clear: '一切都很干净。',
      attention_not_connected: 'GitHub 尚未连接。',
      attention_profile_readme: '个人资料 README 缺失。',
      attention_profile_bio: '个人资料名称或简介为空。',
      attention_pins: '仅选择了 {count}/6 个置顶仓库。',
      attention_duplicate_gists: '有 {count} 组重复的公开 gist。',
      attention_missing_description: '{count} 个仓库缺少描述。',
      attention_missing_topics: '{count} 个仓库缺少主题。',
      attention_empty_repos: '{count} 个空仓库可以归档。',
      attention_unused_forks: '{count} 个未使用的 fork 可以归档。',
      repos_title: '仓库',
      repos_count: '{count} 个仓库',
      search_placeholder: '搜索仓库…',
      filter_all: '全部',
      filter_needs: '需要处理',
      filter_public: '公开',
      filter_private: '私有',
      filter_archived: '已归档',
      filter_forks: 'Fork',
      filter_shared: '共享给我的',
      filter_empty: '空仓库',
      filter_missing_description: '缺少描述',
      filter_missing_topics: '缺少主题',
      no_results: '没有匹配的仓库。',
      repo_no_description: '无描述',
      repo_empty: '空仓库',
      repo_updated: '更新于 {when}',
      badge_public: '公开',
      badge_private: '私有',
      badge_archived: '已归档',
      badge_fork: 'Fork',
      badge_readonly: '只读',
      badge_shared: '共享',
      empty_archive_hint: '空仓库 — 如果不需要可以归档。',
      edit_title: '编辑仓库详情',
      edit_description_label: '描述',
      edit_description_hint: '一句简短说明，会显示在 GitHub 和搜索结果中。留空可删除描述。',
      edit_topics_label: '主题',
      edit_topics_hint: '用逗号分隔，小写，可包含连字符。例如：react, expo, supabase',
      edit_saving: '正在保存…',
      archive_title: '归档仓库',
      archive_body: '{repo} 将变为只读并在大多数视图中隐藏。之后可以在本页面取消归档。',
      unarchive_title: '取消归档',
      unarchive_body: '{repo} 将恢复可编辑与可见。',
      rename_title: '重命名仓库',
      rename_label: '新名称',
      rename_hint: 'GitHub 会保留旧名称的跳转，已有链接仍然有效。',
      renaming: '正在重命名…',
      disconnect_title: '断开 GitHub',
      disconnect_body: '这会从 Windows 密钥环中移除 GitHub CLI 登录信息。本页面将停止工作，直到重新登录。你的 GitHub 账号本身不会改变。',
      disconnect_hint: '随时可以用以下命令重新连接：gh auth login',
      disconnecting: '正在断开…',
      toast_saved: '仓库详情已保存。',
      toast_archived: '仓库已归档。',
      toast_unarchived: '已取消归档。',
      toast_renamed: '仓库已重命名为 {name}。',
      toast_disconnected: '已断开此电脑上的 GitHub 连接。',
      toast_copied: '已复制到剪贴板。',
      profile_title: '个人资料与置顶',
      profile_readme_ok: '个人资料 README 已生效',
      profile_readme_missing: '尚无个人资料 README',
      profile_pins: '置顶仓库：{count}/6',
      profile_suggestions: '建议置顶',
      profile_open: '打开个人主页',
      profile_settings: '打开资料设置',
      profile_readme_action: '打开 README 仓库',
      manual_title: '为什么有些操作会打开 GitHub',
      manual_body: 'GitHub 不允许应用通过 API 修改置顶仓库或个人资料名称/简介。这些链接会打开对应的 GitHub 页面，面板会在下次刷新后显示结果。',
      readme_missing_hint: '个人资料 README 是一个以用户名命名的仓库，里面包含 README.md。需要的话我可以为你创建。',
      log_title: '最近操作',
      log_empty: '暂无操作。',
      log_ok: '完成',
      log_failed: '失败',
      warnings_title: '警告',
      footer_security: '令牌保存在 Windows 密钥环中，本页面从不显示或保存它。所有修改都通过本机的 GitHub CLI 执行。',
      footer_loopback: '本页面只与本机的 Harness 服务通信。',
      phase2_note: '深度分析（README、许可证、CI、测试、过期依赖）将在第二阶段提供。',
      service_offline: '面板服务无响应。',
      repo_admin_only: '你在此仓库有写入权限但没有管理员权限，因此无法从面板修改这些详情。',
      time_just_now: '刚刚',
      time_seconds: '{count} 秒前',
      time_minutes: '{count} 分钟前',
      time_hours: '{count} 小时前',
      time_days: '{count} 天前',
      time_months: '{count} 个月前',
      time_years: '{count} 年前',
      owner_label: '所有者',
      account_unknown: '未知账号',
      analysis_title: '深度分析',
      analysis_subtitle: '对仓库进行只读健康检查：README、许可证、CI、测试、误提交的垃圾文件与可能的密钥。只有点击修复按钮才会产生改动。',
      analysis_run: '分析仓库',
      analysis_running: '分析中…',
      analysis_empty: '运行分析以查看每个仓库的报告。',
      analysis_grade: '评级',
      analysis_repo: '仓库',
      analysis_findings: '问题',
      analysis_fixes: '修复',
      analysis_fix_license: '添加 MIT 许可证',
      analysis_fix_gitignore: '添加 .gitignore',
      analysis_fix_status: '添加 README 状态说明',
      analysis_no_fixes: '—',
      analysis_summary: '已分析 {count} 个仓库 · A {a} · B {b} · C {c} · D {d} · F {f}',
      analysis_missing: '{license} 个缺少许可证 · {gitignore} 个缺少 .gitignore · {status} 个缺少 README 状态',
      analysis_clean: '干净',
      analysis_secrets: '{count} 个可能的密钥',
      analysis_failed: '分析失败：{error}',
      toast_license_added: '已添加 MIT 许可证。',
      toast_gitignore_added: '已添加 .gitignore。',
      toast_status_added: '已添加 README 状态说明。',
      phase2_note: '深度分析已在本面板上线。修复按钮与上方操作一样，通过 GitHub API 提交并同样安全。',
    }

    /** Translator and locale subscription are installed by `apply`. */
    let t = (key) => key
    let subscribeLocale = null

    function tr(key, params) {
      const raw = t(key)
      if (!params) return raw
      return String(raw).replace(/\{(\w+)\}/g, (match, name) =>
        params[name] == null ? match : String(params[name]),
      )
    }

    function withLocale(Component) {
      return function LocaleBound(props) {
        const [, bump] = React.useState(0)
        React.useEffect(() => {
          if (!subscribeLocale) return undefined
          return subscribeLocale(() => bump((value) => value + 1))
        }, [])
        return h(Component, props)
      }
    }

    const palette = {
      text: 'var(--dsw-alias-label-primary, #1f2328)',
      muted: 'var(--dsw-alias-label-secondary, #656d76)',
      border: 'var(--dsw-alias-border-l1, #d8dee4)',
      borderStrong: 'var(--dsw-alias-border-l2, #bcc4cc)',
      surface: 'var(--dsw-alias-bg-layer-1, #ffffff)',
      surfaceAlt: 'var(--dsw-alias-bg-layer-2, #f6f8fa)',
      page: 'var(--dsw-alias-bg-base, #ffffff)',
      brand: 'var(--dsw-alias-brand-primary, #4f46e5)',
      success: 'var(--dsw-alias-state-success-primary, #1a7f37)',
      warn: 'var(--dsw-alias-state-warn-primary, #9a6700)',
      error: 'var(--dsw-alias-state-error-primary, #cf222e)',
      idle: 'var(--dsw-alias-state-idle-primary, #8c959f)',
    }

    const fonts = {
      mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    }

    const styles = {
      page: {
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        background: palette.page,
        color: palette.text,
      },
      container: { maxWidth: 980, margin: '0 auto', padding: '36px 28px 72px', boxSizing: 'border-box' },
      h1: { fontSize: 20, fontWeight: 600, margin: '0 0 6px', lineHeight: 1.3 },
      subtitle: { fontSize: 13, lineHeight: 1.65, color: palette.muted, margin: '0 0 22px', maxWidth: 640 },
      card: {
        border: `1px solid ${palette.border}`,
        background: palette.surface,
        borderRadius: 14,
        padding: 20,
        marginBottom: 16,
      },
      cardTitle: { fontSize: 14, fontWeight: 600, margin: '0 0 12px' },
      row: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
      muted: { color: palette.muted, fontSize: 12.5, lineHeight: 1.6 },
      link: { color: palette.brand, textDecoration: 'none', fontWeight: 500 },
    }

    /* ---------------------------------------------------------------- */
    /* Primitives                                                       */
    /* ---------------------------------------------------------------- */

    function Button({ children, onClick, variant = 'default', disabled, title, style }) {
      const [hover, setHover] = React.useState(false)
      const variants = {
        default: {
          border: `1px solid ${hover ? palette.borderStrong : palette.border}`,
          background: hover ? palette.surfaceAlt : 'transparent',
          color: palette.text,
        },
        primary: {
          border: `1px solid ${palette.text}`,
          background: palette.text,
          color: palette.page,
          fontWeight: 600,
        },
        danger: {
          border: `1px solid ${palette.error}`,
          background: 'transparent',
          color: palette.error,
        },
        subtle: {
          border: '1px solid transparent',
          background: 'transparent',
          color: palette.muted,
        },
      }
      return h(
        'button',
        {
          type: 'button',
          title,
          onClick: disabled ? undefined : onClick,
          disabled,
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
          style: {
            appearance: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            height: 30,
            padding: '0 12px',
            borderRadius: 8,
            font: 'inherit',
            fontSize: 12.5,
            fontWeight: 500,
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.55 : 1,
            whiteSpace: 'nowrap',
            transition: 'background 120ms ease, border-color 120ms ease',
            ...variants[variant],
            ...style,
          },
        },
        children,
      )
    }

    function Badge({ children, tone }) {
      const tones = {
        neutral: { color: palette.muted, border: palette.border, background: 'transparent' },
        warn: { color: palette.warn, border: palette.warn, background: 'transparent' },
        archived: { color: palette.muted, border: palette.border, background: palette.surfaceAlt },
        brand: { color: palette.brand, border: palette.brand, background: 'transparent' },
      }
      const value = tones[tone] || tones.neutral
      return h(
        'span',
        {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            height: 20,
            padding: '0 7px',
            borderRadius: 999,
            border: `1px solid ${value.border}`,
            color: value.color,
            background: value.background,
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: 'nowrap',
          },
        },
        children,
      )
    }

    function StatusDot({ tone }) {
      return h('span', {
        'aria-hidden': true,
        style: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: tone, flex: '0 0 auto' },
      })
    }

    function Avatar({ login }) {
      const letter = String(login || '?').trim().charAt(0).toUpperCase() || '?'
      return h(
        'span',
        {
          'aria-hidden': true,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: palette.surfaceAlt,
            border: `1px solid ${palette.border}`,
            fontSize: 15,
            fontWeight: 600,
            color: palette.muted,
            flex: '0 0 auto',
          },
        },
        letter,
      )
    }

    function Link({ href, children }) {
      return h(
        'a',
        { href, target: '_blank', rel: 'noreferrer noopener', style: styles.link },
        children,
      )
    }

    function Modal({ title, children, footer, onClose }) {
      React.useEffect(() => {
        const handler = (event) => {
          if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
      }, [onClose])
      return h(
        'div',
        {
          role: 'presentation',
          onClick: onClose,
          style: {
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(0, 0, 0, 0.35)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '96px 20px 40px',
            overflowY: 'auto',
          },
        },
        h(
          'div',
          {
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': title,
            onClick: (event) => event.stopPropagation(),
            style: {
              width: '100%',
              maxWidth: 540,
              background: palette.surface,
              color: palette.text,
              border: `1px solid ${palette.border}`,
              borderRadius: 14,
              boxShadow: '0 18px 50px rgba(0, 0, 0, 0.22)',
              padding: 22,
            },
          },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 } },
            h('h2', { style: { fontSize: 16, fontWeight: 600, margin: 0 } }, title),
            h(
              'button',
              {
                type: 'button',
                onClick: onClose,
                'aria-label': tr('action_close'),
                style: {
                  appearance: 'none',
                  border: 'none',
                  background: 'transparent',
                  color: palette.muted,
                  fontSize: 20,
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: 2,
                },
              },
              '×',
            ),
          ),
          h('div', { style: { fontSize: 13, lineHeight: 1.65 } }, children),
          footer
            ? h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 } }, footer)
            : null,
        ),
      )
    }

    function Field({ label, hint, children }) {
      return h(
        'label',
        { style: { display: 'block', marginBottom: 14 } },
        h('span', { style: { display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 } }, label),
        children,
        hint ? h('span', { style: { display: 'block', ...styles.muted, marginTop: 4 } }, hint) : null,
      )
    }

    function TextInput({ value, onChange, placeholder, multiline, autoFocus }) {
      const common = {
        value,
        onChange: (event) => onChange(event.target.value),
        placeholder,
        autoFocus,
        style: {
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px 10px',
          borderRadius: 8,
          border: `1px solid ${palette.border}`,
          background: palette.page,
          color: palette.text,
          font: 'inherit',
          fontSize: 13,
          lineHeight: 1.5,
        },
      }
      if (multiline) {
        return h('textarea', { ...common, rows: 3 })
      }
      return h('input', { ...common, type: 'text' })
    }

    /* ---------------------------------------------------------------- */
    /* Helpers                                                          */
    /* ---------------------------------------------------------------- */

    function formatRelative(iso) {
      if (!iso) return '—'
      const time = Date.parse(iso)
      if (!Number.isFinite(time)) return '—'
      const seconds = Math.round((Date.now() - time) / 1000)
      if (seconds < 45) return tr('time_just_now')
      const minutes = Math.round(seconds / 60)
      if (minutes < 60) return tr('time_minutes', { count: minutes })
      const hours = Math.round(minutes / 60)
      if (hours < 24) return tr('time_hours', { count: hours })
      const days = Math.round(hours / 24)
      if (days < 30) return tr('time_days', { count: days })
      const months = Math.round(days / 30)
      if (months < 12) return tr('time_months', { count: months })
      return tr('time_years', { count: Math.round(months / 12) })
    }

    function parseTopics(text) {
      return String(text || '')
        .split(',')
        .map((value) => value.trim().replace(/^#/, '').toLowerCase())
        .filter(Boolean)
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        return false
      }
    }

    function matchesFilter(repo, filter, query, login) {
      const haystack = `${repo.name} ${repo.fullName} ${repo.description} ${(repo.topics || []).join(' ')}`.toLowerCase()
      if (query && !haystack.includes(String(query).toLowerCase())) return false
      switch (filter) {
        case 'all':
          return true
        case 'needs':
          return repo.canAdmin && !repo.archived && (!repo.description || repo.topics.length === 0 || repo.empty)
        case 'public':
          return !repo.private
        case 'private':
          return repo.private
        case 'archived':
          return repo.archived
        case 'forks':
          return repo.fork
        case 'shared':
          return Boolean(login) && repo.owner !== login
        case 'empty':
          return repo.canAdmin && !repo.archived && repo.empty
        case 'missing-description':
          return repo.canAdmin && !repo.archived && !repo.description
        case 'missing-topics':
          return repo.canAdmin && !repo.archived && repo.topics.length === 0
        default:
          return true
      }
    }

    function filterLabel(filter) {
      const key = {
        all: 'filter_all',
        needs: 'filter_needs',
        public: 'filter_public',
        private: 'filter_private',
        archived: 'filter_archived',
        forks: 'filter_forks',
        shared: 'filter_shared',
        empty: 'filter_empty',
        'missing-description': 'filter_missing_description',
        'missing-topics': 'filter_missing_topics',
      }[filter]
      return key ? tr(key) : filter
    }

    const FILTERS = ['all', 'needs', 'public', 'private', 'archived', 'forks', 'shared']

    /* ---------------------------------------------------------------- */
    /* Data                                                             */
    /* ---------------------------------------------------------------- */

    function useOverview() {
      const [snapshot, setSnapshot] = React.useState({ phase: 'loading', data: null, error: null })
      const mounted = React.useRef(true)

      const load = React.useCallback(async (force) => {
        try {
          const response = await fetch(`${API}/overview${force ? '?refresh=1' : ''}`, {
            headers: { accept: 'application/json' },
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const data = await response.json()
          if (mounted.current) setSnapshot({ phase: 'ready', data, error: null })
          return data
        } catch (error) {
          if (mounted.current) {
            setSnapshot((previous) => ({
              phase: previous.data ? 'ready' : 'error',
              data: previous.data,
              error: String((error && error.message) || error),
            }))
          }
          return null
        }
      }, [])

      React.useEffect(() => {
        mounted.current = true
        load(false)
        const timer = setInterval(() => load(false), 30_000)
        return () => {
          mounted.current = false
          clearInterval(timer)
        }
      }, [load])

      return [snapshot, load]
    }

    /* ---------------------------------------------------------------- */
    /* Sections                                                         */
    /* ---------------------------------------------------------------- */

    function ConnectionCard({ data, onRefresh, onDisconnect, onCopy, busy }) {
      const connection = data.connection || {}
      const account = connection.account || null
      const connected = Boolean(connection.connected)
      const statusTone = snapshotTone(data)
      const scopes = Array.isArray(connection.scopes) ? connection.scopes : []
      const version = connection.version ? String(connection.version).replace(/^gh version\s*/i, '') : ''

      const body = []
      if (!connection.installed) {
        body.push(
          h('div', { key: 'missing', style: { fontSize: 13, lineHeight: 1.7 } },
            h('p', { style: { margin: '0 0 10px', fontWeight: 600 } }, tr('not_connected_title')),
            h('p', { style: { margin: '0 0 12px' } }, tr('gh_missing')),
            h(Link, { href: 'https://cli.github.com/', children: tr('install_gh') }),
          ),
        )
      } else if (!connected) {
        body.push(
          h('div', { key: 'offline', style: { fontSize: 13, lineHeight: 1.7 } },
            h('p', { style: { margin: '0 0 10px', fontWeight: 600 } }, tr('not_connected_title')),
            h('p', { style: { margin: '0 0 14px', color: palette.muted } }, tr('not_connected_body')),
            h('p', { style: { margin: '0 0 6px', fontWeight: 600 } }, tr('not_connected_install')),
            h('p', { style: { margin: '0 0 8px', fontWeight: 600 } }, tr('not_connected_login')),
            h(
              'div',
              { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 } },
              h(
                'code',
                {
                  style: {
                    flex: '1 1 320px',
                    fontFamily: fonts.mono,
                    fontSize: 12,
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: `1px solid ${palette.border}`,
                    background: palette.surfaceAlt,
                    wordBreak: 'break-all',
                  },
                },
                tr('command_login'),
              ),
              h(Button, { onClick: () => onCopy(tr('command_login')) }, tr('action_copy')),
            ),
            h('p', { style: { margin: '0 0 12px', color: palette.muted, fontSize: 12.5 } }, tr('reconnect_hint')),
            h(Link, { href: 'https://cli.github.com/', children: tr('install_gh') }),
          ),
        )
        if (connection.error) {
          body.push(h('p', { key: 'err', style: { margin: '12px 0 0', fontSize: 12, color: palette.error } }, connection.error))
        }
      } else {
        body.push(
          h(
            'div',
            { key: 'connected', style: { display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' } },
            h(Avatar, { login: account ? account.login : '' }),
            h(
              'div',
              { style: { flex: '1 1 260px', minWidth: 220 } },
              h('p', { style: { margin: '0 0 4px', fontSize: 14, fontWeight: 600 } },
                tr('connection_connected_as', { login: account ? account.login : tr('account_unknown') }),
              ),
              h('p', { style: { margin: '0 0 4px', ...styles.muted } },
                tr('connection_via', { version: version || 'gh' }),
              ),
              scopes.length
                ? h('p', { style: { margin: '0 0 4px', ...styles.muted } },
                    tr('connection_scopes', { scopes: scopes.join(', ') }),
                  )
                : null,
              account && account.name
                ? h('p', { style: { margin: 0, ...styles.muted } }, account.name)
                : null,
            ),
          ),
        )
      }

      return h(
        'section',
        { style: styles.card },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 } },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 } },
            h(StatusDot, { tone: statusTone }),
            h('span', null, connected ? tr('status_connected') : tr('status_disconnected')),
          ),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            h(Button, { onClick: onRefresh, disabled: Boolean(busy) }, busy ? tr('action_running') : tr('action_recheck')),
            connected
              ? h(Button, { variant: 'danger', onClick: onDisconnect, disabled: Boolean(busy) }, tr('action_disconnect'))
              : null,
            h(Link, { href: account ? `https://github.com/${account.login}` : 'https://github.com/', children: tr('profile_open') }),
          ),
        ),
        body,
      )
    }

    function snapshotTone(data) {
      const connection = (data && data.connection) || {}
      if (!connection.connected) return palette.error
      return palette.success
    }

    function StatsRow({ stats }) {
      if (!stats) return null
      const tiles = [
        { label: tr('stats_repos'), value: stats.total },
        { label: tr('stats_public'), value: stats.public },
        { label: tr('stats_private'), value: stats.private },
        { label: tr('stats_archived'), value: stats.archived },
        {
          label: tr('stats_descriptions'),
          value: stats.missingDescription ? tr('stats_missing', { count: stats.missingDescription }) : '✓',
          tone: stats.missingDescription ? palette.warn : palette.success,
        },
        {
          label: tr('stats_topics'),
          value: stats.missingTopics ? tr('stats_missing', { count: stats.missingTopics }) : '✓',
          tone: stats.missingTopics ? palette.warn : palette.success,
        },
      ]
      return h(
        'div',
        { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 } },
        tiles.map((tile, index) =>
          h(
            'div',
            {
              key: index,
              style: {
                border: `1px solid ${palette.border}`,
                background: palette.surface,
                borderRadius: 12,
                padding: '12px 14px',
              },
            },
            h('div', { style: { fontSize: 11.5, color: palette.muted, marginBottom: 4 } }, tile.label),
            h('div', { style: { fontSize: 18, fontWeight: 600, color: tile.tone || palette.text } }, tile.value),
          ),
        ),
      )
    }

    function AttentionRow({ item, onShow, onOpenProfile, onOpenSettings }) {
      const map = {
        'not-connected': tr('attention_not_connected'),
        'profile-readme': tr('attention_profile_readme'),
        'profile-bio': tr('attention_profile_bio'),
        pins: tr('attention_pins', { count: item.count }),
        'duplicate-gists': tr('attention_duplicate_gists', { count: item.count }),
        'missing-description': tr('attention_missing_description', { count: item.count }),
        'missing-topics': tr('attention_missing_topics', { count: item.count }),
        'empty-repos': tr('attention_empty_repos', { count: item.count }),
        'unused-forks': tr('attention_unused_forks', { count: item.count }),
      }
      const text = map[item.id] || item.id
      const tone = item.severity === 'warn' ? palette.warn : item.severity === 'error' ? palette.error : palette.muted
      const showable = ['missing-description', 'missing-topics', 'empty-repos', 'unused-forks']
      return h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 0',
            borderTop: `1px solid ${palette.border}`,
            flexWrap: 'wrap',
          },
        },
        h(StatusDot, { tone }),
        h('span', { style: { flex: '1 1 240px', fontSize: 12.5, lineHeight: 1.5 } }, text),
        showable.includes(item.id)
          ? h(Button, { variant: 'subtle', onClick: () => onShow(item.id) }, tr('action_show'))
          : null,
        item.id === 'profile-readme'
          ? h(Button, { variant: 'subtle', onClick: onOpenProfile }, tr('profile_open'))
          : null,
        item.id === 'profile-bio'
          ? h(Button, { variant: 'subtle', onClick: onOpenSettings }, tr('profile_settings'))
          : null,
        item.id === 'pins'
          ? h(Button, { variant: 'subtle', onClick: onOpenProfile }, tr('profile_open'))
          : null,
      )
    }

    function AttentionCard({ items, onShow, onOpenProfile, onOpenSettings }) {
      if (!items || items.length === 0) {
        return h(
          'section',
          { style: styles.card },
          h('h2', { style: styles.cardTitle }, tr('attention_title')),
          h('p', { style: { margin: 0, fontSize: 13, color: palette.success } }, tr('attention_clear')),
        )
      }
      return h(
        'section',
        { style: styles.card },
        h('h2', { style: styles.cardTitle }, tr('attention_title')),
        h(
          'div',
          null,
          items.map((item) =>
            h(AttentionRow, {
              key: item.id,
              item,
              onShow,
              onOpenProfile,
              onOpenSettings,
            }),
          ),
        ),
      )
    }

    function RepoRow({ repo, login, onEdit, onArchive, onRename }) {
      const shared = Boolean(login) && repo.owner !== login
      return h(
        'div',
        {
          style: {
            borderTop: `1px solid ${palette.border}`,
            padding: '13px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
          },
        },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          h(Link, { href: `https://github.com/${repo.fullName}`, children: shared ? repo.fullName : repo.name }),
          repo.private ? h(Badge, { children: tr('badge_private') }) : h(Badge, { children: tr('badge_public') }),
          repo.archived ? h(Badge, { tone: 'archived', children: tr('badge_archived') }) : null,
          repo.fork ? h(Badge, { children: tr('badge_fork') }) : null,
          shared ? h(Badge, { tone: 'brand', children: tr('badge_shared') }) : null,
          !repo.canAdmin ? h(Badge, { children: tr('badge_readonly') }) : null,
          h('span', { style: { flex: 1 } }),
          repo.canAdmin && !repo.archived
            ? h(Button, { variant: 'subtle', onClick: () => onEdit(repo) }, tr('action_edit'))
            : null,
          repo.canAdmin && !repo.archived
            ? h(Button, { variant: 'subtle', onClick: () => onRename(repo) }, tr('action_rename'))
            : null,
          repo.canAdmin
            ? h(
                Button,
                { variant: 'subtle', onClick: () => onArchive(repo) },
                repo.archived ? tr('action_unarchive') : tr('action_archive'),
              )
            : null,
          h(Link, { href: `https://github.com/${repo.fullName}`, children: tr('action_open') }),
        ),
        h(
          'div',
          { style: { fontSize: 12.5, lineHeight: 1.55, color: repo.description ? palette.text : palette.muted } },
          repo.description || tr('repo_no_description'),
          repo.empty ? h('span', { style: { color: palette.warn } }, ` · ${tr('repo_empty')}`) : null,
        ),
        shared
          ? h('div', { style: { fontSize: 11.5, lineHeight: 1.5, color: palette.muted } }, tr('repo_admin_only'))
          : null,
        repo.topics && repo.topics.length
          ? h(
              'div',
              { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
              repo.topics.map((topic) => h(Badge, { key: topic, children: topic })),
            )
          : null,
        h(
          'div',
          { style: { display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11.5, color: palette.muted } },
          h('span', null, tr('repo_updated', { when: formatRelative(repo.pushedAt) })),
          repo.language ? h('span', null, repo.language) : null,
          repo.stars ? h('span', null, `★ ${repo.stars}`) : null,
          h('span', null, repo.fullName),
        ),
      )
    }

    function RepositoriesCard({ repos, login, filter, onFilter, query, onQuery, onEdit, onArchive, onRename }) {
      const visible = (repos || []).filter((repo) => matchesFilter(repo, filter, query, login))
      const tabs = FILTERS.map((value) =>
        h(
          Button,
          {
            key: value,
            variant: filter === value ? 'primary' : 'subtle',
            onClick: () => onFilter(value),
            style: { height: 26, padding: '0 10px', borderRadius: 999, fontSize: 11.5 },
          },
          filterLabel(value),
        ),
      )
      if (!FILTERS.includes(filter)) {
        tabs.push(
          h(
            Button,
            {
              key: filter,
              variant: 'primary',
              onClick: () => onFilter('all'),
              style: { height: 26, padding: '0 10px', borderRadius: 999, fontSize: 11.5 },
            },
            `${filterLabel(filter)} ×`,
          ),
        )
      }
      return h(
        'section',
        { style: styles.card },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } },
          h('h2', { style: { ...styles.cardTitle, marginBottom: 0 } }, tr('repos_title')),
          h('span', { style: styles.muted }, tr('repos_count', { count: (repos || []).length })),
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '12px 0 4px' } },
          h('div', { style: { flex: '1 1 220px', minWidth: 180 } },
            h(TextInput, { value: query, onChange: onQuery, placeholder: tr('search_placeholder') }),
          ),
          tabs,
        ),
        visible.length === 0
          ? h('p', { style: { margin: '16px 0 4px', fontSize: 13, color: palette.muted } }, tr('no_results'))
          : h(
              'div',
              { style: { marginTop: 6 } },
              visible.map((repo) =>
                h(RepoRow, {
                  key: repo.fullName,
                  repo,
                  login,
                  onEdit,
                  onArchive,
                  onRename,
                }),
              ),
            ),
      )
    }

    function AnalysisCard({ analysis, busy, onRun, onFix }) {
      const data = analysis.data
      const running = analysis.phase === 'running'
      const fixButtons = (result) => {
        const fixes = []
        if (result.canFix && result.canFix.license) {
          fixes.push(h(Button, { key: 'license', variant: 'subtle', disabled: Boolean(busy) || running, onClick: () => onFix('/action/apply-license', result.repo) }, tr('analysis_fix_license')))
        }
        if (result.canFix && result.canFix.gitignore) {
          fixes.push(h(Button, { key: 'gitignore', variant: 'subtle', disabled: Boolean(busy) || running, onClick: () => onFix('/action/add-gitignore', result.repo) }, tr('analysis_fix_gitignore')))
        }
        if (result.canFix && result.canFix.readmeStatus) {
          fixes.push(h(Button, { key: 'status', variant: 'subtle', disabled: Boolean(busy) || running, onClick: () => onFix('/action/readme-status', result.repo) }, tr('analysis_fix_status')))
        }
        return fixes.length ? h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } }, fixes) : h('span', { style: styles.muted }, tr('analysis_no_fixes'))
      }
      return h(
        'section',
        { style: styles.card },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } },
          h('h2', { style: { ...styles.cardTitle, marginBottom: 0 } }, tr('analysis_title')),
          h(Button, { variant: 'primary', onClick: onRun, disabled: running }, running ? tr('analysis_running') : tr('analysis_run')),
        ),
        h('p', { style: { margin: '8px 0 12px', ...styles.muted, maxWidth: 720 } }, tr('analysis_subtitle')),
        analysis.error
          ? h('p', { style: { margin: '0 0 10px', fontSize: 12, color: palette.error } }, tr('analysis_failed', { error: analysis.error }))
          : null,
        !data
          ? h('p', { style: { margin: 0, fontSize: 12.5, color: palette.muted } }, tr('analysis_empty'))
          : h(
              'div',
              null,
              h('p', { style: { margin: '0 0 6px', fontSize: 12.5, fontWeight: 600 } },
                tr('analysis_summary', {
                  count: data.summary.repositories,
                  a: data.summary.grades.A,
                  b: data.summary.grades.B,
                  c: data.summary.grades.C,
                  d: data.summary.grades.D,
                  f: data.summary.grades.F,
                }),
              ),
              h('p', { style: { margin: '0 0 10px', ...styles.muted } },
                tr('analysis_missing', {
                  license: data.summary.missingLicense,
                  gitignore: data.summary.missingGitignore,
                  status: data.summary.missingStatus,
                }),
              ),
              data.repos.map((result) => {
                const tone = result.score >= 75 ? palette.success : result.score >= 40 ? palette.warn : palette.error
                const findings = result.error
                  ? [result.error]
                  : (result.flags || []).concat(
                      result.secrets && result.secrets.length ? [tr('analysis_secrets', { count: result.secrets.length })] : [],
                    )
                return h(
                  'div',
                  {
                    key: result.repo,
                    style: { borderTop: `1px solid ${palette.border}`, padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 6 },
                  },
                  h(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                    h(Link, { href: `https://github.com/${result.repo}`, children: result.repo }),
                    h('span', { style: { fontSize: 12, fontWeight: 600, color: tone } }, `${result.grade} (${result.score})`),
                    h('span', { style: { flex: 1 } }),
                    fixButtons(result),
                  ),
                  h('div', { style: { fontSize: 11.5, lineHeight: 1.5, color: findings.length ? palette.muted : palette.success } },
                    findings.length ? findings.join(' · ') : tr('analysis_clean'),
                  ),
                )
              }),
            ),
      )
    }

    function ProfileCard({ profile, account }) {
      if (!profile) return null
      const login = account ? account.login : ''
      const readmeHref = login ? `https://github.com/${login}/${login}` : 'https://github.com/'
      const profileHref = login ? `https://github.com/${login}` : 'https://github.com/'
      const settingsHref = 'https://github.com/settings/profile'
      const suggestions = (profile.pinSuggestions || []).filter(
        (name) => !login || name !== `${login}/${login}`,
      )
      return h(
        'section',
        { style: styles.card },
        h('h2', { style: styles.cardTitle }, tr('profile_title')),
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 } },
          h(
            'div',
            { style: styles.row },
            h(StatusDot, { tone: profile.readme ? palette.success : palette.warn }),
            h('span', null, profile.readme ? tr('profile_readme_ok') : tr('profile_readme_missing')),
            h(Button, { variant: 'subtle', onClick: () => window.open(readmeHref, '_blank', 'noreferrer') }, tr('profile_readme_action')),
          ),
          !profile.readme
            ? h('p', { style: { margin: 0, ...styles.muted } }, tr('readme_missing_hint'))
            : null,
          h(
            'div',
            { style: styles.row },
            h(StatusDot, { tone: profile.pinned.length >= 6 ? palette.success : palette.warn }),
            h('span', null, tr('profile_pins', { count: profile.pinned.length })),
            h(Button, { variant: 'subtle', onClick: () => window.open(profileHref, '_blank', 'noreferrer') }, tr('profile_open')),
          ),
          suggestions.length
            ? h(
                'div',
                { style: { borderTop: `1px solid ${palette.border}`, paddingTop: 10 } },
                h('p', { style: { margin: '0 0 6px', fontSize: 12.5, fontWeight: 600 } }, tr('profile_suggestions')),
                h(
                  'div',
                  { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
                  suggestions.map((name) => h(Badge, { key: name, tone: 'brand', children: name })),
                ),
                h(
                  'div',
                  { style: { display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' } },
                  h(
                    Button,
                    {
                      onClick: async () => {
                        const copied = await copyText(suggestions.join('\n'))
                        if (copied) window.dispatchEvent(new CustomEvent('dsh-github-copied'))
                      },
                    },
                    tr('action_copy_pins'),
                  ),
                  h(Button, { variant: 'subtle', onClick: () => window.open(profileHref, '_blank', 'noreferrer') }, tr('profile_open')),
                ),
              )
            : null,
          h(
            'div',
            { style: { borderTop: `1px solid ${palette.border}`, paddingTop: 10 } },
            h('p', { style: { margin: '0 0 4px', fontSize: 12.5, fontWeight: 600 } }, tr('manual_title')),
            h('p', { style: { margin: '0 0 8px', ...styles.muted } }, tr('manual_body')),
            h(
              'div',
              { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
              h(Button, { onClick: () => window.open(profileHref, '_blank', 'noreferrer') }, tr('profile_open')),
              h(Button, { onClick: () => window.open(settingsHref, '_blank', 'noreferrer') }, tr('profile_settings')),
            ),
          ),
        ),
      )
    }

    function LogCard({ entries }) {
      return h(
        'section',
        { style: styles.card },
        h('h2', { style: styles.cardTitle }, tr('log_title')),
        !entries || entries.length === 0
          ? h('p', { style: { margin: 0, fontSize: 12.5, color: palette.muted } }, tr('log_empty'))
          : h(
              'div',
              null,
              entries.map((entry, index) =>
                h(
                  'div',
                  {
                    key: `${entry.at}-${index}`,
                    style: {
                      display: 'flex',
                      gap: 10,
                      alignItems: 'baseline',
                      padding: '7px 0',
                      borderTop: index === 0 ? 'none' : `1px solid ${palette.border}`,
                      fontSize: 12,
                      flexWrap: 'wrap',
                    },
                  },
                  h(StatusDot, { tone: entry.ok ? palette.success : palette.error }),
                  h('span', { style: { fontWeight: 600 } }, entry.action),
                  h('span', { style: { color: palette.muted } }, entry.target),
                  h('span', { style: { color: palette.muted } }, entry.detail),
                  h('span', { style: { flex: 1 } }),
                  h('span', { style: { color: palette.muted } }, formatRelative(entry.at)),
                ),
              ),
            ),
      )
    }

    function Toast({ notice }) {
      if (!notice) return null
      const tone = notice.tone === 'error' ? palette.error : palette.success
      return h(
        'div',
        {
          role: 'status',
          style: {
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 80,
            maxWidth: 420,
            background: palette.surface,
            color: palette.text,
            border: `1px solid ${palette.border}`,
            borderLeft: `3px solid ${tone}`,
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12.5,
            lineHeight: 1.5,
            boxShadow: '0 12px 34px rgba(0, 0, 0, 0.16)',
          },
        },
        notice.text,
      )
    }

    /* ---------------------------------------------------------------- */
    /* Panel                                                            */
    /* ---------------------------------------------------------------- */

    function GithubPanel() {
      const [snapshot, load] = useOverview()
      const [filter, setFilter] = React.useState('all')
      const [query, setQuery] = React.useState('')
      const [dialog, setDialog] = React.useState(null)
      const [busy, setBusy] = React.useState(null)
      const [notice, setNotice] = React.useState(null)
      const [analysis, setAnalysis] = React.useState({ phase: 'idle', data: null, error: null })

      const data = snapshot.data || null
      const connection = (data && data.connection) || {}
      const account = connection.account || null
      const repos = (data && data.repos) || []

      React.useEffect(() => {
        if (!notice) return undefined
        const timer = setTimeout(() => setNotice(null), 4500)
        return () => clearTimeout(timer)
      }, [notice])

      React.useEffect(() => {
        const onCopied = () => setNotice({ tone: 'success', text: tr('toast_copied') })
        window.addEventListener('dsh-github-copied', onCopied)
        return () => window.removeEventListener('dsh-github-copied', onCopied)
      }, [])

      const runAction = React.useCallback(
        async (path, body, successKey, params) => {
          setBusy(path)
          try {
            const response = await fetch(`${API}${path}`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', [MUTATION_HEADER]: '1' },
              body: JSON.stringify(body || {}),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
            setNotice({ tone: 'success', text: successKey ? tr(successKey, params) : tr('toast_saved') })
            await load(true)
            return payload
          } catch (error) {
            setNotice({ tone: 'error', text: `${tr('error_prefix')}${String((error && error.message) || error)}` })
            return null
          } finally {
            setBusy(null)
          }
        },
        [load],
      )

      const onCopy = React.useCallback(async (text) => {
        const copied = await copyText(text)
        if (copied) setNotice({ tone: 'success', text: tr('toast_copied') })
      }, [])

      const closeDialog = React.useCallback(() => setDialog(null), [])

      const runAnalysis = React.useCallback(async () => {
        setAnalysis((previous) => ({ phase: 'running', data: previous.data, error: null }))
        try {
          const response = await fetch(`${API}/action/analyze`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', [MUTATION_HEADER]: '1' },
            body: '{}',
          })
          const payload = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
          setAnalysis({ phase: 'ready', data: payload, error: null })
        } catch (error) {
          setAnalysis((previous) => ({
            phase: 'ready',
            data: previous.data,
            error: String((error && error.message) || error),
          }))
        }
      }, [])

      const fixFromAnalysis = React.useCallback(
        async (endpoint, repo) => {
          setBusy(endpoint)
          try {
            const response = await fetch(`${API}${endpoint}`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', [MUTATION_HEADER]: '1' },
              body: JSON.stringify({ repo }),
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
            const successKey =
              endpoint === '/action/apply-license'
                ? 'toast_license_added'
                : endpoint === '/action/add-gitignore'
                  ? 'toast_gitignore_added'
                  : 'toast_status_added'
            setNotice({ tone: 'success', text: tr(successKey) })
            await runAnalysis()
            await load(true)
          } catch (error) {
            setNotice({ tone: 'error', text: `${tr('error_prefix')}${String((error && error.message) || error)}` })
          } finally {
            setBusy(null)
          }
        },
        [runAnalysis, load],
      )

      if (snapshot.phase === 'loading' && !data) {
        return h(
          'div',
          { style: styles.page },
          h('div', { style: { ...styles.container, paddingTop: 72, textAlign: 'center', color: palette.muted, fontSize: 13 } }, tr('loading')),
        )
      }

      if (!data) {
        return h(
          'div',
          { style: styles.page },
          h(
            'div',
            { style: styles.container },
            h('h1', { style: styles.h1 }, tr('panel_title')),
            h(
              'section',
              { style: styles.card },
              h('p', { style: { margin: '0 0 8px', fontSize: 13, color: palette.error } },
                tr('service_offline'),
              ),
              h('p', { style: { margin: 0, ...styles.muted } }, snapshot.error || ''),
              h(
                'div',
                { style: { marginTop: 12 } },
                h(Button, { variant: 'primary', onClick: () => load(true) }, tr('action_recheck')),
              ),
            ),
          ),
        )
      }

      const warnings = data.warnings || []

      return h(
        'div',
        { style: styles.page },
        h(
          'div',
          { style: styles.container },
          h('h1', { style: styles.h1 }, tr('panel_title')),
          h('p', { style: styles.subtitle }, tr('panel_subtitle')),

          h(ConnectionCard, {
            data,
            busy,
            onRefresh: () => load(true),
            onDisconnect: () => setDialog({ kind: 'disconnect' }),
            onCopy,
          }),

          h(StatsRow, { stats: data.stats }),

          h(AttentionCard, {
            items: data.attention,
            onShow: (id) => {
              const next = id === 'empty-repos' ? 'empty' : id
              setFilter(next)
              setQuery('')
            },
            onOpenProfile: () =>
              window.open(account ? `https://github.com/${account.login}` : 'https://github.com/', '_blank', 'noreferrer'),
            onOpenSettings: () => window.open('https://github.com/settings/profile', '_blank', 'noreferrer'),
          }),

          h(RepositoriesCard, {
            repos,
            login: account ? account.login : '',
            filter,
            onFilter: setFilter,
            query,
            onQuery: setQuery,
            onEdit: (repo) => setDialog({ kind: 'edit', repo }),
            onArchive: (repo) => setDialog({ kind: 'archive', repo }),
            onRename: (repo) => setDialog({ kind: 'rename', repo }),
          }),

          h(AnalysisCard, { analysis, busy, onRun: runAnalysis, onFix: fixFromAnalysis }),

          h(ProfileCard, { profile: data.profile, account }),

          warnings.length
            ? h(
                'section',
                { style: { ...styles.card, borderColor: palette.warn } },
                h('h2', { style: styles.cardTitle }, tr('warnings_title')),
                warnings.map((warning, index) =>
                  h('p', { key: index, style: { margin: '0 0 4px', fontSize: 12.5, color: palette.warn } }, warning),
                ),
              )
            : null,

          h(LogCard, { entries: data.actionLog }),

          h('p', { style: { margin: '8px 0 0', ...styles.muted, maxWidth: 720 } }, tr('footer_security')),
          h('p', { style: { margin: '6px 0 0', ...styles.muted } }, tr('footer_loopback')),
          h('p', { style: { margin: '6px 0 0', ...styles.muted } }, tr('phase2_note')),
        ),

        h(Toast, { notice }),

        dialog && dialog.kind === 'edit'
          ? h(EditDialog, {
              repo: dialog.repo,
              busy,
              onClose: closeDialog,
              onSubmit: async (values) => {
                const payload = await runAction(
                  '/action/update-repo',
                  { repo: dialog.repo.fullName, description: values.description, topics: values.topics },
                  'toast_saved',
                )
                if (payload) closeDialog()
              },
            })
          : null,

        dialog && dialog.kind === 'archive'
          ? h(ConfirmDialog, {
              title: dialog.repo.archived ? tr('unarchive_title') : tr('archive_title'),
              body: tr(dialog.repo.archived ? 'unarchive_body' : 'archive_body', { repo: dialog.repo.fullName }),
              confirmLabel: dialog.repo.archived ? tr('action_unarchive') : tr('action_archive'),
              danger: !dialog.repo.archived,
              busy,
              onClose: closeDialog,
              onConfirm: async () => {
                const payload = await runAction(
                  '/action/archive',
                  { repo: dialog.repo.fullName, archived: !dialog.repo.archived },
                  dialog.repo.archived ? 'toast_unarchived' : 'toast_archived',
                )
                if (payload) closeDialog()
              },
            })
          : null,

        dialog && dialog.kind === 'rename'
          ? h(RenameDialog, {
              repo: dialog.repo,
              busy,
              onClose: closeDialog,
              onSubmit: async (name) => {
                const payload = await runAction(
                  '/action/rename',
                  { repo: dialog.repo.fullName, name },
                  'toast_renamed',
                  { name },
                )
                if (payload) closeDialog()
              },
            })
          : null,

        dialog && dialog.kind === 'disconnect'
          ? h(ConfirmDialog, {
              title: tr('disconnect_title'),
              body: h(
                'div',
                null,
                h('p', { style: { margin: '0 0 10px' } }, tr('disconnect_body')),
                h('p', { style: { margin: 0, ...styles.muted } }, tr('disconnect_hint')),
              ),
              confirmLabel: tr('action_confirm_disconnect'),
              danger: true,
              busy,
              onClose: closeDialog,
              onConfirm: async () => {
                const payload = await runAction('/action/disconnect', {}, 'toast_disconnected')
                if (payload) closeDialog()
              },
            })
          : null,
      )
    }

    function EditDialog({ repo, busy, onClose, onSubmit }) {
      const [description, setDescription] = React.useState(repo.description || '')
      const [topics, setTopics] = React.useState((repo.topics || []).join(', '))
      const saving = busy === '/action/update-repo'
      return h(
        Modal,
        {
          title: tr('edit_title'),
          onClose,
          footer: [
            h(Button, { key: 'cancel', onClick: onClose, disabled: saving }, tr('action_cancel')),
            h(
              Button,
              {
                key: 'save',
                variant: 'primary',
                disabled: saving,
                onClick: () => onSubmit({ description, topics: parseTopics(topics) }),
              },
              saving ? tr('edit_saving') : tr('action_save'),
            ),
          ],
        },
        h('p', { style: { margin: '0 0 14px', ...styles.muted } }, repo.fullName),
        h(
          Field,
          { label: tr('edit_description_label'), hint: tr('edit_description_hint') },
          h(TextInput, { value: description, onChange: setDescription, multiline: true, autoFocus: true }),
        ),
        h(
          Field,
          { label: tr('edit_topics_label'), hint: tr('edit_topics_hint') },
          h(TextInput, { value: topics, onChange: setTopics }),
        ),
      )
    }

    function ConfirmDialog({ title, body, confirmLabel, danger, busy, onClose, onConfirm }) {
      const running = Boolean(busy)
      return h(
        Modal,
        {
          title,
          onClose,
          footer: [
            h(Button, { key: 'cancel', onClick: onClose, disabled: running }, tr('action_cancel')),
            h(
              Button,
              {
                key: 'confirm',
                variant: danger ? 'danger' : 'primary',
                disabled: running,
                onClick: onConfirm,
              },
              running ? tr('action_running') : confirmLabel,
            ),
          ],
        },
        typeof body === 'string' ? h('p', { style: { margin: 0, fontSize: 13, lineHeight: 1.65 } }, body) : body,
      )
    }

    function RenameDialog({ repo, busy, onClose, onSubmit }) {
      const [name, setName] = React.useState(repo.name)
      const running = busy === '/action/rename'
      return h(
        Modal,
        {
          title: tr('rename_title'),
          onClose,
          footer: [
            h(Button, { key: 'cancel', onClick: onClose, disabled: running }, tr('action_cancel')),
            h(
              Button,
              {
                key: 'rename',
                variant: 'primary',
                disabled: running || !String(name || '').trim(),
                onClick: () => onSubmit(String(name || '').trim()),
              },
              running ? tr('renaming') : tr('action_confirm_rename'),
            ),
          ],
        },
        h('p', { style: { margin: '0 0 14px', ...styles.muted } }, repo.fullName),
        h(
          Field,
          { label: tr('rename_label'), hint: tr('rename_hint') },
          h(TextInput, { value: name, onChange: setName, autoFocus: true }),
        ),
      )
    }

    function GithubIcon({ size = 20, active }) {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: active ? 1.9 : 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('circle', { cx: 6.5, cy: 5.5, r: 2.4 }),
        h('circle', { cx: 6.5, cy: 18.5, r: 2.4 }),
        h('circle', { cx: 17.5, cy: 8.5, r: 2.4 }),
        h('path', { d: 'M6.5 8v8' }),
        h('path', { d: 'M17.5 11v1.4a4 4 0 0 1-4 4H9.2' }),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        t = ctx.locale.bind(NS)
        subscribeLocale = (listener) => ctx.locale.subscribe(listener)
        ctx.effect(() => ctx.locale.register(NS, 'en', EN))
        ctx.effect(() => ctx.locale.register(NS, 'zh-CN', ZH))

        const Panel = withLocale(GithubPanel)
        const Icon = withLocale(GithubIcon)

        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, Panel))
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            { name: 'sidebar.panellist', id: PANEL_ID, order: 21, label: () => t('panel_title') },
            Icon,
          ),
        )
      },
    }
  },
})
