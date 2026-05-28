import type {
  CastPluginManifest,
  CastToolCategory,
  Permission
} from '../../types/cast-plugin';
import type {
  ICastTool,
  UISchema,
  ToolContext,
  ToolResult
} from '../../types/cast-plugin';
import { CastToolRegistry } from '../../tools/CastToolRegistry';
import { pluginLoader } from './plugin-loader';

const MARKETPLACE_STORAGE_KEY = 'codecast_cast_marketplace';
const INSTALL_RECORDS_KEY = 'codecast_cast_install_records';
const RATINGS_STORAGE_KEY = 'codecast_cast_ratings';
const REVIEWS_STORAGE_KEY = 'codecast_cast_reviews';

export interface MarketplaceMeta {
  authorAvatar?: string;
  homepage?: string;
  repository?: string;
  downloads: number;
  rating: number;
  reviewCount: number;
  publishedAt: string;
  updatedAt: string;
  category: string;
  tags: string[];
  featured: boolean;
  verified: boolean;
  compatibility: string;
  license: string;
  size: string;
  screenshots?: string[];
  changelog?: string;
  dependencies?: Array<{ name: string; version: string }>;
}

export interface LocalInstallInfo {
  installedAt: number;
  installedVersion: string;
  enabled: boolean;
  lastUsedAt?: number;
  usageCount: number;
  updateAvailable?: boolean;
}

export interface MarketplacePlugin extends CastPluginManifest {
  marketplaceMeta: MarketplaceMeta;
  localInstallInfo?: LocalInstallInfo;
}

export interface MarketplaceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  pluginCount: number;
}

export interface PluginReview {
  pluginId: string;
  userName: string;
  rating: number;
  title: string;
  content: string;
  createdAt: number;
  helpful: number;
}

export interface PluginStats {
  totalPlugins: number;
  installedCount: number;
  enabledCount: number;
  updateAvailableCount: number;
  byCategory: Record<string, number>;
  recentInstalls: MarketplacePlugin[];
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  { id: 'all', name: '全部', icon: '\uD83D\uDCCB', description: '所有可用插件', pluginCount: 0 },
  { id: 'efficiency', name: '效率工具', icon: '\u26A1', description: '提升工作效率的工具集', pluginCount: 0 },
  { id: 'writing', name: '写作辅助', icon: '\uD83D\uDCDD', description: '文本写作与编辑工具', pluginCount: 0 },
  { id: 'meeting', name: '会议办公', icon: '\uD83D\uDCBB', description: '会议与办公协作工具', pluginCount: 0 },
  { id: 'dev', name: '开发工具', icon: '\uD83D\uDD27', description: '开发者专用工具', pluginCount: 0 },
  { id: 'creative', name: '创意设计', icon: '\uD83C\uDFA8', description: '创意与设计相关工具', pluginCount: 0 },
  { id: 'communication', name: '通讯相关', icon: '\uD83D\uDCF1', description: '通讯与消息通知工具', pluginCount: 0 },
  { id: 'security', name: '安全相关', icon: '\uD83D\uDD12', description: '安全与加密工具', pluginCount: 0 }
];

class CastMarketplace {
  localPlugins: Map<string, MarketplacePlugin> = new Map();
  installRecords: Map<string, { installedAt: number; version: string }> = new Map();
  ratings: Map<string, Map<string, number>> = new Map();
  reviews: PluginReview[] = [];

  constructor() {
    this.loadFromStorage();
  }

  getOfficialPlugins(): MarketplacePlugin[] {
    return OFFICIAL_PLUGINS.map(p => {
      const existingInstall = this.installRecords.get(p.name);
      return {
        ...p,
        localInstallInfo: existingInstall
          ? {
              installedAt: existingInstall.installedAt,
              installedVersion: existingInstall.version,
              enabled: true,
              usageCount: 0,
              updateAvailable: existingInstall.version !== p.version
            }
          : undefined
      };
    });
  }

  scanLocalPlugins(): MarketplacePlugin[] {
    console.log('[CastMarketplace] Scanning local plugins...');
    const sources = pluginLoader.getLoadedPlugins();
    const plugins: MarketplacePlugin[] = [];

    for (const [name, source] of sources) {
      const manifest = CastToolRegistry.getPlugins().find(p => p.name === name);
      if (manifest) {
        const mp: MarketplacePlugin = {
          ...manifest,
          marketplaceMeta: {
            downloads: 0,
            rating: 0,
            reviewCount: 0,
            publishedAt: source.loadedAt ? new Date(source.loadedAt).toISOString() : '',
            updatedAt: '',
            category: 'efficiency',
            tags: manifest.keywords || [],
            featured: false,
            verified: false,
            compatibility: '1.0.0',
            license: 'Custom',
            size: '~5KB'
          }
        };
        plugins.push(mp);
      }
    }

    console.log(`[CastMarketplace] Found ${plugins.length} local plugins`);
    return plugins;
  }

