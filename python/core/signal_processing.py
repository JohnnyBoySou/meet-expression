import numpy as np
from collections import deque

class RollingBaseline:
    """
    Calcula a média móvel dos últimos N frames para definir o 'Zero'
    individual de cada cliente (Baseline Dinâmico).
    """
    def __init__(self, window_size=150):
        self.buffer = deque(maxlen=window_size)
        self.ready = False

    def update(self, value):
        self.buffer.append(value)
        if len(self.buffer) == self.buffer.maxlen:
            self.ready = True

    def get_deviation(self, current_value):
        """Retorna quanto o valor atual foge da média histórica."""
        if not self.buffer: return 0.0
        avg = np.mean(self.buffer)
        return current_value - avg
    
    def is_ready(self):
        # Considera pronto se tiver pelo menos 30% do buffer preenchido
        return len(self.buffer) > (self.buffer.maxlen * 0.3)


class TemporalDerivative:
    """
    Calcula Velocidade e Aceleração baseada em um buffer curto.
    Essencial para detectar o 'Onset' (Ataque) da microexpressão.
    """
    def __init__(self, buffer_size=5):
        # Guarda tuplas (valor, timestamp)
        self.history = deque(maxlen=buffer_size)

    def process(self, value, timestamp):
        self.history.append((value, timestamp))
        
        if len(self.history) < 3:
            return 0.0, 0.0 # Sem dados suficientes para aceleração

        # Pega os 3 pontos mais recentes
        y3, t3 = self.history[-1] # Atual
        y2, t2 = self.history[-2] # Anterior
        y1, t1 = self.history[-3] # Antepenúltimo

        # Evita divisão por zero
        dt1 = max(t2 - t1, 0.001)
        dt2 = max(t3 - t2, 0.001)

        # Velocidade (Derivada Primeira)
        v1 = (y2 - y1) / dt1
        v2 = (y3 - y2) / dt2

        # Aceleração (Derivada Segunda)
        # Quão rápido a velocidade mudou?
        accel = (v2 - v1) / dt2

        return v2, accel
