/**
 * Host half of the GitHub panel.
 *
 * Everything here is a thin, read-mostly bridge over the GitHub CLI that is
 * already authenticated on this PC. The panel never sees, stores or forwards
 * the GitHub token: `gh` keeps it in the Windows keyring, and this module only
 * runs `gh` commands and returns their normalized results.
 *
 * Surface (all under /api/github-panel):
 *   GET  overview           -> connection, repositories, profile/pins, attention, action log
 *   POST action/update-repo -> { repo, description?, topics? }
 *   POST action/archive     -> { repo, archived }
 *   POST action/rename      -> { repo, name }
 *   POST action/disconnect  -> removes the GitHub CLI login (keyring)
 *
 * Safety:
 *   - every route answers loopback only;
 *   - every mutation requires the `x-dsh-github-panel: 1` header, so a
 *     cross-site form cannot trigger one;
 *   - mutations re-read the repository from GitHub and require admin rights
 *     before changing anything;
 *   - the token is never read or returned.
 */
import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const inject = ['webServer']

const PREFIX = '/api/github-panel'
const MUTATION_HEADER = 'x-dsh-github-panel'
const SCAN_TTL_MS = 15_000
const MAX_BUFFER = 16 * 1024 * 1024
const MAX_BODY_BYTES = 256 * 1024
const GH_TIMEOUT_MS = 30_000
const LOG_LIMIT = 30

const REPO_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/
const NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/
const TOPIC_PATTERN = /^[a-z0-9][a-z0-9-]{0,49}$/

/* ------------------------------------------------------------------ */
/* gh process helpers                                                  */
/* ------------------------------------------------------------------ */

function resolveGh() {
  const exe = process.platform === 'win32' ? 'gh.exe' : 'gh'
  const candidates = []
  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
    const programFilesX86 = process.env['ProgramFiles(x86)'] || ''
    const localAppData = process.env.LOCALAPPDATA || ''
    candidates.push(path.join(programFiles, 'GitHub CLI', exe))
    if (programFilesX86) candidates.push(path.join(programFilesX86, 'GitHub CLI', exe))
    if (localAppData) {
      candidates.push(path.join(localAppData, 'Programs', 'GitHub CLI', exe))
      candidates.push(path.join(localAppData, 'GitHub CLI', exe))
    }
  }
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue
    candidates.push(path.join(dir, exe))
  }
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return candidate
    } catch {
      /* keep looking */
    }
  }
  return exe
}

const GH = resolveGh()

/**
 * The Host process does not inherit the agent shell's GH_CONFIG_DIR. This
 * workspace keeps its gh login in `<workspace>/.gh-config` because the sandbox
 * cannot write %APPDATA%. Resolve that directory from the module location
 * (packages are linked from the workspace) and fall back to the ambient env or
 * gh's default only when it does not exist.
 */
const PANEL_GH_CONFIG = (() => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const workspace = path.resolve(here, '..', '..')
  const candidates = [
    process.env.DSH_GITHUB_CONFIG_DIR,
    path.join(workspace, '.gh-config'),
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return candidate
    } catch {
      /* try the next candidate */
    }
  }
  return null
})()

function ghEnv() {
  const env = { ...process.env }
  if (PANEL_GH_CONFIG) env.GH_CONFIG_DIR = PANEL_GH_CONFIG
  return env
}

function runGh(args, timeoutMs = GH_TIMEOUT_MS) {
  return new Promise((resolve) => {
    execFile(
      GH,
      args,
      {
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER,
        env: ghEnv(),
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          code: error ? error.code || 'ERROR' : 0,
          stdout: String(stdout == null ? '' : stdout),
          stderr: String(stderr == null ? '' : stderr),
        })
      },
    )
  })
}

/** Run `gh api ... --input -` with a JSON payload on stdin. */
function runGhInput(args, payload) {
  return new Promise((resolve) => {
    const child = spawn(GH, args, {
      windowsHide: true,
      env: ghEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) {
        try {
          child.kill()
        } catch {
          /* already gone */
        }
      }
    }, GH_TIMEOUT_MS)
    const finish = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        ok: !error,
        code: error ? error.code || 'ERROR' : 0,
        stdout,
        stderr,
      })
    }
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (error) => finish(error))
    child.on('close', (code) => finish(code === 0 ? null : { code }))
    try {
      child.stdin.end(JSON.stringify(payload))
    } catch {
      /* stdin closed early; the close handler reports it */
    }
  })
}

function trimText(value) {
  return String(value == null ? '' : value).trim()
}

function parseHttpResponse(stdout) {
  const text = String(stdout || '')
  const boundary = text.search(/\r?\n\r?\n/)
  if (boundary === -1) return { status: 200, headers: {}, body: text }
  const head = text.slice(0, boundary)
  const body = text.slice(boundary).replace(/^\r?\n\r?\n/, '')
  const lines = head.split(/\r?\n/)
  const statusMatch = lines[0] ? lines[0].match(/\s(\d{3})\s*$/) : null
  const headers = {}
  for (const line of lines.slice(1)) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim()
  }
  return { status: statusMatch ? Number(statusMatch[1]) : 200, headers, body }
}

/* ------------------------------------------------------------------ */
/* GitHub reads                                                        */
/* ------------------------------------------------------------------ */

