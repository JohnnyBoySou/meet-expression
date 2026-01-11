# Quick Start - Uso no React

## Resumo Rápido

### O Que Você Precisa Passar

1. **MediaPipe FaceLandmarker** ✅ (passado como parâmetro)
2. **OpenCV** ✅ (já incluído, não precisa passar)

### Instalação

```bash
npm install @mediapipe/tasks-vision @techstark/opencv-js
```

### Código Mínimo

```typescript
import { createFaceExpressionEngine } from '@meet-expression/core';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import facsConfig from './config/FACS_IA_decision_ready_v1.json';

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
  { facsConfig },
  faceLandmarker // ← MediaPipe aqui
);

// 3. Usar
engine.onResult((result) => {
  console.log('AUs:', result.aus);
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
│   ├── config/
│   │   └── FACS_IA_decision_ready_v1.json
│   └── components/
│       └── FaceExpression.tsx
```

### Parâmetros da Função

```typescript
createFaceExpressionEngine(
  options: {
    facsConfig: FACSConfig,        // OBRIGATÓRIO
    thresholdsConfig?: ThresholdsConfig, // Opcional
    windowSeconds?: number,        // Opcional (padrão: 4.0)
    fps?: number,                  // Opcional (padrão: 30)
  },
  faceLandmarker: MediaPipeFaceLandmarker // OBRIGATÓRIO
)
```

### Sobre o OpenCV

- ✅ Já está incluído no módulo
- ✅ Carregado automaticamente quando necessário
- ✅ Você **NÃO precisa** passar nada relacionado ao OpenCV

### Ver Documentação Completa

- `USAGE_REACT.md` - Guia completo com exemplos
- `REACT_EXAMPLE.tsx` - Componente React completo
