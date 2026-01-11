import cv2
import numpy as np
from core.image_stabilizer import ImageStabilizer

class TextureEngine:
    """
    Analisa AUs baseadas em Textura (Pele enrugando).
    Crucial para AU6 (Microexpressão Real) e AU9 (Nojo/Aversão).
    
    Se baseia na 'variância de bordas' (Sobel) em imagens estabilizadas.
    """
    def __init__(self, config):
        self.roi_size = config['texture']['roi_size']
        self.idx_align_L = 33  # Canto olho esq
        self.idx_align_R = 263 # Canto olho dir
        
        # Pontos centrais das ROIs
        self.IDX = {
            "au6_eye_L": 33,   # Canto externo olho esq ("Pé de galinha")
            "au6_eye_R": 263,  # Canto externo olho dir
            "au9_nose_L": 168, # Lateral do nariz (topo)
            "au9_nose_R": 6    # Centro do nariz
        }

    def analyze(self, frame_bgr, landmarks):
        """
        Retorna dicionário com intensidade de textura (0.0 a 255.0+).
        """
        signals = {}
        
        # Converter para escala de cinza uma vez (otimização)
        # O ImageStabilizer pede BGR, mas fará a conversão internamente se necessário.
        # Vamos passar BGR pois o stabilizer decide.
        
        # --- AU6 (Orbicularis Oculi) ---
        # Analisa o lado esquerdo
        tex_L = self._get_texture_score(frame_bgr, landmarks, self.IDX["au6_eye_L"])
        # Analisa o lado direito
        tex_R = self._get_texture_score(frame_bgr, landmarks, self.IDX["au6_eye_R"])
        
        # Retorna a média (ou o máximo, dependendo da estratégia. Média é mais estável)
        signals["au6_texture"] = (tex_L + tex_R) / 2.0

        # --- AU9 (Levator Labii Superioris) ---
        # Nariz enrugando
        tex_nose = self._get_texture_score(frame_bgr, landmarks, self.IDX["au9_nose_R"])
        signals["au9_texture"] = tex_nose

        return signals

    def _get_texture_score(self, frame, landmarks, center_idx):
        """Helper para extrair e calcular Sobel."""
        
        # 1. Recorta e Desentorta (Unwarp)
        roi = ImageStabilizer.extract_stabilized_roi(
            frame, 
            landmarks, 
            idx_center=center_idx,
            idx_align_1=self.idx_align_L, 
            idx_align_2=self.idx_align_R, 
            output_size=self.roi_size
        )
        
        if roi is None:
            return 0.0
            
        # 2. Filtro de Borda (Sobel)
        # Detecta mudanças bruscas de intensidade (rugas)
        sobel_x = cv2.Sobel(roi, cv2.CV_64F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(roi, cv2.CV_64F, 0, 1, ksize=3)
        
        # Magnitude do gradiente
        magnitude = np.sqrt(sobel_x**2 + sobel_y**2)
        
        # 3. Score = Média da intensidade das bordas
        # Quanto mais rugas, maior este número.
        return np.mean(magnitude)