async function readConnection() {
  const version = await runGh(['--version'], 10_000)
  if (!version.ok) {
    const missing = version.code === 'ENOENT'
    return {
      installed: false,
      connected: false,
      version: null,
      account: null,
      scopes: [],
      error: missing ? 'The GitHub CLI (gh) is not installed on this PC.' : trimText(version.stderr) || 'The GitHub CLI is not usable.',
    }
  }
  const versionLine = trimText(String(version.stdout).split(/\r?\n/)[0])
  const auth = await runGh(['api', 'user', '-i'])
  if (!auth.ok) {
    return {
      installed: true,
      connected: false,
      version: versionLine,
      account: null,
      scopes: [],
      error: trimText(auth.stderr) || trimText(auth.stdout) || 'GitHub is not connected on this PC.',
    }
  }
  const parsed = parseHttpResponse(auth.stdout)
  let user = null
  try {
    user = JSON.parse(parsed.body)
  } catch {
    user = null
  }
  if (!user || parsed.status === 401) {
    return {
      installed: true,
      connected: false,
      version: versionLine,
      account: null,
      scopes: [],
      error: 'GitHub is not connected on this PC.',
    }
  }
  const scopeHeader = parsed.headers['x-oauth-scopes'] || ''
  const scopes = scopeHeader
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)
  return {
    installed: true,
    connected: true,
    version: versionLine,
    account: {
      login: user.login,
      name: user.name || null,
      bio: user.bio || null,
      location: user.location || null,
      blog: user.blog || null,
      twitterUsername: user.twitter_username || null,
      avatarUrl: user.avatar_url || null,
      publicRepos: Number(user.public_repos || 0),
    },
    scopes,
    error: null,
  }
}

function mapRepo(raw) {
  const permissions = raw.permissions || {}
  const fullName = String(raw.full_name || '')
  return {
    fullName,
    owner: raw.owner && raw.owner.login ? raw.owner.login : fullName.split('/')[0],
    name: String(raw.name || ''),
    description: typeof raw.description === 'string' ? raw.description : '',
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    private: Boolean(raw.private),
    archived: Boolean(raw.archived),
    fork: Boolean(raw.fork),
    visibility: raw.private ? 'private' : 'public',
    defaultBranch: raw.default_branch || 'main',
    language: raw.language || null,
    stars: Number(raw.stargazers_count || 0),
    size: Number(raw.size || 0),
    pushedAt: raw.pushed_at || null,
    updatedAt: raw.updated_at || null,
    canAdmin: Boolean(permissions.admin),
    canPush: Boolean(permissions.push || permissions.admin),
    /** Set by the scan probe: true only when the repository has no commits. */
    empty: false,
  }
}

async function readRepos() {
  const result = await runGh([
    'api',
    'user/repos?per_page=100&affiliation=owner,collaborator,organization_member&sort=updated',
  ])
  if (!result.ok) throw new Error(trimText(result.stderr) || 'Could not list repositories.')
  const list = JSON.parse(result.stdout)
  if (!Array.isArray(list)) throw new Error('Unexpected repository list response.')
  return list.map(mapRepo)
}

async function readGists() {
  const result = await runGh(['api', 'gists?per_page=100'])
  if (!result.ok) throw new Error(trimText(result.stderr) || 'Could not list gists.')
  const list = JSON.parse(result.stdout)
  if (!Array.isArray(list)) return []
  return list.map((gist) => ({
    id: String(gist.id || ''),
    description: typeof gist.description === 'string' ? gist.description : '',
    public: Boolean(gist.public),
    createdAt: gist.created_at || null,
    updatedAt: gist.updated_at || null,
    files: Object.values(gist.files || {}).map((file) => ({
      name: String(file.filename || ''),
      size: Number(file.size || 0),
    })),
  }))
}

async function readPinned(login) {
  const query = `query { user(login: "${login}") { pinnedItems(first: 6, types: [REPOSITORY]) { nodes { ... on Repository { nameWithOwner } } } } }`
  const result = await runGh(['api', 'graphql', '-f', `query=${query}`])
  if (!result.ok) return []
  try {
    const payload = JSON.parse(result.stdout)
    const nodes = payload && payload.data && payload.data.user && payload.data.user.pinnedItems ? payload.data.user.pinnedItems.nodes : []
    return (nodes || []).map((node) => node.nameWithOwner).filter(Boolean)
  } catch {
    return []
  }
}

async function readProfileRepo(login) {
  const result = await runGh(['api', `repos/${login}/${login}`])
  if (!result.ok) return null
  try {
    const repo = JSON.parse(result.stdout)
    return {
      fullName: repo.full_name,
      private: Boolean(repo.private),
      description: repo.description || '',
      defaultBranch: repo.default_branch || 'main',
      pushedAt: repo.pushed_at || null,
    }
  } catch {
    return null
  }
}

/**
 * REST `size` in KB lags behind a fresh push (a just-created repository can
 * still report 0). Probe only those few candidates with a commit listing so the
 * panel never calls a non-empty repository "empty".
 */
async function probeEmptyRepos(repos) {
  const suspects = repos.filter((repo) => repo.canAdmin && !repo.archived && repo.size === 0)
  await Promise.all(
    suspects.map(async (repo) => {
      const probe = await runGh(['api', `repos/${repo.fullName}/commits?per_page=1`], 10_000)
      if (probe.ok) {
        repo.empty = false
        return
      }
      const detail = trimText(probe.stderr)
      repo.empty = /409|Git Repository is empty|empty repository/i.test(detail)
    }),
  )
}

