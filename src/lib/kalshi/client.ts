import crypto from "crypto";

// ---------------------------------------------------------------------------
// Base URLs
// ---------------------------------------------------------------------------

const DEMO_BASE_URL = "https://demo-api.kalshi.co/trade-api/v2";
const PROD_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";

/** Production URL for reading real market data. */
function getReadBaseUrl(): string {
  return PROD_BASE_URL;
}

/** Trading URL — respects KALSHI_ENV so trades stay on demo unless explicitly switched. */
function getTradeBaseUrl(): string {
  return process.env.KALSHI_ENV === "production"
    ? PROD_BASE_URL
    : DEMO_BASE_URL;
}

// ---------------------------------------------------------------------------
// Request signing (RSA-PSS / SHA-256)
// ---------------------------------------------------------------------------

function signRequest(
  privateKeyPem: string,
  timestamp: string,
  method: string,
  path: string,
): string {
  const message = timestamp + method + path;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(message);
  return sign.sign(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    },
    "base64",
  );
}

// ---------------------------------------------------------------------------
// Response / request parameter types
// ---------------------------------------------------------------------------

export interface GetMarketsParams {
  status?: string;
  cursor?: string;
  limit?: number;
  series_ticker?: string;
  event_ticker?: string;
}

export interface GetEventsParams {
  cursor?: string;
  limit?: number;
  status?: string;
  series_ticker?: string;
  with_nested_markets?: boolean;
  category?: string;
}

export interface GetCandlesticksParams {
  start_ts?: number;
  end_ts?: number;
  period_interval?: number;
}

export interface GetOrdersParams {
  ticker?: string;
  event_ticker?: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

export interface GetFillsParams {
  ticker?: string;
  order_id?: string;
  cursor?: string;
  limit?: number;
  min_ts?: number;
  max_ts?: number;
}

export interface PlaceOrderBody {
  ticker: string;
  action: "buy" | "sell";
  side: "yes" | "no";
  type: "market" | "limit";
  count: number;
  yes_price?: number;
  client_order_id?: string;
}

// Generic wrapper so callers can type narrow if needed, but we intentionally
// keep response shapes loose -- the Kalshi API surface changes regularly and
// pinning every field creates unnecessary maintenance burden.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type KalshiResponse = Record<string, any>;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class KalshiClient {
  private apiKey: string | undefined;
  private privateKey: string | undefined;

  constructor() {
    this.apiKey = process.env.KALSHI_API_KEY;
    this.privateKey = process.env.KALSHI_PRIVATE_KEY;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private hasCredentials(): boolean {
    return Boolean(this.apiKey && this.privateKey);
  }

  private requireCredentials(): void {
    if (!this.apiKey) {
      throw new Error(
        "KALSHI_API_KEY is not set. Add it to your environment variables.",
      );
    }
    if (!this.privateKey) {
      throw new Error(
        "KALSHI_PRIVATE_KEY is not set. Add it to your environment variables. " +
          "The value should be the full PEM-encoded RSA private key.",
      );
    }
  }

  /**
   * Core request method. Handles auth header generation, signing, query
   * parameter serialisation, and JSON response parsing.
   */
  private async request<T = KalshiResponse>(
    method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH",
    path: string,
    body?: Record<string, unknown>,
    options?: { trade?: boolean },
  ): Promise<T> {
    const baseUrl = options?.trade ? getTradeBaseUrl() : getReadBaseUrl();
    const url = `${baseUrl}${path}`;

    // The signature must be computed over the path *without* query parameters.
    const pathWithoutQuery = path.split("?")[0];

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // Attach auth headers when credentials are available.
    if (this.hasCredentials()) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = signRequest(
        this.privateKey!,
        timestamp,
        method,
        pathWithoutQuery,
      );

      headers["KALSHI-ACCESS-KEY"] = this.apiKey!;
      headers["KALSHI-ACCESS-TIMESTAMP"] = timestamp;
      headers["KALSHI-ACCESS-SIGNATURE"] = signature;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && method !== "GET" && method !== "DELETE") {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      let errorBody: string;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = "Unable to read error response body";
      }

      throw new Error(
        `Kalshi API error ${response.status} ${response.statusText} ` +
          `[${method} ${path}]: ${errorBody}`,
      );
    }

