/**
 * Geometria utilidades para cálculos 3D com landmarks faciais
 * Foca em distâncias relativas e vetores para ignorar escala
 */

import type { LandmarkPoint } from "@type/index";

export function euclideanDistance(
	p1: LandmarkPoint,
	p2: LandmarkPoint,
): number {
	return Math.sqrt(
		(p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2,
	);
}

export function euclideanDistance2D(
	p1: LandmarkPoint,
	p2: LandmarkPoint,
	w: number,
	h: number,
): number {
	const x1 = p1.x * w;
	const y1 = p1.y * h;
	const x2 = p2.x * w;
	const y2 = p2.y * h;
	return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

export function getVector(
	pStart: LandmarkPoint,
	pEnd: LandmarkPoint,
): [number, number, number] {
	return [pEnd.x - pStart.x, pEnd.y - pStart.y, pEnd.z - pStart.z];
}

export function calculateRelativeVelocity(
	posCurr: [number, number, number],
	posPrev: [number, number, number],
	anchorCurr: [number, number, number],
	anchorPrev: [number, number, number],
	dt: number,
): number {
	if (dt <= 0) return 0.0;

	const vPoint: [number, number, number] = [
		(posCurr[0] - posPrev[0]) / dt,
		(posCurr[1] - posPrev[1]) / dt,
		(posCurr[2] - posPrev[2]) / dt,
	];

	const vHead: [number, number, number] = [
		(anchorCurr[0] - anchorPrev[0]) / dt,
		(anchorCurr[1] - anchorPrev[1]) / dt,
		(anchorCurr[2] - anchorPrev[2]) / dt,
	];

	const vClean: [number, number, number] = [
		vPoint[0] - vHead[0],
		vPoint[1] - vHead[1],
		vPoint[2] - vHead[2],
	];

	const vCleanMagnitude = Math.sqrt(
		vClean[0] ** 2 + vClean[1] ** 2 + vClean[2] ** 2,
	);

	return vCleanMagnitude;
}

export function vectorNorm(vector: [number, number, number]): number {
	return Math.sqrt(vector[0] ** 2 + vector[1] ** 2 + vector[2] ** 2);
}

export function calculateDivergence(
	landmarks: LandmarkPoint[],
	indices: number[],
	w: number,
	h: number,
): number {
	const pts: [number, number][] = indices.map((i) => {
		const landmark = landmarks[i];
		if (!landmark) return [0, 0];
		return [landmark.x * w, landmark.y * h];
	});

	if (pts.length === 0) return 0;

	const centerX = pts.reduce((sum, pt) => sum + pt[0], 0) / pts.length;
	const centerY = pts.reduce((sum, pt) => sum + pt[1], 0) / pts.length;

	let divergence = 0;
	for (const pt of pts) {
		const [x, y] = pt;
		const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
		divergence += dist;
	}

	return divergence;
}
