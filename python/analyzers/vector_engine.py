import numpy as np
from core.geometry_utils import GeometryUtils

class VectorEngine:
    """
    Motor Vetorial Expandido (V4.5) - Suporte a Multi-AUs.
    Calcula distâncias normalizadas para cobrir a lista completa do FACS.
    """
    def __init__(self, config):
        # Sensibilidades (podem ser ajustadas no yaml futuramente)
        self.brow_sens = config['geometry']['brow_sensitivity']
        self.mouth_sens = config['geometry']['mouth_sensitivity']
        
        # --- MAPA DE LANDMARKS (MediaPipe 478 pontos) ---
        self.IDX = {
            # Âncoras Estáveis (Pontos que mexem pouco)
            "nose_tip": 1,
            "nose_bridge": 168,
            "chin": 152,
            "face_left": 234,
            "face_right": 454,

            # Região Superior (Testa/Olhos)
            "brow_inner_L": 107, "brow_inner_R": 336, # AU1
            "brow_outer_L": 46,  "brow_outer_R": 276, # AU2
            "lid_top_L": 159,    "lid_bottom_L": 145, # AU5/7/43/45
            "lid_top_R": 386,    "lid_bottom_R": 374,
            
            # Região Média (Nariz/Bochecha)
            "nose_side_L": 203,  "nose_side_R": 423,  # AU9/10
            "cheek_L": 187,      "cheek_R": 411,      # AU6

            # Região Inferior (Boca)
            "lip_top": 13,       "lip_bottom": 14,    # AU25/26/27
            "mouth_L": 61,       "mouth_R": 291,      # AU12/14/20
            "lip_corner_L": 291, "lip_corner_R": 61,
            "lip_top_outer": 0,  "lip_bottom_outer": 17, # AU23/24 (Grossura labio)
            "jaw_bottom": 152
        }

    def analyze(self, landmarks):
        """
        Calcula sinais para todas as AUs geométricas.
        """
        signals = {}

        # ------------------------------------------------------------------
        # GRUPO 1: SOBRANCELHAS (AU1, AU2, AU4)
        # ------------------------------------------------------------------
        # AU1: Inner Brow Raiser (Distância sobrancelha interna -> olho interno ou nariz)
        d_brow_inner = (
            GeometryUtils.euclidean_distance(landmarks[self.IDX["brow_inner_L"]], landmarks[self.IDX["nose_bridge"]]) +
            GeometryUtils.euclidean_distance(landmarks[self.IDX["brow_inner_R"]], landmarks[self.IDX["nose_bridge"]])
        ) / 2.0
        signals["au1_inner_brow"] = d_brow_inner * self.brow_sens

        # AU2: Outer Brow Raiser (Distância sobrancelha externa -> canto olho)
        # Simplificado: medindo contra nariz para estabilidade
        d_brow_outer = (
            GeometryUtils.euclidean_distance(landmarks[self.IDX["brow_outer_L"]], landmarks[self.IDX["nose_bridge"]]) +
            GeometryUtils.euclidean_distance(landmarks[self.IDX["brow_outer_R"]], landmarks[self.IDX["nose_bridge"]])
        ) / 2.0
        signals["au2_outer_brow"] = d_brow_outer * self.brow_sens

        # AU4: Brow Lowerer (Já tínhamos, usa a mesma métrica mas a lógica interpreta invertido)
        # Usamos a mesma medida do AU1, a lógica (logic/) é que diferenciará:
        # Se distância AUMENTA = AU1. Se DIMINUI = AU4.
        signals["au4_brow_dist"] = signals["au1_inner_brow"] 

        # ------------------------------------------------------------------
        # GRUPO 2: OLHOS (AU5, AU7, AU43, AU45)
        # ------------------------------------------------------------------
        # Abertura do olho (Distância pálpebra sup - inf)
        eye_open_L = GeometryUtils.euclidean_distance(landmarks[self.IDX["lid_top_L"]], landmarks[self.IDX["lid_bottom_L"]])
        eye_open_R = GeometryUtils.euclidean_distance(landmarks[self.IDX["lid_top_R"]], landmarks[self.IDX["lid_bottom_R"]])
        avg_eye_open = (eye_open_L + eye_open_R) / 2.0
        
        # AU5 (Olho arregalado) vs AU43/45 (Olho fechado)
        signals["au5_eye_open"] = avg_eye_open

        # ------------------------------------------------------------------
        # GRUPO 3: BOCA SUPERIOR (AU10, AU12, AU9)
        # ------------------------------------------------------------------
        # AU10: Upper Lip Raiser (Lábio sup -> Nariz)
        # Distância DIMINUI quando AU10 ativa
        d_lip_nose = GeometryUtils.euclidean_distance(landmarks[self.IDX["lip_top"]], landmarks[self.IDX["nose_tip"]])
        signals["au10_upper_lip"] = d_lip_nose * self.mouth_sens

        # AU12: Lip Corner Puller (Já tínhamos)
        d_mouth_w = GeometryUtils.euclidean_distance(landmarks[self.IDX["mouth_L"]], landmarks[self.IDX["mouth_R"]])
        # Distância Canto Boca -> Nariz (Diminui no sorriso)
        d_corner_nose = (
            GeometryUtils.euclidean_distance(landmarks[self.IDX["mouth_L"]], landmarks[self.IDX["nose_tip"]]) +
            GeometryUtils.euclidean_distance(landmarks[self.IDX["mouth_R"]], landmarks[self.IDX["nose_tip"]])
        ) / 2.0
        signals["au12_mouth_dist"] = d_corner_nose * self.mouth_sens

        # ------------------------------------------------------------------
        # GRUPO 4: BOCA INFERIOR / LARGURA (AU14, AU15, AU20)
        # ------------------------------------------------------------------
        # AU15: Lip Corner Depressor (Canto boca -> Queixo)
        d_corner_chin = (
            GeometryUtils.euclidean_distance(landmarks[self.IDX["mouth_L"]], landmarks[self.IDX["chin"]]) +
            GeometryUtils.euclidean_distance(landmarks[self.IDX["mouth_R"]], landmarks[self.IDX["chin"]])
        ) / 2.0
        signals["au15_chin_dist"] = d_corner_chin * self.mouth_sens

        # AU20: Lip Stretcher (Largura horizontal da boca)
        # Aumenta no medo/grito
        signals["au20_lip_stretch"] = d_mouth_w * self.mouth_sens

        # AU14: Dimpler (Difícil medir a covinha direto, mas geralmente comprime o canto)
        # Usamos largura da boca (diminui) + tensão canto (aproximação)
        signals["au14_dimpler"] = d_mouth_w # Se diminuir largura sem abrir, pode ser AU14/23

        # ------------------------------------------------------------------
        # GRUPO 5: LÁBIOS (AU23, AU24, AU25, AU26)
        # ------------------------------------------------------------------
        # Altura da parte vermelha dos lábios (Thickness)
        # AU23/24 (Apertar lábios): Essa distância diminui
        lip_thickness = GeometryUtils.euclidean_distance(landmarks[self.IDX["lip_top"]], landmarks[self.IDX["lip_bottom"]])
        signals["au23_lip_tight"] = lip_thickness 

        # Abertura da boca (Mandíbula)
        # AU25/26/27
        mouth_open_vertical = GeometryUtils.euclidean_distance(landmarks[self.IDX["lip_top"]], landmarks[self.IDX["lip_bottom"]])
        signals["au25_lip_open"] = mouth_open_vertical

        # ------------------------------------------------------------------
        # GRUPO 6: CABEÇA (AU51-54)
        # ------------------------------------------------------------------
        # Yaw (Esquerda/Direita - AU51/52)
        nose_x = landmarks[self.IDX["nose_tip"]].x
        ear_L = landmarks[self.IDX["face_left"]].x
        ear_R = landmarks[self.IDX["face_right"]].x
        face_width = abs(ear_R - ear_L)
        # Ratio 0.5 = Centro. >0.5 Dir, <0.5 Esq.
        yaw_ratio = (nose_x - ear_L) / (face_width + 0.0001)
        signals["head_yaw"] = yaw_ratio

        # Pitch (Cima/Baixo - AU53/54)
        nose_y = landmarks[self.IDX["nose_tip"]].y
        eyes_mid_y = (landmarks[self.IDX["lid_top_L"]].y + landmarks[self.IDX["lid_top_R"]].y) / 2
        nose_eye_dist = abs(nose_y - eyes_mid_y)
        signals["head_pitch"] = nose_eye_dist

        return signals
