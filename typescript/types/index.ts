export type ActionUnits = {
	[key: string]: number;
};

export type MetaSignals = {
	gaze: string;
	is_speaking: boolean;
	head_yaw: number;
	head_pitch: number;
};

export type WindowPayload = {
	aus: ActionUnits;
	meta: MetaSignals;
};

export type LandmarkPoint = {
	x: number;
	y: number;
	z: number;
};

export type ThresholdsConfig = {
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

export type RawSignals = {
	[key: string]: number;
};

export type Blendshape = {
	category_name: string;
	score: number;
};

export type GazeStatus =
	| "DIRECT"
	| "THINKING_UP"
	| "THINKING_DOWN"
	| "SIDEWAY"
	| "ERROR";

export interface GazeAnalysisResult {
	isLooking: boolean;
	deviation: number;
	status: GazeStatus;
}

export interface FaceLandmarkResult {
	faceLandmarks: LandmarkPoint[][];
	faceBlendshapes?: Blendshape[][];
}

export interface ExpressionResult {
	dominant_dimension: string;
	dominant_value: number;
	active_combos: string[][]; // Array de arrays: cada combo ativado retorna seu array de tags
	scores: Record<string, number>;
	recommended_actions: string[];
	questions: string[];
}

export interface ComboRule {
	requires: string[];
	forbids?: string[];
	adjustments: Record<string, number>;
	tag?: string[];
	id?: string;
}
export interface FACSConfig {
	weights_by_code: Record<string, Record<string, number>>;
	combo_rules: ComboRule[];
	default_actions_questions: Record<
		string,
		{
			action: string;
			questions: string[];
		}
	>;
	dimensions: Record<
		string,
		{
			desc: string;
			range: string;
		}
	>;
}
