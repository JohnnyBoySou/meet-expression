import math
import numpy as np

class HybridEngine:
    """
    ENGINE V9.2: SMOOTH & CLEAN
    Adiciona Filtro Temporal (EMA) para eliminar 'flicker' e lixo de leitura.
    """
    def __init__(self, config):
        self.sensitivity = 2.8 
        self.noise_gate = 0.04 # Subi levemente (era 0.03) para cortar ruído de fundo
        
        # Fator de Suavização (0.0 a 1.0)
        # Maior = Mais rápido / Menor = Mais suave
        # 0.6 é o equilíbrio perfeito para microexpressões.
        self.alpha = 0.6 
        
        # Memória para o filtro temporal
        self.prev_aus = {}

        # Estados de Calibração
        self.baseline_div = None
        self.calibrated_physics = False
        
        # Tara Manual
        self.manual_offsets = {}
        self.is_calibrated_manual = False

    def calibrate(self, current_aus):
        print(">>> CALIBRANDO... ROSTO NEUTRO DEFINIDO.")
        # Salva os valores SUAVIZADOS atuais como tara
        self.manual_offsets = current_aus.copy()
        self.is_calibrated_manual = True

    def reset_calibration(self):
        print(">>> CALIBRAÇÃO RESETADA.")
        self.manual_offsets = {}
        self.is_calibrated_manual = False

    def _calculate_rotation_penalty(self, landmarks):
        if not landmarks: return 1.0
        nose = landmarks[1].x
        ear_l = landmarks[234].x
        ear_r = landmarks[454].x
        face_width = abs(ear_r - ear_l)
        if face_width == 0: return 1.0
        ratio = abs(nose - ear_l) / face_width
        deviation = abs(ratio - 0.5)
        if deviation > 0.12:
            return min((deviation - 0.12) * 6.0, 1.0)
        return 0.0

    def _calculate_divergence(self, landmarks, indices, w, h):
        pts = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in indices])
        center = np.mean(pts, axis=0)
        return np.sum(np.linalg.norm(pts - center, axis=1))

    def process(self, blendshapes, landmarks, w, h):
        bs = {b.category_name: b.score for b in blendshapes}
        rot_penalty = self._calculate_rotation_penalty(landmarks)
        current_gain = self.sensitivity * (1.0 - (rot_penalty * 0.8))

        aus = {}
        
        # --- CÁLCULO BRUTO ---
        aus["AU1"] = bs.get('browInnerUp', 0)
        aus["AU2"] = (bs.get('browOuterUpLeft', 0) + bs.get('browOuterUpRight', 0)) / 2
        raw_au4 = (bs.get('browDownLeft', 0) + bs.get('browDownRight', 0)) / 2
        aus["AU4"] = raw_au4 + (aus["AU1"] * 0.1)

        aus["AU5"] = (bs.get('eyeWideLeft', 0) + bs.get('eyeWideRight', 0)) / 2
        aus["AU6"] = (bs.get('cheekSquintLeft', 0) + bs.get('cheekSquintRight', 0)) / 2
        aus["AU7"] = (bs.get('eyeSquintLeft', 0) + bs.get('eyeSquintRight', 0)) / 2
        aus["AU43"] = (bs.get('eyeBlinkLeft', 0) + bs.get('eyeBlinkRight', 0)) / 2
        aus["AU45"] = aus["AU43"]

        aus["AU9"] = (bs.get('noseSneerLeft', 0) + bs.get('noseSneerRight', 0)) / 2
        aus["AU10"] = (bs.get('mouthUpperUpLeft', 0) + bs.get('mouthUpperUpRight', 0)) / 2

        smile = (bs.get('mouthSmileLeft', 0) + bs.get('mouthSmileRight', 0)) / 2
        dimple = (bs.get('mouthDimpleLeft', 0) + bs.get('mouthDimpleRight', 0)) / 2
        aus["AU12"] = smile + (dimple * 1.3)
        aus["AU14"] = dimple
        aus["AU15"] = (bs.get('mouthFrownLeft', 0) + bs.get('mouthFrownRight', 0)) / 2
        aus["AU17"] = bs.get('chinRaise', 0)
        aus["AU18"] = bs.get('mouthPucker', 0)
        aus["AU20"] = (bs.get('mouthStretchLeft', 0) + bs.get('mouthStretchRight', 0)) / 2
        press = (bs.get('mouthPressLeft', 0) + bs.get('mouthPressRight', 0)) / 2
        aus["AU23"] = press * 0.9
        aus["AU24"] = press
        aus["AU25"] = bs.get('jawOpen', 0)
        aus["AU26"] = bs.get('jawDrop', 0)
        roll = (bs.get('mouthRollUpper', 0) + bs.get('mouthRollLower', 0)) / 2
        aus["AU28"] = roll

        # Validação Física (Divergência)
        brow_indices = [107, 336, 9, 66, 296]
        curr_div = self._calculate_divergence(landmarks, brow_indices, w, h)
        if not self.calibrated_physics:
            self.baseline_div = curr_div
            self.calibrated_physics = True
        div_delta = curr_div - self.baseline_div
        if aus["AU4"] > 0.15 and div_delta > 6.0:
            aus["AU4"] *= 0.2

        # --- FILTRAGEM TEMPORAL E PÓS-PROCESSAMENTO ---
        final_aus = {}
        for k, v in aus.items():
            # 1. Aplica Ganho e Curva
            val = math.pow(v, 0.75) * current_gain
            
            # 2. SUAVIZAÇÃO TEMPORAL (EMA - Exponential Moving Average)
            # Valor = (Atual * Alpha) + (Anterior * (1-Alpha))
            prev = self.prev_aus.get(k, 0.0)
            smoothed_val = (val * self.alpha) + (prev * (1.0 - self.alpha))
            
            # Atualiza memória
            self.prev_aus[k] = smoothed_val
            
            # Usa o valor suavizado daqui pra frente
            val = smoothed_val

            # 3. APLICA A TARA MANUAL
            if self.is_calibrated_manual:
                offset = self.manual_offsets.get(k, 0.0)
                val = max(0.0, val - offset)

            # 4. Noise Gate (Corta ruído residual)
            if val < self.noise_gate: val = 0.0
            
            final_aus[k] = min(val, 1.0)

        return final_aus, rot_penalty
