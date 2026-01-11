import numpy as np
from collections import deque

class TimeSeriesAnalyzer:
    """
    V11: Analisador de Série Temporal.
    Guarda 4 segundos de histórico para diferenciar:
    - Ruído (< 40ms)
    - Microexpressão (40ms - 500ms)
    - Macroexpressão (> 500ms)
    """
    def __init__(self, buffer_duration=4.0, fps=30):
        self.fps = fps
        self.maxlen = int(buffer_duration * fps) # Ex: 120 frames
        
        # Buffer para cada AU: {'AU4': deque([...]), 'AU12': deque([...])}
        self.buffers = {}

    def update(self, current_aus):
        """
        Recebe o dicionário de AUs do frame atual e adiciona ao histórico.
        """
        for au, value in current_aus.items():
            if au not in self.buffers:
                self.buffers[au] = deque(maxlen=self.maxlen)
            
            self.buffers[au].append(value)

    def get_classification(self, au_name, threshold=0.35):
        """
        Analisa o histórico da AU específica.
        Retorna: 
        - None (Nada relevante)
        - "MICRO" (Expressão rápida/involuntária)
        - "MACRO" (Expressão sustentada/consciente)
        """
        if au_name not in self.buffers or len(self.buffers[au_name]) < 10:
            return None

        # Converte para array numpy para análise vetorizada (rápida)
        data = np.array(self.buffers[au_name])
        
        # 1. Verifica se houve algum pico relevante nos últimos 4s
        peak = np.max(data)
        if peak < threshold:
            return None

        # 2. Calcula a "Largura do Pulso" (Duração)
        # Quantos frames ficaram acima de 60% do pico máximo?
        # Usamos 60% para medir a largura à meia altura (FWHM aproximado)
        cut_level = peak * 0.6
        frames_active = np.sum(data > cut_level)
        
        duration_ms = (frames_active / self.fps) * 1000.0

        # 3. Classificação Temporal
        if duration_ms < 40:
            return None # Ruído muito rápido (glitch)
            
        elif 40 <= duration_ms < 500:
            # Se o pico já passou (último valor é baixo), confirmamos que foi Micro
            if data[-1] < cut_level:
                return "MICRO"
            # Se ainda está alto, pode estar se tornando uma Macro... esperamos.
            return "ANALISANDO..." 
            
        else: # > 500ms
            return "MACRO"
