import json
import numpy as np

class SalesScoringEngine:
    def __init__(self, rules_json_path):
        with open(rules_json_path, 'r', encoding='utf-8') as f:
            self.rules = json.load(f)
        
        self.weights = self.rules.get('weights_by_code', {})
        self.combos = self.rules.get('combo_rules', [])
        self.dimensions_list = list(self.rules.get('dimensions', {}).keys())
        self.actions_map = self.rules.get('default_actions_questions', {})

    def _get_intensity_multiplier(self, value, is_au=True):
        """
        Implementa s(I) = r(I)/5 conforme a equação.
        Se for AU: mapeia o valor contínuo para os degraus A-E.
        Se for Meta (Gaze/Head): s(vazio) = 1.0.
        """
        if not is_au:
            return 1.0 # s(vazio) = 1.0 para GAZE e HEAD
        
        # Mapeamento s(I) para intensidades FACS (A=0.2 a E=1.0)
        if value >= 0.8: return 1.0 # E
        if value >= 0.6: return 0.8 # D
        if value >= 0.4: return 0.6 # C
        if value >= 0.2: return 0.4 # B
        if value >= 0.1: return 0.2 # A
        return 0.0

    def process(self, input_payload):
        aus = input_payload.get("aus", {})
        meta = input_payload.get("meta", {})
        
        scores = {dim: 0.0 for dim in self.dimensions_list}
        active_codes = []

        # 1. Processar AUs: Σ s(Ii) * Wc,d
        for code, raw_val in aus.items():
            s_i = self._get_intensity_multiplier(raw_val, is_au=True)
            if s_i > 0 and code in self.weights:
                active_codes.append(code)
                for dim, weight in self.weights[code].items():
                    scores[dim] += s_i * weight

        # 2. Processar Meta (Gaze/Head): s(vazio)=1.0 * Wc,d
        # Tradução manual para os códigos do teu JSON
        meta_signals = []
        gaze = meta.get('gaze', 'CENTER')
        if gaze == "LOOKING_DOWN": meta_signals.append("GAZE64")
        
        pitch = meta.get('head_pitch', 0)
        if pitch > 15: meta_signals.append("HEAD54")
        elif pitch < -15: meta_signals.append("HEAD53")

        for m_code in meta_signals:
            if m_code in self.weights:
                active_codes.append(m_code)
                for dim, weight in self.weights[m_code].items():
                    scores[dim] += 1.0 * weight # s(vazio) = 1.0

        # 3. Aplicar Combos: Σ ak,d
        triggered_combos = []
        for combo in self.combos:
            if all(req in active_codes for req in combo['requires']):
                triggered_combos.append(combo['tag'])
                for dim, adj in combo.get('adjustments', {}).items():
                    scores[dim] += adj

        # 4. Clamp Final: clamp[-100, 100]
        final_scores = {k: max(-100, min(100, v)) for k, v in scores.items()}
        
        # Dimensão dominante para o HUD
        dom_dim = max(final_scores, key=lambda k: abs(final_scores[k]))
        
        return {
            "dominant_dimension": dom_dim,
            "dominant_value": int(final_scores[dom_dim]),
            "active_combos": triggered_combos,
            "scores": final_scores,
            "recommended_actions": [self.actions_map.get(dom_dim, {}).get('action', "Analise")],
            "questions": self.actions_map.get(dom_dim, {}).get('questions', [])
        }
