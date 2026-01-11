/**
 * Baseline Manager: Orquestra Baselines
 * Mantém um 'RollingBaseline' para cada sinal monitorado (AU4, AU6, AU12, etc).
 */

import {
	createRollingBaseline,
	type RollingBaseline,
} from "@core/signal_processing";
import type { RawSignals, ThresholdsConfig } from "@type/index";

export interface BaselineProcessResult {
	deviations: RawSignals;
	isStable: boolean;
}

export interface BaselineManager {
	process(rawSignals: RawSignals): BaselineProcessResult;
	getStability(): boolean;
	getFrameCount(): number;
	reset(): void;
}

export function createBaselineManager(
	config: ThresholdsConfig,
): BaselineManager {
	const windowSize = config.baseline?.window_size ?? 150;
	const warmupFrames = config.baseline?.warmup_frames ?? 45;
	let frameCount = 0;
	let isStable = false;

	const baselines = new Map<string, RollingBaseline>();

	function process(rawSignals: RawSignals): BaselineProcessResult {
		frameCount += 1;
		const deviations: RawSignals = {};

		for (const [key, value] of Object.entries(rawSignals)) {
			let baseline = baselines.get(key);
			if (!baseline) {
				baseline = createRollingBaseline(windowSize);
				baselines.set(key, baseline);
			}

			baseline.update(value);

			deviations[key] = baseline.getDeviation(value);
		}

		isStable = frameCount > warmupFrames;

		return {
			deviations,
			isStable,
		};
	}

	function getStability(): boolean {
		return isStable;
	}

	function getFrameCount(): number {
		return frameCount;
	}

	function reset(): void {
		baselines.clear();
		frameCount = 0;
		isStable = false;
	}

	return {
		process,
		getStability,
		getFrameCount,
		reset,
	};
}