function findDuplicateGists(gists) {
  const groups = new Map()
  for (const gist of gists) {
    const files = gist.files.slice().sort((a, b) => a.name.localeCompare(b.name))
    if (files.length === 0) continue
    const signature = `${files.map((file) => `${file.name}:${file.size}`).join('|')}::${gist.description}`
    if (!groups.has(signature)) groups.set(signature, [])
    groups.get(signature).push(gist)
  }
  return [...groups.values()]
    .filter((entries) => entries.length > 1)
    .map((entries) => ({
      ids: entries.map((entry) => entry.id),
      files: entries[0].files.map((file) => file.name),
      count: entries.length,
    }))
}

/* ------------------------------------------------------------------ */
/* Overview assembly                                                   */
/* ------------------------------------------------------------------ */

let cache = null
let inflight = null
const actionLog = []

function recordAction(action, target, detail, ok) {
  actionLog.unshift({ at: new Date().toISOString(), action, target, detail, ok })
  if (actionLog.length > LOG_LIMIT) actionLog.length = LOG_LIMIT
  cache = null
}

function buildOverview(connection, repos, gists, pinned, profileRepo) {
  const account = connection.account || null
  const adminRepos = repos.filter((repo) => repo.canAdmin)
  const activeAdmin = adminRepos.filter((repo) => !repo.archived)
  const missingDescription = activeAdmin.filter((repo) => !repo.description)
  const missingTopics = activeAdmin.filter((repo) => repo.topics.length === 0)
  const emptyRepos = activeAdmin.filter((repo) => repo.empty)
  const unusedForks = activeAdmin.filter((repo) => repo.fork)
  const duplicateGists = connection.connected ? findDuplicateGists(gists) : []

  const profileReadme = Boolean(profileRepo && !profileRepo.private)
  const pinnedList = pinned.slice(0, 6)
  const pinnedSet = new Set(pinnedList)
  const pinSuggestions = adminRepos
    .filter((repo) => !repo.private && !repo.archived && !repo.fork && repo.description && !pinnedSet.has(repo.fullName))
    .sort((a, b) => b.stars - a.stars || String(b.pushedAt).localeCompare(String(a.pushedAt)))
    .slice(0, 6)
    .map((repo) => repo.fullName)

  const attention = []
  if (!connection.connected) {
    attention.push({ id: 'not-connected', severity: 'error', count: 0, repos: [] })
  } else {
    if (!profileReadme) attention.push({ id: 'profile-readme', severity: 'warn', count: 0, repos: [] })
    if (account && !account.name && !account.bio) attention.push({ id: 'profile-bio', severity: 'info', count: 0, repos: [] })
    if (pinnedList.length < 6) {
      attention.push({ id: 'pins', severity: 'info', count: pinnedList.length, repos: [] })
    }
    if (duplicateGists.length > 0) {
      attention.push({ id: 'duplicate-gists', severity: 'info', count: duplicateGists.length, repos: [] })
    }
    if (missingDescription.length > 0) {
      attention.push({
        id: 'missing-description',
        severity: 'warn',
        count: missingDescription.length,
        repos: missingDescription.map((repo) => repo.fullName).slice(0, 50),
      })
    }
    if (missingTopics.length > 0) {
      attention.push({
        id: 'missing-topics',
        severity: 'warn',
        count: missingTopics.length,
        repos: missingTopics.map((repo) => repo.fullName).slice(0, 50),
      })
    }
    if (emptyRepos.length > 0) {
      attention.push({
        id: 'empty-repos',
        severity: 'warn',
        count: emptyRepos.length,
        repos: emptyRepos.map((repo) => repo.fullName).slice(0, 50),
      })
    }
    if (unusedForks.length > 0) {
      attention.push({
        id: 'unused-forks',
        severity: 'info',
        count: unusedForks.length,
        repos: unusedForks.map((repo) => repo.fullName).slice(0, 50),
      })
    }
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    connection,
    stats: {
      total: repos.length,
      owned: account ? repos.filter((repo) => repo.owner === account.login).length : 0,
      public: repos.filter((repo) => !repo.private).length,
      private: repos.filter((repo) => repo.private).length,
      archived: repos.filter((repo) => repo.archived).length,
      forks: repos.filter((repo) => repo.fork).length,
      admin: adminRepos.length,
      missingDescription: missingDescription.length,
      missingTopics: missingTopics.length,
    },
    repos,
    attention,
    profile: {
      readme: profileReadme,
      repo: profileRepo,
      pinned: pinnedList,
      pinSuggestions,
      fields: account
        ? {
            name: account.name,
            bio: account.bio,
            location: account.location,
            blog: account.blog,
            twitterUsername: account.twitterUsername,
          }
        : null,
    },
    gists: {
      total: gists.length,
      duplicateGroups: duplicateGists,
    },
    actionLog: actionLog.slice(),
    limits: {
      phase: 2,
      panelVersion: '2.0.0',
      deepAnalysis: true,
      tokenStoredIn: 'Windows keyring (GitHub CLI)',
      tokenExposed: false,
      routes: 'loopback only',
      note: 'Pinned repositories and profile fields cannot be changed through the GitHub API; the panel links to the right GitHub page for those.',
    },
  }
}

