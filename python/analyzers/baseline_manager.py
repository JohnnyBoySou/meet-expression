from core.signal_processing import RollingBaseline

class BaselineManager:
    """
    Orquestrador de Baselines.
    Mantém um 'RollingBaseline' para cada sinal monitorado (AU4, AU6, AU12, etc).
    """
    def __init__(self, config):
        self.window_size = config['baseline']['window_size']
        self.warmup_frames = config['baseline']['warmup_frames']
        self.frame_count = 0
        
        # CORREÇÃO: Inicializa a variável is_stable aqui
        self.is_stable = False
        
        # Dicionário dinâmico de baselines
        # Chave = Nome do sinal (ex: "au4_brow_dist")
        # Valor = Objeto RollingBaseline
        self.baselines = {}

    def process(self, raw_signals):
        """
        Recebe sinais brutos, atualiza a média histórica e retorna os DESVIOS.
        
        Retorna:
            deviations (dict): { "au4_brow_dist": 0.005, ... }
            is_stable (bool): True se já passou do período de warmup.
        """
        # Se o sistema já está estável, não incrementamos o frame_count para 
        # evitar overflow desnecessário, ou mantemos para logs.
        # Aqui vamos incrementar para manter a lógica de tempo.
        self.frame_count += 1
        deviations = {}
        
        for key, value in raw_signals.items():
            # Se o sinal é novo, cria um rastreador para ele
            if key not in self.baselines:
                self.baselines[key] = RollingBaseline(self.window_size)
            
            # Atualiza histórico
            self.baselines[key].update(value)
            
            # Calcula o desvio (Sinal Real - Média Histórica)
            # Para Textura: Desvio positivo = Mais rugas que o normal
            # Para Vetores: Desvio = Movimento em relação ao repouso
            deviations[key] = self.baselines[key].get_deviation(value)
            
        # Verifica se o sistema já está aquecido
        if self.frame_count > self.warmup_frames:
            self.is_stable = True
        else:
            self.is_stable = False
        
        return deviations, self.is_stable
