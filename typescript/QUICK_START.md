# Quick Start - Uso no React

## Resumo Rápido

### O Que Você Precisa Instalar e Passar

1. **MediaPipe FaceLandmarker** ✅ (instalar + passar como parâmetro)
2. **FACS Config** ✅ (opcional - scoring agora é feito no backend via API)

### Instalação Obrigatória

**IMPORTANTE**: Você precisa instalar o MediaPipe no seu projeto frontend:

```bash
npm install @mediapipe/tasks-vision
# ou
yarn add @mediapipe/tasks-vision
# ou
bun add @mediapipe/tasks-vision
```

### Código Mínimo

```typescript
import { 
  createFaceExpressionEngine, 
  defaultFACSConfig,
  type ExpressionResult,
  type FrameResult 
} from '@meet-expression/core';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// 1. Inicializar MediaPipe
const filesetResolver = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/wasm'
);

const faceLandmarker = await FaceLandmarker.createFromOptions(
  filesetResolver,
  {
    baseOptions: {
      modelAssetPath: '/models/face_landmarker.task',
    },
    outputFaceBlendshapes: true, // IMPORTANTE!
    runningMode: 'VIDEO',
    numFaces: 1,
  }
);

// 2. Criar engine (MediaPipe passado aqui)
const engine = createFaceExpressionEngine(
  { facsConfig: defaultFACSConfig }, // Usa a config padrão do módulo
  faceLandmarker // ← MediaPipe aqui
);

// 3. Usar com tipos
engine.onResult((result: FrameResult) => {
  console.log('AUs:', result.aus);
  console.log('Meta:', result.meta);
});

engine.onDecision((decision: ExpressionResult) => {
  console.log('Decisão:', decision.dominant_dimension, decision.dominant_value);
});

// Processar frame (async)
await engine.processFrame(videoElement);
```

### Estrutura de Arquivos

```
projeto-react/
├── public/
│   └── models/
│       └── face_landmarker.task  ← Baixar do MediaPipe
├── src/
│   └── components/
│       └── FaceExpression.tsx
```

**Nota**: O `FACS_IA_decision_ready_v1.json` agora está incluído no módulo e pode ser importado como `defaultFACSConfig`. Não é necessário copiar o arquivo JSON para o seu projeto!

### Usando Configuração Customizada

Se você quiser usar uma configuração FACS personalizada:

```typescript
import { createFaceExpressionEngine } from '@meet-expression/core';
import type { FACSConfig } from '@meet-expression/core';
import myCustomFACSConfig from './my-custom-facs-config.json';

const engine = createFaceExpressionEngine(
  { facsConfig: myCustomFACSConfig as FACSConfig },
  faceLandmarker
);
```

### Parâmetros da Função

```typescript
createFaceExpressionEngine(
  options: {
    facsConfig: FACSConfig,        // OBRIGATÓRIO (use defaultFACSConfig)
    thresholdsConfig?: ThresholdsConfig, // Opcional
    windowSeconds?: number,        // Opcional (padrão: 4.0)
    fps?: number,                  // Opcional (padrão: 30)
  },
  faceLandmarker: MediaPipeFaceLandmarker // OBRIGATÓRIO
)
```

### Sobre o Scoring

- ✅ O scoring agora é feito no backend via API
- ✅ Configure a URL da API nas opções: `apiUrl: 'http://localhost:8000/api/score'`
- ✅ O módulo usa landmark-based flow (rápido, sem dependências externas)

### Ver Documentação Completa

- `USAGE_REACT.md` - Guia completo com exemplos
- `REACT_EXAMPLE.tsx` - Componente React completo