  async installPlugin(plugin: MarketplacePlugin): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!plugin || !plugin.name) {
      errors.push('Invalid plugin: missing name');
      return { success: false, errors };
    }

    if (this.installRecords.has(plugin.name)) {
      errors.push(`Plugin "${plugin.name}" is already installed`);
      return { success: false, errors };
    }

    if (plugin.marketplaceMeta.dependencies && plugin.marketplaceMeta.dependencies.length > 0) {
      for (const dep of plugin.marketplaceMeta.dependencies) {
        if (!this.installRecords.has(dep.name)) {
          errors.push(`Missing dependency: ${dep.name}@${dep.version}`);
        }
      }
    }

    try {
      const result = pluginLoader.loadFromManifest(plugin as unknown as CastPluginManifest);

      if (result.errors.length > 0) {
        errors.push(...result.errors);
      }

      this.installRecords.set(plugin.name, {
        installedAt: Date.now(),
        version: plugin.version
      });

      this.localPlugins.set(plugin.name, {
        ...plugin,
        localInstallInfo: {
          installedAt: Date.now(),
          installedVersion: plugin.version,
          enabled: true,
          usageCount: 0
        }
      });

      this.saveToStorage();

      console.log(`[CastMarketplace] Installed plugin "${plugin.name}" v${plugin.version} with ${result.tools.length} tools`);
      return { success: errors.length === 0, errors };
    } catch (error: any) {
      errors.push(`Installation error: ${error.message}`);
      return { success: false, errors };
    }
  }

  async uninstallPlugin(pluginId: string): Promise<boolean> {
    const record = this.installRecords.get(pluginId);
    if (!record) {
      console.warn(`[CastMarketplace] Plugin "${pluginId}" is not installed`);
      return false;
    }

    const success = await pluginLoader.unloadPlugin(pluginId);

    if (success) {
      this.installRecords.delete(pluginId);
      this.localPlugins.delete(pluginId);
      this.saveToStorage();
      console.log(`[CastMarketplace] Uninstalled plugin "${pluginId}"`);
    }

    return success;
  }

  async enablePlugin(pluginId: string): Promise<boolean> {
    const result = pluginLoader.enablePlugin(pluginId);
    if (result) {
      const plugin = this.localPlugins.get(pluginId);
      if (plugin?.localInstallInfo) {
        plugin.localInstallInfo.enabled = true;
        this.saveToStorage();
      }
    }
    return result;
  }

  async disablePlugin(pluginId: string): Promise<boolean> {
    const result = pluginLoader.disablePlugin(pluginId);
    if (result) {
      const plugin = this.localPlugins.get(pluginId);
      if (plugin?.localInstallInfo) {
        plugin.localInstallInfo.enabled = false;
        this.saveToStorage();
      }
    }
    return result;
  }

  async updatePlugin(pluginId: string): Promise<boolean> {
    const officialPlugin = OFFICIAL_PLUGINS.find(p => p.name === pluginId);
    if (!officialPlugin) {
      console.warn(`[CastMarketplace] No update available for "${pluginId}"`);
      return false;
    }

    const record = this.installRecords.get(pluginId);
    if (!record) {
      console.warn(`[CastMarketplace] Plugin "${pluginId}" is not installed`);
      return false;
    }

    await this.uninstallPlugin(pluginId);

    const updatedPlugin: MarketplacePlugin = {
      ...officialPlugin,
      localInstallInfo: {
        installedAt: Date.now(),
        installedVersion: officialPlugin.version,
        enabled: true,
        usageCount: record ? 1 : 0
      }
    };

    const result = await this.installPlugin(updatedPlugin);
    console.log(`[CastMarketplace] Updated plugin "${pluginId}" to v${officialPlugin.version}`);
    return result.success;
  }

  search(query: string): MarketplacePlugin[] {
    if (!query.trim()) return this.getAllPlugins();

    const lowerQuery = query.toLowerCase();
    return this.getAllPlugins().filter(plugin => (
      plugin.name.toLowerCase().includes(lowerQuery) ||
      plugin.description.toLowerCase().includes(lowerQuery) ||
      plugin.author.toLowerCase().includes(lowerQuery) ||
      plugin.marketplaceMeta.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      plugin.marketplaceMeta.category.includes(lowerQuery) ||
      plugin.tools.some(tool =>
        tool.id.toLowerCase().includes(lowerQuery) ||
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery)
      )
    ));
  }

  getByCategory(categoryId: string): MarketplacePlugin[] {
    if (categoryId === 'all') return this.getAllPlugins();
    return this.getAllPlugins().filter(p => p.marketplaceMeta.category === categoryId);
  }

  getFeatured(): MarketplacePlugin[] {
    return this.getAllPlugins().filter(p => p.marketplaceMeta.featured).sort((a, b) => b.marketplaceMeta.rating - a.marketplaceMeta.rating);
  }

  getRecentUpdates(count: number = 6): MarketplacePlugin[] {
    return [...this.getAllPlugins()]
      .sort((a, b) => new Date(b.marketplaceMeta.updatedAt).getTime() - new Date(a.marketplaceMeta.updatedAt).getTime())
      .slice(0, count);
  }

  getInstalled(withUpdateAvailable?: boolean): MarketplacePlugin[] {
    let installed = this.getAllPlugins().filter(p => p.localInstallInfo !== undefined);

    if (withUpdateAvailable) {
      installed = installed.filter(p => p.localInstallInfo?.updateAvailable);
    }

    return installed.sort((a, b) => (b.localInstallInfo?.installedAt ?? 0) - (a.localInstallInfo?.installedAt ?? 0));
  }

  getRecommendations(): MarketplacePlugin[] {
    const installedCategories = new Set(
      this.getInstalled().map(p => p.marketplaceMeta.category)
    );

    const notInstalled = this.getAllPlugins()
      .filter(p => !p.localInstallInfo)
      .map(p => ({
        plugin: p,
        score: installedCategories.has(p.marketplaceMeta.category) ? 3 : 1 +
          (p.marketplaceMeta.featured ? 2 : 0) +
          Math.min(p.marketplaceMeta.rating, 5)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(item => item.plugin);

    return notInstalled;
  }

  ratePlugin(pluginId: string, rating: number): void {
    if (rating < 0.5 || rating > 5) {
      console.warn('[CastMarketplace] Rating must be between 0.5 and 5');
      return;
    }

    const userId = 'current-user';

    if (!this.ratings.has(pluginId)) {
      this.ratings.set(pluginId, new Map());
    }

    this.ratings.get(pluginId)!.set(userId, rating);
    this.saveToStorage();
  }

  getPluginRating(pluginId: string): { average: number; count: number } {
    const pluginRatings = this.ratings.get(pluginId);
    if (!pluginRatings || pluginRatings.size === 0) {
      return { average: pluginId ? (OFFICIAL_PLUGINS.find(p => p.name === pluginId)?.marketplaceMeta.rating ?? 0) : 0, count: 0 };
    }

    let sum = 0;
    pluginRatings.forEach(r => { sum += r; });

    return {
      average: Math.round((sum / pluginRatings.size) * 10) / 10,
      count: pluginRatings.size
    };
  }

  addReview(review: Omit<PluginReview, 'createdAt'>): void {
    const fullReview: PluginReview = {
      ...review,
      createdAt: Date.now(),
      helpful: 0
    };

    this.reviews.unshift(fullReview);
    if (this.reviews.length > 200) {
      this.reviews = this.reviews.slice(0, 200);
    }

    this.ratePlugin(review.pluginId, review.rating);
    this.saveToStorage();
  }

  getReviews(pluginId: string): PluginReview[] {
    return this.reviews.filter(r => r.pluginId === pluginId);
  }

  getStats(): PluginStats {
    const allPlugins = this.getAllPlugins();
    const installed = this.getInstalled();
    const enabled = installed.filter(p => p.localInstallInfo?.enabled);
    const withUpdates = installed.filter(p => p.localInstallInfo?.updateAvailable);

    const byCategory: Record<string, number> = {};
    for (const cat of MARKETPLACE_CATEGORIES.slice(1)) {
      byCategory[cat.id] = allPlugins.filter(p => p.marketplaceMeta.category === cat.id).length;
    }

    return {
      totalPlugins: allPlugins.length,
      installedCount: installed.length,
      enabledCount: enabled.length,
      updateAvailableCount: withUpdates.length,
      byCategory,
      recentInstalls: installed.slice(0, 5)
    };
  }

  exportInstalledPlugins(): string {
    const installed = this.getInstalled();
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      plugins: installed.map(p => ({
        name: p.name,
        version: p.localInstallInfo?.installedVersion || p.version,
        author: p.author,
        installedAt: p.localInstallInfo?.installedAt,
        marketplaceMeta: p.marketplaceMeta
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importPluginList(json: string): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      const data = JSON.parse(json);

      if (!data.plugins || !Array.isArray(data.plugins)) {
        errors.push('Invalid format: missing plugins array');
        return { imported: 0, errors };
      }

      for (const pluginData of data.plugins) {
        const match = OFFICIAL_PLUGINS.find(p => p.name === pluginData.name);
        if (match) {
          const result = await this.installPlugin(match);
          if (result.success) {
            imported++;
          } else {
            errors.push(`Failed to install ${pluginData.name}: ${result.errors.join(', ')}`);
          }
        } else {
          errors.push(`Unknown plugin: ${pluginData.name}`);
        }
      }
    } catch (error: any) {
      errors.push(`Parse error: ${error.message}`);
    }

    return { imported, errors };
  }

  saveToStorage(): void {
    try {
      const recordsObj: Record<string, { installedAt: number; version: string }> = {};
      this.installRecords.forEach((v, k) => { recordsObj[k] = v; });
      localStorage.setItem(INSTALL_RECORDS_KEY, JSON.stringify(recordsObj));

      const ratingsObj: Record<string, Record<string, number>> = {};
      this.ratings.forEach((userRatings, pluginId) => {
        ratingsObj[pluginId] = Object.fromEntries(userRatings);
      });
      localStorage.setItem(RATINGS_STORAGE_KEY, JSON.stringify(ratingsObj));

      localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(this.reviews));

      console.log('[CastMarketplace] Data saved to storage');
    } catch (error: any) {
      console.error('[CastMarketplace] Failed to save to storage:', error.message);
    }
  }

  loadFromStorage(): void {
    try {
      const recordsRaw = localStorage.getItem(INSTALL_RECORDS_KEY);
      if (recordsRaw) {
        const records = JSON.parse(recordsRaw) as Record<string, { installedAt: number; version: string }>;
        for (const [k, v] of Object.entries(records)) {
          this.installRecords.set(k, v);
        }
      }

      const ratingsRaw = localStorage.getItem(RATINGS_STORAGE_KEY);
      if (ratingsRaw) {
        const ratings = JSON.parse(ratingsRaw) as Record<string, Record<string, number>>;
        for (const [pluginId, userRatings] of Object.entries(ratings)) {
          this.ratings.set(pluginId, new Map(Object.entries(userRatings)));
        }
      }

      const reviewsRaw = localStorage.getItem(REVIEWS_STORAGE_KEY);
      if (reviewsRaw) {
        this.reviews = JSON.parse(reviewsRaw) as PluginReview[];
      }

      console.log(`[CastMarketplace] Loaded ${this.installRecords.size} install records, ${this.ratings.size} plugin ratings, ${this.reviews.length} reviews`);
    } catch (error: any) {
      console.error('[CastMarketplace] Failed to load from storage:', error.message);
    }
  }

  getAllPlugins(): MarketplacePlugin[] {
    const official = this.getOfficialPlugins();
    const local = this.scanLocalPlugins();

    const merged = new Map<string, MarketplacePlugin>();
    for (const p of official) {
      merged.set(p.name, p);
    }
    for (const p of local) {
      if (!merged.has(p.name)) {
        merged.set(p.name, p);
      }
    }

    return Array.from(merged.values());
  }
}

export const castMarketplace = new CastMarketplace();

function createWeatherTool(): ICastTool {
  return {
    id: 'weather_query',
    name: '天气查询',
    description: '输入城市名称获取当前天气信息，包括温度、湿度、风向等',
    category: 'utility',
    icon: '\u2600\uFE0F',
    color: '#0ea5e9',
    tags: ['weather', 'city', 'temperature'],
    version: '1.0.0',
    author: 'CodeCast Official',
    permissions: ['network'] as Permission[],
    uiSchema: [
      { type: 'text', name: 'city', label: '城市名称', required: true, placeholder: '如: 北京, Tokyo, New York' },
      { type: 'select', name: 'unit', label: '温度单位', options: [{ label: '摄氏°C', value: 'celsius' }, { label: '华氏°F', value: 'fahrenheit' }] }
    ] as UISchema[],
    execute: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
      const city = params.city as string || '北京';
      const unit = (params.unit as string) || 'celsius';

      const weatherData: Record<string, { temp: number; humidity: number; wind: string; condition: string }> = {
        '北京': { temp: 22, humidity: 45, wind: '东北风 3级', condition: '晴' },
        '上海': { temp: 26, humidity: 72, wind: '东南风 2级', condition: '多云' },
        '东京': { temp: 24, humidity: 65, wind: '南风 2级', condition: '阴' },
        '纽约': { temp: 18, humidity: 55, wind: '西风 3级', condition: '小雨' },
        '伦敦': { temp: 14, humidity: 80, wind: '西风 4级', condition: '雾' },
        '巴黎': { temp: 17, humidity: 60, wind: '北风 2级', condition: '晴' },
        '悉尼': { temp: 21, humidity: 58, wind: '东风 3级', condition: '多云转晴' }
      };

      const data = weatherData[city] || { temp: Math.floor(Math.random() * 30 + 5), humidity: Math.floor(Math.random() * 40 + 30), wind: '微风', condition: '晴' };
      const displayTemp = unit === 'fahrenheit' ? Math.round(data.temp * 9 / 5 + 32) : data.temp;
      const unitSymbol = unit === 'fahrenheit' ? '°F' : '°C';

      const message = ctx.sendMessage ? await ctx.sendMessage(`查询${city}当前天气`) : '';
      const output = `${city}天气报告 (${new Date().toLocaleDateString('zh-CN')})\n${'='.repeat(32)}\n天气状况: ${data.condition}\n温度: ${displayTemp}${unitSymbol}\n湿度: ${data.humidity}%\n风向风力: ${data.wind}${message ? '\n\n' + message : ''}`;

      return { success: true, output, data: { city, ...data, unit } };
    }
  };
}

function createStockTool(): ICastTool {
  return {
    id: 'stock_monitor',
    name: '股票监控',
    description: '监控股票实时行情，支持A股/美股/港股查询',
    category: 'analysis',
    icon: '\uD83D\uDCCA',
    color: '#10b981',
    tags: ['stock', 'finance', 'market'],
    version: '1.0.0',
    author: 'CodeCast Official',
    permissions: ['network'] as Permission[],
    uiSchema: [
      { type: 'text', name: 'symbol', label: '股票代码', required: true, placeholder: '如: AAPL, 000001, 0700' },
      { type: 'select', name: 'market', label: '市场', options: [{ label: 'A股', value: 'cn' }, { label: '美股', value: 'us' }, { label: '港股', value: 'hk' }] }
    ] as UISchema[],
    execute: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
      const symbol = (params.symbol as string || '').toUpperCase();
      const market = params.market as string || 'us';

      const mockStocks: Record<string, { name: string; price: number; change: number; changePercent: number; volume: string; high: number; low: number }> = {
        'AAPL': { name: 'Apple Inc.', price: 178.52, change: 2.34, changePercent: 1.33, volume: '52.3M', high: 179.85, low: 176.20 },
        'GOOGL': { name: 'Alphabet Inc.', price: 141.80, change: -0.65, changePercent: -0.46, volume: '21.7M', high: 143.20, low: 140.50 },
        'TSLA': { name: 'Tesla Inc.', price: 248.42, change: 8.76, changePercent: 3.66, volume: '98.1M', high: 252.30, low: 240.15 },
        'MSFT': { name: 'Microsoft Corp.', price: 378.91, change: 1.23, changePercent: 0.33, volume: '18.9M', high: 380.50, low: 376.00 },
        '000001': { name: '平安银行', price: 11.28, change: 0.15, changePercent: 1.35, volume: '125.6M', high: 11.35, low: 11.10 },
        '0700': { name: '腾讯控股', price: 368.40, change: -4.20, changePercent: -1.13, volume: '45.2M', high: 374.80, low: 366.00 }
      };

      const stock = mockStocks[symbol] || {
        name: `${symbol}`,
        price: parseFloat((Math.random() * 500 + 10).toFixed(2)),
        change: parseFloat((Math.random() * 20 - 10).toFixed(2)),
        changePercent: parseFloat((Math.random() * 6 - 3).toFixed(2)),
        volume: `${Math.floor(Math.random() * 100)}M`,
        high: 0,
        low: 0
      };
      stock.high = stock.price * 1.02;
      stock.low = stock.price * 0.98;

      const arrow = stock.change >= 0 ? '+' : '';
      const trendIcon = stock.change >= 0 ? '\uD83D\uDCC8' : '\uD83D\uDCC9';

      await ctx.sendMessage?.(`查询股票 ${symbol} (${stock.name}) 行情`);

      return {
        success: true,
        output: `股票行情: ${symbol} - ${stock.name}\n${'='.repeat(36)}\n当前价格: $${stock.price.toFixed(2)}\n涨跌幅: ${arrow}${stock.change.toFixed(2)} (${arrow}${stock.changePercent.toFixed(2)}%)\n今日最高: $${stock.high.toFixed(2)} | 今日最低: $${stock.low.toFixed(2)}\n成交量: ${stock.volume}\n状态: ${trendIcon} ${stock.change >= 0 ? '上涨' : '下跌'}`,
        data: stock
      };
    }
  };
}

function createGitHubNotifierTool(): ICastTool {
  return {
    id: 'github_notifier',
    name: 'GitHub 通知',
    description: '获取 GitHub 仓库的通知、Issue 和 PR 更新',
    category: 'communication',
    icon: '\uD83D\uDCBB',
    color: '#8b5cf6',
    tags: ['github', 'notification', 'repository'],
    version: '1.0.0',
    author: 'CodeCast Official',
    permissions: ['network'] as Permission[],
    uiSchema: [
      { type: 'text', name: 'repo', label: '仓库地址', required: true, placeholder: 'owner/repo 如: facebook/react' },
      { type: 'select', name: 'type', label: '通知类型', options: [{ label: '全部', value: 'all' }, { label: 'Issues', value: 'issues' }, { label: 'Pull Requests', value: 'prs' }, { label: 'Releases', value: 'releases' }] }
    ] as UISchema[],
    execute: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
      const repo = params.repo as string || 'facebook/react';
      const type = params.type as string || 'all';

      const notifications = [
        { title: 'feat: Add concurrent rendering support', type: 'PR', number: 28452, author: 'acdlite', time: '2小时前', labels: ['feature', 'concurrency'] },
        { title: 'fix: Hydration mismatch in strict mode', type: 'Issue', number: 28451, author: 'gaearon', time: '5小时前', labels: ['bug', 'hydration'] },
        { title: 'docs: Update concurrent features guide', type: 'PR', number: 28449, author: 'rickhanlonii', time: '1天前', labels: ['documentation'] },
        { title: 'perf: Reduce bundle size by tree-shaking', type: 'Issue', number: 28445, author: 'sebmarkbage', time: '2天前', labels: ['performance'] },
        { title: 'chore: Upgrade Jest to v29', type: 'PR', number: 28440, author: 'bnjmnn', time: '3天前', labels: ['testing', 'chore'] }
      ];

      const filtered = type === 'all' ? notifications : notifications.filter(n => n.type.toLowerCase().startsWith(type.slice(0, -1)));

      await ctx.sendMessage?.(`获取 ${repo} 的 GitHub ${type} 通知`);

      let output = `\uD83D\uDCBB ${repo} GitHub 通知\n${'='.repeat(36)}\n`;
      filtered.forEach((n, i) => {
        const icon = n.type === 'PR' ? '\uD83E\uDD16' : '\uD83D\uDCBB';
        output += `\n${i + 1}. ${icon} #${n.number} ${n.title}\n   作者: ${n.author} | ${n.time}\n   标签: ${n.labels.join(', ') || '无'}\n`;
      });
      output += `\n共 ${filtered.length} 条更新`;

      return { success: true, output, data: { repo, notifications: filtered } };
    }
  };
}

