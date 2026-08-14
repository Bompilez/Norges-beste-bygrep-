interface SiteAnalytics {
  readonly ready: Promise<unknown>;
  logEvent(eventName: string, eventParams?: Record<string, unknown>): Promise<void>;
}

type MetaPixel = ((...args: unknown[]) => void) & Record<string, any>;

interface Window {
  siteAnalytics?: SiteAnalytics;
  siteComponentsReady?: Promise<unknown>;
  closeCityNav?: (options?: { blurActiveElement?: boolean }) => void;
  fbq?: MetaPixel;
  _fbq?: MetaPixel;
}
