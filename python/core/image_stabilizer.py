import cv2
import numpy as np

class ImageStabilizer:
    """
    Responsável por recortar e estabilizar Regiões de Interesse (ROIs)
    removendo a rotação no plano (Roll) para análise de textura.
    """

    @staticmethod
    def extract_stabilized_roi(frame_bgr, landmarks, idx_center, idx_align_1, idx_align_2, output_size=64):
        """
        Recorta uma ROI quadrada estabilizada.
        
        Args:
            frame_bgr: Imagem original.
            landmarks: Lista de landmarks do MediaPipe.
            idx_center: Índice do landmark central da ROI (ex: canto do olho).
            idx_align_1, idx_align_2: Índices para calcular o ângulo (ex: cantos dos olhos).
            output_size: Tamanho final da imagem quadrada (px).
        """
        h, w, _ = frame_bgr.shape
        
        # 1. Obter coordenadas de alinhamento
        p1 = landmarks[idx_align_1]
        p2 = landmarks[idx_align_2]
        
        x1, y1 = p1.x * w, p1.y * h
        x2, y2 = p2.x * w, p2.y * h
        
        # 2. Calcular ângulo de rotação (Roll)
        dy = y2 - y1
        dx = x2 - x1
        angle_rad = np.arctan2(dy, dx)
        angle_deg = np.degrees(angle_rad)
        
        # 3. Obter centro da ROI
        pc = landmarks[idx_center]
        cx, cy = pc.x * w, pc.y * h
        
        # 4. Criar Matriz de Rotação (Affine)
        # Rotaciona a imagem inteira ao redor do ponto de interesse para nivelar o horizonte
        M = cv2.getRotationMatrix2D((cx, cy), angle_deg, 1.0)
        
        # 5. Aplicar Warp (apenas na região necessária para otimizar)
        # Nota: Aplicamos na imagem toda por simplicidade, mas em C++ faríamos crop antes.
        stabilized_img = cv2.warpAffine(frame_bgr, M, (w, h))
        
        # 6. Recorte Seguro (Safe Crop)
        half = output_size // 2
        start_x = int(cx - half)
        start_y = int(cy - half)
        end_x = start_x + output_size
        end_y = start_y + output_size
        
        # Checagem de bordas
        if start_x < 0 or start_y < 0 or end_x > w or end_y > h:
            return None # ROI saiu da tela
            
        roi = stabilized_img[start_y:end_y, start_x:end_x]
        
        # Retorna em Grayscale (melhor para gradientes de textura)
        if roi.size > 0:
            return cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        return None
