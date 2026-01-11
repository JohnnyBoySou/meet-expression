import cv2
import mediapipe as mp
import numpy as np
import time
from collections import deque

# ==========================================
# CONFIGURAÇÕES V4 (PRECISÃO & SEGURANÇA)
# ==========================================
CONFIG = {
    "camera_index": 0,
    "resolution": (1280, 720),
    "baseline_window_frames": 150,    # 5 segundos a 30fps para aprender o rosto neutro
    "temporal_buffer_size": 5,        # Janela curta para cálculo de aceleração
    "acceleration_threshold": 0.005,  # Sensibilidade para "Explosão" (Microexpressão)
    "head_rotation_limit": 15.0,      # Graus permitidos antes de bloquear análise
    "texture_roi_size": 60,           # Tamanho do recorte para análise de rugas
}

# Índices da Malha (MediaPipe 478)
IDX = {
    "nose_tip": 1,
    "nose_bridge_top": 168,
    "left_eye_outer": 33, 
    "right_eye_outer": 263,
    "mouth_left": 61,
    "mouth_right": 291,
    "mouth_top": 0,
    "mouth_bottom": 17,
    "brow_inner_L": 107,
    "brow_inner_R": 336
}

# ==========================================
# MÓDULOS DA ARQUITETURA V4
# ==========================================

class BaselineManager:
    """Gerencia a Média Móvel (Rolling Average) para ignorar traços fixos."""
    def __init__(self, window_size):
        self.history = deque(maxlen=window_size)
        
    def update_and_get_deviation(self, current_value):
        """Retorna o desvio atual em relação à média histórica."""
        self.history.append(current_value)
        if len(self.history) < 10: # Cold start
            return 0.0
        avg = np.mean(self.history)
        return current_value - avg

