import numpy as np
from core.geometry_utils import GeometryUtils

class GazeTracker:
    """
    Calcula o vetor de atenção do cliente.
    Combina: Rotação da Cabeça + Posição da Íris.
    """
    def __init__(self, config):
        self.max_deviation = config['safety']['max_gaze_deviation']
        
        # Índices MP (Left=Esq na imagem, Dir real do sujeito)
        self.IDX_IRIS_L = 468
        self.IDX_IRIS_R = 473
        self.IDX_EYE_L_CORNERS = (33, 133)   # Canto interno, externo
        self.IDX_EYE_R_CORNERS = (362, 263)
        
        # Índices para estimativa de pose da cabeça (Simplificado)
        self.IDX_NOSE = 1
        self.IDX_FACE_EDGES = (234, 454) # Orelha esq, Orelha dir

    def analyze(self, landmarks, frame_width, frame_height):
        """
        Retorna:
          - is_looking (bool): True se estiver olhando para a câmera/tela.
          - deviation (float): Grau de desvio estimado (0 a 100).
          - status (str): "DIRECT", "THINKING_UP", "THINKING_DOWN", "SIDEWAY"
        """
        
        # 1. Estimativa de Pose da Cabeça (Yaw - Rotação Lateral)
        nose = landmarks[self.IDX_NOSE].x
        left_ear = landmarks[self.IDX_FACE_EDGES[0]].x
        right_ear = landmarks[self.IDX_FACE_EDGES[1]].x
        
        # Razão de simetria do nariz em relação às orelhas
        face_width = right_ear - left_ear
        if face_width == 0: return False, 0.0, "ERROR"
        
        # 0.5 = Centro. <0.5 Esquerda, >0.5 Direita
        head_yaw_ratio = (nose - left_ear) / face_width
        head_yaw_deviation = abs(head_yaw_ratio - 0.5) * 200 # Escala aprox 0-100
        
        # 2. Rastreamento de Íris (Ajuste fino)
        # Calcula onde a íris está dentro do olho
        iris_l = landmarks[self.IDX_IRIS_L].x
        eye_l_start, eye_l_end = landmarks[self.IDX_EYE_L_CORNERS[0]].x, landmarks[self.IDX_EYE_L_CORNERS[1]].x
        eye_l_width = eye_l_end - eye_l_start
        
        # Posição normalizada da íris (0.0 a 1.0 dentro do olho)
        if eye_l_width == 0: iris_ratio = 0.5
        else: iris_ratio = (iris_l - eye_l_start) / eye_l_width
        
        iris_deviation = abs(iris_ratio - 0.5) * 200 # Escala aprox 0-100

        # 3. Fusão (Score Total de Desvio)
        # Se a cabeça gira, o olho costuma compensar. Se ambos giram, desvio é alto.
        total_deviation = head_yaw_deviation + (iris_deviation * 0.5)

        # 4. Classificação Vertical (Olhar Cima/Baixo)
        # Importante para diferenciar "Pensando" (Cima/Lado) de "Tristeza" (Baixo)
        iris_y = landmarks[self.IDX_IRIS_L].y
        eye_y_center = (landmarks[self.IDX_EYE_L_CORNERS[0]].y + landmarks[self.IDX_EYE_L_CORNERS[1]].y) / 2
        vertical_diff = (iris_y - eye_y_center) * 1000
        
        status = "DIRECT"
        if total_deviation > self.max_deviation:
            if vertical_diff < -15: status = "THINKING_UP"   # Olhando p/ cima
            elif vertical_diff > 15: status = "THINKING_DOWN" # Olhando p/ baixo
            else: status = "SIDEWAY" # Olhando p/ lado
            
            return False, total_deviation, status
            
        return True, total_deviation, "DIRECT"
