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
	faceBlendshapes?: Array<{
		categories: Array<{ categoryName: string; score: number }>;
	}>;
	// MediaPipe retorna Matrix[] onde Matrix é um tipo específico do MediaPipe
	// Aceitamos qualquer tipo compatível (Matrix do MediaPipe ou number[][])
	// O tipo Matrix do MediaPipe é estruturalmente equivalente a number[][] (matriz 4x4)
	// Usamos um tipo genérico para aceitar o tipo Matrix do MediaPipe sem conflitos de tipo
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	facialTransformationMatrixes?: any[];
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
	// Verificar se faceLandmarks é um array válido
	if (!Array.isArray(mpResult.faceLandmarks)) {
		console.warn("faceLandmarks is not an array:", mpResult.faceLandmarks);
		return {
			faceLandmarks: [],
		};
	}

	const faceLandmarks: LandmarkPoint[][] = mpResult.faceLandmarks
		.filter((face) => Array.isArray(face))
		.map((face) =>
			face.map((point) => ({
				x: point.x,
				y: point.y,
				z: point.z,
			})),
		);

	let faceBlendshapes: Blendshape[][] | undefined;
	if (mpResult.faceBlendshapes) {
		// Verificar se é um array
		if (!Array.isArray(mpResult.faceBlendshapes)) {
			console.warn(
				"faceBlendshapes is not an array:",
				typeof mpResult.faceBlendshapes,
				mpResult.faceBlendshapes,
			);
		} else {
			try {
				// MediaPipe retorna: Array<{ categories: Array<{ categoryName, score }> }>
				// Precisamos converter para: Array<Array<{ category_name, score }>>
				faceBlendshapes = mpResult.faceBlendshapes
					.filter((faceBlendshape) => {
						// Verificar se tem a propriedade 'categories' e se é um array
						const isValid =
							faceBlendshape &&
							typeof faceBlendshape === "object" &&
							"categories" in faceBlendshape &&
							Array.isArray(faceBlendshape.categories);
						if (!isValid && process.env.NODE_ENV === "development") {
							console.warn(
								"faceBlendshapes element is not in expected format:",
								typeof faceBlendshape,
								faceBlendshape,
							);
						}
						return isValid;
					})
					.map((faceBlendshape) =>
						faceBlendshape.categories.map((blendshape) => ({
							category_name: blendshape.categoryName,
							score: blendshape.score,
						})),
					);
			} catch (error) {
				console.error("Error converting faceBlendshapes:", error);
				// Em caso de erro, continuar sem blendshapes
				faceBlendshapes = undefined;
			}
		}
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

			// Verificar se o resultado é válido
			if (!detectionResult) {
				return null;
			}

			// Debug: log da estrutura retornada (apenas primeira vez)
			if (typeof window !== "undefined") {
				const win = window as unknown as { __mpDebugLogged?: boolean };
				if (!win.__mpDebugLogged) {
					win.__mpDebugLogged = true;
					const firstBlendshape = detectionResult.faceBlendshapes?.[0];
					console.log("MediaPipe result structure:", {
						hasFaceLandmarks: !!detectionResult.faceLandmarks,
						faceLandmarksLength: Array.isArray(detectionResult.faceLandmarks)
							? detectionResult.faceLandmarks.length
							: 0,
						hasFaceBlendshapes: !!detectionResult.faceBlendshapes,
						faceBlendshapesLength: Array.isArray(
							detectionResult.faceBlendshapes,
						)
							? detectionResult.faceBlendshapes.length
							: 0,
						firstBlendshapeType: firstBlendshape
							? typeof firstBlendshape
							: "N/A",
						firstBlendshapeKeys:
							firstBlendshape && typeof firstBlendshape === "object"
								? Object.keys(firstBlendshape)
								: [],
						hasCategories:
							firstBlendshape && typeof firstBlendshape === "object"
								? "categories" in firstBlendshape
								: false,
						categoriesType:
							firstBlendshape &&
							typeof firstBlendshape === "object" &&
							"categories" in firstBlendshape
								? Array.isArray(firstBlendshape.categories)
									? "array"
									: typeof firstBlendshape.categories
								: "N/A",
						categoriesLength:
							firstBlendshape &&
							typeof firstBlendshape === "object" &&
							"categories" in firstBlendshape &&
							Array.isArray(firstBlendshape.categories)
								? firstBlendshape.categories.length
								: 0,
						sample: firstBlendshape,
					});
				}
			}

			// Verificar se faceLandmarks existe e é um array
			if (
				!detectionResult.faceLandmarks ||
				!Array.isArray(detectionResult.faceLandmarks) ||
				detectionResult.faceLandmarks.length === 0
			) {
				return null;
			}

			return convertToFaceLandmarkResult(detectionResult);
		} catch (error) {
			console.error("Error in LandmarkTracker:", error);
			if (error instanceof Error) {
				console.error("Error details:", error.message, error.stack);
			}
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