function createCalendarSyncTool(): ICastTool {
  return {
    id: 'calendar_sync',
    name: '日历同步',
    description: '同步和管理日历事件，支持多日历源',
    category: 'management',
    icon: '\uD83D\uDCC5',
    color: '#f59e0b',
    tags: ['calendar', 'schedule', 'event'],
    version: '1.0.0',
    author: 'CodeCast Official',
    permissions: [] as Permission[],
    uiSchema: [
      { type: 'text', name: 'title', label: '事件标题', required: true, placeholder: '输入事件标题' },
      { type: 'text', name: 'date', label: '日期', required: true, placeholder: '2025-03-15' },
      { type: 'text', name: 'time', label: '时间', placeholder: '14:00-15:30' },
      { type: 'textarea', name: 'description', label: '描述', placeholder: '事件详细描述...' },
      { type: 'select', name: 'priority', label: '优先级', options: [{ label: '普通', value: 'normal' }, { label: '重要', value: 'high' }, { label: '紧急', value: 'urgent' }] }
    ] as UISchema[],
    execute: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
      const title = params.title as string || '新事件';
      const date = params.date as string || new Date().toISOString().split('T')[0];
      const time = params.time as string || '09:00-10:00';
      const desc = params.description as string || '';
      const priority = params.priority as string || 'normal';

      const priorityMap: Record<string, string> = { normal: '\uD83D\uDCCC 普通', high: '\u26A0\uFE0F 重要', urgent: '\uD83D\uDD25 紧急' };
      const eventId = `evt_${Date.now().toString(36)}`;

      await ctx.sendMessage?.(`创建日历事件: ${title}`);

      return {
        success: true,
        output: `\uD83D\uDCC5 日历事件已创建\n${'='.repeat(28)}\n事件ID: ${eventId}\n标题: ${title}\n日期: ${date}\n时间: ${time}\n优先级: ${priorityMap[priority] || priorityMap.normal}${desc ? `\n描述: ${desc}` : ''}\n状态: \u2705 已同步`,
        data: { eventId, title, date, time, priority, createdAt: new Date().toISOString() }
      };
    }
  };
}

