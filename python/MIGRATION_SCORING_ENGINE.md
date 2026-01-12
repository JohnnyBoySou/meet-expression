# Migração do Scoring Engine para o Backend

## O que o Scoring Engine precisa para processar

### 1. **Entrada (WindowPayload)**
```typescript
{
  aus: {
    "AU1": 0.5,
    "AU4": 0.3,
    "AU12": 0.8,
    // ... outros AUs
  },
  meta: {
    gaze: "LOOKING_DOWN" | "CENTER" | "DIRECT" | "THINKING_UP" | "THINKING_DOWN" | "SIDEWAY",
    is_speaking: boolean,
    head_yaw: number,      // -180 a 180
    head_pitch: number     // -180 a 180
  }
}
```

### 2. **Configuração (FACSConfig)**
O engine precisa do arquivo JSON de configuração que contém:
- `weights_by_code`: Pesos de cada AU/código para cada dimensão
- `combo_rules`: Regras de combinação de AUs
- `dimensions`: Lista de dimensões (engagement, approval, resistance, etc.)
- `default_actions_questions`: Ações e perguntas recomendadas por dimensão

**Localização atual:** `python/config/FACS_IA_decision_ready_v1.json`

### 3. **Saída (ExpressionResult)**
```typescript
{
  dominant_dimension: string,        // Ex: "engagement", "resistance"
  dominant_value: number,            // -100 a 100
  active_combos: string[],           // Tags dos combos ativados
  scores: Record<string, number>,    // Pontuação de todas as dimensões
  recommended_actions: string[],     // Ações recomendadas
  questions: string[]                // Perguntas sugeridas
}
```

## Lógica de Processamento

1. **Processa AUs**: Para cada AU ativo, calcula multiplicador de intensidade (s(I)) e aplica pesos
2. **Processa Meta Signals**: Gaze e Head Pitch geram códigos especiais (GAZE64, HEAD53, HEAD54)
3. **Aplica Combos**: Verifica regras de combinação que requerem múltiplos códigos
4. **Calcula Dimensão Dominante**: Encontra a dimensão com maior valor absoluto
5. **Retorna Resultado**: Inclui ações e perguntas baseadas na dimensão dominante

## Implementação no Backend

### Opção 1: API REST (Recomendado)
Criar um endpoint `/api/score` que:
- Recebe `WindowPayload` via POST
- Processa usando `SalesScoringEngine` (já existe em Python)
- Retorna `ExpressionResult` como JSON

### Opção 2: WebSocket
Para processamento em tempo real, usar WebSocket para:
- Receber `WindowPayload` continuamente
- Enviar `ExpressionResult` de volta

## Dependências

O `scoring_engine.py` já existe e funciona! Ele precisa apenas de:
- Python 3.8+
- `json` (built-in)
- `numpy` (já está em requirements.txt)

## Próximos Passos

1. ✅ **Backend Python já tem o engine** (`python/logic/scoring_engine.py`)
2. ⏳ **Criar API server** (Flask/FastAPI) com endpoint `/api/score`
3. ⏳ **Modificar frontend TypeScript** para chamar API ao invés de processar localmente
4. ⏳ **Remover ou ocultar** `typescript/logic/scoring_engine.ts` do bundle público
