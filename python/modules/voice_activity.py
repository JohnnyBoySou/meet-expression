import numpy as np
from core.geometry_utils import GeometryUtils

class VoiceActivityDetector:
    """
    Detector Visual de Atividade de Voz (Visual VAD).
    Usa a geometria da boca para saber se a pessoa está falando.
    """
    def __init__(self, config):
        self.threshold = config['vad']['speaking_threshold']
        
        # Índices da Boca (Lábios Internos - Melhores para detectar fala)
        self.IDX_LIP_TOP = 13
        self.IDX_LIP_BOTTOM = 14
        
        # Âncoras para normalização (Nariz e Queixo)
        self.IDX_NOSE = 1
        self.IDX_CHIN = 152

    def is_speaking(self, landmarks):
        """
        Retorna True se a abertura da boca indicar fala.
        """
        # 1. Distância vertical dos lábios (Abertura)
        lip_dist = GeometryUtils.euclidean_distance(
            landmarks[self.IDX_LIP_TOP],
            landmarks[self.IDX_LIP_BOTTOM]
        )
        
        # 2. Distância de referência (Altura do rosto inferior)
        # Necessário para que funcione se a pessoa estiver longe ou perto da câmera
        face_ref_dist = GeometryUtils.euclidean_distance(
            landmarks[self.IDX_NOSE],
            landmarks[self.IDX_CHIN]
        )
        
        if face_ref_dist == 0: return False
        
        # 3. Razão de Abertura Normalizada
        opening_ratio = lip_dist / face_ref_dist
        
        # Se a abertura for maior que o limiar configurado (ex: 0.05), está falando/boca aberta
        return opening_ratio > self.threshold
