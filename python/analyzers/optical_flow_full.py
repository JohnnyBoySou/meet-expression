import cv2
import numpy as np

class FullFaceFlowEngine:
    """
    MOTOR V10 FULL: Monitora tensão física em 5 zonas críticas.
    Compatível com a lista de 21 AUs do JSON.
    """
    def __init__(self):
        self.prev_gray = None
        self.initialized = False
        
        # 1. Definição das Zonas (Landmark Indices do MediaPipe 468)
        # Escolhidos estrategicamente para pegar a musculatura correta
        self.rois_def = {
            # Testa Central: Corrugator (AU4) e Frontalis (AU1/2)
            'brow':  [336, 107, 66, 296],      
            
            # Nariz Superior: Procerus/Nasalis (AU9 - Nojo)
            'nose':  [198, 420, 279, 49],      
            
            # Bochecha Esq: Zygomaticus Major (AU6/12)
            'l_cheek': [117, 119, 100, 47],    
            
            # Bochecha Dir: Zygomaticus Major (AU6/12)
            'r_cheek': [346, 348, 329, 277],   
            
            # Boca Completa: Orbicularis Oris (Todas as AUs de boca: 10 a 28)
            # Abrangemos uma área maior para pegar estiramento (AU20) e bico (AU18)
            'mouth': [61, 291, 0, 17]          
        }
        
        # Armazena o 'recorte' anterior de cada zona para comparação
        self.prev_crops = {}

    def analyze(self, frame, landmarks, w, h):
        """
        Calcula o Fluxo Óptico (Tensão) para cada zona.
        Retorna dicionário: {'brow': -5.0, 'mouth': 2.0, ...}
        Valores Negativos = Compressão (Tensão)
        Valores Positivos = Expansão (Abertura)
        """
        # Converte para P&B (Optical Flow não precisa de cor)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        results = {}
        
        # Inicializa dicionário com 0.0 para segurança
        for zone in self.rois_def.keys():
            results[zone] = 0.0
        
        for name, indices in self.rois_def.items():
            # 1. Obter Bounding Box da Zona baseada nos Landmarks
            pts = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in indices], dtype=np.int32)
            x, y, rw, rh = cv2.boundingRect(pts)
            
            # Proteção: Se a área for muito pequena (erro de tracking ou longe demais), ignora
            if rw < 5 or rh < 5: 
                continue
            
            # 2. Recortar a ROI com Margem de Segurança (Padding)
            # O padding é crucial para ver o movimento da pele "puxando" as bordas
            pad = 10
            # Garante que não vamos tentar ler pixels fora da imagem (evita crash)
            y1, y2 = max(0, y-pad), min(h, y+rh+pad)
            x1, x2 = max(0, x-pad), min(w, x+rw+pad)
            
            crop_curr = gray[y1:y2, x1:x2]
            
            # Se o recorte falhou ou tem tamanho zero
            if crop_curr.size == 0:
                continue

            # Recupera o frame anterior dessa zona específica
            prev = self.prev_crops.get(name)
            
            # Se não temos histórico ou o tamanho mudou (zoom/movimento rápido), reseta
            if prev is None or crop_curr.shape != prev.shape:
                self.prev_crops[name] = crop_curr
                continue # Retorna 0.0 neste frame

            # 3. Fluxo Óptico Denso (Algoritmo de Farneback)
            # Configurado para alta sensibilidade (winsize pequeno)
            flow = cv2.calcOpticalFlowFarneback(
                prev, crop_curr, None, 
                pyr_scale=0.5, levels=1, winsize=10, 
                iterations=2, poly_n=5, poly_sigma=1.1, flags=0
            )
            
            # 4. Cálculo Vetorial: Divergência (Strain)
            # Mede a "taxa de deformação" da textura da pele
            du_dx = np.gradient(flow[..., 0], axis=1) # Derivada X
            dv_dy = np.gradient(flow[..., 1], axis=0) # Derivada Y
            divergence = du_dx + dv_dy
            
            # A média da divergência na região é o nosso sinal físico
            # Multiplicamos por 2000 para transformar números como 0.0005 em 1.0 (legível)
            strain = np.mean(divergence) * 2000.0
            
            results[name] = strain
            
            # Atualiza memória para o próximo frame
            self.prev_crops[name] = crop_curr
            
        return results
