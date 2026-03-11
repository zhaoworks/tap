type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type PassthroughAllow = string | URL;

interface TapOptions {
  baseURL?: string;
  passthrough?: {
    enabled?: boolean;
    fetch?: FetchLike;
    allow?: PassthroughAllow[];
  };
}

interface RouteParams {
  [key: string]: string;
}

interface CompiledRoute {
  match(pathname: string): RouteParams | null;
}

/**
 * Normalized request data passed to a route handler.
 *
 * @property {HttpMethod} method The incoming HTTP method.
 * @property {string} url The full request URL.
 * @property {Headers} headers The incoming request headers.
 * @property {RouteParams} params Route params extracted from `:segments`.
 * @property {URLSearchParams} query The parsed query string.
 * @property {unknown} [body] The parsed request body when one is present.
 *
 * @example
 * ```ts
 * tap.get('/users/:id', (request, reply) => {
 *   return reply.json({
 *     id: request.params.id,
 *     search: request.query.get('search'),
 *   });
 * });
 * ```
 */
export interface TapRequest {
  method: HttpMethod;
  url: string;
  headers: Headers;
  params: RouteParams;
  query: URLSearchParams;
  body?: unknown;
}

/**
 * Helper methods for building a mocked HTTP response.
 *
 * @property {(code: number, body?: unknown) => Response} status Create a response with an explicit status code.
 * @property {(body: unknown) => Response} json Create a JSON response with status `200`.
 * @property {(body: string) => Response} text Create a plain text response with status `200`.
 * @property {(body?: unknown) => Response} send Create an empty, text, or JSON response based on the value.
 * @property {(name: string, value: string) => TapReply} header Set a single response header.
 * @property {(headers: Record<string, string>) => TapReply} headers Set multiple response headers.
 *
 * @example
 * ```ts
 * tap.get('/health', (_request, reply) => {
 *   return reply
 *     .header('x-mock', 'tap')
 *     .json({ ok: true });
 * });
 * ```
 */
export interface TapReply {
  /**
   * Create a response with a custom status code.
   *
   * @param {number} code The HTTP status code to return.
   * @param {unknown} [body] The response body.
   * @returns {Response} A mocked response.
   */
  status(code: number, body?: unknown): Response;

  /**
   * Create a JSON response with status `200`.
   *
   * @param {unknown} body The value to serialize as JSON.
   * @returns {Response} A mocked JSON response.
   */
  json(body: unknown): Response;

  /**
   * Create a plain text response with status `200`.
   *
   * @param {string} body The text body to return.
   * @returns {Response} A mocked text response.
   */
  text(body: string): Response;

  /**
   * Create a response and infer the output type from the body.
   *
   * @param {unknown} [body] The response body.
   * @returns {Response} A mocked response.
   */
  send(body?: unknown): Response;

  /**
   * Set a response header.
   *
   * @param {string} name The header name.
   * @param {string} value The header value.
   * @returns {TapReply} The same reply instance for chaining.
   */
  header(name: string, value: string): TapReply;

  /**
   * Set multiple response headers.
   *
   * @param {Record<string, string>} headers Header values to merge into the response.
   * @returns {TapReply} The same reply instance for chaining.
   */
  headers(headers: Record<string, string>): TapReply;
}

type RouteHandler = (request: TapRequest, reply: TapReply) => Response | Promise<Response>;

interface Route {
  method: HttpMethod;
  matcher: CompiledRoute;
  handler: RouteHandler;
  pathPattern: string;
}

/**
 * Mock `fetch` requests with route handlers that behave like a tiny HTTP server.
 *
 * @example
 * ```ts
 * const tap = new Tap({
 *   baseURL: 'https://api.example.com',
 * });
 *
 * tap.get('/users/:id', (request, reply) => {
 *   return reply.json({ id: request.params.id });
 * });
 *
 * const response = await tap.fetch('https://api.example.com/users/123');
 * ```
 */
export class Tap {
  private routes: Route[] = [];
  private readonly baseURL?: URL;
  private readonly requestBaseURL: URL;
  private readonly passthrough: {
    enabled: boolean;
    fetch: FetchLike;
    allow: string[];
  };

  /**
   * Create a new mock fetch server.
   *
   * @param {TapOptions} [options] Configuration for base URL and passthrough behavior.
   * @param {string} [options.baseURL] Restrict mocked routes to a specific origin.
   * @param {object} [options.passthrough] Configure requests that should use a real fetch implementation.
   * @param {boolean} [options.passthrough.enabled=false] Enable passthrough for requests outside `baseURL`.
   * @param {FetchLike} [options.passthrough.fetch=globalThis.fetch.bind(globalThis)] Fetch implementation used for passthrough requests.
   * @param {Array<string | URL>} [options.passthrough.allow=[]] Allowed passthrough prefixes. Use `['*']` to allow all.
   */
  constructor(options?: TapOptions) {
    this.baseURL = options?.baseURL ? new URL(options.baseURL) : undefined;
    this.requestBaseURL = this.baseURL || new URL('http://localhost');
    this.passthrough = {
      enabled: options?.passthrough?.enabled ?? false,
      fetch: options?.passthrough?.fetch ?? globalThis.fetch.bind(globalThis),
      allow: options?.passthrough?.allow?.map(url => url.toString()) ?? [],
    };
  }

