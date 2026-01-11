/**
 * Sales Scoring Engine
 * Processa regras do JSON de configuração e calcula pontuações para dimensões
 */

import type { ExpressionResult, FACSConfig, WindowPayload } from "@type/index";

export interface SalesScoringEngine {
	process(inputPayload: WindowPayload): ExpressionResult;
}

function getIntensityMultiplier(value: number, isAu: boolean = true): number {
	if (!isAu) {
		return 1.0;
	}

	if (value >= 0.8) return 1.0; // E
	if (value >= 0.6) return 0.8; // D
	if (value >= 0.4) return 0.6; // C
	if (value >= 0.2) return 0.4; // B
	if (value >= 0.1) return 0.2; // A
	return 0.0;
}

export function createSalesScoringEngine(
	rules: FACSConfig,
): SalesScoringEngine {
	const weights = rules.weights_by_code || {};
	const combos = rules.combo_rules || [];
	const dimensionsList = Object.keys(rules.dimensions || {});
	const actionsMap = rules.default_actions_questions || {};

	function process(inputPayload: WindowPayload): ExpressionResult {
		const aus = inputPayload.aus || {};
		const meta = inputPayload.meta || {};

		const scores: Record<string, number> = {};
		for (const dim of dimensionsList) {
			scores[dim] = 0.0;
		}

		const activeCodes: string[] = [];

		for (const [code, rawVal] of Object.entries(aus)) {
			const sI = getIntensityMultiplier(rawVal, true);
			if (sI > 0 && code in weights) {
				activeCodes.push(code);
				const weightMap = weights[code] || {};
				for (const [dim, weight] of Object.entries(weightMap)) {
					scores[dim] = (scores[dim] || 0) + sI * weight;
				}
			}
		}

		const metaSignals: string[] = [];
		const gaze = meta.gaze || "CENTER";
		if (gaze === "LOOKING_DOWN") metaSignals.push("GAZE64");

		const pitch = meta.head_pitch || 0;
		if (pitch > 15) metaSignals.push("HEAD54");
		else if (pitch < -15) metaSignals.push("HEAD53");

		for (const mCode of metaSignals) {
			if (mCode in weights) {
				activeCodes.push(mCode);
				const weightMap = weights[mCode] || {};
				for (const [dim, weight] of Object.entries(weightMap)) {
					scores[dim] = (scores[dim] || 0) + 1.0 * weight; // s(empty) = 1.0
				}
			}
		}

		const triggeredCombos: string[] = [];
		for (const combo of combos) {
			const requiresMet = combo.requires.every((req) =>
				activeCodes.includes(req),
			);
			const forbidsMet =
				combo.forbids && combo.forbids.length > 0
					? combo.forbids.some((forbid) => activeCodes.includes(forbid))
					: false;

			if (requiresMet && !forbidsMet) {
				triggeredCombos.push(combo.tag?.[0] || combo.id || "");
				for (const [dim, adj] of Object.entries(combo.adjustments || {})) {
					scores[dim] = (scores[dim] || 0) + adj;
				}
			}
		}

		const finalScores: Record<string, number> = {};
		for (const [k, v] of Object.entries(scores)) {
			finalScores[k] = Math.max(-100, Math.min(100, v));
		}

		let domDim = dimensionsList[0] || "engagement";
		let maxAbs = Math.abs(finalScores[domDim] || 0);
		for (const [k, v] of Object.entries(finalScores)) {
			const abs = Math.abs(v);
			if (abs > maxAbs) {
				maxAbs = abs;
				domDim = k;
			}
		}

		const actionData = actionsMap[domDim] || {
			action: "Analise",
			questions: [],
		};

		return {
			dominant_dimension: domDim,
			dominant_value: Math.round(finalScores[domDim] || 0),
			active_combos: triggeredCombos,
			scores: finalScores,
			recommended_actions: [actionData.action],
			questions: actionData.questions,
		};
	}

	return {
		process,
	};
}
