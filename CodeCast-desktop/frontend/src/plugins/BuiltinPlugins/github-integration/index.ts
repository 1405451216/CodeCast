import type { PluginManifest, PluginAPI } from '../../PluginTypes';

interface GitHubConfig {
  token: string;
  defaultOwner: string;
  defaultRepo: string;
  autoSyncInterval: number;
  showNotifications: boolean;
  enablePRReviews: boolean;
}

interface GitHubIssue {
  id: number;
  title: string;
  state: 'open' | 'closed';
  number: number;
  created_at: string;
  user: { login: string };
  labels: Array<{ name: string; color: string }>;
  assignees: Array<{ login: string }>;
}

interface PullRequest {
  id: number;
  title: string;
  state: 'open' | 'closed';
  number: number;
  created_at: string;
  user: { login: string };
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  mergeable: boolean | null;
  review_status: string;
}

class GitHubIntegrationPlugin {
  private api: PluginAPI | null = null;
  private config: GitHubConfig = {
    token: '',
    defaultOwner: '',
    defaultRepo: '',
    autoSyncInterval: 300,
    showNotifications: true,
    enablePRReviews: true
  };

  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private cachedIssues: GitHubIssue[] = [];
  private cachedPRs: PullRequest[] = [];

  async activate(api: PluginAPI): Promise<void> {
    this.api = api;

    console.log('[GitHub] Plugin activated');

    const savedConfig = await this.api.storage.get<GitHubConfig>('github-config');
    if (savedConfig) {
      this.config = { ...this.config, ...savedConfig };
    }

    if (!this.config.token) {
      console.warn('[GitHub] No token configured. Please set your GitHub Personal Access Token.');
      return;
    }

    this.registerCommands();
    this.setupAutoSync();

    this.api.ui.registerStatusBarItem({
      id: 'github-issues',
      icon: '🐛',
      tooltip: `Open Issues: ${this.cachedIssues.length}`,
      onClick: () => this.showIssuesPanel()
    });

    this.api.ui.registerStatusBarItem({
      id: 'github-prs',
      icon: '🔀',
      tooltip: `Pull Requests: ${this.cachedPRs.length}`,
      onClick: () => this.showPRsPanel()
    });

    await this.initialSync();
  }

