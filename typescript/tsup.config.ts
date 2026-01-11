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
		"@techstark/opencv-js",
		"react",
		"react-dom",
	],
	esbuildOptions(options) {
		// Resolver path aliases manualmente
		options.alias = {
			"@core": "./core",
			"@analyzers": "./analyzers",
			"@config": "./config",
			"@logic": "./logic",
			"@modules": "./modules",
			"@type": "./types",
			"@json": "./json",
		};
	},
});