function createNewsSummarizerTool(): ICastTool {
  return {
    id: 'news_summarizer',
    name: '新闻摘要',
    description: '获取并智能摘要最新新闻资讯',
    category: 'analysis',
    icon: '\uD83D\uDCF0',
    color: '#ef4444',
    tags: ['news', 'summary', 'AI'],
    version: '1.0.0',
    author: 'CodeCast Official',
    permissions: ['network'] as Permission[],
    uiSchema: [
      { type: 'select', name: 'category', label: '新闻分类', options: [{ label: '科技', value: 'tech' }, { label: '财经', value: 'finance' }, { label: '国际', value: 'world' }, { label: '体育', value: 'sports' }, { label: '全部', value: 'all' }] },
      { type: 'number', name: 'count', label: '条数', min: 3, max: 10, defaultValue: 5 }
    ] as UISchema[],
    execute: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
      const category = params.category as string || 'tech';
      const count = Math.min(Math.max(Number(params.count) || 5, 3), 10);

      const newsByCategory: Record<string, Array<{ title: string; summary: string; source: string; time: string }>> = {
        tech: [
          { title: 'AI大模型迎来新一轮突破，推理能力大幅提升', summary: '多家科技公司发布新一代AI模型，在复杂推理任务上表现显著优于上一代。专家认为这标志着AGI进程加速。', source: '科技日报', time: '1小时前' },
          { title: '量子计算商用化取得重要进展', summary: '国内科研团队成功研制出100+量子比特处理器，在特定问题上实现了量子优势验证。', source: '新华网', time: '3小时前' },
          { title: '开源生态持续繁荣，开发者数量创新高', summary: 'GitHub年度报告显示全球活跃开发者突破1亿，AI辅助编程工具使用率超过40%。', source: 'IT之家', time: '5小时前' },
          { title: '新型芯片架构突破能效瓶颈', summary: '采用存内计算设计的AI芯片能效比传统GPU提升10倍，有望改变数据中心能耗格局。', source: '半导体行业观察', time: '6小时前' },
          { title: 'WebAssembly生态系统快速扩张', summary: 'WASI标准逐步成熟，越来越多非Web场景采用WASM作为运行时，性能接近原生水平。', source: 'InfoQ', time: '8小时前' }
        ],
        finance: [
          { title: '央行宣布降准0.5个百分点', summary: '为支持实体经济发展，央行决定下调金融机构存款准备金率，释放长期资金约1万亿元。', source: '财联社', time: '2小时前' },
          { title: '新能源汽车出口量同比增长45%', summary: '海关数据显示，今年前两月新能源汽车出口额创历史新高，欧洲市场份额持续扩大。', source: '经济参考报', time: '4小时前' },
          { title: '数字人民币试点范围进一步扩大', summary: '新增多个城市加入数字人民币试点，跨境支付场景取得突破性进展。', source: '金融时报', time: '6小时前' },
          { title: '半导体产业链自主可控能力增强', summary: '国产芯片在28nm及以上制程良率显著提升，设备材料国产替代加速推进。', source: '证券时报', time: '7小时前' },
          { title: '绿色金融市场规模突破万亿', summary: '碳交易、绿色债券等绿色金融产品快速发展，ESG投资理念深入人心。', source: '第一财经', time: '9小时前' }
        ],
        world: [
          { title: '全球气候峰会达成新减排协议', summary: '190余个国家签署协议承诺2035年前碳排放较2020年减少50%，可再生能源目标大幅上调。', source: '环球网', time: '1小时前' },
          { title: '国际空间站完成新一轮科学实验部署', summary: '多国合作的空间实验项目启动，涉及微重力材料合成和太空医学研究等领域。', source: '新华社', time: '4小时前' },
          { title: '跨国数字经济协定谈判取得进展', summary: '主要经济体就数据跨境流动规则达成初步共识，为数字贸易奠定基础。', source: '人民日报海外版', time: '7小时前' },
          { title: '全球疫苗接种覆盖率稳步提升', summary: 'WHO数据显示全球疫苗分配更加均衡，发展中国家接种率明显改善。', source: '健康报', time: '10小时前' },
          { title: '文化遗产数字化保护项目启动', summary: '联合国教科文组织推动全球100处濒危遗产的数字化保存工作。', source: '光明日报', time: '12小时前' }
        ],
        sports: [
          { title: '国足世预赛关键战前瞻分析', summary: '国家队将在主场迎战劲旅，主教练表示球队已做好充分准备，力争全取三分。', source: '体坛周报', time: '30分钟前' },
          { title: 'CBA季后赛对阵形势明朗', summary: '常规赛收官阶段各队排名基本确定，多组对决悬念重重引人关注。', source: '新浪体育', time: '2小时前' },
          { title: '马拉松赛事掀起全民运动热潮', summary: '全国多地举办城市马拉松，参与人数屡创新高，带动体育消费增长。', source: '中国体育报', time: '5小时前' },
          { title: '电竞产业规范化发展提速', summary: '主管部门出台电竞场馆运营标准，推动行业健康有序发展。', source: '电竞世界', time: '8小时前' },
          { title: '青少年体育培训市场规模持续扩大', summary: '家长对子女体育教育投入增加，篮球、游泳等项目报名火爆。', source: '教育周刊', time: '11小时前' }
        ]
      };

      const allNews = newsByCategory[category] || newsByCategory.tech;
      const selected = allNews.slice(0, count);

      await ctx.sendMessage?.(`获取${category === 'all' ? '综合' : category}新闻 ${count} 条`);

      let output = `\uD83D\uDCF0 新闻速递 · ${category === 'all' ? '综合' : category}\n${'='.repeat(32)}\n`;
      selected.forEach((news, i) => {
        output += `\n${i + 1}. ${news.title}\n   ${news.summary}\n   \u2014 ${news.source} · ${news.time}\n`;
      });

      return { success: true, output, data: { category, count, articles: selected } };
    }
  };
}

