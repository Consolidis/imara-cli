// Fichier long (~500 lignes) pour tester investigate_file
// Simule un service REST complet avec plusieurs classes et fonctions

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
  timestamp: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ApiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private retries: number;
  private interceptors: Array<(req: Request) => Request> = [];

  constructor(baseUrl: string, apiKey: string, options?: { timeout?: number; retries?: number }) {
    if (!baseUrl) throw new Error('baseUrl is required');
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.timeout = options?.timeout ?? 30000;
    this.retries = options?.retries ?? 3;
  }

  addInterceptor(fn: (req: Request) => Request): void {
    this.interceptors.push(fn);
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path, params);
    return this.request<T>('GET', url);
  }

  async post<T>(path: string, body?: any): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path);
    return this.request<T>('POST', url, body);
  }

  async put<T>(path: string, body?: any): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path);
    return this.request<T>('PUT', url, body);
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path);
    return this.request<T>('DELETE', url);
  }

  async paginate<T>(path: string, params: PaginationParams): Promise<PaginatedResult<T>> {
    const queryParams: Record<string, string> = {
      page: String(params.page),
      limit: String(params.limit),
    };
    if (params.sort) queryParams.sort = params.sort;
    if (params.order) queryParams.order = params.order;
    const response = await this.get<PaginatedResult<T>>(path, queryParams);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Pagination failed');
    }
    return response.data;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const fullPath = path.startsWith('/') ? path : '/' + path;
    let url = this.baseUrl + fullPath;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        searchParams.append(key, value);
      }
      url += '?' + searchParams.toString();
    }
    return url;
  }

  private async request<T>(method: string, url: string, body?: any): Promise<ApiResponse<T>> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        const headers: Record<string, string> = {
          'Authorization': 'Bearer ' + this.apiKey,
          'Content-Type': 'application/json',
        };
        const request = new Request(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        const finalRequest = this.interceptors.reduce((req, fn) => fn(req), request);
        const response = await fetch(finalRequest);
        clearTimeout(timeoutId);
        if (!response.ok) {
          const errorText = await response.text();
          return {
            success: false,
            error: `HTTP ${response.status}: ${errorText}`,
            status: response.status,
            timestamp: new Date().toISOString(),
          };
        }
        const data = await response.json();
        return {
          success: true,
          data: data as T,
          status: response.status,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.retries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      status: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

export class UserService {
  private client: ApiClient;
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private cacheTtl = 60000; // 1 minute

  constructor(client: ApiClient) {
    this.client = client;
  }

  async getById(id: string): Promise<ApiResponse<any>> {
    const cacheKey = 'user:' + id;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return { success: true, data: cached.data, status: 200, timestamp: new Date().toISOString() };
    }
    const response = await this.client.get('/users/' + id);
    if (response.success && response.data) {
      this.cache.set(cacheKey, { data: response.data, expiry: Date.now() + this.cacheTtl });
    }
    return response;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<any>> {
    return this.client.paginate('/users', params);
  }

  async create(userData: any): Promise<ApiResponse<any>> {
    return this.client.post('/users', userData);
  }

  async update(id: string, userData: any): Promise<ApiResponse<any>> {
    return this.client.put('/users/' + id, userData);
  }

  async delete(id: string): Promise<ApiResponse<any>> {
    return this.client.delete('/users/' + id);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export class ProductService {
  private client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async getById(id: string): Promise<ApiResponse<any>> {
    return this.client.get('/products/' + id);
  }

  async list(params: PaginationParams & { category?: string }): Promise<PaginatedResult<any>> {
    const queryParams: Record<string, string> = {
      page: String(params.page),
      limit: String(params.limit),
    };
    if (params.category) queryParams.category = params.category;
    return this.client.paginate('/products', params);
  }

  async create(productData: any): Promise<ApiResponse<any>> {
    return this.client.post('/products', productData);
  }

  async update(id: string, productData: any): Promise<ApiResponse<any>> {
    return this.client.put('/products/' + id, productData);
  }

  async delete(id: string): Promise<ApiResponse<any>> {
    return this.client.delete('/products/' + id);
  }
}

export class OrderService {
  private client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async getById(id: string): Promise<ApiResponse<any>> {
    return this.client.get('/orders/' + id);
  }

  async list(params: PaginationParams): Promise<PaginatedResult<any>> {
    return this.client.paginate('/orders', params);
  }

  async create(orderData: any): Promise<ApiResponse<any>> {
    return this.client.post('/orders', orderData);
  }

  async updateStatus(id: string, status: string): Promise<ApiResponse<any>> {
    return this.client.put('/orders/' + id + '/status', { status });
  }

  async cancel(id: string): Promise<ApiResponse<any>> {
    return this.client.post('/orders/' + id + '/cancel');
  }
}

// Fonctions utilitaires
export function createApiClient(baseUrl: string, apiKey: string): ApiClient {
  return new ApiClient(baseUrl, apiKey);
}

export function formatApiResponse<T>(response: ApiResponse<T>): string {
  if (response.success) {
    return JSON.stringify(response.data, null, 2);
  }
  return 'Error: ' + response.error;
}

export function calculatePagination(total: number, page: number, limit: number): PaginatedResult<any> {
  return {
    items: [],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

async function main() {
  const client = createApiClient('https://api.example.com', 'test-key-123');
  const users = new UserService(client);
  const user = await users.getById('123');
  console.log(formatApiResponse(user));
}

if (require.main === module) {
  main().catch(console.error);
}
