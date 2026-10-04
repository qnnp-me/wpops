// 批量请求命令(/wp-json/batch/v1)。
// 一次提交多条子请求,减少往返。
import { printJson, dry, parseJson, readJsonFile } from './util.js';

const BATCH = '/wp-json/batch/v1';

const NEED =
  'batch 需要 --requests JSON 数组 或 --requests-file 文件';

function readRequests(flags) {
  if (flags.requests === undefined && flags['requests-file'] === undefined) return undefined;
  try {
    const parsed = flags.requests !== undefined
      ? parseJson(flags.requests)
      : readJsonFile(flags['requests-file']);
    // 同时接受裸数组和 {"requests": [...]} 两种写法。
    return Array.isArray(parsed?.requests) ? parsed.requests : parsed;
  } catch (err) {
    throw new Error(`${NEED}(${err.message})`);
  }
}

/** POST /batch/v1,body 为 { requests }。 */
export async function batch(client, flags) {
  const requests = readRequests(flags);
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new Error(NEED);
  }
  const BATCH_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
  const bad = requests.find(
    (r) => r && r.method && !BATCH_METHODS.includes(String(r.method).toUpperCase()),
  );
  if (bad) {
    throw new Error(`batch 不支持 ${bad.method}:WordPress 批量端点只接受 ${BATCH_METHODS.join('/')}`);
  }
  if (flags['dry-run']) return dry(`批量请求 ${requests.length} 条`);
  const { data } = await client.request('POST', BATCH, { body: { requests } });
  if (flags.json) return printJson(data);

  const responses = Array.isArray(data?.responses)
    ? data.responses
    : Array.isArray(data)
      ? data
      : [];
  console.log(`批量返回 ${responses.length} 条:`);
  responses.forEach((response, index) => {
    const request = requests[index] || {};
    const status = response?.status ?? request.status ?? '?';
    const method = response?.method ?? request.method ?? '?';
    const path = response?.path ?? request.path ?? '?';
    console.log(`  [${status}] ${method} ${path}`);
  });
}
