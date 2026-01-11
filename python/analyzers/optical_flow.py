import cv2
import numpy as np

class MicroFlowEngine:
    """
    MOTOR V10: OPTICAL FLOW PHYSICS
    Detecta micro-movimentos de 'arrasto' da pele (Skin Strain)
    que o MediaPipe (Landmarks) não consegue ver.
    """
    def __init__(self):
        self.prev_gray = None
        # Indices da Testa (Bounding Box aproximada do MediaPipe)
        # 336, 296 (Topo dir), 107, 66 (Topo esq) -> Região central da testa
        self.roi_indices = [336, 107, 66, 296] 
        self.initialized = False

    def analyze(self, frame, landmarks, w, h):
        """
        Retorna a Tensão (Strain) da pele na testa.
        Valores Negativos (-5.0 a -20.0) indicam COMPRESSÃO (Raiva/Foco).
        Valores Positivos indicam EXPANSÃO (Surpresa).
        Zero indica repouso.
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # 1. Estabilização Digital: Recortar a Testa
        # Usamos os landmarks para criar uma 'janela' que segue a cabeça.
        # Isso remove o movimento do pescoço, deixando apenas o movimento da pele.
        pts = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in self.roi_indices], dtype=np.int32)
        x, y, rw, rh = cv2.boundingRect(pts)
        
        # Margem de segurança e validação de tamanho
        if rw < 10 or rh < 10: return 0.0
        
        # Recorte da região atual
        try:
            crop_curr = gray[y:y+rh, x:x+rw]
        except:
            return 0.0
            
        # Inicialização do primeiro frame
        if not self.initialized or self.prev_gray is None or crop_curr.shape != self.prev_gray.shape:
            self.prev_gray = crop_curr
            self.initialized = True
            return 0.0

        # 2. Cálculo de Fluxo Óptico Denso (Farneback)
        # Isso gera vetores de movimento para cada pixel
        flow = cv2.calcOpticalFlowFarneback(
            self.prev_gray, crop_curr, None, 
            pyr_scale=0.5, levels=3, winsize=15, 
            iterations=3, poly_n=5, poly_sigma=1.2, flags=0
        )
        
        # 3. Cálculo Vetorial: Divergência (Div V)
        # Medimos se os pixels estão se juntando (compressão) ou afastando (expansão)
        du_dx = np.gradient(flow[..., 0], axis=1) # Derivada em X
        dv_dy = np.gradient(flow[..., 1], axis=0) # Derivada em Y
        divergence = du_dx + dv_dy
        
        # A média da divergência é o nosso sinal de "Tensão"
        # Multiplicamos por 2000 para tornar o número legível (ex: -5.4)
        strain = np.mean(divergence) * 2000.0
        
        # Atualiza o frame anterior
        self.prev_gray = crop_curr
        
        return strain
