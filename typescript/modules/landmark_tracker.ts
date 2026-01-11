/**
 * Landmark Tracker
 * Processa frames usando MediaPipe FaceLandmarker
 * Adaptado para uso com @mediapipe/tasks-vision
 */

import type {
	Blendshape,
	FaceLandmarkResult,
	LandmarkPoint,
} from "@type/index";

export interface MediaPipeFaceLandmarker {
	detectForVideo(
		image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageData,
		timestamp: number,
	): FaceLandmarkerResult;
}

export interface FaceLandmarkerResult {
	faceLandmarks: Array<Array<{ x: number; y: number; z: number }>>;
	faceBlendshapes?: Array<Array<{ categoryName: string; score: number }>>;
	facialTransformationMatrixes?: number[][];
}

export interface LandmarkTracker {
	processFrame(
		frame: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageData,
		timestamp?: number,
	): FaceLandmarkResult | null;
	isInitialized(): boolean;
	getModelPath(): string;
}

function convertToFaceLandmarkResult(
	mpResult: FaceLandmarkerResult,
): FaceLandmarkResult {
	const faceLandmarks: LandmarkPoint[][] = mpResult.faceLandmarks.map((face) =>
		face.map((point) => ({
			x: point.x,
			y: point.y,
			z: point.z,
		})),
	);

	let faceBlendshapes: Blendshape[][] | undefined;
	if (mpResult.faceBlendshapes) {
		faceBlendshapes = mpResult.faceBlendshapes.map((face) =>
			face.map((blendshape) => ({
				category_name: blendshape.categoryName,
				score: blendshape.score,
			})),
		);
	}

	const converted: FaceLandmarkResult = {
		faceLandmarks,
	};
	if (faceBlendshapes) {
		converted.faceBlendshapes = faceBlendshapes;
	}
	return converted;
}

export function createLandmarkTracker(
	detector: MediaPipeFaceLandmarker,
	modelPath: string = "/models/face_landmarker.task",
): LandmarkTracker {
	const initialized = true;

	function processFrame(
		frame: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageData,
		timestamp: number = Date.now(),
	): FaceLandmarkResult | null {
		try {
			if (!detector || !initialized) {
				console.warn("LandmarkTracker not initialized.");
				return null;
			}

			const detectionResult = detector.detectForVideo(frame, timestamp);

			if (
				detectionResult.faceLandmarks &&
				detectionResult.faceLandmarks.length > 0
			) {
				return convertToFaceLandmarkResult(detectionResult);
			} else {
				return null;
			}
		} catch (error) {
			console.error("Error in LandmarkTracker:", error);
			return null;
		}
	}

	function isInitialized(): boolean {
		return initialized;
	}

	function getModelPath(): string {
		return modelPath;
	}

	return {
		processFrame,
		isInitialized,
		getModelPath,
	};
}
