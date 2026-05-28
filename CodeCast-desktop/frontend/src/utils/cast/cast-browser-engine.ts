export interface BrowserPageInfo {
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface BrowserScreenshot {
  dataUrl: string;
  width: number;
  height: number;
  timestamp: number;
}

export interface BrowserElement {
  selector: string;
  tag: string;
  text: string;
  visible: boolean;
  clickable: boolean;
  editable: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface BrowserFormData {
  fields: Array<{
    name: string;
    type: 'text' | 'password' | 'email' | 'select' | 'checkbox' | 'textarea' | 'file';
    selector: string;
    value: string;
    label?: string;
    placeholder?: string;
  }>;
  submitButton?: { selector: string; text: string };
}

export interface BrowserScrapeResult {
  url: string;
  title: string;
  timestamp: number;
  content: {
    text: string;
    html?: string;
    links: Array<{ text: string; href: string }>;
    images: Array<{ src: string; alt: string }>;
    forms: BrowserFormData[];
  };
  metadata: {
    loadTime: number;
    elementCount: number;
    wordCount: number;
  };
}

export interface BrowserAutomationOptions {
  timeout?: number;
  waitForSelector?: string;
  waitForNavigation?: boolean;
  screenshot?: boolean;
  headless?: boolean;
  userAgent?: string;
  viewport?: { width: number; height: number };
}

type BrowserEventType = 'navigated' | 'loaded' | 'error' | 'console' | 'dialog';

export interface BrowserEvent {
  type: BrowserEventType;
  url?: string;
  message?: string;
  timestamp: number;
}

type EngineMode = 'cdp' | 'simulation' | 'unavailable';

import { castPrivacyManager } from './cast-privacy-manager';

class CastBrowserEngineClass {
  private available: boolean = false;
  private mode: EngineMode = 'unavailable';
  private eventListeners: Map<BrowserEventType, Set<(event: BrowserEvent) => void>> = new Map();
  private currentPageUrl: string = '';
  private currentPageTitle: string = '';
  private allowedDomains: string[] = [];
  private navigationHistory: string[] = [];
  private historyIndex: number = -1;

  constructor() {
    this.available = this.detectAvailability();
    this.initEventMaps();
  }

  private initEventMaps(): void {
    const types: BrowserEventType[] = ['navigated', 'loaded', 'error', 'console', 'dialog'];
    for (const t of types) {
      this.eventListeners.set(t, new Set());
    }
  }

  private detectAvailability(): boolean {
    try {
      const w = window as any;
      if (w?.go?.main?.App?.BrowserNavigate) {
        this.mode = 'cdp';
        return true;
      }
      if (w?.go?.main?.App?.CDPOpen || w?.go?.main?.App?.CDPNavigate) {
        this.mode = 'cdp';
        return true;
      }
      if (typeof fetch !== 'undefined' && typeof DOMParser !== 'undefined') {
        this.mode = 'simulation';
        return true;
      }
      this.mode = 'unavailable';
      return false;
    } catch {
      this.mode = 'simulation';
      return typeof fetch !== 'undefined';
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  getStatus(): { available: boolean; method: EngineMode } {
    return { available: this.available, method: this.mode };
  }

  async navigate(url: string, options?: BrowserAutomationOptions): Promise<BrowserPageInfo> {
    if (!this.isDomainAllowed(url)) {
      throw new Error(`Domain not in allowlist: ${new URL(url).hostname}`);
    }

    const auditResult = await castPrivacyManager.auditOutbound({
      url,
      method: 'NAVIGATE',
      category: 'browser',
      reason: `Browser navigation to ${url}`,
      privacyLevel: 'private'
    });

    if (!auditResult.allowed) {
      throw new Error('Browser navigation blocked by privacy policy');
    }

    const timeout = options?.timeout ?? 10000;

    if (this.mode === 'cdp') {
      return await this.cdpNavigate(url, options);
    }

    return await this.simulateNavigate(url, timeout);
  }

  private async cdpNavigate(url: string, _options?: BrowserAutomationOptions): Promise<BrowserPageInfo> {
    try {
      const w = window as any;
      const result = await w.go.main.App.BrowserNavigate(url);

      if (result && typeof result === 'object') {
        this.currentPageUrl = result.url || url;
        this.currentPageTitle = result.title || '';
        this.pushHistory(this.currentPageUrl);
        this.emit('navigated', { url: this.currentPageUrl });
        this.emit('loaded', { url: this.currentPageUrl });
        return {
          url: this.currentPageUrl,
          title: this.currentPageTitle,
          loading: false,
          canGoBack: this.historyIndex > 0,
          canGoForward: this.historyIndex < this.navigationHistory.length - 1
        };
      }

      this.currentPageUrl = url;
      this.pushHistory(url);
      return {
        url,
        title: '',
        loading: false,
        canGoBack: this.historyIndex > 0,
        canGoForward: this.historyIndex < this.navigationHistory.length - 1
      };
    } catch (error: any) {
      this.emit('error', { message: error.message || 'CDP navigation failed' });
      throw new Error(`CDP navigation failed: ${error.message}`);
    }
  }

  private async simulateNavigate(url: string, timeout: number): Promise<BrowserPageInfo> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CodeCast-Browser/1.0)' },
        redirect: 'follow'
      });

      clearTimeout(timer);

      const contentType = response.headers.get('content-type') || '';
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      this.currentPageUrl = response.url || url;
      this.currentPageTitle = doc.title || '';
      this.pushHistory(this.currentPageUrl);

      const loadTime = Date.now() - startTime;
      this.emit('navigated', { url: this.currentPageUrl, message: `Loaded in ${loadTime}ms (${contentType})` });
      this.emit('loaded', { url: this.currentPageUrl });

      return {
        url: this.currentPageUrl,
        title: this.currentPageTitle,
        loading: false,
        canGoBack: this.historyIndex > 0,
        canGoForward: this.historyIndex < this.navigationHistory.length - 1
      };
    } catch (error: any) {
      this.emit('error', { url, message: error.name === 'AbortError' ? `Timeout after ${timeout}ms` : error.message });
      throw error;
    }
  }

  private pushHistory(url: string): void {
    if (this.historyIndex < this.navigationHistory.length - 1) {
      this.navigationHistory = this.navigationHistory.slice(0, this.historyIndex + 1);
    }
    this.navigationHistory.push(url);
    this.historyIndex = this.navigationHistory.length - 1;
  }

  async goBack(): Promise<BrowserPageInfo> {
    if (this.historyIndex <= 0) {
      return this.getCurrentPageInfo();
    }
    this.historyIndex--;
    const prevUrl = this.navigationHistory[this.historyIndex];
    return await this.navigate(prevUrl);
  }

  async goForward(): Promise<BrowserPageInfo> {
    if (this.historyIndex >= this.navigationHistory.length - 1) {
      return this.getCurrentPageInfo();
    }
    this.historyIndex++;
    const nextUrl = this.navigationHistory[this.historyIndex];
    return await this.navigate(nextUrl);
  }

  async refresh(options?: BrowserAutomationOptions): Promise<BrowserPageInfo> {
    return await this.navigate(this.currentPageUrl, options);
  }

  async getCurrentUrl(): Promise<string> {
    return this.currentPageUrl;
  }

  async getTitle(): Promise<string> {
    return this.currentPageTitle;
  }

  async getPageText(): Promise<string> {
    if (!this.currentPageUrl) return '';

    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserGetText) {
          return await w.go.main.App.BrowserGetText() || '';
        }
      } catch {
        // fallback to simulation
      }
    }

    return await this.simulateGetPageText();
  }

  private async simulateGetPageText(): Promise<string> {
    try {
      const response = await fetch(this.currentPageUrl);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return doc.body?.textContent?.trim() || '';
    } catch {
      return '';
    }
  }

  async screenshot(_fullPage?: boolean): Promise<BrowserScreenshot> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserScreenshot) {
          const result = await w.go.main.App.BrowserScreenshot();
          if (result && result.dataUrl) {
            return {
              dataUrl: result.dataUrl,
              width: result.width || 1280,
              height: result.height || 720,
              timestamp: Date.now()
            };
          }
        }
      } catch {
        // fallback
      }
    }

    return {
      dataUrl: '',
      width: 1280,
      height: 720,
      timestamp: Date.now()
    };
  }

  async scrape(options?: { includeHtml?: boolean; includeLinks?: boolean; includeImages?: boolean; includeForms?: boolean }): Promise<BrowserScrapeResult> {
    const startTime = Date.now();
    const opts = {
      includeHtml: false,
      includeLinks: true,
      includeImages: true,
      includeForms: true,
      ...options
    };

    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserScrape) {
          const result = await w.go.main.App.BrowserScrape(opts);
          if (result && result.content) {
            return result;
          }
        }
      } catch {
        // fallback to simulation
      }
    }

    return await this.simulateScrape(opts, startTime);
  }

  private async simulateScrape(opts: { includeHtml: boolean; includeLinks: boolean; includeImages: boolean; includeForms: boolean }, startTime: number): Promise<BrowserScrapeResult> {
    try {
      const response = await fetch(this.currentPageUrl);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const textContent = doc.body?.textContent?.trim() || '';
      const links = opts.includeLinks
        ? Array.from(doc.querySelectorAll('a')).map(a => ({
            text: a.textContent?.trim() || '',
            href: a.href || ''
          })).filter(l => l.href)
        : [];

      const images = opts.includeImages
        ? Array.from(doc.querySelectorAll('img')).map(img => ({
            src: img.src || '',
            alt: img.alt || ''
          })).filter(i => i.src)
        : [];

      const forms = opts.includeForms ? this.extractForms(doc) : [];

      return {
        url: this.currentPageUrl,
        title: doc.title || '',
        timestamp: Date.now(),
        content: {
          text: textContent,
          html: opts.includeHtml ? html : undefined,
          links,
          images,
          forms
        },
        metadata: {
          loadTime: Date.now() - startTime,
          elementCount: doc.all?.length || 0,
          wordCount: textContent.split(/\s+/).filter(Boolean).length
        }
      };
    } catch (error: any) {
      throw new Error(`Scrape failed: ${error.message}`);
    }
  }

  private extractForms(doc: Document): BrowserFormData[] {
    const forms: BrowserFormData[] = [];
    const formElements = doc.querySelectorAll('form');

    for (const form of formElements) {
      const fields: BrowserFormData['fields'] = [];
      let submitBtn: { selector: string; text: string } | undefined;

      const inputs = form.querySelectorAll('input, textarea, select');
      for (const el of Array.from(inputs)) {
        const tagName = el.tagName.toLowerCase();
        let type: BrowserFormData['fields'][0]['type'] = 'text';

        if (tagName === 'input') {
          const inputType = (el as HTMLInputElement).type;
          if (['password', 'email', 'checkbox', 'file'].includes(inputType)) {
            type = inputType as BrowserFormData['fields'][0]['type'];
          } else if (inputType === 'hidden') continue;
        } else if (tagName === 'textarea') {
          type = 'textarea';
        } else if (tagName === 'select') {
          type = 'select';
        }

        const name = el.getAttribute('name') || el.getAttribute('id') || '';
        const selector = el.tagName.toLowerCase() +
          (el.getAttribute('id') ? `#${el.getAttribute('id')}` :
           el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : '');

        fields.push({
          name,
          type,
          selector: selector || tagName,
          value: tagName === 'select'
            ? (el as HTMLSelectElement).value || ''
            : (el as HTMLInputElement).value || '',
          placeholder: (el as HTMLInputElement).placeholder || undefined
        });
      }

      const submitEls = form.querySelectorAll('button[type="submit"], input[type="submit"]');
      if (submitEls.length > 0) {
        const btn = submitEls[0];
        submitBtn = {
          selector: `${btn.tagName.toLowerCase()}${btn.getAttribute('id') ? `#${btn.getAttribute('id')}` : ''}`,
          text: btn.textContent?.trim() || (btn as HTMLInputElement).value || 'Submit'
        };
      }

      if (fields.length > 0) {
        forms.push({ fields, submitButton: submitBtn });
      }
    }

    return forms;
  }

  async click(selector: string, options?: BrowserAutomationOptions): Promise<boolean> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserClick) {
          return await w.go.main.App.BrowserClick(selector, options);
        }
      } catch (error: any) {
        throw new Error(`Click failed: ${error.message}`);
      }
    }

    console.warn(`[CastBrowser] Click on "${selector}" simulated (no real browser control)`);
    return true;
  }

  async fill(selector: string, value: string, options?: BrowserAutomationOptions): Promise<boolean> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserFill) {
          return await w.go.main.App.BrowserFill(selector, value, options);
        }
      } catch (error: any) {
        throw new Error(`Fill failed: ${error.message}`);
      }
    }

    console.warn(`[CastBrowser] Fill "${selector}" with "${value}" simulated`);
    return true;
  }

  async type(selector: string, text: string, _options?: { delay?: number; clearFirst?: boolean }): Promise<boolean> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserType) {
          return await w.go.main.App.BrowserType(selector, text);
        }
      } catch (error: any) {
        throw new Error(`Type failed: ${error.message}`);
      }
    }

    console.warn(`[CastBrowser] Type "${text}" into "${selector}" simulated`);
    return true;
  }

  async selectOption(selector: string, value: string): Promise<boolean> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserSelectOption) {
          return await w.go.main.App.BrowserSelectOption(selector, value);
        }
      } catch (error: any) {
        throw new Error(`SelectOption failed: ${error.message}`);
      }
    }

    console.warn(`[CastBrowser] SelectOption "${value}" on "${selector}" simulated`);
    return true;
  }

  async scrollTo(selector: string): Promise<boolean> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserScrollTo) {
          return await w.go.main.App.BrowserScrollTo(selector);
        }
      } catch {
        // fallback
      }
    }
    return true;
  }

  async scrollToTop(): Promise<boolean> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserScrollToTop) {
          return await w.go.main.App.BrowserScrollToTop();
        }
      } catch {
        // fallback
      }
    }
    return true;
  }

  async hover(selector: string): Promise<boolean> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserHover) {
          return await w.go.main.App.BrowserHover(selector);
        }
      } catch {
        // fallback
      }
    }
    return true;
  }

  async fillForm(formData: Record<string, string>, options?: { submit?: boolean }): Promise<boolean> {
    for (const [selector, value] of Object.entries(formData)) {
      const filled = await this.fill(selector, value);
      if (!filled) return false;
    }

    if (options?.submit) {
      return await this.submitForm();
    }
    return true;
  }

  async getFormFields(selector?: string): Promise<BrowserFormData[]> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserGetFormFields) {
          return await w.go.main.App.BrowserGetFormFields(selector);
        }
      } catch {
        // fallback
      }
    }

    try {
      const scrapeResult = await this.scrape({ includeHtml: false, includeLinks: false, includeImages: false, includeForms: true });
      if (selector) {
        return scrapeResult.content.forms.filter(f =>
          f.fields.some(field => field.selector.includes(selector))
        );
      }
      return scrapeResult.content.forms;
    } catch {
      return [];
    }
  }

  async submitForm(selector?: string): Promise<boolean> {
    const targetSelector = selector || 'form input[type="submit"], form button[type="submit"]';
    return await this.click(targetSelector);
  }

  async findElements(selector: string): Promise<BrowserElement[]> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserFindElements) {
          return await w.go.main.App.BrowserFindElements(selector);
        }
      } catch {
        // fallback
      }
    }

    return this.simulateFindElements(selector);
  }

  private simulateFindElements(selector: string): BrowserElement[] {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = '<div><a href="https://example.com">Example</a><button>Click me</button><input type="text" placeholder="Search"></div>';
      const elements = tempDiv.querySelectorAll(selector);
      return Array.from(elements).map(el => ({
        selector: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`,
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim() || '',
        visible: true,
        clickable: ['A', 'BUTTON', 'INPUT'].includes(el.tagName),
        editable: ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
      }));
    } catch {
      return [];
    }
  }

  async findElement(selector: string): Promise<BrowserElement | null> {
    const elements = await this.findElements(selector);
    return elements[0] || null;
  }

  async waitForElement(_selector: string, timeout?: number): Promise<BrowserElement | null> {
    const ms = timeout ?? 5000;
    return new Promise(resolve => setTimeout(() => resolve(null), ms));
  }

  async getText(selector: string): Promise<string> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserGetElementText) {
          return await w.go.main.App.BrowserGetElementText(selector);
        }
      } catch {
        // fallback
      }
    }
    return '';
  }

  async getAttribute(_selector: string, _attr: string): Promise<string | null> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserGetAttribute) {
          return await w.go.main.App.BrowserGetAttribute(_selector, _attr);
        }
      } catch {
        // fallback
      }
    }
    return null;
  }

  async evaluate(script: string): Promise<unknown> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserEvaluate) {
          return await w.go.main.App.BrowserEvaluate(script);
        }
      } catch (error: any) {
        throw new Error(`Evaluate failed: ${error.message}`);
      }
    }

    try {
      const func = new Function(`return (${script})`) as () => unknown;
      return func();
    } catch (error: any) {
      throw new Error(`JS evaluation failed: ${error.message}`);
    }
  }

  on(event: BrowserEventType, handler: (event: BrowserEvent) => void): () => void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(handler);
    }
    return () => this.off(event, handler);
  }

  off(event: BrowserEventType, handler: (event: BrowserEvent) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(handler);
    }
  }

  private emit(type: BrowserEventType, data: Omit<BrowserEvent, 'type' | 'timestamp'>): void {
    const event: BrowserEvent = { type, ...data, timestamp: Date.now() };
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(handler => {
        try { handler(event); } catch (e) { console.error('[CastBrowser] Event handler error:', e); }
      });
    }
  }

  async getCookies(): Promise<Array<{ name: string; value: string; domain: string }>> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserGetCookies) {
          return await w.go.main.App.BrowserGetCookies();
        }
      } catch {
        // fallback
      }
    }
    return [];
  }

  async setCookie(name: string, value: string, domain?: string): Promise<void> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserSetCookie) {
          await w.go.main.App.BrowserSetCookie(name, value, domain || '');
          return;
        }
      } catch (error: any) {
        throw new Error(`SetCookie failed: ${error.message}`);
      }
    }
  }

  async clearCookies(): Promise<void> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserClearCookies) {
          await w.go.main.App.BrowserClearCookies();
          return;
        }
      } catch (error: any) {
        throw new Error(`ClearCookies failed: ${error.message}`);
      }
    }
  }

  async localStorageGet(key: string): Promise<string | null> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserLocalStorageGet) {
          return await w.go.main.App.BrowserLocalStorageGet(key);
        }
      } catch {
        // fallback
      }
    }
    return null;
  }

  async localStorageSet(key: string, value: string): Promise<void> {
    if (this.mode === 'cdp') {
      try {
        const w = window as any;
        if (w.go.main.App.BrowserLocalStorageSet) {
          await w.go.main.App.BrowserLocalStorageSet(key, value);
          return;
        }
      } catch (error: any) {
        throw new Error(`LocalStorageSet failed: ${error.message}`);
      }
    }
  }

  getAllowedDomains(): string[] {
    return [...this.allowedDomains];
  }

  setAllowedDomains(domains: string[]): void {
    this.allowedDomains = domains.map(d => d.toLowerCase().replace(/^https?:\/\//, ''));
  }

  isDomainAllowed(url: string): boolean {
    if (this.allowedDomains.length === 0) return true;

    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return this.allowedDomains.some(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
      );
    } catch {
      return false;
    }
  }

  private getCurrentPageInfo(): BrowserPageInfo {
    return {
      url: this.currentPageUrl,
      title: this.currentPageTitle,
      loading: false,
      canGoBack: this.historyIndex > 0,
      canGoForward: this.historyIndex < this.navigationHistory.length - 1
    };
  }
}

export const CastBrowserEngine = new CastBrowserEngineClass();
