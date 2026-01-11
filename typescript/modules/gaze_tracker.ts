/**
 * Gaze Tracker
 * Calcula o vetor de atenção do cliente.
 * Combina: Rotação da Cabeça + Posição da Íris.
 */

import type {
	GazeAnalysisResult,
	GazeStatus,
	LandmarkPoint,
	ThresholdsConfig,
} from "@type/index";

const IDX_IRIS_L = 468;
const IDX_EYE_L_CORNERS: [number, number] = [33, 133]; // Inner corner, outer corner
const IDX_NOSE = 1;
const IDX_FACE_EDGES: [number, number] = [234, 454]; // Left ear, right ear

export function createGazeTracker(config: ThresholdsConfig) {
	const maxDeviation = config.safety?.max_gaze_deviation || 100;

	/**
	 * Retorna:
	 * - isLooking (bool): True se estiver olhando para a câmera/tela.
	 * - deviation (float): Grau de desvio estimado (0 a 100)
	 * - status (str): "DIRECT", "THINKING_UP", "THINKING_DOWN", "SIDEWAY"
	 *
	 */
	function analyze(landmarks: LandmarkPoint[]): GazeAnalysisResult {
		const nose = landmarks[IDX_NOSE];
		const leftEar = landmarks[IDX_FACE_EDGES[0]];
		const rightEar = landmarks[IDX_FACE_EDGES[1]];

		if (!nose || !leftEar || !rightEar) {
			return {
				isLooking: false,
				deviation: 0.0,
				status: "ERROR",
			};
		}

		const faceWidth = rightEar.x - leftEar.x;
		if (Math.abs(faceWidth) < 1e-6) {
			return {
				isLooking: false,
				deviation: 0.0,
				status: "ERROR",
			};
		}

		const headYawRatio = (nose.x - leftEar.x) / faceWidth;
		const headYawDeviation = Math.abs(headYawRatio - 0.5) * 200; // Scale approx 0-100

		const irisL = landmarks[IDX_IRIS_L];
		const eyeLStart = landmarks[IDX_EYE_L_CORNERS[0]];
		const eyeLEnd = landmarks[IDX_EYE_L_CORNERS[1]];

		if (!irisL || !eyeLStart || !eyeLEnd) {
			return {
				isLooking: false,
				deviation: 0.0,
				status: "ERROR",
			};
		}

		const eyeLWidth = eyeLEnd.x - eyeLStart.x;

		const irisRatio =
			Math.abs(eyeLWidth) < 1e-6 ? 0.5 : (irisL.x - eyeLStart.x) / eyeLWidth;

		const irisDeviation = Math.abs(irisRatio - 0.5) * 200; // Scale approx 0-100

		const totalDeviation = headYawDeviation + irisDeviation * 0.5;

		const irisY = irisL.y;
		const eyeYCenter = (eyeLStart.y + eyeLEnd.y) / 2;
		const verticalDiff = (irisY - eyeYCenter) * 1000;

		let status: GazeStatus = "DIRECT";
		if (totalDeviation > maxDeviation) {
			if (verticalDiff < -15) {
				status = "THINKING_UP";
			} else if (verticalDiff > 15) {
				status = "THINKING_DOWN";
			} else {
				status = "SIDEWAY";
			}

			return {
				isLooking: false,
				deviation: totalDeviation,
				status,
			};
		}

		return {
			isLooking: true,
			deviation: totalDeviation,
			status: "DIRECT",
		};
	}

	return {
		analyze,
	};
}