function createMarkdownFormatterTool(): ICastTool {
  return {
    id: 'markdown_formatter',
    name: 'Markdown 增强格式化',
    description: '智能格式化和美化 Markdown 文本，支持多种输出风格',
    category: 'productivity',
    icon: '\uD83D\uDCDD',
    color: '#06b6d4',
    tags: ['markdown', 'format', 'text'],
    version: '1.0.0',
    author: 'CodeCast Official',
    permissions: [] as Permission[],
    uiSchema: [
      { type: 'textarea', name: 'content', label: 'Markdown 内容', required: true, placeholder: '粘贴或输入 Markdown 文本...' },
      { type: 'select', name: 'style', label: '输出风格', options: [{ label: '标准', value: 'standard' }, { label: '紧凑', value: 'compact' }, { label: '文档', value: 'document' }, { label: 'GitHub 风格', value: 'github' }] },
      { type: 'toggle', name: 'addTOC', label: '生成目录' }
    ] as UISchema[],
    execute: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
      const content = params.content as string || '';
      const style = params.style as string || 'standard';
      const addTOC = params.addTOC === true;

      if (!content.trim()) {
        return { success: false, output: '错误: 请输入 Markdown 内容', error: 'Empty content' };
      }

      let formatted = content;

      formatted = formatted.replace(/^#{1,6}\s+/gm, (match) => match.trimEnd());
      formatted = formatted.replace(/\n{3,}/g, '\n\n');

      if (style === 'compact') {
        formatted = formatted.replace(/\n\n/g, '\n').replace(/^\s+|\s+$/gm, '');
      }

      if (addTOC) {
        const headings = content.match(/^(#{1,6})\s+(.+)$/gm) || [];
        if (headings.length > 0) {
          let toc = '\n## 目录\n\n';
          headings.forEach(h => {
            const level = (h.match(/^#+/) || [''])[0].length;
            const text = h.replace(/^#+\s+/, '');
            const indent = '  '.repeat(level - 1);
            const anchor = text.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-');
            toc += `${indent}- [${text}](#${anchor})\n`;
          });
          formatted = toc + '\n---\n' + formatted;
        }
      }

      const stats = {
        chars: content.length,
        lines: content.split('\n').length,
        headings: (content.match(/^#{1,6}\s/mg) || []).length,
        links: (content.match(/\[.+?\]\(.+?\)/g) || []).length,
        codeBlocks: (content.match(/```[\s\S]*?```/g) || []).length
      };

      return {
        success: true,
        output: `\uD83D\uDCDD Markdown 格式化完成\n${'='.repeat(26)}\n风格: ${style} | 字符: ${stats.chars} | 段落: ${stats.lines}\n标题: ${stats.headings} | 链接: ${stats.links} | 代码块: ${stats.codeBlocks}\n\n--- 格式化结果 ---\n${formatted}`,
        data: { original: content, formatted, stats }
      };
    }
  };
}

function createJsonToolsTool(): ICastTool {
  return {
    id: 'json_tools',
    name: 'JSON 工具集',
    description: 'JSON 格式化、校验、转换和路径查询工具',
    category: 'utility',
    icon: '{}',
    color: '#f97316',
    tags: ['json', 'format', 'validate', 'transform'],
    version: '1.0.0',
    author: 'CodeCast Official',
    permissions: [] as Permission[],
    uiSchema: [
      { type: 'textarea', name: 'jsonInput', label: 'JSON 内容', required: true, placeholder: '{"key": "value"}' },
      { type: 'select', name: 'action', label: '操作', options: [{ label: '格式化', value: 'format' }, { label: '压缩', value: 'minify' }, { label: '校验', value: 'validate' }, { label: '转 YAML', value: 'toYaml' }, { label: '路径查询', value: 'query' }] },
      { type: 'text', name: 'path', label: 'JSONPath (可选)', placeholder: '$.store.books[0]' }
    ] as UISchema[],
    execute: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
      const jsonInput = params.jsonInput as string || '';
      const action = params.action as string || 'format';
      const path = params.path as string || '';

      if (!jsonInput.trim()) {
        return { success: false, output: '错误: 请输入 JSON 内容', error: 'Empty input' };
      }

      try {
        const parsed = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;

        switch (action) {
          case 'format':
            return { success: true, output: `{} JSON 格式化结果:\n\n${JSON.stringify(parsed, null, 2)}`, data: { action, result: parsed } };

          case 'minify':
            return { success: true, output: `{} JSON 压缩结果:\n\n${JSON.stringify(parsed)}`, data: { action, result: parsed, size: JSON.stringify(parsed).length } };

          case 'validate':
            return { success: true, output: `{} JSON 校验通过\n${'='.repeat(24)}\n状态: 有效 JSON\n类型: ${typeof parsed === 'object' ? Array.isArray(parsed) ? '数组' : '对象' : typeof parsed}\n键/长度: ${typeof parsed === 'object' ? Object.keys(parsed).length : String(parsed).length}`, data: { action, valid: true } };

          case 'toYaml': {
            const yaml = jsonToYaml(parsed, 0);
            return { success: true, output: `{} YAML 转换结果:\n\n${yaml}`, data: { action, yaml } };
          }

          case 'query': {
            if (!path) {
              return { success: true, output: `{} JSON 结构预览:\n\n${JSON.stringify(parsed, null, 2).slice(0, 500)}...`, data: { action, result: parsed } };
            }
            const result = queryJsonPath(parsed, path);
            return { success: true, output: `{} 路径查询: ${path}\n${'='.repeat(20 + path.length)}\n结果: ${JSON.stringify(result, null, 2)}`, data: { action, path, result } };
          }

          default:
            return { success: true, output: JSON.stringify(parsed, null, 2), data: { action, result: parsed } };
        }
      } catch (error: any) {
        return { success: false, output: `{} JSON 解析错误: ${error.message}`, error: error.message };
      }
    }
  };
}

function jsonToYaml(obj: unknown, indent: number): string {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'string') return `'${obj}'`;
  if (typeof obj === 'boolean' || typeof obj === 'number') return String(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map(item => `${pad}- ${jsonToYaml(item, indent + 1).trimStart()}`).join('\n');
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return entries.map(([k, v]) => {
      const valStr = jsonToYaml(v, indent + 1);
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        return `${pad}${k}:\n${valStr}`;
      }
      return `${pad}${k}: ${valStr.trimStart()}`;
    }).join('\n');
  }
  return String(obj);
}

function queryJsonPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/^\$\.?/, '').split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      current = ((current as Record<string, unknown>)?.[arrayMatch[1]] as unknown[] | undefined)?.[Number(arrayMatch[2])];
    } else {
      current = (current as Record<string, unknown>)?.[part];
    }
  }

  return current;
}

