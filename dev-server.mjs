// 开发用静态服务器：等价于 `python3 -m http.server 3000 --directory src`，
// 但所有响应强制 Cache-Control: no-store。
// 为什么不用 python 版：python http.server 不发缓存头，WKWebView 会按 RFC 7234
// 启发式规则把页面缓存在磁盘上，改完前端文件后应用窗口仍显示旧页面（本项目实际踩坑）。
import http from "node:http";
import { readFile } from "node:fs/promises";
import { watch } from "node:fs";
import { extname, join, normalize } from "node:path";

const ROOT = normalize(new URL("./src", import.meta.url).pathname);
const PORT = 3000;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

http
  .createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      // livereload 版本端点：前端 dev 模式轮询它，版本变化即刷新页面
      if (p === "/__livereload") {
        res.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
        return res.end(String(version));
      }
      if (p === "/") p = "/index.html";
      const file = normalize(join(ROOT, p));
      // 防目录穿越：解析后的路径必须仍落在 src 目录内
      if (!file.startsWith(ROOT)) {
        res.writeHead(403);
        return res.end("forbidden");
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": MIME[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  })
  .listen(PORT, () => console.log(`dev server (no-store): http://localhost:${PORT}`));

// ---------- livereload ----------
// 监视 src/ 目录（文件内容变更/替换都会触发，含编辑器换 inode 的重写），
// 每次变更递增版本号；前端在 dev 模式下轮询 /__livereload，发现变化自动 reload。
let version = 0;
watch(ROOT, () => {
  version++;
});
