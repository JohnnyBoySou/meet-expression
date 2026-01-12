import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["index.ts"],
	format: ["esm", "cjs"], // Gera ESM e CommonJS
	dts: true, // Gera arquivos .d.ts
	splitting: false,
	sourcemap: true,
	clean: true,
	treeshake: true,
	tsconfig: "./tsconfig.json",
	external: [
		"@mediapipe/tasks-vision",
		"react",
		"react-dom",
	],
	esbuildOptions(options) {
		// Resolver path aliases manualmente - apontando para o diretório typescript
		options.alias = {
			"@core": "../typescript/core",
			"@analyzers": "../typescript/analyzers",
			"@config": "../typescript/config",
			"@logic": "../typescript/logic",
			"@modules": "../typescript/modules",
			"@type": "../typescript/types",
			"@json": "../typescript/json",
		};
	},
});
