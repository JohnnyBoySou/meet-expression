/**
 * Face Expression Engine
 * Orquestração do sistema de análise de expressão facial.
 */

import { createHybridEngine } from "@analyzers/hybrid_engine";
import { createLandmarkFlowEngine } from "@analyzers/landmark_based_flow";
import { defaultThresholdsConfig } from "@config/thresholds_config";
import { defaultFACSConfig } from "@config/facs_config";
import { createSalesScoringEngine } from "@logic/scoring_engine";
import { createGazeTracker } from "@modules/gaze_tracker";
import {
	createLandmarkTracker,
	type MediaPipeFaceLandmarker,
} from "@modules/landmark_tracker";
import { createVoiceActivityDetector } from "@modules/voice_activity";
import type {
	ActionUnits,
	ExpressionResult,
	FACSConfig,
	MetaSignals,
	ThresholdsConfig,
	WindowPayload,
} from "@type/index";

interface BufferEntry {
	aus: ActionUnits;
	meta: MetaSignals;
	timestamp: number;
}

export interface FrameResult {
	aus: ActionUnits;
	meta: MetaSignals;
	rotPenalty?: number;
	isStable: boolean;
	currentDecision?: ExpressionResult;
}

export interface FaceExpressionEngineOptions {
	thresholdsConfig?: ThresholdsConfig;
	facsConfig?: FACSConfig; // Opcional: usa defaultFACSConfig se não fornecido
	apiUrl?: string; // Opcional: URL da API para enviar resultados (frontend envia para backend/IA)
	windowSeconds?: number;
	fps?: number;
}

export interface FaceExpressionEngine {
	processFrame(
		frame: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageData,
	): Promise<FrameResult | null>;
	calibrate(currentAus: ActionUnits): void;
	resetCalibration(): void;
	getCurrentDecision(): ExpressionResult | null;
	clearBuffer(): void;
	onResult(callback: (result: FrameResult) => void): void;
	onDecision(callback: (decision: ExpressionResult) => void): void;
}

/**
 * Envia o resultado do scoring para a API (opcional, não bloqueante)
 */
async function sendToAPI(
	apiUrl: string,
	result: ExpressionResult,
): Promise<void> {
	try {
		await fetch(apiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(result),
		});
	} catch (error) {
		// Silenciar erros de rede - não deve bloquear o processamento local
		console.warn("[Engine] Erro ao enviar para API (não bloqueante):", error);
	}
}

