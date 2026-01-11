import cv2
import os
import numpy as np
import sys

# Garante que o Python encontre os módulos na raiz
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modules.landmark_tracker import LandmarkTracker
from analyzers.vector_engine import VectorEngine
from analyzers.texture_engine import TextureEngine
from core.signal_processing import TemporalDerivative

# Configuração Mínima para o Profiler rodar sem o arquivo YAML
MOCK_CONFIG = {
    'geometry': {'brow_sensitivity': 1.0, 'mouth_sensitivity': 1.0},
    'texture': {'roi_size': 64},
    'dynamics': {'temporal_buffer_size': 5}
}

def analyze_video_flux(video_path, au_target):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"ERRO: Não foi possível abrir {video_path}")
        return 0.0

    tracker = LandmarkTracker()
    vec_engine = VectorEngine(MOCK_CONFIG)
    tex_engine = TextureEngine(MOCK_CONFIG)
    
    # Processadores de Derivada (Aceleração)
    derivative_calc = TemporalDerivative(5)
    
    max_accel = 0.0
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        
        # Simula 30 FPS para padronizar a física (já que é video gravado)
        dt = 0.033 
        
        landmarks = tracker.process_frame(frame)
        if landmarks:
            lm = landmarks.landmark
            
            # Extrai Sinais
            vecs = vec_engine.analyze(lm)
            texs = tex_engine.analyze(frame, lm)
            signals = {**vecs, **texs}
            
            # Escolhe o sinal certo baseado no nome do arquivo 
            # (Ex: se o vídeo é AU4.mp4, monitoramos 'au4_brow_dist')
            target_signal = None
            if "AU4" in au_target: target_signal = signals.get("au4_brow_dist")
            elif "AU12" in au_target: target_signal = signals.get("au12_mouth_dist")
            elif "AU6" in au_target: target_signal = signals.get("au6_texture")
            elif "AU15" in au_target: target_signal = signals.get("au15_chin_dist")
            elif "AU9" in au_target: target_signal = signals.get("au9_texture")
            
            if target_signal is not None:
                # Calcula Fluxo (Aceleração)
                _, accel = derivative_calc.process(target_signal, dt)
                
                # Guarda o pico de aceleração (ignorando se é negativo/positivo)
                if abs(accel) > max_accel:
                    max_accel = abs(accel)
                    
    cap.release()
    return max_accel

def run_profiling():
    # Caminho para a pasta de vídeos
    videos_dir = os.path.join(os.path.dirname(__file__), "Videos_microexpressão", "AUS")
    
    if not os.path.exists(videos_dir):
        print(f"ERRO CRÍTICO: Pasta de vídeos não encontrada em: {videos_dir}")
        print("Verifique se a pasta 'Videos_microexpressão' está na raiz.")
        return

    print(f"\n{'VIDEO':<15} | {'MAX FLUXO (ACELERAÇÃO)':<25} | {'SUGESTÃO CONFIG'}")
    print("-" * 65)

    # Lista de vídeos críticos para calibração
    targets = ["AU4.mp4", "AU12.mp4", "AU6.mp4", "AU15.mp4", "AU9.mp4"]
    
    total_acc = 0
    count = 0

    for filename in os.listdir(videos_dir):
        # Verifica se o arquivo é um dos nossos alvos (ignora .DS_Store, etc)
        if any(t in filename for t in targets):
            path = os.path.join(videos_dir, filename)
            
            # Analisa o Fluxo do Vídeo
            peak_flux = analyze_video_flux(path, filename)
            
            # A sugestão é 60% do pico. 
            # Motivo: No vídeo você faz a expressão forte (100%). 
            # Na vida real, a microexpressão é mais sutil, então cortamos o limiar.
            suggestion = peak_flux * 0.60 
            
            print(f"{filename:<15} | {peak_flux:.5f}                   | {suggestion:.5f}")
            
            if peak_flux > 0:
                total_acc += suggestion
                count += 1

    if count > 0:
        avg_threshold = total_acc / count
        print("-" * 65)
        print(f"\n>>> CONCLUSÃO CIENTÍFICA: Configure 'acceleration_threshold' para: {avg_threshold:.5f}")
        print(f">>> Configure no arquivo: config/thresholds_config.yaml")
    else:
        print("\nNenhum vídeo alvo (AU4, AU12, etc) foi processado com sucesso.")

if __name__ == "__main__":
    run_profiling()