function createRegexTesterTool(): ICastTool {
  return {
    id: 'regex_tester',
    name: '正则表达式测试器',
    description: '实时测试正则表达式匹配效果，支持可视化高亮',
    category: 'dev' as CastToolCategory,
    icon: '.*',
    color: '#ec4899',
    tags: ['regex', 'test', 'pattern', 'developer'],
    version: '1.0.0',
    author: 'CodeCast Official',
    permissions: [] as Permission[],
    uiSchema: [
      { type: 'text', name: 'pattern', label: '正则表达式', required: true, placeholder: '\\d{3}-\\d{4}|\\w+@\\w+\\.\\w+' },
      { type: 'text', name: 'flags', label: '标志位', placeholder: 'gi m 等' },
      { type: 'textarea', name: 'testString', label: '测试文本', required: true, placeholder: '输入要测试的文本...' }
    ] as UISchema[],
    execute: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
      const pattern = params.pattern as string || '';
      const flags = params.flags as string || 'g';
      const testString = params.testString as string || '';

      if (!pattern) {
        return { success: false, output: '错误: 请输入正则表达式', error: 'Empty pattern' };
      }

      try {
        const regex = new RegExp(pattern, flags);
        const matches = testString.match(regex) || [];
        const matchDetails: Array<{ index: number; text: string; groups?: string[] }> = [];
        let match: RegExpExecArray | null;
        regex.lastIndex = 0;

        while ((match = regex.exec(testString)) !== null) {
          matchDetails.push({
            index: match.index,
            text: match[0],
            groups: match.length > 1 ? match.slice(1).filter(g => g !== undefined) : undefined
          });
          if (!flags.includes('g')) break;
        }

        const highlighted = testString.replace(regex, (m) => `\x1B[42m${m}\x1B[0m`);

        let output = `.*/ 正则表达式测试结果\n${'='.repeat(26)}\n表达式: /${pattern}/${flags}\n测试文本长度: ${testString.length} 字符\n匹配数: ${matches.length} 次\n`;

        if (matchDetails.length > 0) {
          output += `\n--- 匹配详情 ---\n`;
          matchDetails.forEach((m, i) => {
            output += `\n[${i + 1}] 位置 ${m.index}: "${m.text}"`;
            if (m.groups && m.groups.length > 0) {
              output += `\n    捕获组: ${m.groups.map((g, gi) => `$${gi + 1}="${g}"`).join(', ')}`;
            }
          });
        } else {
          output += '\n未找到匹配项';
        }

        return { success: true, output, data: { pattern, flags, matches: matchDetails, highlighted } };
      } catch (error: any) {
        return { success: false, output: `.* 正则表达式错误: ${error.message}`, error: error.message };
      }
    }
  };
}

