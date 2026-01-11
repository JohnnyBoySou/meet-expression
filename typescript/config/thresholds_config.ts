/**
 * Configuração de Limiares para Análise de Expressão Facial
 */

import type { ThresholdsConfig } from "@type/index";

export const defaultThresholdsConfig: ThresholdsConfig = {
	system: {
		camera_index: 0,
		resolution: [1280, 720],
		fps_target: 30,
	},
	baseline: {
		window_size: 90,
		warmup_frames: 45,
	},
	safety: {
		max_head_rotation_yaw: 30.0,
		max_head_rotation_pitch: 25.0,
		min_iod_pixels: 40,
		max_gaze_deviation: 30.0,
	},
	dynamics: {
		temporal_buffer_size: 5,
		acceleration_threshold: 600.0,
		min_persistence_frames: 1,
	},
	texture: {
		roi_size: 64,
		variance_threshold: 5.0,
	},
	geometry: {
		brow_sensitivity: 4.0,
		mouth_sensitivity: 3.0,
	},
	vad: {
		speaking_threshold: 0.2,
	},
};
