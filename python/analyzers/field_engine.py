import numpy as np

class FieldEngine:
    """
    Motor de Campo Vetorial (V5 Physics).
    Aplica conceitos de Cálculo Vetorial (Divergência e Gradiente) para 
    analisar a dinâmica muscular como um fluxo de fluido.
    
    Conceitos:
    - Divergência Positiva (>0): Expansão (Surpresa, Alegria aberta)
    - Divergência Negativa (<0): Compressão (Raiva, Dor, Beijo)
    - Gradiente: Direção da intenção do movimento.
    """
    
    # CORREÇÃO AQUI: Adicionado o parâmetro 'config'
    def __init__(self, config):
        # Pontos centrais das regiões de interesse (Indices MediaPipe)
        self.REGIONS = {
            # Região da Testa (AU4 vs AU1/2)
            "brow_region": [107, 336, 9, 66, 296, 55, 285],
            
            # Região da Boca (AU12 vs AU18/23)
            "mouth_region": [13, 14, 61, 291, 0, 17, 37, 267],
            
            # Região do Nariz (AU9)
            "nose_region": [1, 2, 98, 327, 168, 6, 197]
        }
        self.prev_landmarks = None
        # O config pode ser usado futuramente para ajustar sensibilidade física
        self.config = config 

    def calculate_divergence(self, vectors, positions):
        """
        Calcula div F (Divergência) aproximada.
        Mede se os vetores estão fugindo (div > 0) ou indo para (div < 0) o centróide.
        """
        if len(vectors) < 2: return 0.0
        
        # Centróide da região
        center = np.mean(positions, axis=0)
        divergence = 0.0
        
        for i, vec in enumerate(vectors):
            pos = positions[i]
            # Vetor raio (do centro até o ponto)
            radius_vec = pos - center
            # Normaliza o raio
            norm = np.linalg.norm(radius_vec)
            if norm > 0: radius_vec /= norm
            
            # Produto escalar: Projeção da velocidade na direção radial
            # Se V aponta para fora (mesma direção do raio) -> Positivo (Expansão)
            # Se V aponta para dentro (oposto ao raio) -> Negativo (Compressão)
            divergence += np.dot(vec, radius_vec)
            
        return divergence

    def analyze(self, current_landmarks, dt):
        """
        Retorna mapa de fluxo físico.
        """
        # Se dt for zero ou muito pequeno, evita divisão por zero
        if dt < 0.001: dt = 0.001
            
        curr_np = np.array([[lm.x, lm.y] for lm in current_landmarks])
        
        if self.prev_landmarks is None:
            self.prev_landmarks = curr_np
            return {}

        results = {}
        
        # 1. Campo de Velocidade (V = dS/dt)
        # Quão rápido cada ponto moveu desde o último frame
        velocity_field = (curr_np - self.prev_landmarks) / dt

        # 2. Analisar Regiões
        for name, indices in self.REGIONS.items():
            region_vels = velocity_field[indices]
            region_pos = curr_np[indices]
            
            # A. Divergência (Classificação de Estado)
            div = self.calculate_divergence(region_vels, region_pos)
            
            # Escala para leitura humana (ex: -0.05 vira -50)
            results[f"{name}_div"] = div * 100.0

            # B. Magnitude do Fluxo (Energia Cinética da região)
            # Quanto essa região está se movendo no total?
            flux_mag = np.mean(np.linalg.norm(region_vels, axis=1))
            results[f"{name}_flux"] = flux_mag * 1000.0

        self.prev_landmarks = curr_np
        return results