  async deactivate(): Promise<void> {
    console.log('[GitHub] Plugin deactivated');
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.api) {
      this.api.commands.unregisterCommand('github.show-issues');
      this.api.commands.unregisterCommand('github.show-prs');
      this.api.commands.unregisterCommand('github.create-issue');
      this.api.commands.unregisterCommand('github.create-pr');
      this.api.commands.unregisterCommand('github.sync');
      this.api.ui.unregisterStatusBarItem('github-issues');
      this.api.ui.unregisterStatusBarItem('github-prs');
    }
  }

  private registerCommands(): void {
    if (!this.api) return;

    this.api.commands.registerCommand({
      id: 'github.show-issues',
      title: 'GitHub: Show Issues',
      handler: () => this.showIssuesPanel()
    });

    this.api.commands.registerCommand({
      id: 'github.show-prs',
      title: 'GitHub: Show Pull Requests',
      handler: () => this.showPRsPanel()
    });

    this.api.commands.registerCommand({
      id: 'github.create-issue',
      title: 'GitHub: Create Issue',
      handler: () => this.createIssueInteractive()
    });

    this.api.commands.registerCommand({
      id: 'github.create-pr',
      title: 'GitHub: Create Pull Request',
      handler: () => this.createPRInteractive()
    });

    this.api.commands.registerCommand({
      id: 'github.sync',
      title: 'GitHub: Sync Now',
      handler: () => this.syncAll()
    });
  }

  private setupAutoSync(): void {
    if (this.config.autoSyncInterval > 0 && this.config.token) {
      this.syncTimer = setInterval(() => {
        this.syncAll().catch(console.error);
      }, this.config.autoSyncInterval * 1000);

      console.log(`[GitHub] Auto-sync enabled (${this.config.autoSyncInterval}s interval)`);
    }
  }

  private async initialSync(): Promise<void> {
    try {
      console.log('[GitHub] Performing initial sync...');
      await this.syncAll();
      
      if (this.config.showNotifications) {
        const issueCount = this.cachedIssues.filter(i => i.state === 'open').length;
        const prCount = this.cachedPRs.filter(pr => pr.state === 'open').length;

        if (issueCount > 0 || prCount > 0) {
          this.api?.ui.showNotification({
            type: 'info',
            message: `GitHub Sync Complete: ${issueCount} open issues, ${prCount} open PRs`
          });
        }
      }
    } catch (error) {
      console.error('[GitHub] Initial sync failed:', error);
      this.api?.ui.showNotification({
        type: 'error',
        message: `GitHub sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async syncAll(): Promise<void> {
    try {
      const [issues, prs] = await Promise.all([
        this.fetchIssues(),
        this.fetchPullRequests()
      ]);

      this.cachedIssues = issues;
      this.cachedPRs = prs;

      this.updateStatusBarItems();

      this.api?.events.emit('github:synced', {
        issues: issues.length,
        pullRequests: prs.length,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[GitHub] Sync failed:', error);
      throw error;
    }
  }

  private async fetchIssues(): Promise<GitHubIssue[]> {
    if (!this.config.token || !this.config.defaultOwner || !this.config.defaultRepo) {
      return [];
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.config.defaultOwner}/${this.config.defaultRepo}/issues?state=open&per_page=20`,
        {
          headers: {
            'Authorization': `token ${this.config.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[GitHub] Fetched ${data.length} issues`);
      return data;
    } catch (error) {
      console.error('[GitHub] Failed to fetch issues:', error);
      return [];
    }
  }

  private async fetchPullRequests(): Promise<PullRequest[]> {
    if (!this.config.token || !this.config.defaultOwner || !this.config.defaultRepo) {
      return [];
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.config.defaultOwner}/${this.config.defaultRepo}/pulls?state=open&per_page=20`,
        {
          headers: {
            'Authorization': `token ${this.config.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[GitHub] Fetched ${data.length} PRs`);
      return data.map((pr: any) => ({
        ...pr,
        review_status: pr.review_comments_url ? 'pending' : 'none'
      }));
    } catch (error) {
      console.error('[GitHub] Failed to fetch PRs:', error);
      return [];
    }
  }

  private updateStatusBarItems(): void {
    if (!this.api) return;

    const openIssues = this.cachedIssues.filter(i => i.state === 'open').length;
    const openPRs = this.cachedPRs.filter(pr => pr.state === 'open').length;

    this.api.ui.updateStatusBarItem('github-issues', {
      tooltip: `Open Issues: ${openIssues}`
    });

    this.api.ui.updateStatusBarItem('github-prs', {
      tooltip: `Open PRs: ${openPRs}`
    });
  }

  private async showIssuesPanel(): Promise<void> {
    console.log('[GitHub] Opening issues panel...');
    
    const panelContent = this.renderIssuesList();
    
    this.api?.ui.showPanel({
      id: 'github-issues-panel',
      title: `🐛 GitHub Issues (${this.cachedIssues.length})`,
      content: panelContent,
      width: 500
    });
  }

  private async showPRsPanel(): Promise<void> {
    console.log('[GitHub] Opening PRs panel...');
    
    const panelContent = this.renderPRsList();
    
    this.api?.ui.showPanel({
      id: 'github-prs-panel',
      title: `🔀 Pull Requests (${this.cachedPRs.length})`,
      content: panelContent,
      width: 600
    });
  }

  private renderIssuesList(): string {
    if (this.cachedIssues.length === 0) {
      return '<p style="padding: 20px; color: #888;">No issues found</p>';
    }

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        ${this.cachedIssues.slice(0, 15).map(issue => `
          <div style="padding: 12px; border-bottom: 1px solid #eee; cursor: pointer;" 
               onclick="window.open('${issue.html_url}', '_blank')">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: #28a745;">●</span>
              <strong style="flex: 1;">#${issue.number} ${issue.title}</strong>
            </div>
            <div style="margin-top: 4px; font-size: 12px; color: #666;">
              by ${issue.user.login} · ${new Date(issue.created_at).toLocaleDateString()}
              ${issue.labels.length > 0 ? `
                <span style="margin-left: 8px;">
                  ${issue.labels.map(label => `
                    <span style="background: #${label.color}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-right: 4px;">
                      ${label.name}
                    </span>
                  `).join('')}
                </span>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderPRsList(): string {
    if (this.cachedPRs.length === 0) {
      return '<p style="padding: 20px; color: #888;">No pull requests found</p>';
    }

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        ${this.cachedPRs.slice(0, 15).map(pr => `
          <div style="padding: 12px; border-bottom: 1px solid #eee; cursor: pointer;"
               onclick="window.open('${pr.html_url}', '_blank')">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: #6f42c1;">⇄</span>
              <strong style="flex: 1;">#${pr.number} ${pr.title}</strong>
              <span style="font-size: 11px; background: #f1f8ff; padding: 2px 6px; border-radius: 3px;">
                ${pr.head.ref}
              </span>
            </div>
            <div style="margin-top: 4px; font-size: 12px; color: #666;">
              by ${pr.user.login} → ${pr.base.ref} · ${new Date(pr.created_at).toLocaleDateString()}
              ${pr.mergeable === false ? '<span style="color: #d73a49; margin-left: 8px;">⚠️ Merge conflict</span>' : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private async createIssueInteractive(): Promise<void> {
    if (!this.api) return;

    const title = await this.api.ui.showInputBox({
      prompt: 'Enter issue title',
      placeholder: 'Bug: Something is broken'
    });

    if (!title) return;

    const description = await this.api.ui.showInputBox({
      prompt: 'Enter issue description (optional)',
      placeholder: 'Describe the issue in detail...'
    });

    await this.createIssue(title, description || '');
  }

  private async createIssue(title: string, body: string): Promise<void> {
    if (!this.config.token || !this.config.defaultOwner || !this.config.defaultRepo) {
      throw new Error('GitHub configuration incomplete. Please set token, owner, and repo.');
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.config.defaultOwner}/${this.config.defaultRepo}/issues`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${this.config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title, body })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create issue: HTTP ${response.status}`);
      }

      const issue = await response.json();
      console.log(`[GitHub] Created issue #${issue.number}`);

      this.api?.ui.showNotification({
        type: 'success',
        message: `Created issue #${issue.number}: ${title}`,
        actions: [{
          label: 'View on GitHub',
          onClick: () => window.open(issue.html_url, '_blank')
        }]
      });

      await this.fetchIssues();
    } catch (error) {
      console.error('[GitHub] Failed to create issue:', error);
      this.api?.ui.showNotification({
        type: 'error',
        message: `Failed to create issue: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async createPRInteractive(): Promise<void> {
    if (!this.api) return;

    const title = await this.api.ui.showInputBox({
      prompt: 'Enter PR title',
      placeholder: 'feat: Add new feature'
    });

    if (!title) return;

    const headBranch = await this.api.ui.showInputBox({
      prompt: 'Source branch name',
      placeholder: 'feature/my-new-feature'
    });

    if (!headBranch) return;

    await this.createPullRequest(title, headBranch, 'main');
  }

  private async createPullRequest(
    title: string, 
    head: string, 
    base: string,
    body?: string
  ): Promise<void> {
    if (!this.config.token || !this.config.defaultOwner || !this.config.defaultRepo) {
      throw new Error('GitHub configuration incomplete.');
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.config.defaultOwner}/${this.config.defaultRepo}/pulls`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${this.config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title, head, base, body })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create PR: HTTP ${response.status}`);
      }

      const pr = await response.json();
      console.log(`[GitHub] Created PR #${pr.number}`);

      this.api?.ui.showNotification({
        type: 'success',
        message: `Created PR #${pr.number}: ${title}`,
        actions: [{
          label: 'View on GitHub',
          onClick: () => window.open(pr.html_url, '_blank')
        }]
      });

      await this.fetchPullRequests();
    } catch (error) {
      console.error('[GitHub] Failed to create PR:', error);
      this.api?.ui.showNotification({
        type: 'error',
        message: `Failed to create PR: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  async updateConfig(newConfig: Partial<GitHubConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    if (this.api) {
      await this.api.storage.set('github-config', this.config);
    }

    console.log('[GitHub] Config updated:', { ...this.config, token: '***' });
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    this.setupAutoSync();

    this.api?.events.emit('github:config-updated', this.config);
  }

  getConfig(): Omit<GitHubConfig, 'token'> {
    const { token, ...configWithoutToken } = this.config;
    return configWithoutToken;
  }

  getIssues(): GitHubIssue[] {
    return [...this.cachedIssues];
  }

  getPullRequests(): PullRequest[] {
    return [...this.cachedPRs];
  }
}

const plugin: PluginManifest = {
  id: 'github-integration',
  name: 'GitHub Integration',
  version: '1.0.0',
  description: '无缝集成 GitHub 功能，包括仓库管理、Issue 跟踪、PR 创建和 CI/CD 状态监控',
  author: 'CodeCast Team',
  permissions: ['network:fetch', 'file:read', 'clipboard:read', 'clipboard:write'],
  entry: GitHubIntegrationPlugin
};

export default plugin;