    // Some endpoints (e.g. DELETE) may return 204 with no body.
    if (
      response.status === 204 ||
      response.headers.get("content-length") === "0"
    ) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  /**
   * Build a query string from an object, omitting undefined / null values.
   */
  private toQueryString(
    params?: Record<string, string | number | boolean | undefined | null>,
  ): string {
    if (!params) return "";

    const entries = Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null,
    );

    if (entries.length === 0) return "";

    const qs = entries
      .map(
        ([k, v]) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
      )
      .join("&");

    return `?${qs}`;
  }

  // -----------------------------------------------------------------------
  // Public endpoints (auth optional)
  // -----------------------------------------------------------------------

  /** List markets with optional filters and pagination. */
  async getMarkets(params?: GetMarketsParams): Promise<KalshiResponse> {
    const qs = this.toQueryString(
      params as Record<string, string | number | undefined>,
    );
    return this.request("GET", `/markets${qs}`);
  }

  /** Get a single market by its ticker. */
  async getMarket(ticker: string): Promise<KalshiResponse> {
    return this.request("GET", `/markets/${encodeURIComponent(ticker)}`);
  }

  /** Get the current orderbook for a market. */
  async getOrderbook(ticker: string): Promise<KalshiResponse> {
    return this.request(
      "GET",
      `/markets/${encodeURIComponent(ticker)}/orderbook`,
    );
  }

  /** Get a series by its ticker. */
  async getSeries(ticker: string): Promise<KalshiResponse> {
    return this.request("GET", `/series/${encodeURIComponent(ticker)}`);
  }

  /** List events with optional filters and pagination. */
  async getEvents(params?: GetEventsParams): Promise<KalshiResponse> {
    const qs = this.toQueryString(
      params as Record<string, string | number | boolean | undefined>,
    );
    return this.request("GET", `/events${qs}`);
  }

  /** Get candlestick (OHLC) data for a market. */
  async getCandlesticks(
    ticker: string,
    params?: GetCandlesticksParams,
  ): Promise<KalshiResponse> {
    const qs = this.toQueryString(
      params as Record<string, string | number | undefined>,
    );
    return this.request(
      "GET",
      `/markets/${encodeURIComponent(ticker)}/candlesticks${qs}`,
    );
  }

  // -----------------------------------------------------------------------
  // Portfolio endpoints (auth required)
  // -----------------------------------------------------------------------

  /** Place a new order. Uses trade URL (demo unless KALSHI_ENV=production). */
  async placeOrder(order: PlaceOrderBody): Promise<KalshiResponse> {
    this.requireCredentials();
    return this.request("POST", "/portfolio/orders", order as unknown as Record<string, unknown>, { trade: true });
  }

  /** Cancel an existing order by its ID. */
  async cancelOrder(orderId: string): Promise<KalshiResponse> {
    this.requireCredentials();
    return this.request(
      "DELETE",
      `/portfolio/orders/${encodeURIComponent(orderId)}`,
      undefined,
      { trade: true },
    );
  }

  /** List orders with optional filters and pagination. */
  async getOrders(params?: GetOrdersParams): Promise<KalshiResponse> {
    this.requireCredentials();
    const qs = this.toQueryString(
      params as Record<string, string | number | undefined>,
    );
    return this.request("GET", `/portfolio/orders${qs}`, undefined, { trade: true });
  }

  /** Get all current positions. */
  async getPositions(): Promise<KalshiResponse> {
    this.requireCredentials();
    return this.request("GET", "/portfolio/positions", undefined, { trade: true });
  }

  /** List fills (executed trades) with optional filters. */
  async getFills(params?: GetFillsParams): Promise<KalshiResponse> {
    this.requireCredentials();
    const qs = this.toQueryString(
      params as Record<string, string | number | undefined>,
    );
    return this.request("GET", `/portfolio/fills${qs}`, undefined, { trade: true });
  }

  /** Get the current account balance. */
  async getBalance(): Promise<KalshiResponse> {
    this.requireCredentials();
    return this.request("GET", "/portfolio/balance", undefined, { trade: true });
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

export const kalshi = new KalshiClient();
