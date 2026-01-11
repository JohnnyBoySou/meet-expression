# Face Expression Analysis Engine - TypeScript Module

TypeScript module for face expression analysis using MediaPipe FaceLandmarker. Converted from Python for use with React and browser environments.

## Features

- **Action Unit (AU) Detection**: Detects 21+ facial action units from MediaPipe blendshapes
- **Gaze Tracking**: Calculates attention vector combining head rotation and iris position
- **Voice Activity Detection**: Visual detection of speech using mouth geometry
- **Baseline Management**: Dynamic baseline calculation for individual users
- **Temporal Analysis**: Classifies expressions as micro or macro
- **Scoring Engine**: Calculates emotional dimensions (engagement, approval, resistance, etc.)
- **Smooth Processing**: EMA filtering to eliminate flicker and noise

## Installation

### No Projeto React

```bash
npm install @mediapipe/tasks-vision @techstark/opencv-js
# or
yarn add @mediapipe/tasks-vision @techstark/opencv-js
```

### Baixar Modelo MediaPipe

Baixe o arquivo `face_landmarker.task` de:
- https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task

Coloque em `public/models/face_landmarker.task` no seu projeto React.

## O Que Você Precisa Passar

O módulo precisa de **2 coisas principais**:

1. **MediaPipe FaceLandmarker** - Instância inicializada do MediaPipe (passado como parâmetro)
2. **OpenCV** - Já está incluído internamente via `@techstark/opencv-js`, não precisa passar nada

## Usage

### Basic Setup

```typescript
import { createFaceExpressionEngine } from '@meet-expression/core';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import facsConfig from './config/FACS_IA_decision_ready_v1.json';

// 1. Inicializar MediaPipe FaceLandmarker (OBRIGATÓRIO)
const filesetResolver = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/wasm'
);

const faceLandmarker = await FaceLandmarker.createFromOptions(
  filesetResolver,
  {
    baseOptions: {
      modelAssetPath: '/models/face_landmarker.task', // Caminho para o modelo
    },
    outputFaceBlendshapes: true, // CRÍTICO: precisa estar true
    runningMode: 'VIDEO', // Modo vídeo para processamento contínuo
    numFaces: 1,
  }
);

// 2. Criar o engine (MediaPipe é passado como parâmetro)
const engine = createFaceExpressionEngine(
  {
    facsConfig: facsConfig, // OBRIGATÓRIO: Config JSON com regras
    windowSeconds: 4.0, // Opcional: padrão 4.0
    fps: 30, // Opcional: padrão 30
    // thresholdsConfig é opcional, usa default se não fornecido
  },
  faceLandmarker // OBRIGATÓRIO: MediaPipe FaceLandmarker passado aqui
);

// 3. Configurar callbacks
engine.onResult((result) => {
  console.log('Frame result:', result.aus, result.meta);
});

engine.onDecision((decision) => {
  console.log('Decision:', decision.dominant_dimension, decision.dominant_value);
});

// 4. Processar frames (processFrame é async)
const video = document.getElementById('video') as HTMLVideoElement;
await engine.processFrame(video);
```

**Nota sobre OpenCV**: O OpenCV é carregado automaticamente quando necessário. Você não precisa fazer nada além de ter `@techstark/opencv-js` instalado.

### React Hook Example

