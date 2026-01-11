class TemporalGate:
    """
    Filtro Temporal: Decide se um sinal passou do limiar de 'Explosão' (Aceleração)
    e se manteve estável por tempo suficiente (Persistência).
    
    Transforma sinais contínuos em EVENTOS DISCRETOS (Ex: "AU4 Disparou").
    """
    def __init__(self, config):
        self.accel_threshold = config['dynamics']['acceleration_threshold']
        self.min_persistence = config['dynamics']['min_persistence_frames']
        
        # Contadores de persistência para cada AU
        self.active_counters = {}
        
        # Mapeamento: Nome Técnico (Analyzers) -> Código FACS (JSON)
        self.MAPPING = {
            "au4_brow_dist": "AU4",
            "au12_mouth_dist": "AU12",
            "au15_chin_dist": "AU15",
            "au25_lip_open": "AU25",
            "au6_texture": "AU6",
            "au9_texture": "AU9"
        }

    def process(self, deviations, accelerations):
        """
        Retorna uma lista de AUs validadas neste frame.
        Ex: ["AU4", "AU7"]
        """
        active_aus = []

        for signal_name, value in deviations.items():
            # Pega a aceleração correspondente (se existir no dict de dinâmica)
            # Se for textura, às vezes usamos apenas magnitude, mas o ideal é aceleração.
            acc = accelerations.get(signal_name, 0.0)
            
            # 1. Checagem de Intensidade/Aceleração
            # Para vetores (distância), importa a aceleração (mudança rápida).
            # Para textura (rugas), importa se o valor subiu rápido.
            is_triggered = abs(acc) > self.accel_threshold
            
            # Se for textura, também podemos exigir um valor mínimo absoluto de desvio
            if "texture" in signal_name and value < 5.0: # Ruído de sensor
                is_triggered = False

            # 2. Lógica de Persistência (Debounce)
            if is_triggered:
                self.active_counters[signal_name] = self.active_counters.get(signal_name, 0) + 1
            else:
                self.active_counters[signal_name] = 0 # Reseta se o sinal cair
            
            # 3. Validação Final
            if self.active_counters.get(signal_name, 0) >= self.min_persistence:
                # Traduz para nome FACS (ex: au4_brow_dist -> AU4)
                if signal_name in self.MAPPING:
                    active_aus.append(self.MAPPING[signal_name])
        
        return active_aus