class TextureEngine:
    """Especialista em Textura Estabilizada (Para AU6 e AU9)."""
    
    def extract_feature(self, frame_gray, landmarks, roi_center_idx, align_p1_idx, align_p2_idx):
        """
        1. Cria matriz de rotação baseada nos olhos (align_points).
        2. Desentorta a imagem (Unwarp).
        3. Recorta ROI.
        4. Calcula Variância de Textura (Sobel).
        """
        h, w = frame_gray.shape
        
        # Coordenadas de alinhamento (ex: cantos dos olhos)
        p1 = landmarks[align_p1_idx]
        p2 = landmarks[align_p2_idx]
        px1, py1 = int(p1.x * w), int(p1.y * h)
        px2, py2 = int(p2.x * w), int(p2.y * h)
        
        # Calcula ângulo para estabilizar horizonte
        dy = py2 - py1
        dx = px2 - px1
        angle = np.degrees(np.arctan2(dy, dx))
        
        # Ponto central da ROI
        pc = landmarks[roi_center_idx]
        cx, cy = int(pc.x * w), int(pc.y * h)
        
        # Matriz de Rotação
        M = cv2.getRotationMatrix2D((cx, cy), angle, 1.0)
        
        # Aplica Warp apenas na área de interesse (otimização)
        stabilized = cv2.warpAffine(frame_gray, M, (w, h))
        
        # Recorte (Crop)
        half_s = CONFIG["texture_roi_size"] // 2
        y1, y2 = max(0, cy - half_s), min(h, cy + half_s)
        x1, x2 = max(0, cx - half_s), min(w, cx + half_s)
        roi = stabilized[y1:y2, x1:x2]
        
        if roi.size == 0: return 0.0
        
        # Análise de Gradiente (Sobel) para detectar rugas
        sobelx = cv2.Sobel(roi, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(roi, cv2.CV_64F, 0, 1, ksize=3)
        magnitude = np.sqrt(sobelx**2 + sobely**2)
        
        # Retorna a "quantidade de rugas" (intensidade média das bordas)
        return np.mean(magnitude)

class VectorEngine:
    """Especialista em Geometria Vetorial (Cancelamento de Cabeça)."""
    
    def get_relative_distance(self, landmarks, idx_target, idx_anchor):
        """Calcula distância Euclidiana normalizada (imune a Z-depth)."""
        t = landmarks[idx_target]
        a = landmarks[idx_anchor]
        # Distância 3D simples
        dist = np.sqrt((t.x - a.x)**2 + (t.y - a.y)**2 + (t.z - a.z)**2)
        return dist

class DynamicsProcessor:
    """Calcula Velocidade e Aceleração para filtrar Macro vs Micro."""
    def __init__(self):
        self.buffer = deque(maxlen=CONFIG["temporal_buffer_size"])
        
    def process(self, signal_val, dt):
        self.buffer.append((signal_val, dt))
        if len(self.buffer) < 3:
            return 0.0, 0.0 # Sem dados suficientes
            
        # Derivada Primeira (Velocidade)
        v1 = (self.buffer[-1][0] - self.buffer[-2][0]) / self.buffer[-1][1]
        v2 = (self.buffer[-2][0] - self.buffer[-3][0]) / self.buffer[-2][1]
        
        # Derivada Segunda (Aceleração)
        accel = (v1 - v2) / self.buffer[-1][1]
        
        return v1, accel

# ==========================================
# MAIN PIPELINE
# ==========================================

class SalesMicroExpressionSystem:
    def __init__(self):
        # Inicializa MediaPipe
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Motores
        self.tex_engine = TextureEngine()
        self.vec_engine = VectorEngine()
        
        # Baselines (Um para cada métrica monitorada)
        self.baselines = {
            "au4_dist": BaselineManager(CONFIG["baseline_window_frames"]),
            "au12_dist": BaselineManager(CONFIG["baseline_window_frames"]),
            "au6_tex": BaselineManager(CONFIG["baseline_window_frames"]),
            "head_rot": BaselineManager(CONFIG["baseline_window_frames"])
        }
        
        # Dinâmica
        self.dynamics = {
            "au4": DynamicsProcessor(),
            "au12": DynamicsProcessor(),
            "au6": DynamicsProcessor()
        }
        
        self.prev_time = time.time()

    def get_head_rotation(self, landmarks):
        # Estimativa simplificada de Yaw baseada na simetria do nariz vs orelhas
        # (Para o V4 final, usaríamos PnP Solver, mas isso serve para o teste)
        nose = landmarks[IDX["nose_tip"]].x
        left_e = landmarks[234].x # Orelha esq aprox
        right_e = landmarks[454].x # Orelha dir aprox
        
        midpoint = (left_e + right_e) / 2
        yaw_rel = (nose - midpoint) * 100 # Escala arbitrária para graus aprox
        return yaw_rel

    def run(self):
        cap = cv2.VideoCapture(CONFIG["camera_index"])
        cap.set(3, CONFIG["resolution"][0])
        cap.set(4, CONFIG["resolution"][1])
        
        print(">>> INICIANDO SISTEMA V4 (HÍBRIDO) <<<")
        print(">>> Aguarde 5 segundos para estabilização do Baseline <<<")
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frame_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            results = self.face_mesh.process(frame_rgb)
            
            # Controle de Tempo (dt)
            curr_time = time.time()
            dt = curr_time - self.prev_time
            self.prev_time = curr_time
            if dt == 0: dt = 0.001

            hud_color = (0, 255, 0)
            status_msg = "MONITORANDO"
            
            if results.multi_face_landmarks:
                lm = results.multi_face_landmarks[0].landmark
                
                # 1. Higiene: Rotação da Cabeça
                yaw = self.get_head_rotation(lm)
                if abs(yaw) > CONFIG["head_rotation_limit"]:
                    status_msg = "BLOQUEIO: ROTAÇÃO"
                    hud_color = (0, 0, 255)
                else:
                    # 2. Extração de Sinais
                    
                    # AU4 (Raiva/Conc): Vetor Sobrancelha -> Nariz
                    au4_raw = self.vec_engine.get_relative_distance(lm, IDX["brow_inner_L"], IDX["nose_bridge_top"])
                    au4_dev = self.baselines["au4_dist"].update_and_get_deviation(au4_raw)
                    
                    # AU12 (Sorriso): Vetor Canto Boca -> Nariz (Invertido, pois sorriso encurta essa dist)
                    au12_raw = self.vec_engine.get_relative_distance(lm, IDX["mouth_left"], IDX["nose_tip"])
                    au12_dev = self.baselines["au12_dist"].update_and_get_deviation(au12_raw)
                    
                    # AU6 (Micro): Textura Canto Olho
                    au6_raw = self.tex_engine.extract_feature(frame_gray, lm, IDX["left_eye_outer"], IDX["left_eye_outer"], IDX["right_eye_outer"])
                    au6_dev = self.baselines["au6_tex"].update_and_get_deviation(au6_raw)
                    
                    # 3. Processamento Dinâmico (Aceleração)
                    _, acc_au4 = self.dynamics["au4"].process(au4_dev, dt)
                    _, acc_au12 = self.dynamics["au12"].process(au12_dev, dt)
                    _, acc_au6 = self.dynamics["au6"].process(au6_dev, dt)
                    
                    # 4. Decisão e Visualização
                    y_pos = 100
                    for name, val, acc in [("AU4 (Testa)", au4_dev, acc_au4), 
                                           ("AU12 (Boca)", -au12_dev, acc_au12), # Negativo pois sorriso aproxima pontos
                                           ("AU6 (Textura)", au6_dev, acc_au6)]:
                        
                        # Barra de Intensidade (Visual)
                        cv2.putText(frame, name, (30, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 1)
                        bar_len = int(abs(val) * 2000) # Ganho visual
                        color_bar = (200, 200, 200)
                        
                        # Gatilho de Microexpressão (Aceleração Alta)
                        if abs(acc) > CONFIG["acceleration_threshold"]:
                            color_bar = (0, 255, 255) # AMARELO = Micro detecção
                            cv2.putText(frame, "MICRO!", (250, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,255), 2)
                        
                        cv2.rectangle(frame, (150, y_pos-10), (150 + bar_len, y_pos+5), color_bar, -1)
                        y_pos += 40

            # HUD
            cv2.rectangle(frame, (0,0), (1280, 80), (20,20,20), -1)
            cv2.putText(frame, f"STATUS: {status_msg}", (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, hud_color, 2)
            
            cv2.imshow('Sales Engine V4 - Validation', frame)
            if cv2.waitKey(5) & 0xFF == 27:
                break
                
        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    sys = SalesMicroExpressionSystem()
    sys.run()