```typescript
import { useEffect, useRef, useState } from 'react';
import { createFaceExpressionEngine, type FrameResult } from '@meet-expression/core';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export function useFaceExpression() {
  const [result, setResult] = useState<FrameResult | null>(null);
  const engineRef = useRef<ReturnType<typeof createFaceExpressionEngine> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    async function init() {
      // Load FACS config
      const facsConfig = await fetch('/config/FACS_IA_decision_ready_v1.json')
        .then(r => r.json());

      // Initialize MediaPipe
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/wasm'
      );

      const faceLandmarker = await FaceLandmarker.createFromOptions(
        filesetResolver,
        {
          baseOptions: {
            modelAssetPath: '/models/face_landmarker.task',
          },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        }
      );

      // Create engine
      const engine = createFaceExpressionEngine(
        {
          facsConfig,
          windowSeconds: 4.0,
          fps: 30,
        },
        faceLandmarker
      );

      engine.onResult(setResult);

      engineRef.current = engine;

      // Start video processing
      if (videoRef.current) {
        const video = videoRef.current;
        video.addEventListener('loadeddata', () => {
          processVideo(video, engine);
        });
      }
    }

    init();
  }, []);

  function processVideo(video: HTMLVideoElement, engine: ReturnType<typeof createFaceExpressionEngine>) {
    function frame() {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        engine.processFrame(video);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  return { result, videoRef, engineRef };
}
```

## Configuration

### Thresholds Config

```typescript
import { defaultThresholdsConfig } from '@meet-expression/core';

// Customize config
const customConfig = {
  ...defaultThresholdsConfig,
  baseline: {
    window_size: 120,
    warmup_frames: 60,
  },
};
```

### FACS Config

Load the FACS configuration JSON file:

```typescript
import facsConfig from './config/FACS_IA_decision_ready_v1.json';
```

## API Reference

### createFaceExpressionEngine

Main orchestration function. Returns an engine object with methods.

#### Usage

```typescript
const engine = createFaceExpressionEngine(options, faceLandmarker);
```

#### Methods

- `processFrame(frame: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageData)`: Process a single frame
- `calibrate(currentAus: ActionUnits)`: Calibrate neutral face baseline
- `resetCalibration()`: Reset calibration
- `getCurrentDecision()`: Get current decision result
- `getTimeSeriesAnalyzer()`: Get time series analyzer instance
- `clearBuffer()`: Clear window buffer
- `onResult(callback: (result: FrameResult) => void)`: Set frame result callback
- `onDecision(callback: (decision: ExpressionResult) => void)`: Set decision update callback

### FrameResult

```typescript
interface FrameResult {
  aus: ActionUnits;           // Detected action units
  meta: MetaSignals;          // Gaze, head pose, voice activity
  rotPenalty?: number;        // Rotation penalty (0-1)
  isStable: boolean;          // Whether baseline is stable
  currentDecision?: ExpressionResult; // Current emotional dimension decision
}
```

### ExpressionResult

```typescript
interface ExpressionResult {
  dominant_dimension: string;  // e.g., "engagement", "approval", "resistance"
  dominant_value: number;      // -100 to +100
  active_combos: string[];     // Triggered combo rules
  scores: Record<string, number>; // All dimension scores
  recommended_actions: string[];  // Recommended actions
  questions: string[];         // Suggested questions
}
```

## Action Units Detected

The engine detects the following Action Units:

- AU1: Inner Brow Raiser
- AU2: Outer Brow Raiser
- AU4: Brow Lowerer
- AU5: Upper Lid Raiser
- AU6: Cheek Raiser
- AU7: Lid Tightener
- AU9: Nose Wrinkler
- AU10: Upper Lip Raiser
- AU12: Lip Corner Puller (Smile)
- AU14: Dimpler
- AU15: Lip Corner Depressor
- AU17: Chin Raiser
- AU18: Lip Puckerer
- AU20: Lip Stretcher
- AU23: Lip Tightener
- AU24: Lip Pressor
- AU25: Lips Part
- AU26: Jaw Drop
- AU28: Lip Suck
- AU43: Eyes Closed
- AU45: Blink

## Emotional Dimensions

The scoring engine calculates scores for:

- **engagement**: Engagement/attention (tendency to participate)
- **affiliation**: Affection/approach (tendency to bond/welcome)
- **approval**: Approval/alignment with proposal
- **resistance**: Resistance/blocking (tendency to disagree/close)
- **stress_load**: Cognitive load/stress (overload/pressure)
- **aversion**: Aversion/disgust/contempt (stimulus rejection)
- **incongruence_risk**: Risk of incongruence (speech vs signals) / retention

## License

Private project