function scan(force) {
  if (!force && cache && Date.now() - cache.at < SCAN_TTL_MS) return Promise.resolve(cache.data)
  if (inflight) return inflight
  inflight = (async () => {
    const connection = await readConnection()
    const warnings = []
    let repos = []
    let gists = []
    let pinned = []
    let profileRepo = null
    if (connection.connected) {
      const account = connection.account
      const [reposResult, gistsResult, pinnedResult, profileResult] = await Promise.all([
        readRepos().catch((error) => {
          warnings.push(`Repositories: ${error.message}`)
          return []
        }),
        readGists().catch((error) => {
          warnings.push(`Gists: ${error.message}`)
          return []
        }),
        readPinned(account.login).catch(() => []),
        readProfileRepo(account.login).catch(() => null),
      ])
      repos = reposResult
      gists = gistsResult
      pinned = pinnedResult
      profileRepo = profileResult
      await probeEmptyRepos(repos)
    }
    const data = buildOverview(connection, repos, gists, pinned, profileRepo)
    data.warnings = warnings
    cache = { at: Date.now(), data }
    return data
  })().finally(() => {
    inflight = null
  })
  return inflight
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

async function fetchRepo(fullName) {
  const result = await runGh(['api', `repos/${fullName}`])
  if (!result.ok) {
    const detail = trimText(result.stderr) || 'Repository not found.'
    throw new Error(detail)
  }
  const repo = JSON.parse(result.stdout)
  return { repo, mapped: mapRepo(repo) }
}

function requireAdmin(mapped, fullName) {
  if (!mapped.canAdmin) {
    throw new Error(`You do not have admin permission on ${fullName}, so its settings cannot be changed here.`)
  }
}

function normalizeTopics(input) {
  if (input == null) return null
  if (!Array.isArray(input)) throw new Error('Topics must be a list.')
  const seen = new Set()
  const topics = []
  for (const value of input) {
    const topic = String(value == null ? '' : value).trim().replace(/^#/, '').toLowerCase()
    if (!topic) continue
    if (!TOPIC_PATTERN.test(topic)) {
      throw new Error(`Topic "${topic}" is not valid: use lowercase letters, numbers and hyphens (max 50 characters).`)
    }
    if (seen.has(topic)) continue
    seen.add(topic)
    topics.push(topic)
  }
  if (topics.length > 20) throw new Error('A repository can have at most 20 topics.')
  return topics
}

async function actionUpdateRepo(body) {
  const fullName = String(body.repo || '')
  if (!REPO_PATTERN.test(fullName)) throw new Error('Invalid repository name.')
  const description = body.description == null ? null : String(body.description)
  const topics = normalizeTopics(body.topics)
  if (description == null && topics == null) throw new Error('Nothing to update.')
  if (description != null && description.length > 350) {
    throw new Error('Description must be 350 characters or fewer.')
  }
  const { mapped } = await fetchRepo(fullName)
  requireAdmin(mapped, fullName)
  if (description != null) {
    const patch = await runGhInput(['api', '-X', 'PATCH', `repos/${fullName}`, '--input', '-'], {
      description,
    })
    if (!patch.ok) throw new Error(trimText(patch.stderr) || 'GitHub rejected the description update.')
  }
  if (topics != null) {
    const update = await runGhInput(['api', '-X', 'PUT', `repos/${fullName}/topics`, '--input', '-'], {
      names: topics,
    })
    if (!update.ok) throw new Error(trimText(update.stderr) || 'GitHub rejected the topic update.')
  }
  recordAction('update-repo', fullName, 'description and/or topics', true)
  return { ok: true, repo: fullName }
}

async function actionArchive(body) {
  const fullName = String(body.repo || '')
  if (!REPO_PATTERN.test(fullName)) throw new Error('Invalid repository name.')
  const archived = Boolean(body.archived)
  const { mapped } = await fetchRepo(fullName)
  requireAdmin(mapped, fullName)
  const result = await runGhInput(['api', '-X', 'PATCH', `repos/${fullName}`, '--input', '-'], { archived })
  if (!result.ok) throw new Error(trimText(result.stderr) || 'GitHub rejected the archive change.')
  recordAction(archived ? 'archive' : 'unarchive', fullName, archived ? 'archived' : 'unarchived', true)
  return { ok: true, repo: fullName, archived }
}

async function actionRename(body) {
  const fullName = String(body.repo || '')
  if (!REPO_PATTERN.test(fullName)) throw new Error('Invalid repository name.')
  const name = String(body.name || '').trim()
  if (!NAME_PATTERN.test(name)) {
    throw new Error('New name must be 1-100 characters of letters, numbers, dots, underscores or hyphens.')
  }
  const { mapped } = await fetchRepo(fullName)
  requireAdmin(mapped, fullName)
  const result = await runGhInput(['api', '-X', 'PATCH', `repos/${fullName}`, '--input', '-'], { name })
  if (!result.ok) throw new Error(trimText(result.stderr) || 'GitHub rejected the rename.')
  const renamed = `${mapped.owner}/${name}`
  recordAction('rename', fullName, `renamed to ${renamed}`, true)
  return { ok: true, repo: fullName, fullName: renamed }
}

async function actionDisconnect() {
  const result = await runGh(['auth', 'logout', '--hostname', 'github.com'], 20_000)
  if (!result.ok) {
    throw new Error(
      trimText(result.stderr) ||
        'Could not remove the GitHub CLI login automatically. Run `gh auth logout` in a terminal.',
    )
  }
  recordAction('disconnect', 'github.com', 'GitHub CLI login removed from this PC', true)
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/* Phase 2: deep analysis + safe fixes                                 */
/* ------------------------------------------------------------------ */

const ANALYSIS_TTL_MS = 30 * 60 * 1000
const analysisCache = new Map()

const MIT_TEMPLATE = (year) => `MIT License

Copyright (c) ${year} zayyehtut

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`

const STATUS_SECTION = `
## Status

This project is no longer maintained. It was built as an educational/demo project and is kept public for reference; issues and pull requests may not be reviewed.
`

const LICENSE_PATHS = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING']

const GITIGNORE_TEMPLATES = {
  flutter: `# Flutter / Dart
.dart_tool/
.packages
build/
.flutter-plugins
.flutter-plugins-dependencies
*.iml
.idea/
.vscode/

# Build output
android/.gradle/
android/app/build/
ios/Pods/
ios/.symlinks/

# Secrets
.env
.env.*
!.env.example
*.pem
*.key
`,
  node: `# Dependencies
node_modules/

# Build output
dist/
build/
.next/
out/
coverage/

# Environment & secrets
.env
.env.*
!.env.example
*.pem
*.key

# Logs
*.log
`,
  java: `# Build output
target/
build/
out/
*.class

# IDE
.idea/
*.iml
.vscode/

# Environment & secrets
.env
.env.*
!.env.example
*.pem
*.key
`,
  python: `# Python
__pycache__/
*.py[cod]
.venv/
venv/
*.egg-info/
dist/
build/

# Environment & secrets
.env
.env.*
!.env.example
*.pem
*.key
`,
  generic: `# Environment & secrets
.env
.env.*
!.env.example
*.pem
*.key

# OS / editor
.DS_Store
.idea/
.vscode/
*.log
`,
}

const SECRET_PATTERNS = [
  { kind: 'github-token', re: /\b(ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|ghs_[A-Za-z0-9]{36}|ghu_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,})\b/g },
  { kind: 'aws-key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: 'private-key', re: /-----BEGIN (RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/g },
  { kind: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  { kind: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
  { kind: 'generic-secret', re: /(?:api[_-]?key|apikey|secret|password|passwd|token|access[_-]?key)\s*[:=]\s*['"][A-Za-z0-9_\-\.\+]{16,}['"]/gi },
]

function invalidateAnalysis(repo) {
  if (repo) analysisCache.delete(repo)
}

function inferGitignoreTemplate(paths, language) {
  if (paths.includes('pubspec.yaml')) return 'flutter'
  if (paths.includes('package.json')) return 'node'
  if (paths.includes('pom.xml') || paths.includes('build.gradle') || paths.includes('build.gradle.kts')) return 'java'
  if (paths.includes('requirements.txt') || paths.includes('pyproject.toml') || paths.includes('Pipfile')) return 'python'
  const lang = String(language || '').toLowerCase()
  if (lang === 'dart') return 'flutter'
  if (['java', 'kotlin'].includes(lang)) return 'java'
  if (lang === 'python') return 'python'
  if (['javascript', 'typescript', 'html', 'css'].includes(lang)) return 'node'
  return 'generic'
}

function scoreAnalysis(input) {
  let score = 0
  const flags = []
  if (input.readme) {
    score += 20
    if (input.readme.lines >= 20) score += 10
    if (input.readme.sections) score += 5
    if (!input.readme.sections) flags.push('README has no install/usage section')
  } else flags.push('no README')
  if (input.license) score += 10
  else flags.push('no license')
  if (input.ci) score += 10
  else flags.push('no CI')
  if (input.tests > 0) score += 10
  else flags.push('no tests')
  if (input.manifests.length > 0) score += 5
  if (input.gitignore) score += 5
  else flags.push('no .gitignore')
  let penalty = 0
  if (input.junkDirs.length) { penalty += 15; flags.push(`junk committed: ${input.junkDirs.join(', ')}`) }
  if (input.envFiles.length) { penalty += 20; flags.push(`.env file committed: ${input.envFiles.join(', ')}`) }
  if (input.keyFiles.length) { penalty += 15; flags.push(`key material: ${input.keyFiles.join(', ')}`) }
  if (input.secrets.length) { penalty += 20; flags.push(`${input.secrets.length} possible secret(s)`) }
  if (input.largeCount > 3) penalty += 5
  score = Math.max(0, Math.min(100, score - penalty))
  let grade = 'F'
  if (score >= 90) grade = 'A'
  else if (score >= 75) grade = 'B'
  else if (score >= 60) grade = 'C'
  else if (score >= 40) grade = 'D'
  return { score, grade, flags }
}

async function readTree(fullName, branch) {
  const result = await runGh(['api', `repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`], 40_000)
  if (!result.ok) throw new Error(trimText(result.stderr) || 'Could not read the repository tree.')
  const data = JSON.parse(result.stdout)
  return { entries: Array.isArray(data.tree) ? data.tree : [], truncated: Boolean(data.truncated) }
}

async function getFile(fullName, filePath) {
  const result = await runGh(['api', `repos/${fullName}/contents/${filePath}`], 20_000)
  if (!result.ok) return null
  try {
    const data = JSON.parse(result.stdout)
    if (!data || typeof data !== 'object') return null
    const content = typeof data.content === 'string' ? Buffer.from(data.content, 'base64').toString('utf8') : ''
    return { sha: data.sha, size: data.size || 0, content }
  } catch {
    return null
  }
}

async function analyzeRepo(mapped) {
  const fullName = mapped.fullName
  const branch = mapped.defaultBranch || 'main'
  const { entries, truncated } = await readTree(fullName, branch)
  const blobs = entries.filter((entry) => entry.type === 'blob')
  const paths = blobs.map((entry) => String(entry.path || ''))
  const rootReadme = paths.find((value) => /^readme(\.[a-z0-9]+)?$/i.test(value))
  const readme = rootReadme ? await getFile(fullName, rootReadme) : null
  const readmeLines = readme && readme.content ? readme.content.split(/\r?\n/).length : 0
  const readmeSections = readme && readme.content
    ? /(^|\n)#{1,4}\s*(install|installation|setup|getting started|usage|quick start)/i.test(readme.content)
    : false
  const licensePath = paths.find((value) => /^(licen[cs]e|copying)(\.[a-z0-9]+)?$/i.test(value))
  const workflows = paths.filter((value) => value.startsWith('.github/workflows/') && /\.ya?ml$/i.test(value))
  const otherCi = paths.filter((value) => ['.gitlab-ci.yml', 'azure-pipelines.yml', 'Jenkinsfile', '.travis.yml', 'netlify.toml', 'vercel.json', 'firebase.json'].includes(value))
  const tests = paths.filter((value) =>
    /(^|\/)(__tests__|tests?|spec)(\/)/i.test(value) ||
    /\.(test|spec)\.[a-z0-9]+$/i.test(value) ||
    /(^|\/)(test_|_test\.)/i.test(value) ||
    /Test(s)?\.java$/.test(value),
  ).length
  const manifests = ['package.json', 'requirements.txt', 'pyproject.toml', 'Pipfile', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'pubspec.yaml', 'Cargo.toml', 'go.mod'].filter((name) => paths.includes(name))
  const junkDirs = ['node_modules', 'dist', 'build', 'out', '.next', 'coverage', 'vendor'].filter((dir) => paths.some((value) => value.startsWith(`${dir}/`)))
  const large = blobs
    .filter((entry) => Number(entry.size || 0) > 1_000_000)
    .sort((a, b) => Number(b.size || 0) - Number(a.size || 0))
    .slice(0, 5)
    .map((entry) => ({ path: entry.path, bytes: Number(entry.size || 0) }))
  const envFiles = paths.filter((value) => /(^|\/)\.env(\.[a-z]+)?$/i.test(value) && !/\.(example|sample|template)$/i.test(value)).slice(0, 5)
  const keyFiles = paths.filter((value) => /\.(pem|key|p12|pfx)$/i.test(value)).slice(0, 5)
  const suspicious = [...envFiles, ...keyFiles].slice(0, 6)
  const secrets = []
  for (const file of suspicious) {
    const data = await getFile(fullName, file)
    if (!data || !data.content || data.content.length > 250_000) continue
    for (const pattern of SECRET_PATTERNS) {
      pattern.re.lastIndex = 0
      if (pattern.re.test(data.content)) {
        secrets.push({ kind: pattern.kind, file })
        break
      }
    }
  }
  const gitignore = paths.includes('.gitignore')
  const analysis = {
    repo: fullName,
    branch,
    truncated,
    files: blobs.length,
    readme: rootReadme ? { path: rootReadme, lines: readmeLines, sections: readmeSections } : null,
    license: licensePath || (mapped.license || null),
    ci: { workflows: workflows.slice(0, 5), others: otherCi },
    tests,
    manifests,
    junkDirs,
    gitignore,
    envFiles,
    keyFiles,
    secrets,
    large,
    largeCount: large.length,
  }
  const scored = scoreAnalysis(analysis)
  return {
    ...analysis,
    score: scored.score,
    grade: scored.grade,
    flags: scored.flags,
    generatedAt: new Date().toISOString(),
    canFix: {
      license: !analysis.license && mapped.canAdmin,
      gitignore: !analysis.gitignore && mapped.canAdmin,
      readmeStatus: Boolean(analysis.readme) && mapped.canAdmin && !/^##\s+Status/m.test((readme && readme.content) || ''),
    },
  }
}

async function analyzeAll(force) {
  const overview = await scan(force)
  const account = overview.connection && overview.connection.account
  if (!account) throw new Error('GitHub is not connected on this PC.')
  const targets = overview.repos.filter((repo) => repo.canAdmin && !repo.archived)
  const results = []
  const concurrency = 4
  for (let index = 0; index < targets.length; index += concurrency) {
    const chunk = targets.slice(index, index + concurrency)
    const settled = await Promise.all(
      chunk.map(async (repo) => {
        const cached = analysisCache.get(repo.fullName)
        if (!force && cached && Date.now() - cached.at < ANALYSIS_TTL_MS) return cached.data
        try {
          const data = await analyzeRepo(repo)
          analysisCache.set(repo.fullName, { at: Date.now(), data })
          return data
        } catch (error) {
          return {
            repo: repo.fullName,
            error: error instanceof Error ? error.message : String(error),
            grade: '?',
            score: 0,
            flags: ['analysis failed'],
            canFix: {},
          }
        }
      }),
    )
    results.push(...settled)
  }
  const gradeCount = { A: 0, B: 0, C: 0, D: 0, F: 0 }
  for (const result of results) {
    if (gradeCount[result.grade] != null) gradeCount[result.grade] += 1
  }
  results.sort((a, b) => a.score - b.score || a.repo.localeCompare(b.repo))
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      repositories: results.length,
      grades: gradeCount,
      missingLicense: results.filter((entry) => !entry.license).length,
      missingGitignore: results.filter((entry) => !entry.gitignore && !entry.error).length,
      missingStatus: results.filter((entry) => entry.canFix && entry.canFix.readmeStatus).length,
      secrets: results.reduce((sum, entry) => sum + (Array.isArray(entry.secrets) ? entry.secrets.length : 0), 0),
    },
    repos: results,
  }
}

async function putFile(fullName, filePath, content, message, branch, sha) {
  const payload = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch,
  }
  if (sha) payload.sha = sha
  const result = await runGhInput(['api', '-X', 'PUT', `repos/${fullName}/contents/${filePath}`, '--input', '-'], payload)
  if (!result.ok) throw new Error(trimText(result.stderr) || `GitHub rejected the commit for ${filePath}.`)
  const data = JSON.parse(result.stdout)
  return { sha: data.commit && data.commit.sha, url: data.commit && data.commit.html_url }
}

async function actionApplyLicense(body) {
  const fullName = String(body.repo || '')
  if (!REPO_PATTERN.test(fullName)) throw new Error('Invalid repository name.')
  const { repo, mapped } = await fetchRepo(fullName)
  requireAdmin(mapped, fullName)
  if (repo.archived) throw new Error('This repository is archived; unarchive it before changing files.')
  for (const candidate of LICENSE_PATHS) {
    const existing = await getFile(fullName, candidate)
    if (existing) throw new Error(`Repository already has a license file (${candidate}).`)
  }
  const year = String(repo.created_at || new Date().toISOString()).slice(0, 4)
  const branch = repo.default_branch || 'main'
  const commit = await putFile(fullName, 'LICENSE', MIT_TEMPLATE(year), 'Organize: add MIT license', branch)
  recordAction('apply-license', fullName, `MIT license (${year})`, true)
  invalidateAnalysis(fullName)
  return { ok: true, repo: fullName, file: 'LICENSE', year, commit: commit.sha, url: commit.url }
}

async function actionAddGitignore(body) {
  const fullName = String(body.repo || '')
  if (!REPO_PATTERN.test(fullName)) throw new Error('Invalid repository name.')
  const { repo, mapped } = await fetchRepo(fullName)
  requireAdmin(mapped, fullName)
  if (repo.archived) throw new Error('This repository is archived; unarchive it before changing files.')
  const existing = await getFile(fullName, '.gitignore')
  if (existing) throw new Error('Repository already has a .gitignore file.')
  const tree = await readTree(fullName, repo.default_branch || 'main')
  const paths = tree.entries.filter((entry) => entry.type === 'blob').map((entry) => String(entry.path || ''))
  const requested = String(body.template || 'auto')
  const template = requested === 'auto' || !GITIGNORE_TEMPLATES[requested]
    ? inferGitignoreTemplate(paths, repo.language)
    : requested
  const content = GITIGNORE_TEMPLATES[template] || GITIGNORE_TEMPLATES.generic
  const commit = await putFile(fullName, '.gitignore', content, `Organize: add ${template} .gitignore`, repo.default_branch || 'main')
  recordAction('add-gitignore', fullName, `${template} template`, true)
  invalidateAnalysis(fullName)
  return { ok: true, repo: fullName, file: '.gitignore', template, commit: commit.sha, url: commit.url }
}

async function actionReadmeStatus(body) {
  const fullName = String(body.repo || '')
  if (!REPO_PATTERN.test(fullName)) throw new Error('Invalid repository name.')
  const { repo, mapped } = await fetchRepo(fullName)
  requireAdmin(mapped, fullName)
  if (repo.archived) throw new Error('This repository is archived; unarchive it before changing files.')
  const readme = await getFile(fullName, 'README.md')
  if (!readme) throw new Error('Repository has no README.md to update.')
  if (/^##\s+Status/m.test(readme.content)) throw new Error('README already documents a status section.')
  const updated = `${readme.content.trimEnd()}\n${STATUS_SECTION}`
  const commit = await putFile(fullName, 'README.md', updated, 'Organize: document project status in README', repo.default_branch || 'main', readme.sha)
  recordAction('readme-status', fullName, 'status section added', true)
  invalidateAnalysis(fullName)
  return { ok: true, repo: fullName, file: 'README.md', commit: commit.sha, url: commit.url }
}

/* Agent tools: same operations the panel buttons call (user-actions rule). */
function registerTools(ctx) {
  const statusTool = {
    name: 'github_panel_status',
    description: 'Read the GitHub panel connection, repository counts and current needs-attention items. Use before proposing repository cleanup.',
    parameters: {},
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{
        type: 'text',
        text: value && value.connected
          ? `GitHub connected as @${value.login}: ${value.repositories} repositories (${value.archived} archived). Needs attention: ${(value.attention || []).join(', ') || 'none'}.`
          : 'GitHub is not connected on this PC.',
      }],
    },
    async execute() {
      const data = await scan(false)
      return {
        connected: Boolean(data.connection.connected),
        login: data.connection.account ? data.connection.account.login : null,
        repositories: data.stats.total,
        archived: data.stats.archived,
        attention: (data.attention || []).map((item) => item.id),
      }
    },
  }
  const actionTool = {
    name: 'github_panel_action',
    description: 'Run one GitHub panel action: analyze repositories (read-only health report), or apply safe fixes (update description/topics, archive, add MIT license, add .gitignore, append README status). Never use this to disconnect or change repository visibility.',
    parameters: {
      action: {
        type: 'string',
        required: true,
        enum: ['analysis', 'update-repo', 'archive', 'apply-license', 'add-gitignore', 'readme-status'],
        description: 'analysis = read-only report; the others change one repository.',
      },
      repo: { type: 'string', description: 'Repository as owner/name (required for every action except analysis).' },
      description: { type: 'string', description: 'New description for update-repo.' },
      topics: { type: 'array', items: { type: 'string' }, description: 'Topic list for update-repo.' },
      archived: { type: 'boolean', description: 'Target state for archive.' },
      template: { type: 'string', enum: ['auto', 'flutter', 'node', 'java', 'python', 'generic'], description: 'Template for add-gitignore (default auto).' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value && value.summary ? value.summary : JSON.stringify(value) }],
    },
    async execute(args) {
      const action = String((args && args.action) || '')
      const repo = String((args && args.repo) || '')
      let result
      if (action === 'analysis') {
        const analysis = await analyzeAll(false)
        result = {
          summary: `Analyzed ${analysis.summary.repositories} repositories: ${Object.entries(analysis.summary.grades).map(([grade, count]) => `${grade} ${count}`).join(', ')}. Missing license ${analysis.summary.missingLicense}, missing .gitignore ${analysis.summary.missingGitignore}, README status missing ${analysis.summary.missingStatus}, possible secrets ${analysis.summary.secrets}.`,
          data: analysis,
        }
      } else if (action === 'update-repo') {
        result = await actionUpdateRepo({ repo, description: args.description, topics: args.topics })
      } else if (action === 'archive') {
        result = await actionArchive({ repo, archived: args.archived !== false })
      } else if (action === 'apply-license') {
        result = await actionApplyLicense({ repo })
      } else if (action === 'add-gitignore') {
        result = await actionAddGitignore({ repo, template: args.template })
      } else if (action === 'readme-status') {
        result = await actionReadmeStatus({ repo })
      } else {
        throw new Error(`Unknown action: ${action}`)
      }
      return result
    },
    presentCall(args) {
      return { card: 'generic', title: `GitHub: ${String((args && args.action) || 'action')}`, kind: 'other' }
    },
  }
  ctx.effect(() => ctx.tools.register(statusTool))
  ctx.effect(() => ctx.tools.register(actionTool))
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

function isLoopback(req) {
  const remote = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : ''
  return (
    remote === '127.0.0.1' ||
    remote === '::1' ||
    remote === '::ffff:127.0.0.1' ||
    remote.startsWith('127.')
  )
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(payload)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body is too large.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text ? JSON.parse(text) : {})
      } catch {
        reject(new Error('Invalid JSON body.'))
      }
    })
    req.on('error', reject)
  })
}