export function createFaceExpressionEngine(
	options: FaceExpressionEngineOptions,
	faceLandmarker: MediaPipeFaceLandmarker,
): FaceExpressionEngine {
	const config = options.thresholdsConfig || defaultThresholdsConfig;
	// Usa defaultFACSConfig se não fornecido - já está definido no módulo
	const facsConfig = options.facsConfig || defaultFACSConfig;

	// Validação do facsConfig (agora sempre tem valor, mas valida estrutura)
	if (!facsConfig.weights_by_code) {
		throw new Error(
			"[Engine] facsConfig inválido: 'weights_by_code' não encontrado.\n" +
				"Verifique se o JSON está correto.",
		);
	}

	if (!facsConfig.combo_rules) {
		throw new Error(
			"[Engine] facsConfig inválido: 'combo_rules' não encontrado.\n" +
				"Verifique se o JSON está correto.",
		);
	}

	if (!facsConfig.dimensions) {
		throw new Error(
			"[Engine] facsConfig inválido: 'dimensions' não encontrado.\n" +
				"Verifique se o JSON está correto.",
		);
	}

	const apiUrl = options.apiUrl; // Opcional: se fornecido, envia resultados para API
	const windowSeconds = options.windowSeconds || 4.0; // Janela de tempo para agregação (padrão: 4 segundos)
	const fps = options.fps || 30;
	const windowSize = Math.floor(windowSeconds * fps); // Tamanho do buffer em frames (4s * 30fps = 120 frames)

	// Initialize engines
	const tracker = createLandmarkTracker(faceLandmarker);
	const gazeTracker = createGazeTracker(config);
	const vad = createVoiceActivityDetector(config);
	const hybridEngine = createHybridEngine();
	// Usar landmark-based flow (rápido, sem dependências externas)
	const flowEngine = createLandmarkFlowEngine();
	const scoringEngine = createSalesScoringEngine(facsConfig);

	// Window buffer
	let buffer: BufferEntry[] = [];
	let lastAnalysisTime = Date.now();
	let lastOpticalFlowTime = 0;
	const OPTICAL_FLOW_INTERVAL = 3; // Executar optical flow a cada 3 frames (reduz de ~30fps para ~10fps)
	let frameCount = 0;

	// Current state
	let currentDecision: ExpressionResult | null = null;

	// Callbacks
	let onResultCallback: ((result: FrameResult) => void) | undefined;
	let onDecisionCallback: ((decision: ExpressionResult) => void) | undefined;

	function onResult(callback: (result: FrameResult) => void): void {
		onResultCallback = callback;
	}

	function onDecision(callback: (decision: ExpressionResult) => void): void {
		onDecisionCallback = callback;
	}

	/**
	 * Processa um único frame
	 * @param frame - HTMLVideoElement, HTMLImageElement, HTMLCanvasElement, ou ImageData
	 */
	async function processFrame(
		frame: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageData,
	): Promise<FrameResult | null> {
		if (!tracker.isInitialized()) {
			console.warn("[Engine] Not initialized.");
			return null;
		}

		const timestamp = Date.now();
		const detectionResult = tracker.processFrame(frame, timestamp);

		if (
			!detectionResult ||
			!detectionResult.faceLandmarks ||
			detectionResult.faceLandmarks.length === 0
		) {
			// Sem face detectada - não é erro, apenas retorna null
			return null;
		}

		const firstLandmarks = detectionResult.faceLandmarks[0];
		if (!firstLandmarks) {
			return null;
		}
		const landmarks = firstLandmarks;
		const blendshapes = detectionResult.faceBlendshapes?.[0] || [];

		let width = 1280;
		let height = 720;

		if (frame instanceof HTMLVideoElement) {
			width = frame.videoWidth;
			height = frame.videoHeight;
		} else if (frame instanceof HTMLCanvasElement) {
			width = frame.width;
			height = frame.height;
		} else if (frame instanceof ImageData) {
			width = frame.width;
			height = frame.height;
		}

		const { aus, rotPenalty } = hybridEngine.process(
			blendshapes,
			landmarks,
			width,
			height,
		);

		const gazeResult = gazeTracker.analyze(landmarks);
		const isSpeaking = vad.isSpeaking(landmarks);

		// Landmark-Based Flow (rápido, sem dependências externas)
		// Executar apenas a cada N frames para reduzir carga
		frameCount++;
		const shouldRunFlow =
			rotPenalty < 0.3 &&
			(frameCount % OPTICAL_FLOW_INTERVAL === 0 || lastOpticalFlowTime === 0);

		if (shouldRunFlow) {
			try {
				const flowStart = performance.now();
				// Landmark-based flow é síncrono e rápido, mas mantemos como Promise para compatibilidade
				const strains = await flowEngine.analyze(landmarks, width, height);
				const flowTime = performance.now() - flowStart;
				lastOpticalFlowTime = flowTime;

				if (flowTime > 10) {
					console.warn(
						`[Engine] Flow analysis lento: ${flowTime.toFixed(1)}ms`,
					);
				}

				if (strains.brow < -3.0) {
					aus.AU4 = Math.max(aus.AU4 || 0, 0.45);
				}
				if (strains.nose < -2.5) {
					aus.AU9 = Math.max(aus.AU9 || 0, 0.4);
				}
				if (Math.abs(strains.mouth) > 4.0) {
					const mouthAus = ["AU12", "AU24", "AU25"] as const;
					for (const mAu of mouthAus) {
						if ((aus[mAu] || 0) > 0.1) {
							aus[mAu] = (aus[mAu] || 0) + 0.15;
						}
					}
				}
			} catch {
				// Silenciar erros de timeout ou falhas do optical flow
				// O processamento continua sem os boosts do optical flow
			}
		}

		const nose = landmarks[1];
		const earL = landmarks[234];
		const earR = landmarks[454];

		if (nose && earL && earR) {
			const faceWidth = earR.x - earL.x;
			const headYaw = faceWidth !== 0 ? (nose.x - earL.x) / faceWidth : 0.5;

			const meta: MetaSignals = {
				gaze: gazeResult.status,
				is_speaking: isSpeaking,
				head_yaw: (headYaw - 0.5) * 180,
				head_pitch: (nose.y - (earL.y + earR.y) / 2) * 200,
			};

			buffer.push({
				aus: { ...aus },
				meta,
				timestamp,
			});

			if (buffer.length > windowSize) {
				buffer.shift();
			}

			// Verifica se passou o tempo da janela (padrão: 4 segundos)
			const timeSinceLastAnalysis = (timestamp - lastAnalysisTime) / 1000;
			if (timeSinceLastAnalysis >= windowSeconds) {
				// Só processa se tiver pelo menos 80% dos frames esperados no buffer
				if (buffer.length >= windowSize * 0.8) {
					const firstEntry = buffer[0];
					if (!firstEntry) {
						return null;
					}

					// Agrega os AUs: calcula percentil 95 de cada AU na janela de 4 segundos
					const allKeys = Object.keys(firstEntry.aus);
					const summaryAus: ActionUnits = {};

					for (const key of allKeys) {
						const values = buffer
							.map((entry) => entry.aus[key] || 0)
							.sort((a, b) => a - b);
						const percentile95Index = Math.floor(values.length * 0.95);
						summaryAus[key] = values[percentile95Index] || 0;
					}

					// Usa os meta signals do último frame da janela
					const lastEntry = buffer[buffer.length - 1];
					if (!lastEntry) {
						return null;
					}

					// Prepara o payload com dados agregados da janela de 4 segundos
					const windowPayload: WindowPayload = {
						aus: summaryAus,
						meta: lastEntry.meta,
					};

					// Processa o scoring localmente usando o scoring engine
					currentDecision = scoringEngine.process(windowPayload);
					lastAnalysisTime = timestamp;

					// Chama o callback local (frontend recebe o resultado)
					if (onDecisionCallback && currentDecision) {
						try {
							onDecisionCallback(currentDecision);
						} catch (error) {
							console.error("[Engine] Erro no callback onDecision:", error);
						}
					}

					// Se apiUrl estiver configurado, envia o resultado para a API (assíncrono, não bloqueante)
					if (apiUrl && currentDecision) {
						// Envia de forma assíncrona sem bloquear o processamento
						sendToAPI(apiUrl, currentDecision).catch(() => {
							// Erro já tratado na função sendToAPI
						});
					}
				}
			}

			const result: FrameResult = {
				aus,
				meta,
				rotPenalty,
				isStable: buffer.length >= windowSize * 0.3,
				currentDecision: currentDecision || undefined,
			};

			if (onResultCallback) {
				try {
					onResultCallback(result);
				} catch (error) {
					console.error("[Engine] Erro no callback onResult:", error);
				}
			}

			return result;
		}

		return null;
	}

	function calibrate(currentAus: ActionUnits): void {
		hybridEngine.calibrate(currentAus);
	}

	function resetCalibration(): void {
		hybridEngine.resetCalibration();
	}

	function getCurrentDecision(): ExpressionResult | null {
		return currentDecision;
	}

	function clearBuffer(): void {
		buffer = [];
		lastAnalysisTime = Date.now();
	}

	return {
		processFrame,
		calibrate,
		resetCalibration,
		getCurrentDecision,
		clearBuffer,
		onResult,
		onDecision,
	};
}

// Export default FACS config
export { defaultFACSConfig } from "@config/facs_config";

// Export types from @type/index
export type {
	ActionUnits,
	Blendshape,
	ExpressionResult,
	FACSConfig,
	FaceLandmarkResult,
	LandmarkPoint,
	MetaSignals,
	ThresholdsConfig,
	WindowPayload,
} from "@type/index";
