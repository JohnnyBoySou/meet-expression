import json
import numpy as np

class SalesScoringEngine:
    def __init__(self, rules_json_path):
        with open(rules_json_path, 'r', encoding='utf-8') as f:
            self.rules = json.load(f)
        self.weights = self.rules.get('weights_by_code', {})
        self.combos = self.rules.get('combo_rules', [])
        self.dimensions_list = list(self.rules.get('dimensions', {}).keys())

    def process(self, input_payload):
        aus = input_payload.get("aus", {})
        meta = input_payload.get("meta", {})
        
        scores = {dim: 0.0 for dim in self.dimensions_list}
        active_codes = [k for k, v in aus.items() if v > 0.15]

        # Somar Pesos do JSON
        for code in active_codes:
            if code in self.weights:
                intensity = aus[code]
                for dim, weight in self.weights[code].items():
                    scores[dim] += weight * intensity

        # Verificar Combos do JSON
        triggered_combos = []
        for combo in self.combos:
            if all(req in active_codes for req in combo['requires']):
                triggered_combos.append(combo['tag'])
                for dim, adj in combo.get('adjustments', {}).items():
                    scores[dim] += adj

        final_scores = {k: max(-100, min(100, v)) for k, v in scores.items()}
        dom_dim = max(final_scores, key=lambda k: abs(final_scores[k]))

        return {
            "dominant_dimension": dom_dim,
            "dominant_value": int(final_scores[dom_dim]),
            "active_combos": triggered_combos,
            "scores": final_scores,
            "recommended_actions": [self.rules['default_actions_questions'].get(dom_dim, {}).get('action', "Analise mais")],
            "questions": self.rules['default_actions_questions'].get(dom_dim, {}).get('questions', [])
        }
