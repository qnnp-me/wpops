// 用法/参数错误:表示“命令调用方式不对”(缺参数、未知动作、缺少必填开关等),
// 与运行期错误(HTTP/网络/配置)区分开,由 CLI 以退出码 2 处理并附带用法提示。
export class UsageError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = 'UsageError';
    this.group = meta.group;
    this.action = meta.action;
  }
}
