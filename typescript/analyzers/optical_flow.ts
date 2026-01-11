/**
 * Full Face Flow Engine: MOTOR V10 FULL
 * Monitora tensão física em 5 zonas críticas usando Optical Flow.
 * Compatível com a lista de 21 AUs do JSON.
 *
 */

import cvModule from "@techstark/opencv-js";
import type { LandmarkPoint } from "../types/index";

interface OpenCV {
	Mat: new (rows: number, cols: number, type: number) => OpenCVMat;
	CV_8UC1: number;
	CV_32FC2: number;
	calcOpticalFlowFarneback: (
		prev: OpenCVMat,
		next: OpenCVMat,
		flow: OpenCVMat,
		pyr_scale: number,
		levels: number,
		winsize: number,
		iterations: number,
		poly_n: number,
		poly_sigma: number,
		flags: number,
	) => void;
}

interface OpenCVMat {
	data: Uint8Array | Float32Array;
	data32F: Float32Array;
	delete: () => void;
	rows: number;
	cols: number;
}

interface OpenCVModule {
	Mat?: unknown;
	onRuntimeInitialized?: () => void;
}

let cvInstance: OpenCV | null = null;
let cvInitializing: Promise<OpenCV> | null = null;

async function getOpenCV(): Promise<OpenCV | null> {
	if (cvInstance) {
		return cvInstance;
	}

	if (cvInitializing) {
		return cvInitializing;
	}

	cvInitializing = (async () => {
		try {
			console.log("[OpenCV] Iniciando carregamento...");
			let cv: OpenCV;

			if (cvModule instanceof Promise) {
				cv = (await cvModule) as unknown as OpenCV;
			} else {
				const cvModuleTyped = cvModule as unknown as OpenCVModule;
				if (cvModuleTyped.Mat) {
					cv = cvModule as unknown as OpenCV;
				} else {
					console.log("[OpenCV] Aguardando inicialização do runtime...");
					await new Promise<void>((resolve) => {
						if (cvModuleTyped.onRuntimeInitialized) {
							const originalCallback = cvModuleTyped.onRuntimeInitialized;
							cvModuleTyped.onRuntimeInitialized = () => {
								originalCallback?.();
								resolve();
							};
						} else {
							cvModuleTyped.onRuntimeInitialized = () => resolve();
						}
					});
					cv = cvModule as unknown as OpenCV;
				}
			}

			cvInstance = cv;
			console.log("[OpenCV] Carregado com sucesso!");
			return cv;
		} catch (error) {
			console.error("[OpenCV] Erro ao inicializar:", error);
			cvInitializing = null;
			return null as unknown as OpenCV;
		}
	})();

	return cvInitializing;
}

export interface OpticalFlowResult {
	brow: number;
	nose: number;
	l_cheek: number;
	r_cheek: number;
	mouth: number;
}

export interface FullFaceFlowEngine {
	analyze(
		frame: HTMLImageElement | HTMLCanvasElement | ImageData | HTMLVideoElement,
		landmarks: LandmarkPoint[],
		w: number,
		h: number,
	): Promise<OpticalFlowResult>;
	reset(): void;
}

interface ROIDefinition {
	[key: string]: number[];
}

interface CropData {
	data: Uint8Array;
	width: number;
	height: number;
}

function boundingRect(pts: number[][]): {
	x: number;
	y: number;
	width: number;
	height: number;
} {
	if (pts.length === 0) {
		return { x: 0, y: 0, width: 0, height: 0 };
	}

	const firstPt = pts[0];
	if (!firstPt || firstPt.length < 2) {
		return { x: 0, y: 0, width: 0, height: 0 };
	}

	let minX = firstPt[0] ?? 0;
	let minY = firstPt[1] ?? 0;
	let maxX = firstPt[0] ?? 0;
	let maxY = firstPt[1] ?? 0;

	for (const pt of pts) {
		if (!pt || pt.length < 2) continue;
		const x = pt[0] ?? 0;
		const y = pt[1] ?? 0;
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);
	}

	return {
		x: Math.floor(minX),
		y: Math.floor(minY),
		width: Math.ceil(maxX - minX),
		height: Math.ceil(maxY - minY),
	};
}

