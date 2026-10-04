export class WpError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = 'WpError';
    this.status = meta.status;
    this.code = meta.code;
    this.data = meta.data;
    this.method = meta.method;
    this.path = meta.path;
    this.network = meta.network;
  }
}

export function buildConfig(env) {
  const retries = Number(env.WP_RETRIES);
  const retryDelay = Number(env.WP_RETRY_DELAY_MS);
  return {
    url: String(env.WP_URL || '').replace(/\/+$/, ''),
    user: String(env.WP_USER || ''),
    password: String(env.WP_APP_PASSWORD || ''),
    timeoutMs: Number(env.WP_TIMEOUT_MS) > 0 ? Number(env.WP_TIMEOUT_MS) : 30000,
    retries: Number.isInteger(retries) && retries >= 0 ? retries : 2,
    retryDelayMs: retryDelay > 0 ? retryDelay : 500,
  };
}

export function configProblems(cfg) {
  const problems = [];
  if (!cfg.url) problems.push('WP_URL 未设置');
  if (!cfg.user) problems.push('WP_USER 未设置');
  if (!cfg.password) problems.push('WP_APP_PASSWORD 未设置');
  if (cfg.url && !/^https:\/\//i.test(cfg.url)) {
    problems.push('WP_URL 不是 https(应用密码走明文 HTTP 不安全)');
  }
  return problems;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export function createClient(cfg) {
  const token = Buffer.from(`${cfg.user}:${cfg.password}`, 'utf8').toString('base64');
  const baseHeaders = {
    Authorization: `Basic ${token}`,
    'User-Agent': 'wpops/0.2',
  };
  const retries = cfg.retries ?? 2;
  const retryDelayMs = cfg.retryDelayMs ?? 500;

  async function once(method, path, { query, body, form, headers = {} }) {
    const url = new URL(cfg.url + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(key, String(value));
      }
    }

    const init = { method, headers: { ...baseHeaders, ...headers }, redirect: 'follow' };
    if (form) {
      init.body = form;
    } else if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    init.signal = controller.signal;

    let res;
    try {
      res = await fetch(url, init);
    } catch (err) {
      clearTimeout(timer);
      const message =
        err.name === 'AbortError' ? `请求超时(${cfg.timeoutMs}ms)` : `网络错误:${err.message}`;
      throw new WpError(message, { method, path, network: true });
    }
    clearTimeout(timer);

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      const message =
        data && typeof data === 'object' && data.message
          ? data.message
          : typeof data === 'string' && data
            ? data.slice(0, 300)
            : res.statusText;
      throw new WpError(`${res.status} ${message}`, {
        status: res.status,
        code: data && typeof data === 'object' ? data.code : undefined,
        data,
        method,
        path,
      });
    }

    return { status: res.status, data, headers: res.headers };
  }

  const IDEMPOTENT = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

  async function request(method, path, opts = {}) {
    const upper = String(method).toUpperCase();

    if ((opts.body !== undefined || opts.form) && (upper === 'GET' || upper === 'HEAD')) {
      throw new WpError(`${upper} 请求不能带 body(--data 仅用于写操作)`, { method: upper, path });
    }

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await once(upper, path, opts);
      } catch (err) {
        lastError = err;
        // 429 / 5xx 视为可重试(服务端未成功处理);
        // 网络错误只对幂等方法重试,避免 POST 创建重复内容。
        const retryable = err.network
          ? IDEMPOTENT.has(upper)
          : err.status === 429 || (err.status >= 500 && err.status <= 599);
        if (!retryable || attempt === retries) throw err;
        await sleep(retryDelayMs * (attempt + 1));
      }
    }
    throw lastError;
  }

  return { request, root: cfg.url };
}
