# 站点档案(sites)

每个要管理的站点放一个 `<名字>.env`,内容跟根目录的 `.env.example` 一样,
填上该站自己的 `WP_URL` / `WP_USER` / `WP_APP_PASSWORD`。

例如 `sites/blog-a.env`:

```
WP_URL=https://blog-a.example.com
WP_USER=wpops
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

用法:

```powershell
wpops sites                     # 列出所有站点
wpops -s blog-a doctor          # 指定站点
wpops --all posts list          # 对所有站点批量执行
```

这些文件已被 `.gitignore` 忽略(`sites/*.env`),不会被提交。

只有一个站点时,不带 `-s` 的命令会默认用它;有多个时用 `-s <名字>` 或 `--all`。
