import numpy as np
import math

class GeometryUtils:
    """
    Utilitários para cálculos geométricos 3D (Landmarks).
    Foca em distâncias relativas e vetores para ignorar escala.
    """

    @staticmethod
    def euclidean_distance(p1, p2):
        """Calcula distância Euclidiana 3D entre dois landmarks."""
        return math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2)

    @staticmethod
    def euclidean_distance_2d(p1, p2, w, h):
        """Calcula distância em pixels (para IOD - Interocular Distance)."""
        x1, y1 = p1.x * w, p1.y * h
        x2, y2 = p2.x * w, p2.y * h
        return math.sqrt((x1 - x2)**2 + (y1 - y2)**2)

    @staticmethod
    def get_vector(p_start, p_end):
        """Retorna o vetor (dx, dy, dz) entre dois pontos."""
        return np.array([p_end.x - p_start.x, p_end.y - p_start.y, p_end.z - p_start.z])

    @staticmethod
    def calculate_relative_velocity(pos_curr, pos_prev, anchor_curr, anchor_prev, dt):
        """
        O SEGREDO DO V4:
        Calcula a velocidade de um ponto SUBTRAINDO a velocidade da cabeça (âncora).
        
        Args:
            pos_curr, pos_prev: Posição do ponto de interesse (ex: sobrancelha)
            anchor_curr, anchor_prev: Posição do ponto rígido (ex: nariz)
            dt: Delta tempo entre frames
        """
        if dt <= 0: return 0.0
        
        # Velocidade do Ponto de Interesse
        v_point = (np.array(pos_curr) - np.array(pos_prev)) / dt
        
        # Velocidade da Cabeça (Ruído)
        v_head = (np.array(anchor_curr) - np.array(anchor_prev)) / dt
        
        # Velocidade Limpa (Vetor Resultante)
        v_clean = np.linalg.norm(v_point - v_head)
        
        return v_clean
