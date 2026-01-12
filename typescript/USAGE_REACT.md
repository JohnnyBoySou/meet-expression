# Como Usar o Módulo no React

Este guia explica como integrar o módulo `@meet-expression/core` no seu projeto React.

## Dependências Necessárias

### 1. Instalar no Projeto React

```bash
bun add @mediapipe/tasks-vision
```

### 2. Baixar o Modelo MediaPipe

Você precisa do arquivo `face_landmarker.task` do MediaPipe. Baixe de:
- https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task

Coloque o arquivo na pasta `public/models/` do seu projeto React.

## O Que Você Precisa Passar

O módulo precisa de **1 coisa principal**:

1. **MediaPipe FaceLandmarker** - Instância inicializada do MediaPipe

## Exemplo Completo de Uso

### 1. Hook Customizado para Face Expression

Crie um arquivo `hooks/useFaceExpression.ts`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { createFaceExpressionEngine, type FrameResult, type ExpressionResult } from '@meet-expression/core';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import facsConfig from '../config/FACS_IA_decision_ready_v1.json';

export function useFaceExpression() {
  const [result, setResult] = useState<FrameResult | null>(null);
  const [decision, setDecision] = useState<ExpressionResult | null>(null);
  const [isReady, setIsReady] = useState(false);
  const engineRef = useRef<ReturnType<typeof createFaceExpressionEngine> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    async function init() {
      try {
        // 1. Inicializar MediaPipe FaceLandmarker
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/wasm'
        );

        const faceLandmarker = await FaceLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: {
              modelAssetPath: '/models/face_landmarker.task', // Caminho para o modelo
            },
            outputFaceBlendshapes: true, // IMPORTANTE: precisa estar true
            runningMode: 'VIDEO', // Modo vídeo para processamento contínuo
            numFaces: 1, // Número de faces a detectar
          }
        );

        // 2. Criar o engine (MediaPipe é passado como parâmetro)
        const engine = createFaceExpressionEngine(
          {
            facsConfig: facsConfig, // Configuração FACS (regras de decisão)
            windowSeconds: 4.0, // Janela de análise (4 segundos)
            fps: 30, // FPS esperado
            // thresholdsConfig é opcional, usa default se não fornecido
          },
          faceLandmarker // MediaPipe FaceLandmarker passado aqui
        );

        // 3. Configurar callbacks
        engine.onResult((frameResult) => {
          setResult(frameResult);
        });

        engine.onDecision((decisionResult) => {
          setDecision(decisionResult);
          console.log('Decisão:', decisionResult.dominant_dimension, decisionResult.dominant_value);
        });

        engineRef.current = engine;
        setIsReady(true);
      } catch (error) {
        console.error('Erro ao inicializar Face Expression Engine:', error);
      }
    }

    init();
  }, []);

  // Processar frames do vídeo
  useEffect(() => {
    if (!isReady || !engineRef.current || !videoRef.current) return;

    const video = videoRef.current;
    const engine = engineRef.current;

    function processFrame() {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // processFrame é async, então precisa await
        engine.processFrame(video).catch((error) => {
          console.warn('Erro ao processar frame:', error);
        });
      }
      requestAnimationFrame(processFrame);
    }

    const frameId = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(frameId);
  }, [isReady]);

  // Funções de controle
  const calibrate = () => {
    if (result?.aus && engineRef.current) {
      engineRef.current.calibrate(result.aus);
      console.log('Calibração realizada');
    }
  };

  const resetCalibration = () => {
    if (engineRef.current) {
      engineRef.current.resetCalibration();
      console.log('Calibração resetada');
    }
  };

  return {
    result,
    decision,
    isReady,
    videoRef,
    calibrate,
    resetCalibration,
  };
}
```

### 2. Componente React de Exemplo

```typescript
import React from 'react';
import { useFaceExpression } from './hooks/useFaceExpression';