  /**
   * Register a `GET` route.
   *
   * @param {string} path The route pattern to match.
   * @param {RouteHandler} handler The handler that returns a mocked response.
   * @returns {this} The current `Tap` instance for chaining.
   */
  get(path: string, handler: RouteHandler): this {
    return this.addRoute('GET', path, handler);
  }

  /**
   * Register a `POST` route.
   *
   * @param {string} path The route pattern to match.
   * @param {RouteHandler} handler The handler that returns a mocked response.
   * @returns {this} The current `Tap` instance for chaining.
   */
  post(path: string, handler: RouteHandler): this {
    return this.addRoute('POST', path, handler);
  }

  /**
   * Register a `PUT` route.
   *
   * @param {string} path The route pattern to match.
   * @param {RouteHandler} handler The handler that returns a mocked response.
   * @returns {this} The current `Tap` instance for chaining.
   */
  put(path: string, handler: RouteHandler): this {
    return this.addRoute('PUT', path, handler);
  }

  /**
   * Register a `PATCH` route.
   *
   * @param {string} path The route pattern to match.
   * @param {RouteHandler} handler The handler that returns a mocked response.
   * @returns {this} The current `Tap` instance for chaining.
   */
  patch(path: string, handler: RouteHandler): this {
    return this.addRoute('PATCH', path, handler);
  }

  /**
   * Register a `DELETE` route.
   *
   * @param {string} path The route pattern to match.
   * @param {RouteHandler} handler The handler that returns a mocked response.
   * @returns {this} The current `Tap` instance for chaining.
   */
  delete(path: string, handler: RouteHandler): this {
    return this.addRoute('DELETE', path, handler);
  }

  /**
   * Register a `HEAD` route.
   *
   * @param {string} path The route pattern to match.
   * @param {RouteHandler} handler The handler that returns a mocked response.
   * @returns {this} The current `Tap` instance for chaining.
   */
  head(path: string, handler: RouteHandler): this {
    return this.addRoute('HEAD', path, handler);
  }

  /**
   * Register an `OPTIONS` route.
   *
   * @param {string} path The route pattern to match.
   * @param {RouteHandler} handler The handler that returns a mocked response.
   * @returns {this} The current `Tap` instance for chaining.
   */
  options(path: string, handler: RouteHandler): this {
    return this.addRoute('OPTIONS', path, handler);
  }

