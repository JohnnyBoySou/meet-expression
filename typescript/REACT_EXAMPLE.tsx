/**
 * Exemplo completo de uso do módulo no React
 * 
 * Este arquivo demonstra como:
 * 1. Inicializar o MediaPipe FaceLandmarker
 * 2. Criar o engine
 * 3. Processar frames do vídeo
 * 4. Exibir resultados
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useEffect, useRef, useState } from 'react';
import facsConfig from './config/FACS_IA_decision_ready_v1.json';
import { createFaceExpressionEngine, type FrameResult } from './index';
import type { ExpressionResult } from './types/index';

interface FaceExpressionDemoProps {
  modelPath?: string;
  windowSeconds?: number;
  fps?: number;
}

export function FaceExpressionDemo({
  modelPath = '/models/face_landmarker.task',
  windowSeconds = 4.0,
  fps = 30,
}: FaceExpressionDemoProps) {
  const [result, setResult] = useState<FrameResult | null>(null);
  const [decision, setDecision] = useState<ExpressionResult | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);

  const engineRef = useRef<ReturnType<typeof createFaceExpressionEngine> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Inicializar MediaPipe e Engine
  useEffect(() => {
    async function init() {
      try {
        setError(null);

        // 1. Inicializar MediaPipe FaceLandmarker
        console.log('Inicializando MediaPipe...');
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/wasm'
        );

        const faceLandmarker = await FaceLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: {
              modelAssetPath: modelPath,
            },
            outputFaceBlendshapes: true, // CRÍTICO: precisa estar true
            runningMode: 'VIDEO',
            numFaces: 1,
          }
        );

        console.log('MediaPipe inicializado com sucesso');

        // 2. Criar o engine
        console.log('Criando Face Expression Engine...');
        const engine = createFaceExpressionEngine(
          {
            facsConfig: facsConfig,
            windowSeconds,
            fps,
          },
          faceLandmarker // MediaPipe passado aqui
        );

        // 3. Configurar callbacks
        engine.onResult((frameResult) => {
          setResult(frameResult);
        });

        engine.onDecision((decisionResult) => {
          setDecision(decisionResult);
          console.log('Nova decisão:', {
            dimension: decisionResult.dominant_dimension,
            value: decisionResult.dominant_value,
          });
        });

        engineRef.current = engine;
        setIsReady(true);
        console.log('Engine pronto!');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(`Erro ao inicializar: ${errorMessage}`);
        console.error('Erro ao inicializar:', err);
      }
    }

    init();
  }, [modelPath, windowSeconds, fps]);

  // Inicializar webcam
  useEffect(() => {
    async function startWebcam() {
      if (!videoRef.current) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 1280,
            height: 720,
            facingMode: 'user',
          },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError('Erro ao acessar webcam. Verifique as permissões.');
        console.error('Erro ao acessar webcam:', err);
      }
    }

    if (isReady) {
      startWebcam();
    }

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, [isReady]);

  // Processar frames
  useEffect(() => {
    if (!isReady || !engineRef.current || !videoRef.current) return;

    const video = videoRef.current;
    const engine = engineRef.current;
    let animationFrameId: number;

    function processFrame() {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // processFrame é async
        engine.processFrame(video).catch((err) => {
          console.warn('Erro ao processar frame:', err);
        });
      }
      animationFrameId = requestAnimationFrame(processFrame);
    }

    animationFrameId = requestAnimationFrame(processFrame);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isReady]);

  // Funções de controle
  const handleCalibrate = () => {
    if (result?.aus && engineRef.current) {
      engineRef.current.calibrate(result.aus);
      setIsCalibrated(true);
      console.log('Calibração realizada');
    }
  };

  const handleResetCalibration = () => {
    if (engineRef.current) {
      engineRef.current.resetCalibration();
      setIsCalibrated(false);
      console.log('Calibração resetada');
    }
  };

  // Renderizar Action Units
  const renderActionUnits = () => {
    if (!result) return null;

    const aus = Object.entries(result.aus)
      .filter(([_, value]) => value && typeof value === 'number' && value > 0.05) // Mostrar apenas AUs ativas
      .sort(([_, a], [__, b]) => (b as number) - (a as number))
      .slice(0, 10); // Top 10

    return (
      <div style={{ marginTop: '20px' }}>
        <h3>Action Units Ativas (Top 10)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {aus.map(([au, value]) => (
            <div
              key={au}
              style={{
                padding: '8px',
                backgroundColor: value && typeof value === 'number' && value > 0.35 ? '#4caf50' : value && typeof value === 'number' && value > 0.1 ? '#ff9800' : '#9e9e9e',
                borderRadius: '4px',
                color: 'white',
              }}
            >
              <strong>{au}</strong>: {value && typeof value === 'number' ? value.toFixed(3) : '0.000'}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Face Expression Analysis Demo</h1>

      {error && (
        <div style={{ padding: '10px', backgroundColor: '#f44336', color: 'white', borderRadius: '4px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {!isReady && (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>Inicializando engine...</p>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Carregando MediaPipe e OpenCV...
          </p>
        </div>
      )}

      {isReady && (
        <div>
          {/* Controles */}
          <div style={{ marginBottom: '20px' }}>
            <button
              type="button"
              onClick={handleCalibrate}
              disabled={!result}
              style={{
                padding: '10px 20px',
                marginRight: '10px',
                backgroundColor: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: result ? 'pointer' : 'not-allowed',
              }}
            >
              Calibrar (C)
            </button>
            <button
              type="button"
              onClick={handleResetCalibration}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Reset Calibração (R)
            </button>
            {isCalibrated && (
              <span style={{ marginLeft: '10px', color: '#4caf50' }}>
                ✓ Calibrado
              </span>
            )}
          </div>

          {/* Vídeo */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '640px',
                height: '480px',
                border: '2px solid #333',
                borderRadius: '8px',
              }}
            />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              style={{
                border: '2px solid #333',
                borderRadius: '8px',
              }}
            />
          </div>

          {/* Resultados */}
          {result && (
            <div>
              <h2>Resultados do Frame</h2>

              {/* Meta Signals */}
              <div style={{ marginBottom: '20px' }}>
                <h3>Meta Signals</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <div>
                    <strong>Gaze:</strong> {result.meta.gaze}
                  </div>
                  <div>
                    <strong>Falando:</strong> {result.meta.is_speaking ? 'Sim' : 'Não'}
                  </div>
                  <div>
                    <strong>Head Yaw:</strong> {result.meta.head_yaw.toFixed(2)}°
                  </div>
                  <div>
                    <strong>Head Pitch:</strong> {result.meta.head_pitch.toFixed(2)}°
                  </div>
                  {result.rotPenalty !== undefined && (
                    <div>
                      <strong>Rotation Penalty:</strong> {result.rotPenalty.toFixed(3)}
                    </div>
                  )}
                  <div>
                    <strong>Estável:</strong> {result.isStable ? 'Sim' : 'Não'}
                  </div>
                </div>
              </div>

              {/* Action Units */}
              {renderActionUnits()}
            </div>
          )}

          {/* Decisão */}
          {decision && (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
              <h2>Decisão Atual</h2>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>
                {decision.dominant_dimension.toUpperCase()}: {decision.dominant_value}
              </div>

              {decision.recommended_actions.length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  <h3>Ações Recomendadas:</h3>
                  <ul>
                    {decision.recommended_actions.map((action, i) => (
                      <li key={i}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}

              {decision.questions.length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  <h3>Perguntas Sugeridas:</h3>
                  <ul>
                    {decision.questions.map((question, i) => (
                      <li key={i}>{question}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
                <strong>Combos Ativos:</strong> {decision.active_combos.join(', ') || 'Nenhum'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
