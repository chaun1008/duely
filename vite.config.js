import { defineConfig } from "vite";

// 如期而至前端开发服务器配置
// root 指向 src/：项目结构不变（index.html 仍在 src/ 下），发布时 frontendDist 指向 vite build 产物
export default defineConfig({
  root: "src",
  server: {
    // 保持 3000 端口：tauri.conf.json 的 devUrl 已指向 localhost:3000，不改它就不用动 Rust 侧任何配置
    port: 3000,
    // 端口被占用时直接失败而不是静默换端口——否则 webview 会连到错误的服务上，又出现「改了看不到」的假象
    strictPort: true,
  },
  build: {
    // 产物输出到项目根 dist/，由 tauri.conf.json 的 frontendDist("../dist") 打包进二进制
    outDir: "../dist",
    emptyOutDir: true,
  },
});
