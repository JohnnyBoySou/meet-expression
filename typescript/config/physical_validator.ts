/**
 * Physical Validator: Aplica validações físicas usando landmarks para validar cálculos de AUs
 */

import { calculateDivergence } from "@core/geometry_utils";
import physicalValidationsConfig from "@json/physical_validations.json";
import type { ActionUnits, LandmarkPoint } from "@type/index";

interface DivergenceValidation {
	type: "divergence";
	description?: string;
	landmarkIndices: number[];
	conditions: {
		auThreshold: number;
		divergenceDeltaThreshold: number;
	};
	action: {
		type: "penalize";
		multiplier: number;
	};
}

type PhysicalValidation = DivergenceValidation;

interface PhysicalValidationsConfig {
	validations: Record<string, PhysicalValidation>;
}

interface ValidationState {
	baselineDiv: number | null;
	calibrated: boolean;
}

export function createPhysicalValidator() {
	const config = physicalValidationsConfig as PhysicalValidationsConfig;
	const states = new Map<string, ValidationState>();

	function applyValidations(
		aus: ActionUnits,
		landmarks: LandmarkPoint[],
		w: number,
		h: number,
	): ActionUnits {
		const result = { ...aus };

		for (const [auName, validation] of Object.entries(config.validations)) {
			if (validation.type === "divergence") {
				const state = states.get(auName) || {
					baselineDiv: null,
					calibrated: false,
				};

				const currDiv = calculateDivergence(
					landmarks,
					validation.landmarkIndices,
					w,
					h,
				);

				if (!state.calibrated) {
					state.baselineDiv = currDiv;
					state.calibrated = true;
					states.set(auName, state);
					continue;
				}

				const divDelta = currDiv - (state.baselineDiv || 0);
				const auValue = result[auName] || 0;

				if (
					auValue > validation.conditions.auThreshold &&
					divDelta > validation.conditions.divergenceDeltaThreshold
				) {
					if (validation.action.type === "penalize") {
						result[auName] = auValue * validation.action.multiplier;
					}
				}

				states.set(auName, state);
			}
		}

		return result;
	}

	function resetCalibration(): void {
		states.clear();
	}

	return {
		applyValidations,
		resetCalibration,
	};
}
