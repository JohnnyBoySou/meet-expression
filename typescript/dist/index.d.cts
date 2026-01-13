type ActionUnits = {
    [key: string]: number;
};
type MetaSignals = {
    gaze: string;
    is_speaking: boolean;
    head_yaw: number;
    head_pitch: number;
};
type WindowPayload = {
    aus: ActionUnits;
    meta: MetaSignals;
};
type LandmarkPoint = {
    x: number;
    y: number;
    z: number;
};
type ThresholdsConfig = {
    system?: {
        camera_index?: number;
        resolution?: [number, number];
        fps_target?: number;
    };
    baseline?: {
        window_size?: number;
        warmup_frames?: number;
    };
    safety?: {
        max_head_rotation_yaw?: number;
        max_head_rotation_pitch?: number;
        min_iod_pixels?: number;
        max_gaze_deviation?: number;
    };
    dynamics?: {
        temporal_buffer_size?: number;
        acceleration_threshold?: number;
        min_persistence_frames?: number;
    };
    texture?: {
        roi_size?: number;
        variance_threshold?: number;
    };
    geometry?: {
        brow_sensitivity?: number;
        mouth_sensitivity?: number;
    };
    vad?: {
        speaking_threshold?: number;
    };
};
type Blendshape = {
    category_name: string;
    score: number;
};
interface FaceLandmarkResult {
    faceLandmarks: LandmarkPoint[][];
    faceBlendshapes?: Blendshape[][];
}
interface ExpressionResult {
    dominant_dimension: string;
    dominant_value: number;
    active_combos: string[][];
    scores: Record<string, number>;
    recommended_actions: string[];
    questions: string[];
}
interface ComboRule {
    requires: string[];
    forbids?: string[];
    adjustments: Record<string, number>;
    tag?: string[];
    id?: string;
}
interface FACSConfig {
    weights_by_code: Record<string, Record<string, number>>;
    combo_rules: ComboRule[];
    default_actions_questions: Record<string, {
        action: string;
        questions: string[];
    }>;
    dimensions: Record<string, {
        desc: string;
        range: string;
    }>;
}

/**
 * Landmark Tracker
 * Processa frames usando MediaPipe FaceLandmarker
 * Adaptado para uso com @mediapipe/tasks-vision
 */

interface MediaPipeFaceLandmarker {
    detectForVideo(image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageData, timestamp: number): FaceLandmarkerResult;
}
interface FaceLandmarkerResult {
    faceLandmarks: Array<Array<{
        x: number;
        y: number;
        z: number;
    }>>;
    faceBlendshapes?: Array<{
        categories: Array<{
            categoryName: string;
            score: number;
        }>;
    }>;
    facialTransformationMatrixes?: any[];
}

/**
 * FACS Configuration
 * Exporta a configuração FACS padrão para uso no engine
 */

declare const defaultFACSConfig: FACSConfig;

/**
 * Face Expression Engine
 * Orquestração do sistema de análise de expressão facial.
 */

interface FrameResult {
    aus: ActionUnits;
    meta: MetaSignals;
    rotPenalty?: number;
    isStable: boolean;
    currentDecision?: ExpressionResult;
}
interface FaceExpressionEngineOptions {
    thresholdsConfig?: ThresholdsConfig;
    facsConfig?: FACSConfig;
    apiUrl?: string;
    windowSeconds?: number;
    fps?: number;
}
interface FaceExpressionEngine {
    processFrame(frame: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageData): Promise<FrameResult | null>;
    calibrate(currentAus: ActionUnits): void;
    resetCalibration(): void;
    getCurrentDecision(): ExpressionResult | null;
    clearBuffer(): void;
    onResult(callback: (result: FrameResult) => void): void;
    onDecision(callback: (decision: ExpressionResult) => void): void;
}
declare function createFaceExpressionEngine(options: FaceExpressionEngineOptions, faceLandmarker: MediaPipeFaceLandmarker): FaceExpressionEngine;

export { type ActionUnits, type Blendshape, type ExpressionResult, type FACSConfig, type FaceExpressionEngine, type FaceExpressionEngineOptions, type FaceLandmarkResult, type FrameResult, type LandmarkPoint, type MetaSignals, type ThresholdsConfig, type WindowPayload, createFaceExpressionEngine, defaultFACSConfig };
