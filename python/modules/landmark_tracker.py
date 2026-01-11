import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import cv2
import os
import numpy as np

class LandmarkTracker:
    def __init__(self, model_path='face_landmarker.task'):
        # Garante que o caminho do modelo está correto
        if not os.path.exists(model_path):
            if os.path.exists(os.path.join(os.getcwd(), model_path)):
                model_path = os.path.join(os.getcwd(), model_path)
            else:
                print(f"ERRO CRÍTICO: Modelo '{model_path}' não encontrado.")

        base_options = python.BaseOptions(model_asset_path=model_path)
        
        # --- CONFIGURAÇÃO CORRIGIDA ---
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            output_face_blendshapes=True,  # Precisamos disso para as AUs (V0/V32)
            # output_face_landmarks=True,  <-- REMOVIDO (Landmarks vêm por padrão)
            num_faces=1,
            running_mode=vision.RunningMode.IMAGE 
        )
        self.detector = vision.FaceLandmarker.create_from_options(options)

    def process_frame(self, frame):
        """
        Processa o frame e retorna o resultado COMPLETO do MediaPipe.
        """
        try:
            # Converte para formato MediaPipe (RGB)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            
            # Detecção Síncrona
            detection_result = self.detector.detect(mp_image)
            
            # Verifica se detectou rosto
            if detection_result.face_landmarks:
                return detection_result
            else:
                return None
                
        except Exception as e:
            print(f"Erro no Tracker: {e}")
            return None
