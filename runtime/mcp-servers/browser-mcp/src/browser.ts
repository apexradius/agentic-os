import { type Browser, type BrowserContext, firefox } from "playwright";
import { Camoufox } from "camoufox-js";
import {
  type CliOptions,
  type StealthProfile,
  normalizeAttachEndpoint
} from "./utils.js";

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private launchPromise: Promise<BrowserContext> | null = null;
  private attachedEndpoint: string | null = null;
  private stealthProfile: StealthProfile = "camoufox";

  constructor(private readonly options: CliOptions) {
    if (options.attach) {
      this.attachedEndpoint = normalizeAttachEndpoint(options.attach);
    }
  }

  getConfig(): CliOptions {
    return this.options;
  }

  getStealthProfile(): StealthProfile {
    return this.stealthProfile;
  }

  async getContext(): Promise<BrowserContext> {
    if (this.context) {
      return this.context;
    }

    if (!this.launchPromise) {
      this.launchPromise = this.initialize();
    }

    try {
      this.context = await this.launchPromise;
      return this.context;
    } finally {
      this.launchPromise = null;
    }
  }

  async attach(endpoint: string): Promise<BrowserContext> {
    this.attachedEndpoint = normalizeAttachEndpoint(endpoint);
    await this.reset();
    return this.getContext();
  }

  async setStealthProfile(profile: StealthProfile): Promise<void> {
    this.stealthProfile = profile;
    if (!this.attachedEndpoint) {
      await this.reset();
    }
  }

  async reset(): Promise<void> {
    this.context = null;
    this.launchPromise = null;

    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
  }

  private async initialize(): Promise<BrowserContext> {
    if (this.attachedEndpoint) {
      return this.attachToRunningBrowser(this.attachedEndpoint);
    }
    return this.launchPersistentContext();
  }

  private async launchPersistentContext(): Promise<BrowserContext> {
    const context = await Camoufox({
      headless: this.options.headless ? true : false,
      user_data_dir: this.options.userDataDir,
      proxy: this.options.proxyUrl ? { server: this.options.proxyUrl } : undefined,
      geoip: true,
      humanize: true,
      os: ["windows", "macos"]
    }) as unknown as BrowserContext;

    await context.grantPermissions(["notifications"]).catch(() => {});
    await context.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Upgrade-Insecure-Requests": "1"
    }).catch(() => {});

    context.setDefaultTimeout(this.options.timeout);
    context.setDefaultNavigationTimeout(this.options.navTimeout);

    this.browser = context.browser();
    this.context = context;

    return context;
  }

  private async attachToRunningBrowser(endpoint: string): Promise<BrowserContext> {
    const browser = await firefox.connectOverCDP(endpoint);
    const existingContext = browser.contexts()[0];
    const context = existingContext ?? await browser.newContext({ viewport: this.options.viewport });

    context.setDefaultTimeout(this.options.timeout);
    context.setDefaultNavigationTimeout(this.options.navTimeout);

    this.browser = browser;
    this.context = context;

    return context;
  }
}
