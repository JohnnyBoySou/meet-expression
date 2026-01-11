/**
 * Hybrid Engine: SMOOTH & CLEAN
 * Adiciona Filtro Temporal (EMA) para eliminar 'flicker' e lixo de leitura.
 */

import { calculateAUsFromMappings } from "@config/au_mapper";
import { createPhysicalValidator } from "@config/physical_validator";
import type { ActionUnits, Blendshape, LandmarkPoint } from "@type/index";

export interface HybridEngineResult {
	aus: ActionUnits;
	rotPenalty: number;
}

export interface HybridEngine {
	process(
		blendshapes: Blendshape[],
		landmarks: LandmarkPoint[],
		w: number,
		h: number,
	): HybridEngineResult;
	calibrate(currentAus: ActionUnits): void;
	resetCalibration(): void;
}

function calculateRotationPenalty(landmarks: LandmarkPoint[]): number {
	if (landmarks.length < 455) return 1.0;

	const nose = landmarks[1];
	const earL = landmarks[234];
	const earR = landmarks[454];

	if (!nose || !earL || !earR) return 1.0;

	const faceWidth = Math.abs(earR.x - earL.x);
	if (faceWidth === 0) return 1.0;

	const ratio = Math.abs(nose.x - earL.x) / faceWidth;
	const deviation = Math.abs(ratio - 0.5);

	if (deviation > 0.12) {
		return Math.min((deviation - 0.12) * 6.0, 1.0);
	}
	return 0.0;
}

export function createHybridEngine(): HybridEngine {
	const sensitivity = 2.8;
	const noiseGate = 0.04;

	const alpha = 0.6;

	const prevAus = new Map<string, number>();

	const physicalValidator = createPhysicalValidator();

	let manualOffsets: ActionUnits = {};
	let isCalibratedManual = false;

	function calibrate(currentAus: ActionUnits): void {
		console.log(">>> CALIBRATING... NEUTRAL FACE DEFINED.");
		manualOffsets = { ...currentAus };
		isCalibratedManual = true;
	}

	function resetCalibration(): void {
		console.log(">>> CALIBRATION RESET.");
		manualOffsets = {};
		isCalibratedManual = false;
	}

	function process(
		blendshapes: Blendshape[],
		landmarks: LandmarkPoint[],
		w: number,
		h: number,
	): HybridEngineResult {
		const bs: Record<string, number> = {};
		for (const b of blendshapes) {
			bs[b.category_name] = b.score;
		}

		const rotPenalty = calculateRotationPenalty(landmarks);
		const currentGain = sensitivity * (1.0 - rotPenalty * 0.8);

		let aus: ActionUnits = calculateAUsFromMappings(bs);

		aus = physicalValidator.applyValidations(aus, landmarks, w, h);

		const finalAus: ActionUnits = {};

		for (const [k, v] of Object.entries(aus)) {
			let val = (v || 0) ** 0.75 * currentGain;

			const prev = prevAus.get(k) || 0.0;
			const smoothedVal = val * alpha + prev * (1.0 - alpha);

			prevAus.set(k, smoothedVal);

			val = smoothedVal;

			if (isCalibratedManual) {
				const offset = manualOffsets[k] || 0.0;
				val = Math.max(0.0, val - offset);
			}

			if (val < noiseGate) val = 0.0;

			finalAus[k] = Math.min(val, 1.0);
		}

		return {
			aus: finalAus,
			rotPenalty,
		};
	}

	return {
		process,
		calibrate,
		resetCalibration,
	};
}
