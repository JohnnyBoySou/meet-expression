import json
import time
import random

class InsightGenerator:
    """
    Motor de Decisão V5 (Dimensional Scoring).
    
    Diferente da versão anterior (regras Se/Então), esta versão usa um sistema de PONTUAÇÃO.
    Cada AU detectada soma pontos em dimensões específicas (Resistência, Engajamento, etc.).
    A dimensão com maior pontuação dispara o insight do arquivo JSON.
    """
    
    def __init__(self, json_path):
        # Carrega as estratégias de venda do JSON
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
            print(f"> [InsightGenerator] Regras carregadas: {json_path}")
        except Exception as e:
            print(f"> [ERRO] Falha ao carregar JSON de regras: {e}")
            self.data = {"dimensions": {}}

        self.dimensions = self.data.get("dimensions", {})
        
        # Controle de Tempo (Cooldown)
        self.last_insight_time = 0
        self.COOLDOWN_SECONDS = 5.0  # Tempo mínimo entre insights para não "spamar" o vendedor
        
        # ====================================================================
        # MATRIZ DE PESOS (AUs -> Dimensões de Negócio)
        # Aqui definimos como cada movimento facial impacta a negociação.
        # ====================================================================
        self.AU_WEIGHTS = {
            # --- ZONA DE TENSÃO / RESISTÊNCIA ---
            "AU4":  {"resistance": 35, "stress_load": 25, "engagement": -10}, # Testa franzida
            "AU7":  {"resistance": 20, "stress_load": 15, "incongruence_risk": 15}, # Olhos apertados
            "AU9":  {"aversion": 45, "resistance": 25, "approval": -30}, # Nariz enrugado (Nojo)
            "AU15": {"resistance": 25, "stress_load": 15, "approval": -20}, # Cantos boca baixos
            "AU17": {"resistance": 15, "incongruence_risk": 10}, # Queixo elevado
            "AU23": {"resistance": 30, "incongruence_risk": 20}, # Lábios apertados
            
            # --- ZONA DE APROVAÇÃO / CONEXÃO ---
            "AU6":  {"affiliation": 40, "engagement": 25, "approval": 15}, # Olhos sorrindo (Duchenne)
            "AU12": {"affiliation": 30, "approval": 20, "resistance": -15}, # Sorriso boca
            "AU25": {"engagement": 15, "affiliation": 10}, # Lábios entreabertos (Relaxamento)
            
            # --- ZONA DE CETICISMO / RISCO ---
            "AU14": {"incongruence_risk": 35, "resistance": 15, "approval": -15}, # Covinha (Sarcasmo)
            "AU10": {"aversion": 25, "incongruence_risk": 20}, # Labio superior levantado
            
            # --- ZONA DE ATENÇÃO ---
            "AU1":  {"engagement": 20, "stress_load": 5}, # Sobrancelha interna cima
            "AU2":  {"engagement": 20, "stress_load": 5}, # Sobrancelha externa cima
            "AU5":  {"engagement": 25, "stress_load": 10} # Olhos arregalados (Interesse ou Choque)
        }

    def evaluate(self, active_aus, gaze_status, vad_status):
        """
        Calcula os scores dimensionais e retorna o melhor insight.
        
        Args:
            active_aus (list): Lista de AUs ativas (ex: ['AU4', 'AU7'])
            gaze_status (str): Estado do olhar (DIRECT, THINKING_UP, etc)
            vad_status (bool): Se o cliente está falando
            
        Returns:
            dict: Objeto de Insight formatado ou None
        """
        current_time = time.time()
        
        # ---------------------------------------------------------
        # 1. FILTROS DE CONTEXTO (PRIORIDADE MÁXIMA)
        # ---------------------------------------------------------
        
        # Regra: Nunca interromper quando o cliente está falando
        if vad_status: 
            return None 
            
        # Regra: Detectar "Pensando" (Desvio de Olhar)
        if "THINKING" in gaze_status:
            if (current_time - self.last_insight_time) > self.COOLDOWN_SECONDS:
                self.last_insight_time = current_time
                return {
                    "type": "STATE_INSIGHT",
                    "label": "PROCESSAMENTO COGNITIVO",
                    "text": "O cliente está buscando informações ou refletindo.",
                    "action": "SILENCIO TOTAL", # Instrução clara pro vendedor
                    "suggested_phrase": "..."
                }
            return None

        # ---------------------------------------------------------
        # 2. CÁLCULO DE PONTUAÇÃO (SCORING)
        # ---------------------------------------------------------
        
        # Inicializa placar zerado
        scores = {dim: 0.0 for dim in self.dimensions.keys()}
        # Adiciona dimensões extras que podem não estar no JSON mas usamos na lógica
        for extra in ["resistance", "stress_load", "incongruence_risk", "engagement", "affiliation", "approval", "aversion"]:
            if extra not in scores: scores[extra] = 0.0
            
        # Soma pontos baseados nas AUs ativas
        for au in active_aus:
            if au in self.AU_WEIGHTS:
                weights = self.AU_WEIGHTS[au]
                for dim, points in weights.items():
                    if dim in scores:
                        scores[dim] += points

        # ---------------------------------------------------------
        # 3. SELEÇÃO DO VENCEDOR
        # ---------------------------------------------------------
        
        # Filtra pontuações muito baixas (Ruído)
        # Ex: Só considera se a soma for maior que 35 pontos
        ACTIVATION_THRESHOLD = 35 
        valid_scores = {k: v for k, v in scores.items() if v >= ACTIVATION_THRESHOLD}
        
        if not valid_scores:
            return None # Nenhuma emoção forte o suficiente

        # Encontra a dimensão dominante (a que tem maior pontuação)
        dominant_dim = max(valid_scores, key=valid_scores.get)
        score_val = valid_scores[dominant_dim]
        
        # ---------------------------------------------------------
        # 4. GERAÇÃO DO INSIGHT
        # ---------------------------------------------------------
        
        if (current_time - self.last_insight_time) > self.COOLDOWN_SECONDS:
            self.last_insight_time = current_time
            
            # Busca dados no JSON carregado
            dim_data = self.dimensions.get(dominant_dim, {})
            
            # Tenta pegar campos do JSON, ou usa Fallbacks genéricos
            description = dim_data.get("desc", f"Nível de {dominant_dim} elevado.")
            
            # Pega ação recomendada (JSON V1 structure: "action": "...")
            action = dim_data.get("action", "OBSERVAR E SONDAR")
            
            # Seleciona uma pergunta sugerida aleatória
            questions = dim_data.get("questions", [])
            phrase = random.choice(questions) if questions else "Poderia me contar mais sobre isso?"
            
            # Define cor ou rótulo baseado na polaridade (apenas para log/debug)
            label_text = f"{dominant_dim.upper()} ({int(score_val)} pts)"
            
            return {
                "type": "DIMENSIONAL_INSIGHT",
                "label": label_text,
                "text": description,
                "action": action.upper(),  # Ex: "CALIBRAR", "FECHAR"
                "suggested_phrase": phrase,
                "detected_aus": active_aus # Útil para debug
            }
            
        return None