async function handle(req, res) {
  if (!isLoopback(req)) {
    sendJson(res, 403, { error: 'The GitHub panel is available on this PC only.' })
    return
  }

  const url = new URL(req.url || '/', 'http://localhost')
  const pathname = url.pathname
  if (!pathname.startsWith(PREFIX)) {
    sendJson(res, 404, { error: 'not found' })
    return
  }
  const endpoint = pathname.slice(PREFIX.length) || '/'
  const method = req.method || 'GET'

  try {
    if (method === 'GET' && (endpoint === '/overview' || endpoint === '/')) {
      const force = url.searchParams.get('refresh') === '1'
      sendJson(res, 200, await scan(force))
      return
    }

    if (method === 'POST') {
      if (req.headers[MUTATION_HEADER] !== '1') {
        sendJson(res, 403, { error: `Missing ${MUTATION_HEADER} header.` })
        return
      }
      const body = await readJsonBody(req)
      if (endpoint === '/action/update-repo') {
        sendJson(res, 200, await actionUpdateRepo(body))
        return
      }
      if (endpoint === '/action/archive') {
        sendJson(res, 200, await actionArchive(body))
        return
      }
      if (endpoint === '/action/rename') {
        sendJson(res, 200, await actionRename(body))
        return
      }
      if (endpoint === '/action/disconnect') {
        sendJson(res, 200, await actionDisconnect())
        return
      }
      if (endpoint === '/action/analyze') {
        sendJson(res, 200, await analyzeAll(true))
        return
      }
      if (endpoint === '/action/apply-license') {
        sendJson(res, 200, await actionApplyLicense(body))
        return
      }
      if (endpoint === '/action/add-gitignore') {
        sendJson(res, 200, await actionAddGitignore(body))
        return
      }
      if (endpoint === '/action/readme-status') {
        sendJson(res, 200, await actionReadmeStatus(body))
        return
      }
      sendJson(res, 404, { error: 'unknown action' })
      return
    }

    sendJson(res, 404, { error: 'not found' })
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
  }
}

/* Agent tools are intentionally NOT registered at activation.
 *
 * Post-mortem (2026-11-05): an earlier build added `tools` to `inject` and
 * registered two global agent tools inside `apply()`. Hot-reloading that build
 * into the running app broke the window on startup and the app could not boot
 * while the plugin stayed enabled in the profile. Web-server registration on
 * its own was stable (Phase 1 ran fine). Re-enable tools only behind an opt-in
 * Config flag, inside try/catch, after a staged test with a rollback copy.
 * The tool definitions below are kept for that future opt-in.
 */
export function apply(ctx) {
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: PREFIX,
      handler: handle,
    }),
  )
}
