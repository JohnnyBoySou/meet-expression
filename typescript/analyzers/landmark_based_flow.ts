/**
 * Landmark-Based Flow Engine (Alternativa Rápida ao Optical Flow)
 * 
 * Calcula "strain" (tensão) baseado na velocidade e aceleração dos landmarks,
 * sem precisar do OpenCV. Muito mais rápido que optical flow denso.
 */

import type { LandmarkPoint } from "../types/index";

export interface OpticalFlowResult {
	brow: number;
	nose: number;
	l_cheek: number;
	r_cheek: number;
	mouth: number;
}

export interface LandmarkFlowEngine {
	analyze(
		landmarks: LandmarkPoint[],
		w: number,
		h: number,
	): Promise<OpticalFlowResult>;
	reset(): void;
}

interface PreviousLandmarks {
	landmarks: LandmarkPoint[];
	velocities: number[];
	timestamp: number;
}

// ROIs (Regions of Interest) - mesmas regiões do optical flow original
const ROIS: Record<string, number[]> = {
	// Brow: Corrugator (AU4) e Frontalis (AU1/2)
	brow: [336, 107, 66, 296],

	// Nariz Superior: Procerus/Nasalis (AU9 - Nojo)
	nose: [198, 420, 279, 49],

	// Bochecha Esq: Zygomaticus Major (AU6/12)
	l_cheek: [117, 119, 100, 47],

	// Bochecha Dir: Zygomaticus Major (AU6/12)
	r_cheek: [346, 348, 329, 277],

	// Boca Completa: Orbicularis Oris
	mouth: [61, 291, 0, 17],
};

function calculateDistance(p1: LandmarkPoint, p2: LandmarkPoint): number {
	const dx = (p1.x - p2.x) ** 2;
	const dy = (p1.y - p2.y) ** 2;
	const dz = (p1.z - p2.z) ** 2;
	return Math.sqrt(dx + dy + dz);
}

function calculateROIVelocity(
	currentLandmarks: LandmarkPoint[],
	prevLandmarks: LandmarkPoint[],
	roiIndices: number[],
	w: number,
	h: number,
	deltaTime: number,
): number {
	if (deltaTime <= 0) return 0;

	let totalVelocity = 0;
	let validPoints = 0;

	for (const idx of roiIndices) {
		const curr = currentLandmarks[idx];
		const prev = prevLandmarks[idx];

		if (!curr || !prev) continue;

		// Calcular distância normalizada (em pixels)
		const distance = calculateDistance(
			{ x: curr.x * w, y: curr.y * h, z: curr.z },
			{ x: prev.x * w, y: prev.y * h, z: prev.z },
		);

		// Velocidade = distância / tempo (pixels por segundo)
		const velocity = distance / deltaTime;
		totalVelocity += velocity;
		validPoints++;
	}

	if (validPoints === 0) return 0;
	return totalVelocity / validPoints;
}

function calculateROIAcceleration(
	currentVelocity: number,
	prevVelocity: number,
	deltaTime: number,
): number {
	if (deltaTime <= 0) return 0;
	return Math.abs(currentVelocity - prevVelocity) / deltaTime;
}

export function createLandmarkFlowEngine(): LandmarkFlowEngine {
	let previous: PreviousLandmarks | null = null;
	const prevVelocities: Map<string, number> = new Map();

	function analyze(
		landmarks: LandmarkPoint[],
		w: number,
		h: number,
	): Promise<OpticalFlowResult> {
		const now = performance.now();
		const results: OpticalFlowResult = {
			brow: 0.0,
			nose: 0.0,
			l_cheek: 0.0,
			r_cheek: 0.0,
			mouth: 0.0,
		};

		// Se não temos frame anterior, apenas armazenar e retornar zeros
		if (!previous) {
			previous = {
				landmarks: landmarks.map((l) => ({ ...l })),
				velocities: [],
				timestamp: now,
			};
			return Promise.resolve(results);
		}

		const deltaTime = (now - previous.timestamp) / 1000; // Converter para segundos
		if (deltaTime <= 0 || deltaTime > 1.0) {
			// Resetar se deltaTime inválido (muito grande = frame perdido)
			previous = {
				landmarks: landmarks.map((l) => ({ ...l })),
				velocities: [],
				timestamp: now,
			};
			prevVelocities.clear();
			return Promise.resolve(results);
		}

		// Calcular strain para cada ROI
		for (const [roiName, roiIndices] of Object.entries(ROIS)) {
			// 1. Calcular velocidade atual dos landmarks nesta ROI
			const currentVelocity = calculateROIVelocity(
				landmarks,
				previous.landmarks,
				roiIndices,
				w,
				h,
				deltaTime,
			);

			// 2. Calcular aceleração (mudança de velocidade)
			const prevVelocity = prevVelocities.get(roiName) || 0;
			const acceleration = calculateROIAcceleration(
				currentVelocity,
				prevVelocity,
				deltaTime,
			);

			// 3. Strain = combinação de velocidade alta + aceleração alta
			// Fórmula similar ao optical flow: strain negativo = contração, positivo = expansão
			// Multiplicamos por fatores para aproximar os valores do optical flow original
			const velocityStrain = currentVelocity * 50; // Fator de escala
			const accelerationStrain = acceleration * 200; // Fator de escala para aceleração

			// Strain total: negativo quando há contração rápida (tensão)
			// Usamos aceleração negativa (desaceleração) como indicador de tensão
			const strain = velocityStrain - accelerationStrain;

			results[roiName as keyof OpticalFlowResult] = strain;
			prevVelocities.set(roiName, currentVelocity);
		}

		// Atualizar estado anterior
		previous = {
			landmarks: landmarks.map((l) => ({ ...l })),
			velocities: [],
			timestamp: now,
		};

		return Promise.resolve(results);
	}

	function reset(): void {
		previous = null;
		prevVelocities.clear();
	}

	return {
		analyze,
		reset,
	};
}