function frameToGrayscale(
	frame: HTMLImageElement | HTMLCanvasElement | ImageData | HTMLVideoElement,
	_width: number,
	_height: number,
): ImageData {
	let imageData: ImageData;

	if (frame instanceof ImageData) {
		imageData = frame;
	} else if (frame instanceof HTMLCanvasElement) {
		const ctx = frame.getContext("2d");
		if (!ctx) throw new Error("Cannot get 2D context from canvas");
		imageData = ctx.getImageData(0, 0, frame.width, frame.height);
	} else if (frame instanceof HTMLVideoElement) {
		const canvas = document.createElement("canvas");
		canvas.width = frame.videoWidth;
		canvas.height = frame.videoHeight;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Cannot get 2D context");
		ctx.drawImage(frame, 0, 0);
		imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	} else {
		// HTMLImageElement
		const canvas = document.createElement("canvas");
		canvas.width = frame.width;
		canvas.height = frame.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Cannot get 2D context");
		ctx.drawImage(frame, 0, 0);
		imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	}

	// Converter para grayscale
	const grayData: number[] = [];
	for (let i = 0; i < imageData.data.length; i += 4) {
		const r = imageData.data[i] ?? 0;
		const g = imageData.data[i + 1] ?? 0;
		const b = imageData.data[i + 2] ?? 0;
		// Fórmula padrão de conversão para grayscale
		const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
		grayData.push(gray);
	}

	// Criar ImageData com valores RGBA (repetindo o valor de grayscale)
	const rgbaData = new Uint8ClampedArray(
		(imageData.width ?? 0) * (imageData.height ?? 0) * 4,
	);
	for (let i = 0; i < grayData.length; i++) {
		const gray = grayData[i] ?? 0;
		rgbaData[i * 4] = gray; // R
		rgbaData[i * 4 + 1] = gray; // G
		rgbaData[i * 4 + 2] = gray; // B
		rgbaData[i * 4 + 3] = 255; // A
	}

	return new ImageData(rgbaData, imageData.width ?? 0, imageData.height ?? 0);
}

function extractCrop(
	imageData: ImageData,
	x: number,
	y: number,
	width: number,
	height: number,
): CropData | null {
	const w = imageData.width;
	const h = imageData.height;

	const x1 = Math.max(0, x);
	const y1 = Math.max(0, y);
	const x2 = Math.min(w, x + width);
	const y2 = Math.min(h, y + height);

	if (x2 <= x1 || y2 <= y1) {
		return null;
	}

	const cropWidth = x2 - x1;
	const cropHeight = y2 - y1;
	const cropData = new Uint8Array(cropWidth * cropHeight);

	for (let cy = 0; cy < cropHeight; cy++) {
		for (let cx = 0; cx < cropWidth; cx++) {
			const srcX = x1 + cx;
			const srcY = y1 + cy;
			const srcIdx = (srcY * w + srcX) * 4;
			const grayValue = imageData.data[srcIdx] ?? 0; // Já está em grayscale
			cropData[cy * cropWidth + cx] = grayValue ?? 0;
		}
	}

	return {
		data: cropData,
		width: cropWidth,
		height: cropHeight,
	};
}

function gradient2D(matrix: number[][], axis: 0 | 1): number[][] {
	const rows = matrix.length;
	if (rows === 0) return [];
	const firstRow = matrix[0];
	if (!firstRow) return [];
	const cols = firstRow.length;

	const result: number[][] = [];

	if (axis === 1) {
		for (let i = 0; i < rows; i++) {
			const row: number[] = [];
			const currentRow = matrix[i];
			if (!currentRow) continue;
			for (let j = 0; j < cols; j++) {
				const curr = currentRow[j] ?? 0;
				if (j === 0) {
					const next = currentRow[j + 1] ?? 0;
					row.push(next - curr);
				} else if (j === cols - 1) {
					const prev = currentRow[j - 1] ?? 0;
					row.push(curr - prev);
				} else {
					const next = currentRow[j + 1] ?? 0;
					const prev = currentRow[j - 1] ?? 0;
					row.push((next - prev) / 2);
				}
			}
			result.push(row);
		}
	} else {
		for (let i = 0; i < rows; i++) {
			const row: number[] = [];
			const currentRow = matrix[i];
			if (!currentRow) continue;
			for (let j = 0; j < cols; j++) {
				const curr = currentRow[j] ?? 0;
				if (i === 0) {
					const nextRow = matrix[i + 1];
					const next = nextRow?.[j] ?? 0;
					row.push(next - curr);
				} else if (i === rows - 1) {
					const prevRow = matrix[i - 1];
					const prev = prevRow?.[j] ?? 0;
					row.push(curr - prev);
				} else {
					const nextRow = matrix[i + 1];
					const prevRow = matrix[i - 1];
					const next = nextRow?.[j] ?? 0;
					const prev = prevRow?.[j] ?? 0;
					row.push((next - prev) / 2);
				}
			}
			result.push(row);
		}
	}

	return result;
}