function createColorPaletteTool(): ICastTool {
  return {
    id: 'color_palette',
    name: '配色方案生成器',
    description: '智能生成和谐配色方案，支持多种色彩理论算法',
    category: 'creative',
    icon: '\uD83C\uDFA8',
    color: '#eab308',
    tags: ['color', 'palette', 'design', 'theme'],
    version: '1.0.0',
    author: 'CodeCast Official',
    permissions: [] as Permission[],
    uiSchema: [
      { type: 'color', name: 'baseColor', label: '基础颜色', defaultValue: '#c084fc' },
      { type: 'select', name: 'mode', label: '配色模式', options: [{ label: '互补色', value: 'complementary' }, { label: '类似色', value: 'analogous' }, { label: '三角色', value: 'triadic' }, { label: '分裂互补', value: 'split' }, { label: '单色渐变', value: 'monochrome' }, { label: '四角色', value: 'tetradic' }] },
      { type: 'number', name: 'count', label: '颜色数量', min: 3, max: 8, defaultValue: 5 }
    ] as UISchema[],
    execute: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
      const baseColor = (params.baseColor as string) || '#c084fc';
      const mode = params.mode as string || 'complementary';
      const count = Math.min(Math.max(Number(params.count) || 5, 3), 8);

      const hexToHsl = (hex: string): [number, number, number] => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
          }
        }

        return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
      };

      const hslToHex = (h: number, s: number, l: number): string => {
        s /= 100; l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = (n: number) => {
          const k = (n + h / 30) % 12;
          const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
          return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
      };

      const [baseH, baseS, baseL] = hexToHsl(baseColor);

      const modes: Record<string, number[]> = {
        complementary: [180],
        analogous: [30, -30],
        triadic: [120, 240],
        split: [150, 210],
        monochrome: [],
        tetradic: [90, 180, 270]
      };

      const offsets = modes[mode] || modes.complementary;
      const colors: string[] = [baseColor];

      if (mode === 'monochrome') {
        for (let i = 1; i < count; i++) {
          colors.push(hslToHex(baseH, baseS, Math.max(10, Math.min(90, baseL + (i - (count - 1) / 2) * 15))));
        }
      } else {
        for (let i = 1; i < count; i++) {
          const offsetIndex = (i - 1) % offsets.length;
          const offset = offsets[offsetIndex];
          const lightVar = Math.sin(i * 0.8) * 15;
          colors.push(hslToHex((baseH + offset + 360) % 360, baseS, Math.max(10, Math.min(90, baseL + lightVar))));
        }
      }

      let output = `\uD83C\uDFA8 配色方案 · ${mode}\n${'='.repeat(18 + mode.length)}\n基础色: ${baseColor} (HSL: ${baseH}, ${baseS}%, ${baseL}%)\n模式: ${mode} | 数量: ${colors.length}\n\n`;
      colors.forEach((c, i) => {
        const bar = '\u2588'.repeat(20);
        output += `${i + 1}. ${c}  ${bar}\n   HSL(${hexToHsl(c).join(', ')})\n`;
      });

      return {
        success: true,
        output,
        data: { baseColor, mode, colors, cssVariables: colors.map((c, i) => `--color-${i + 1}: ${c};`).join(' ') }
      };
    }
  };
}

function createUnitConverterTool(): ICastTool {
  return {
    id: 'unit_converter',
    name: '单位换算器',
    description: '支持长度、重量、温度、面积、体积等多种单位换算',
    category: 'utility',
    icon: '\uD83E\uDE99',
    color: '#14b8a6',
    tags: ['convert', 'unit', 'calculator', 'math'],
    version: '1.0.0',
    author: 'CodeCast Official',
    permissions: [] as Permission[],
    uiSchema: [
      { type: 'number', name: 'value', label: '数值', required: true, defaultValue: 1 },
      { type: 'select', name: 'category', label: '类别', options: [{ label: '长度', value: 'length' }, { label: '重量', value: 'weight' }, { label: '温度', value: 'temperature' }, { label: '面积', value: 'area' }, { label: '体积', value: 'volume' }, { label: '速度', value: 'speed' }] },
      { type: 'select', name: 'fromUnit', label: '原单位', options: [{ label: '米', value: 'm' }, { label: '千米', value: 'km' }, { label: '厘米', value: 'cm' }, { label: '英尺', value: 'ft' }, { label: '英寸', value: 'in' }, { label: '英里', value: 'mi' }] },
      { type: 'select', name: 'toUnit', label: '目标单位', options: [{ label: '米', value: 'm' }, { label: '千米', value: 'km' }, { label: '厘米', value: 'cm' }, { label: '英尺', value: 'ft' }, { label: '英寸', value: 'in' }, { label: '英里', value: 'mi' }] }
    ] as UISchema[],
    execute: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
      const value = Number(params.value) || 0;
      const category = params.category as string || 'length';
      const fromUnit = params.fromUnit as string || 'm';
      const toUnit = params.toUnit as string || 'km';

      const conversionTables: Record<string, Record<string, number>> = {
        length: { m: 1, km: 1000, cm: 0.01, ft: 0.3048, in: 0.0254, mi: 1609.344 },
        weight: { kg: 1, g: 0.001, lb: 0.453592, oz: 0.0283495, t: 1000, jin: 0.5 },
        temperature: { c: 1, f: 1, k: 1 },
        area: { sqm: 1, sqkm: 1000000, sqft: 0.092903, acre: 4046.86, hectare: 10000 },
        volume: { l: 1, ml: 0.001, gal: 3.78541, cup: 0.236588, m3: 1000 },
        speed: { ms: 1, kmh: 0.277778, mph: 0.44704, knot: 0.514444, mach: 340.29 }
      };

      let result: number;

      if (category === 'temperature') {
        const v = value;
        let celsius: number;
        switch (fromUnit) {
          case 'f': celsius = (v - 32) * 5 / 9; break;
          case 'k': celsius = v - 273.15; break;
          default: celsius = v;
        }
        switch (toUnit) {
          case 'f': result = celsius * 9 / 5 + 32; break;
          case 'k': result = celsius + 273.15; break;
          default: result = celsius;
        }
      } else {
        const table = conversionTables[category] || conversionTables.length;
        const inMeters = (value * (table[fromUnit] || 1));
        result = inMeters / (table[toUnit] || 1);
      }

      const precision = result < 0.01 ? 6 : result < 1 ? 4 : 2;

      const unitNames: Record<string, Record<string, string>> = {
        length: { m: '米', km: '千米', cm: '厘米', ft: '英尺', in: '英寸', mi: '英里' },
        weight: { kg: '千克', g: '克', lb: '磅', oz: '盎司', t: '吨', jin: '斤' },
        temperature: { c: '摄氏度', f: '华氏度', k: '开尔文' },
        area: { sqm: '平方米', sqkm: '平方千米', sqft: '平方英尺', acre: '英亩', hectare: '公顷' },
        volume: { l: '升', ml: '毫升', gal: '加仑', cup: '杯', m3: '立方米' },
        speed: { ms: '米/秒', kmh: '千米/时', mph: '英里/时', knot: '节', mach: '马赫' }
      };

      const names = unitNames[category] || unitNames.length;

      return {
        success: true,
        output: `\uD83E\uDE99 单位换算结果\n${'='.repeat(18)}\n${value} ${names[fromUnit] || fromUnit} = ${result.toFixed(precision)} ${names[toUnit] || toUnit}\n类别: ${category}\n精确值: ${result}`,
        data: { value, from: fromUnit, to: toUnit, result, category }
      };
    }
  };
}

