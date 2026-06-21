import { Mutex } from "async-mutex";
import type {
  BrowserContext,
  CDPSession,
  ConsoleMessage,
  Dialog,
  Page,
  Request,
  Response
} from "playwright";
import { BrowserManager } from "./browser.js";
import { DEFAULT_TAB_ID, compilePatterns, formatUrl, requireValue, type StealthProfile } from "./utils.js";

export interface ConsoleMessageRecord {
  type: string;
  text: string;
  location?: string;
}

export interface NetworkRequestRecord {
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  failureText?: string;
  intercepted?: boolean;
}

export interface TabEntry {
  page: Page;
  mutex: Mutex;
  cdp: CDPSession;
  consoleMessages: ConsoleMessageRecord[];
  networkRequests: NetworkRequestRecord[];
  pendingDialog: Dialog | null;
  traceOutputPath?: string;
  interceptPatterns: string[];
  interceptionInstalled: boolean;
}

export class TabRegistry {
  private readonly tabs = new Map<string, TabEntry>();
  private context: BrowserContext | null = null;

  constructor(private readonly browserManager: BrowserManager) {}

  async get(tabId: string): Promise<TabEntry | null> {
    await this.syncContext();
    return this.tabs.get(tabId) ?? null;
  }

  async getOrCreate(tabId: string): Promise<TabEntry> {
    const context = await this.syncContext();
    const existing = this.tabs.get(tabId);
    if (existing && !existing.page.isClosed()) {
      return existing;
    }

    const page = this.resolveInitialPage(context, tabId) ?? await context.newPage();
    const entry = await this.createEntry(page);
    this.tabs.set(tabId, entry);
    return entry;
  }

  async close(tabId: string): Promise<void> {
    const entry = await this.get(tabId);
    if (!entry) {
      return;
    }

    await entry.page.close().catch(() => undefined);
    this.tabs.delete(tabId);
  }

  async list(): Promise<Array<{ tabId: string; url: string }>> {
    await this.syncContext();
    return Array.from(this.tabs.entries()).map(([tabId, entry]) => ({
      tabId,
      url: formatUrl(entry.page.url())
    }));
  }

  async withTab<T>(tabId: string, fn: (entry: TabEntry) => Promise<T>): Promise<T> {
    const entry = await this.getOrCreate(tabId);
    return entry.mutex.runExclusive(async () => {
      if (entry.page.isClosed()) {
        this.tabs.delete(tabId);
        throw new Error(`Tab "${tabId}" is closed`);
      }

      return fn(entry);
    });
  }

  async reset(): Promise<void> {
    const entries = Array.from(this.tabs.values());
    this.tabs.clear();
    this.context = null;

    await Promise.all(
      entries.map(async entry => {
        if (!entry.page.isClosed()) {
          await entry.page.close().catch(() => undefined);
        }
      })
    );
  }

  async currentStealthProfile(): Promise<StealthProfile> {
    return this.browserManager.getStealthProfile();
  }

  private async syncContext(): Promise<BrowserContext> {
    const nextContext = await this.browserManager.getContext();
    if (this.context && this.context !== nextContext) {
      await this.reset();
    }

    this.context = nextContext;
    return nextContext;
  }

  private resolveInitialPage(context: BrowserContext, tabId: string): Page | null {
    if (this.tabs.size > 0) {
      return null;
    }

    if (tabId !== DEFAULT_TAB_ID) {
      return null;
    }

    return context.pages()[0] ?? null;
  }

  private async createEntry(page: Page): Promise<TabEntry> {
    const cdp = await page.context().newCDPSession(page);
    const entry: TabEntry = {
      page,
      mutex: new Mutex(),
      cdp,
      consoleMessages: [],
      networkRequests: [],
      pendingDialog: null,
      interceptPatterns: [],
      interceptionInstalled: false
    };

    page.on("console", message => {
      entry.consoleMessages.push(this.toConsoleMessageRecord(message));
      if (entry.consoleMessages.length > 200) {
        entry.consoleMessages.shift();
      }
    });

    page.on("dialog", dialog => {
      entry.pendingDialog = dialog;
    });

    page.on("request", request => {
      entry.networkRequests.push(this.toNetworkRequestRecord(request));
      if (entry.networkRequests.length > 500) {
        entry.networkRequests.shift();
      }
    });

    page.on("response", response => {
      this.mergeResponse(entry.networkRequests, response);
    });

    page.on("requestfailed", request => {
      this.mergeFailure(entry.networkRequests, request);
    });

    return entry;
  }

  private toConsoleMessageRecord(message: ConsoleMessage): ConsoleMessageRecord {
    const location = message.location();
    const locationText = location.url ? `${location.url}:${location.lineNumber}:${location.columnNumber}` : undefined;

    return {
      type: message.type(),
      text: message.text(),
      location: locationText
    };
  }

  private toNetworkRequestRecord(request: Request): NetworkRequestRecord {
    return {
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType()
    };
  }

  private mergeResponse(records: NetworkRequestRecord[], response: Response): void {
    const record = this.findLatestRecord(records, response.url());
    if (record) {
      record.status = response.status();
    }
  }

  private mergeFailure(records: NetworkRequestRecord[], request: Request): void {
    const record = this.findLatestRecord(records, request.url());
    if (record) {
      record.failureText = request.failure()?.errorText;
    }
  }

  private findLatestRecord(records: NetworkRequestRecord[], url: string): NetworkRequestRecord | undefined {
    for (let index = records.length - 1; index >= 0; index -= 1) {
      if (records[index]?.url === url) {
        return records[index];
      }
    }

    return undefined;
  }
}

export async function installNetworkInterception(entry: TabEntry): Promise<void> {
  if (entry.interceptionInstalled) {
    return;
  }

  entry.interceptionInstalled = true;

  await entry.page.route("**/*", async route => {
    const request = route.request();
    const url = request.url();
    const interceptors = compilePatterns(entry.interceptPatterns);
    const matched = interceptors.some(pattern => pattern.test(url));

    if (matched) {
      entry.networkRequests.push({
        url,
        method: request.method(),
        resourceType: request.resourceType(),
        intercepted: true
      });
    }

    await route.continue();
  });
}

export function requireDialog(entry: TabEntry): Dialog {
  return requireValue(entry.pendingDialog, "No pending dialog available for this tab");
}