async function calculateOpticalFlow(
	prev: CropData,
	curr: CropData,
): Promise<{ flowX: number[][]; flowY: number[][] } | null> {
	const cvStart = performance.now();
	const cv = await getOpenCV();
	const cvTime = performance.now() - cvStart;
	if (cvTime > 10) {
		console.log(`[OpenCV] Tempo para obter instância: ${cvTime.toFixed(1)}ms`);
	}
	if (!cv) {
		console.warn(
			"[OpenCV] OpenCV.js não está disponível. Instale: npm install @techstark/opencv-js",
		);
		return null;
	}

	try {
		const prevMat = new cv.Mat(prev.height, prev.width, cv.CV_8UC1);
		if (prevMat.data) {
			const prevData = new Uint8Array(prevMat.data);
			prevData.set(prev.data);
		}

		const currMat = new cv.Mat(curr.height, curr.width, cv.CV_8UC1);
		if (currMat.data) {
			const currData = new Uint8Array(currMat.data);
			currData.set(curr.data);
		}

		const flow = new cv.Mat(prev.height, prev.width, cv.CV_32FC2);

		cv.calcOpticalFlowFarneback(
			prevMat,
			currMat,
			flow,
			0.5,
			1,
			10,
			2,
			5,
			1.1,
			0,
		);

		const flowX: number[][] = [];
		const flowY: number[][] = [];

		if (flow.data32F) {
			for (let y = 0; y < prev.height; y++) {
				const rowX: number[] = [];
				const rowY: number[] = [];
				for (let x = 0; x < prev.width; x++) {
					const idx = (y * prev.width + x) * 2;
					rowX.push(flow.data32F[idx] ?? 0); // u component
					rowY.push(flow.data32F[idx + 1] ?? 0); // v component
				}
				flowX.push(rowX);
				flowY.push(rowY);
			}
		}

		prevMat.delete();
		currMat.delete();
		flow.delete();

		return { flowX, flowY };
	} catch (error) {
		console.error("Erro ao calcular fluxo óptico:", error);
		return null;
	}
}

function calculateDivergence(flowX: number[][], flowY: number[][]): number {
	const du_dx = gradient2D(flowX, 1);
	const dv_dy = gradient2D(flowY, 0);

	let sum = 0;
	let count = 0;

	for (let i = 0; i < du_dx.length; i++) {
		const duRow = du_dx[i];
		const dvRow = dv_dy[i];
		if (!duRow || !dvRow) continue;
		for (let j = 0; j < duRow.length; j++) {
			const duVal = duRow[j] ?? 0;
			const dvVal = dvRow[j] ?? 0;
			sum += duVal + dvVal;
			count++;
		}
	}

	return count > 0 ? sum / count : 0;
}

export function createFullFaceFlowEngine(): FullFaceFlowEngine {
	const prevCrops: Map<string, CropData> = new Map();

	const roisDef: ROIDefinition = {
		// Brow: Corrugator (AU4) e Frontalis (AU1/2)
		brow: [336, 107, 66, 296],

		// Nariz Superior: Procerus/Nasalis (AU9 - Nojo)
		nose: [198, 420, 279, 49],

		// Bochecha Esq: Zygomaticus Major (AU6/12)
		l_cheek: [117, 119, 100, 47],

		// Bochecha Dir: Zygomaticus Major (AU6/12)
		r_cheek: [346, 348, 329, 277],

		// Boca Completa: Orbicularis Oris (Todas as AUs de boca: 10 a 28)
		// Abrangemos uma área maior para pegar estiramento (AU20) e bico (AU18)
		mouth: [61, 291, 0, 17],
	};

	async function analyze(
		frame: HTMLImageElement | HTMLCanvasElement | ImageData | HTMLVideoElement,
		landmarks: LandmarkPoint[],
		w: number,
		h: number,
	): Promise<OpticalFlowResult> {
		const results: OpticalFlowResult = {
			brow: 0.0,
			nose: 0.0,
			l_cheek: 0.0,
			r_cheek: 0.0,
			mouth: 0.0,
		};

		let grayImageData: ImageData;
		try {
			grayImageData = frameToGrayscale(frame, w, h);
		} catch (error) {
			console.error("Erro ao converter frame para grayscale:", error);
			return results;
		}

		for (const [name, indices] of Object.entries(roisDef)) {
			const pts: number[][] = indices.map((i) => {
				const landmark = landmarks[i];
				return [(landmark?.x ?? 0) * w, (landmark?.y ?? 0) * h];
			});

			const bbox = boundingRect(pts);

			if (bbox.width < 5 || bbox.height < 5) {
				continue;
			}

			const pad = 10;
			const y1 = Math.max(0, bbox.y - pad);
			const y2 = Math.min(h, bbox.y + bbox.height + pad);
			const x1 = Math.max(0, bbox.x - pad);
			const x2 = Math.min(w, bbox.x + bbox.width + pad);

			const cropWidth = x2 - x1;
			const cropHeight = y2 - y1;

			const cropCurr = extractCrop(
				grayImageData,
				x1,
				y1,
				cropWidth,
				cropHeight,
			);

			if (!cropCurr || cropCurr.data.length === 0) {
				continue;
			}

			const prev = prevCrops.get(name);

			if (
				!prev ||
				cropCurr.width !== prev.width ||
				cropCurr.height !== prev.height
			) {
				prevCrops.set(name, cropCurr);
				continue;
			}

			const flowResult = await calculateOpticalFlow(prev, cropCurr);

			if (!flowResult) {
				prevCrops.set(name, cropCurr);
				continue;
			}

			const divergence = calculateDivergence(
				flowResult.flowX,
				flowResult.flowY,
			);

			const strain = divergence * 2000.0;

			results[name as keyof OpticalFlowResult] = strain;

			prevCrops.set(name, cropCurr);
		}

		return results;
	}

	function reset(): void {
		prevCrops.clear();
	}

	return {
		analyze,
		reset,
	};
}