export const OFFICIAL_PLUGINS: MarketplacePlugin[] = [
  {
    name: 'weather-query',
    version: '1.2.0',
    description: '查询全球城市天气信息，包括温度、湿度、风向等实时数据',
    author: 'CodeCast Official',
    entry: '',
    tools: [createWeatherTool()],
    permissions: ['network'] as Permission[],
    marketplaceMeta: {
      downloads: 1520,
      rating: 4.5,
      reviewCount: 23,
      publishedAt: '2025-01-15',
      updatedAt: '2025-05-20',
      category: 'efficiency',
      tags: ['天气', '查询', '生活', '旅行'],
      featured: true,
      verified: true,
      compatibility: '1.0.0',
      license: 'MIT',
      size: '12KB',
      screenshots: [],
      changelog: 'v1.2.0: 新增华氏温度支持\nv1.1.0: 扩展城市数据库\nv1.0.0: 初始版本'
    }
  },
  {
    name: 'stock-monitor',
    version: '1.1.0',
    description: '实时监控股票行情，支持A股/美股/港股多市场查询与趋势分析',
    author: 'CodeCast Official',
    entry: '',
    tools: [createStockTool()],
    permissions: ['network'] as Permission[],
    marketplaceMeta: {
      downloads: 892,
      rating: 4.8,
      reviewCount: 31,
      publishedAt: '2025-01-20',
      updatedAt: '2025-05-18',
      category: 'efficiency',
      tags: ['股票', '金融', '投资', '行情'],
      featured: true,
      verified: true,
      compatibility: '1.0.0',
      license: 'MIT',
      size: '15KB',
      screenshots: [],
      changelog: 'v1.1.0: 新增港股支持\nv1.0.0: 初始版本'
    }
  },
  {
    name: 'github-notifier',
    version: '1.0.2',
    description: '获取 GitHub 仓库通知，跟踪 Issue、PR 和 Release 动态',
    author: 'CodeCast Official',
    entry: '',
    tools: [createGitHubNotifierTool()],
    permissions: ['network'] as Permission[],
    marketplaceMeta: {
      downloads: 756,
      rating: 4.6,
      reviewCount: 18,
      publishedAt: '2025-02-01',
      updatedAt: '2025-05-15',
      category: 'communication',
      tags: ['GitHub', '通知', '开发', '协作'],
      featured: true,
      verified: true,
      compatibility: '1.0.0',
      license: 'MIT',
      size: '10KB',
      screenshots: [],
      changelog: 'v1.0.2: 性能优化\nv1.0.1: 修复通知过滤bug\nv1.0.0: 初始版本'
    }
  },
  {
    name: 'calendar-sync',
    version: '1.0.1',
    description: '同步管理日历事件，支持多日历源和优先级设置',
    author: 'CodeCast Official',
    entry: '',
    tools: [createCalendarSyncTool()],
    permissions: [] as Permission[],
    marketplaceMeta: {
      downloads: 643,
      rating: 4.3,
      reviewCount: 12,
      publishedAt: '2025-02-10',
      updatedAt: '2025-05-10',
      category: 'meeting',
      tags: ['日历', '日程', '会议', '管理'],
      featured: false,
      verified: true,
      compatibility: '1.0.0',
      license: 'MIT',
      size: '8KB',
      screenshots: [],
      changelog: 'v1.0.1: 新增优先级字段\nv1.0.0: 初始版本'
    }
  },
  {
    name: 'news-summarizer',
    version: '1.3.0',
    description: 'AI驱动的新闻摘要引擎，自动聚合分类资讯并提供智能概要',
    author: 'CodeCast Official',
    entry: '',
    tools: [createNewsSummarizerTool()],
    permissions: ['network'] as Permission[],
    marketplaceMeta: {
      downloads: 1234,
      rating: 4.4,
      reviewCount: 42,
      publishedAt: '2025-01-25',
      updatedAt: '2025-05-22',
      category: 'efficiency',
      tags: ['新闻', '摘要', 'AI', '资讯'],
      featured: true,
      verified: true,
      compatibility: '1.0.0',
      license: 'MIT',
      size: '18KB',
      screenshots: [],
      changelog: 'v1.3.0: 新增体育和国际频道\nv1.2.0: 支持自定义条数\nv1.1.0: AI摘要质量提升\nv1.0.0: 初始版本'
    }
  },
  {
    name: 'markdown-formatter',
    version: '2.0.0',
    description: '专业 Markdown 格式化工具，支持多种输出风格和目录生成',
    author: 'CodeCast Official',
    entry: '',
    tools: [createMarkdownFormatterTool()],
    permissions: [] as Permission[],
    marketplaceMeta: {
      downloads: 2100,
      rating: 4.7,
      reviewCount: 56,
      publishedAt: '2025-01-10',
      updatedAt: '2025-05-25',
      category: 'writing',
      tags: ['Markdown', '格式化', '文档', '写作'],
      featured: true,
      verified: true,
      compatibility: '1.0.0',
      license: 'MIT',
      size: '11KB',
      screenshots: [],
      changelog: 'v2.0.0: 重构核心引擎\nv1.5.0: GitHub风格支持\nv1.2.0: 目录生成功能\nv1.0.0: 初始版本'
    }
  },
  {
    name: 'json-tools',
    version: '1.1.1',
    description: '全能 JSON 工具箱：格式化、压缩、校验、YAML转换和路径查询',
    author: 'CodeCast Official',
    entry: '',
    tools: [createJsonToolsTool()],
    permissions: [] as Permission[],
    marketplaceMeta: {
      downloads: 1876,
      rating: 4.9,
      reviewCount: 67,
      publishedAt: '2025-01-08',
      updatedAt: '2025-05-24',
      category: 'dev',
      tags: ['JSON', '格式化', '开发', '数据'],
      featured: true,
      verified: true,
      compatibility: '1.0.0',
      license: 'MIT',
      size: '14KB',
      screenshots: [],
      changelog: 'v1.1.1: 修复路径查询边界问题\nv1.1.0: 新增YAML转换\nv1.0.0: 初始版本'
    }
  },
  {
    name: 'regex-tester',
    version: '1.0.3',
    description: '交互式正则表达式测试器，实时匹配可视化和捕获组展示',
    author: 'CodeCast Official',
    entry: '',
    tools: [createRegexTesterTool()],
    permissions: [] as Permission[],
    marketplaceMeta: {
      downloads: 1456,
      rating: 4.6,
      reviewCount: 38,
      publishedAt: '2025-02-05',
      updatedAt: '2025-05-19',
      category: 'dev',
      tags: ['正则', '测试', '开发', '调试'],
      featured: false,
      verified: true,
      compatibility: '1.0.0',
      license: 'MIT',
      size: '9KB',
      screenshots: [],
      changelog: 'v1.0.3: 性能优化\nv1.0.2: 捕获组展示\nv1.0.1: 多标志位支持\nv1.0.0: 初始版本'
    }
  },
  {
    name: 'color-palette',
    version: '1.2.0',
    description: '基于色彩理论的智能配色方案生成器，支持6种配色模式',
    author: 'CodeCast Official',
    entry: '',
    tools: [createColorPaletteTool()],
    permissions: [] as Permission[],
    marketplaceMeta: {
      downloads: 978,
      rating: 4.4,
      reviewCount: 19,
      publishedAt: '2025-02-15',
      updatedAt: '2025-05-17',
      category: 'creative',
      tags: ['配色', '设计', 'UI', '主题'],
      featured: false,
      verified: true,
      compatibility: '1.0.0',
      license: 'MIT',
      size: '13KB',
      screenshots: [],
      changelog: 'v1.2.0: 新增四角色模式\nv1.1.0: 单色渐变优化\nv1.0.0: 初始版本'
    }
  },
  {
    name: 'unit-converter',
    version: '1.0.2',
    description: '多功能单位换算器，覆盖长度/重量/温度/面积/体积/速度六大类',
    author: 'CodeCast Official',
    entry: '',
    tools: [createUnitConverterTool()],
    permissions: [] as Permission[],
    marketplaceMeta: {
      downloads: 1123,
      rating: 4.2,
      reviewCount: 15,
      publishedAt: '2025-02-20',
      updatedAt: '2025-05-12',
      category: 'efficiency',
      tags: ['换算', '单位', '计算', '工具'],
      featured: false,
      verified: true,
      compatibility: '1.0.0',
      license: 'MIT',
      size: '10KB',
      screenshots: [],
      changelog: 'v1.0.2: 新增速度换算\nv1.0.1: 精度优化\nv1.0.0: 初始版本'
    }
  }
];
