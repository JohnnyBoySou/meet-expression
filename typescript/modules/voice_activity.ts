/**
 * Visual Voice Activity Detector (Visual VAD)
 * Usa a geometria da boca para saber se a pessoa está falando.
 */

import { euclideanDistance } from "@core/geometry_utils";
import type { LandmarkPoint, ThresholdsConfig } from "@type/index";

const IDX_LIP_TOP = 13;
const IDX_LIP_BOTTOM = 14;

const IDX_NOSE = 1;
const IDX_CHIN = 152;

export function createVoiceActivityDetector(config: ThresholdsConfig) {
	const threshold = config.vad?.speaking_threshold || 0.2;

	function isSpeaking(landmarks: LandmarkPoint[]): boolean {
		const lipTop = landmarks[IDX_LIP_TOP];
		const lipBottom = landmarks[IDX_LIP_BOTTOM];

		if (!lipTop || !lipBottom) return false;

		const lipDist = euclideanDistance(lipTop, lipBottom);

		const nose = landmarks[IDX_NOSE];
		const chin = landmarks[IDX_CHIN];

		if (!nose || !chin) return false;

		const faceRefDist = euclideanDistance(nose, chin);

		if (faceRefDist === 0) return false;

		const openingRatio = lipDist / faceRefDist;

		return openingRatio > threshold;
	}

	return {
		isSpeaking,
	};
}

export function isSpeaking(
	landmarks: LandmarkPoint[],
	threshold: number,
): boolean {
	const lipTop = landmarks[IDX_LIP_TOP];
	const lipBottom = landmarks[IDX_LIP_BOTTOM];

	if (!lipTop || !lipBottom) return false;

	const lipDist = euclideanDistance(lipTop, lipBottom);

	const nose = landmarks[IDX_NOSE];
	const chin = landmarks[IDX_CHIN];

	if (!nose || !chin) return false;

	const faceRefDist = euclideanDistance(nose, chin);

	if (faceRefDist === 0) return false;

	const openingRatio = lipDist / faceRefDist;

	return openingRatio > threshold;
}