  /**
   * Register the same handler for every supported HTTP method.
   *
   * @param {string} path The route pattern to match.
   * @param {RouteHandler} handler The handler that returns a mocked response.
   * @returns {this} The current `Tap` instance for chaining.
   */
  all(path: string, handler: RouteHandler): this {
    ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].forEach(method => {
      this.addRoute(method as HttpMethod, path, handler);
    });
    return this;
  }

  /**
   * Add a route to the mock server
   */
  private addRoute(method: HttpMethod, path: string, handler: RouteHandler): this {
    const matcher = this.compileRoute(path);
    this.routes.push({
      method,
      matcher,
      handler,
      pathPattern: path,
    });
    return this;
  }

  private normalizePath(path: string): string {
    if (path === '/') {
      return '/';
    }

    const normalized = path.startsWith('/') ? path : `/${path}`;
    return normalized.replace(/\/+$/, '') || '/';
  }

  private splitPath(path: string): string[] {
    const normalized = this.normalizePath(path);

    if (normalized === '/') {
      return [];
    }

    return normalized.slice(1).split('/');
  }

  private compileRoute(path: string): CompiledRoute {
    const segments = this.splitPath(path);

    return {
      match: (pathname: string): RouteParams | null => {
        const pathnameSegments = this.splitPath(pathname);

        if (segments.length !== pathnameSegments.length) {
          return null;
        }

        const params: RouteParams = {};

        for (let index = 0; index < segments.length; index += 1) {
          const routeSegment = segments[index];
          const pathnameSegment = pathnameSegments[index];

          if (routeSegment.startsWith(':')) {
            params[routeSegment.slice(1)] = decodeURIComponent(pathnameSegment);
            continue;
          }

          if (routeSegment !== pathnameSegment) {
            return null;
          }
        }

        return params;
      },
    };
  }

  private shouldHandleRequest(url: URL): boolean {
    if (!this.baseURL) {
      return true;
    }

    return url.origin === this.baseURL.origin;
  }

  private isPassthroughAllowed(url: URL): boolean {
    if (!this.passthrough.enabled) {
      return false;
    }

    if (this.passthrough.allow.includes('*')) {
      return true;
    }

    if (this.passthrough.allow.length === 0) {
      return true;
    }

    return this.passthrough.allow.some(allowedURL => {
      if (allowedURL.includes('://')) {
        return url.toString().startsWith(allowedURL);
      }

      return url.pathname.startsWith(this.normalizePath(allowedURL));
    });
  }

  /**
   * Find a matching route for the given request
   */
  private findRoute(method: HttpMethod, url: URL): { route: Route; params: RouteParams } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const params = route.matcher.match(url.pathname);
      if (params) {
        return {
          route,
          params,
        };
      }
    }
    return null;
  }

  /**
   * Create a reply helper
   */
  private createReply(): TapReply {
    const responseHeaders = new Headers();

    const reply: TapReply = {
      status(code: number, body?: unknown): Response {
        if (body === undefined) {
          return new Response(null, { status: code, headers: responseHeaders });
        }
        
        if (typeof body === 'string') {
          return new Response(body, { status: code, headers: responseHeaders });
        }
        
        responseHeaders.set('content-type', 'application/json');
        return new Response(JSON.stringify(body), { status: code, headers: responseHeaders });
      },

      json(body: unknown): Response {
        responseHeaders.set('content-type', 'application/json');
        return new Response(JSON.stringify(body), { status: 200, headers: responseHeaders });
      },

      text(body: string): Response {
        responseHeaders.set('content-type', 'text/plain');
        return new Response(body, { status: 200, headers: responseHeaders });
      },

      send(body?: unknown): Response {
        if (body === undefined) {
          return new Response(null, { status: 204, headers: responseHeaders });
        }
        
        if (typeof body === 'string') {
          return new Response(body, { status: 200, headers: responseHeaders });
        }
        
        return reply.json(body);
      },

      header(name: string, value: string): TapReply {
        responseHeaders.set(name, value);
        return reply;
      },

      headers(headers: Record<string, string>): TapReply {
        Object.entries(headers).forEach(([name, value]) => {
          responseHeaders.set(name, value);
        });
        return reply;
      },
    };

    return reply;
  }

  /**
   * Parse request body based on content-type
   */
  private async parseBody(request: Request): Promise<unknown> {
    const contentType = request.headers.get('content-type');
    
    if (!contentType || request.method === 'GET' || request.method === 'HEAD') {
      return undefined;
    }

    try {
      if (contentType.includes('application/json')) {
        return await request.json();
      } else if (contentType.includes('text/')) {
        return await request.text();
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await request.text();
        return new URLSearchParams(text);
      }
      
      // Default: return as text
      return await request.text();
    } catch {
      return undefined;
    }
  }

  /**
   * Handle a request with registered mock routes or passthrough behavior.
   *
   * @param {RequestInfo | URL} input The request URL or request object.
   * @param {RequestInit} [init] Request options used to construct the request.
   * @returns {Promise<Response>} The mocked or passthrough response.
   */
  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestInput =
      typeof input === 'string' || input instanceof URL
        ? new URL(input.toString(), this.requestBaseURL)
        : input;
    const request = new Request(requestInput, init);
    const url = new URL(request.url);
    const method = request.method.toUpperCase() as HttpMethod;

    if (!this.shouldHandleRequest(url)) {
      if (!this.isPassthroughAllowed(url)) {
        throw new Error(
          `No passthrough configured for ${method} ${url.toString()}; baseURL is ${this.baseURL?.origin || 'not configured'}`
        );
      }

      return this.passthrough.fetch(input, init);
    }

    // Find matching route
    const match = this.findRoute(method, url);

    if (!match) {
      return new Response(
        JSON.stringify({ error: 'Not Found', message: `No route registered for ${method} ${url.pathname}` }),
        { 
          status: 404, 
          headers: { 'content-type': 'application/json' } 
        }
      );
    }

    // Parse body
    const body = await this.parseBody(request);

    // Create mock request object
    const mockRequest: TapRequest = {
      method,
      url: request.url,
      headers: request.headers,
      params: match.params,
      query: url.searchParams,
      body,
    };

    // Create reply helper
    const reply = this.createReply();

    // Execute handler
    try {
      const response = await match.route.handler(mockRequest, reply);
      return response;
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: 'Internal Server Error', 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { 
          status: 500, 
          headers: { 'content-type': 'application/json' } 
        }
      );
    }
  };

  /**
   * Remove every registered route.
   *
   * @returns {this} The current `Tap` instance for chaining.
   */
  clear(): this {
    this.routes = [];
    return this;
  }

  /**
   * List the currently registered routes.
   *
   * @returns {Array<{ method: HttpMethod; path: string }>} Route definitions in registration order.
   */
  getRoutes(): Array<{ method: HttpMethod; path: string }> {
    return this.routes.map(route => ({
      method: route.method,
      path: route.pathPattern,
    }));
  }
}