export function FaceExpressionDemo() {
  const { result, decision, isReady, videoRef, calibrate, resetCalibration } = useFaceExpression();

  return (
    <div>
      <h1>Face Expression Analysis</h1>
      
      {/* Vídeo da webcam */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '640px', height: '480px' }}
      />

      {/* Status */}
      {!isReady && <p>Inicializando...</p>}
      
      {isReady && (
        <div>
          <button onClick={calibrate}>Calibrar (C)</button>
          <button onClick={resetCalibration}>Reset Calibração (R)</button>
        </div>
      )}

      {/* Resultados */}
      {result && (
        <div>
          <h2>Action Units (AUs)</h2>
          <div>
            {Object.entries(result.aus).map(([au, value]) => (
              <div key={au}>
                {au}: {value.toFixed(3)}
              </div>
            ))}
          </div>

          <h2>Meta Signals</h2>
          <div>
            <p>Gaze: {result.meta.gaze}</p>
            <p>Falando: {result.meta.is_speaking ? 'Sim' : 'Não'}</p>
            <p>Head Yaw: {result.meta.head_yaw.toFixed(2)}°</p>
            <p>Head Pitch: {result.meta.head_pitch.toFixed(2)}°</p>
          </div>
        </div>
      )}

      {/* Decisão */}
      {decision && (
        <div>
          <h2>Decisão</h2>
          <p>
            <strong>{decision.dominant_dimension.toUpperCase()}</strong>: {decision.dominant_value}
          </p>
          {decision.recommended_actions.length > 0 && (
            <div>
              <h3>Ações Recomendadas:</h3>
              <ul>
                {decision.recommended_actions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 3. Inicializar Webcam no React

```typescript
import { useEffect, useRef } from 'react';

export function useWebcam() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    async function startWebcam() {
      if (!videoRef.current) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Erro ao acessar webcam:', error);
      }
    }

    startWebcam();

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return videoRef;
}
```

## Resumo: O Que Passar para o Módulo

### createFaceExpressionEngine(options, faceLandmarker)

**Parâmetros:**

1. **options** (objeto):
   ```typescript
   {
     facsConfig: FACSConfig,        // OBRIGATÓRIO: Config JSON com regras
     thresholdsConfig?: ThresholdsConfig, // Opcional: usa default se não fornecido
     windowSeconds?: number,        // Opcional: padrão 4.0
     fps?: number,                  // Opcional: padrão 30
   }
   ```

2. **faceLandmarker** (MediaPipe FaceLandmarker):
   ```typescript
   // OBRIGATÓRIO: Instância inicializada do MediaPipe
   const faceLandmarker = await FaceLandmarker.createFromOptions(...)
   ```

### Sobre o Scoring

O **scoring agora é feito no backend** via API. Configure a URL da API nas opções do engine:

```typescript
const engine = createFaceExpressionEngine(
  {
    apiUrl: 'http://localhost:8000/api/score', // URL da API do backend
    windowSeconds: 4.0,
    fps: 30,
  },
  faceLandmarker
);
```

## Estrutura de Arquivos Recomendada

```
seu-projeto-react/
├── public/
│   └── models/
│       └── face_landmarker.task  # Modelo MediaPipe
├── src/
│   ├── config/
│   │   └── FACS_IA_decision_ready_v1.json  # Config FACS
│   ├── hooks/
│   │   └── useFaceExpression.ts
│   └── components/
│       └── FaceExpressionDemo.tsx
└── package.json
```

## Notas Importantes

1. **MediaPipe**: Deve ser inicializado **antes** de criar o engine
2. **API Backend**: Configure a URL da API para processar o scoring
3. **processFrame**: É **async**, então use `await` ou `.catch()`
4. **Calibração**: Chame `calibrate()` quando a pessoa estiver com rosto neutro
5. **Modelo MediaPipe**: Deve estar acessível via URL pública ou no `public/`

## Troubleshooting

### Erro: "Cannot find module '@meet-expression/core'"
- Certifique-se de que o módulo está instalado ou linkado corretamente
- Se estiver em desenvolvimento local, use `npm link` ou configure path mapping no `tsconfig.json`

### Erro: "API request failed"
- Verifique se o backend está rodando
- Verifique se a URL da API está correta nas opções do engine
- O módulo retorna um resultado padrão em caso de erro da API

### Erro: "FaceLandmarker not initialized"
- Certifique-se de que o MediaPipe foi inicializado corretamente
- Verifique se o caminho do modelo está correto
- Verifique se `outputFaceBlendshapes: true` está configurado
