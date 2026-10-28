import vibelang from "vibelang-vite"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [vibelang()],
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    // Foldkit ships ESM that Vitest must transform with the app.
    server: { deps: { inline: ["foldkit"] } }
  }
})
