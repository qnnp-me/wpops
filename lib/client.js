export class WpError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = 'WpError';
    this.status = meta.status;
    this.code = meta.code;
    this.data = meta.data;
    this.method = meta.method;
    this.path = meta.path;
  }
}

export function buildConfig(env) {
  return {
    url: String(env.WP_URL || '').replace(/\/+$/, ''),
    user: String(env.WP_USER || ''),
    password: String(env.WP_APP_PASSWORD || ''),
    timeoutMs: Number(env.WP_TIMEOUT_MS) > 0 ? Number(env.WP_TIMEOUT_MS) : 30000,
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

export function createClient(cfg) {
  const token = Buffer.from(`${cfg.user}:${cfg.password}`, 'utf8').toString('base64');
  const baseHeaders = {
    Authorization: `Basic ${token}`,
    'User-Agent': 'wpops/0.1',
  };

  async function request(method, path, { query, body, form, headers = {} } = {}) {
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
      if (err.name === 'AbortError') {
        throw new WpError(`请求超时(${cfg.timeoutMs}ms)`, { method, path });
      }
      throw new WpError(`网络错误:${err.message}`, { method, path });
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

  return { request, root: cfg.url };
}
