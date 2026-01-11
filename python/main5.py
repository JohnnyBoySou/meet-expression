import cv2
import time
import yaml
import sys
import os
import numpy as np
import json
from collections import deque

# Garante que o Python encontre as pastas locais
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Modules
from modules.landmark_tracker import LandmarkTracker
from modules.gaze_tracker import GazeTracker
from modules.voice_activity import VoiceActivityDetector

# Analysers
from analyzers.hybrid_engine import HybridEngine
from analyzers.optical_flow_full import FullFaceFlowEngine

# Logic
from logic.scoring_engine import SalesScoringEngine


class SalesEngineV11_Production:
    def __init__(self, window_seconds=4.0):
        print(f">>> INICIALIZANDO MAIN5.PY (21 AUs + CALIBRAÇÃO) ...")
        self.root_dir = os.path.dirname(os.path.abspath(__file__))
        self.config_path = os.path.join(
            self.root_dir, "config", "thresholds_config.yaml"
        )
        self.rules_path = os.path.join(
            self.root_dir, "config", "FACS_IA_decision_ready_v1.json"
        )

        # Pasta de Saída
        self.output_dir = os.path.join(self.root_dir, "outputs")
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

        with open(self.config_path, "r") as f:
            self.cfg = yaml.safe_load(f)

        # Motores
        self.tracker = LandmarkTracker()
        self.gaze_tracker = GazeTracker(self.cfg)
        self.vad = VoiceActivityDetector(self.cfg)
        self.engine = HybridEngine(self.cfg)
        self.flow_engine = FullFaceFlowEngine()
        self.scoring_engine = SalesScoringEngine(self.rules_path)

        # Buffer de Janela
        self.window_seconds = window_seconds
        self.fps = 30
        self.window_size = int(window_seconds * self.fps)
        self.buffer = deque(maxlen=self.window_size)
        self.last_analysis_time = time.time()

        # Estado
        self.latest_strains = {}
        self.current_decision = {
            "dominant_dimension": "Calibrando...",
            "dominant_value": 0,
        }

    def draw_hud(self, frame, aus, gaze_status):
        h, w, _ = frame.shape
        overlay = frame.copy()
        # Painel lateral maior para caber as 21 AUs
        cv2.rectangle(overlay, (0, 0), (420, h), (15, 15, 20), -1)
        cv2.addWeighted(overlay, 0.90, frame, 0.10, 0, frame)

        # Status Calibração e Barra de Progresso
        tara_color = (0, 255, 0) if self.engine.is_calibrated_manual else (0, 0, 255)
        cv2.putText(
            frame,
            f"TARA: {'ON' if self.engine.is_calibrated_manual else 'OFF (C)'}",
            (430, 30),
            1,
            1,
            tara_color,
            2,
        )

        progress = len(self.buffer) / self.window_size
        cv2.rectangle(frame, (430, 45), (700, 55), (40, 40, 40), -1)
        cv2.rectangle(
            frame, (430, 45), (430 + int(270 * progress), 55), (0, 255, 255), -1
        )

        # LISTA COMPLETA DAS 21 AUs (main4 style)
        y = 35
        json_aus = [
            "AU1",
            "AU2",
            "AU4",
            "AU5",
            "AU6",
            "AU7",
            "AU9",
            "AU10",
            "AU12",
            "AU14",
            "AU15",
            "AU17",
            "AU18",
            "AU20",
            "AU23",
            "AU24",
            "AU25",
            "AU26",
            "AU28",
            "AU43",
            "AU45",
        ]

        for k in json_aus:
            val = aus.get(k, 0.0)
            color = (60, 60, 60)
            if val > 0.05:
                color = (0, 255, 255)
            if val > 0.35:
                color = (0, 255, 0)

            # Validação Física Simplificada para o HUD
            validated = False
            brow_s = self.latest_strains.get("brow", 0)
            nose_s = self.latest_strains.get("nose", 0)
            mouth_s = abs(self.latest_strains.get("mouth", 0))

            if k == "AU4" and brow_s < -2.0:
                validated = True
            if k in ["AU1", "AU2"] and brow_s > 2.0:
                validated = True
            if k == "AU9" and nose_s < -2.0:
                validated = True
            if k in ["AU12", "AU24", "AU25"] and mouth_s > 3.0:
                validated = True

            if validated and val > 0.1:
                color = (255, 0, 255)  # Ponto Roxo

            cv2.putText(
                frame, k, (15, y), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1
            )
            bar_w = int(val * 180)
            cv2.rectangle(frame, (65, y - 10), (65 + 180, y + 2), (30, 30, 30), -1)
            cv2.rectangle(frame, (65, y - 10), (65 + bar_w, y + 2), color, -1)
            if validated:
                cv2.circle(frame, (260, y - 4), 3, (255, 0, 255), -1)
            y += 24

        # Decisão Atual
        dom = self.current_decision.get("dominant_dimension", "Analysing")
        val = self.current_decision.get("dominant_value", 0)
        cv2.putText(
            frame,
            f"DECISAO JSON: {dom.upper()} ({val})",
            (430, h - 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 255),
            2,
        )

    def run(self):
        cap = cv2.VideoCapture(0)
        cap.set(3, 1280)
        cap.set(4, 720)

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            frame = cv2.flip(frame, 1)
            h, w, _ = frame.shape

            packet = self.tracker.process_frame(frame)
            if packet and packet.face_blendshapes and packet.face_landmarks:
                bs = packet.face_blendshapes[0]
                lm = packet.face_landmarks[0]

                # 1. Percepção com Calibração
                aus, rot_pen = self.engine.process(bs, lm, w, h)
                is_looking, _, gaze_status = self.gaze_tracker.analyze(lm, w, h)
                is_speaking = self.vad.is_speaking(lm)

                # 2. Física V10 (Boosts)
                if rot_pen < 0.3:
                    strains = self.flow_engine.analyze(frame, lm, w, h)
                    self.latest_strains = strains
                    # Aplicar os boosts nas AUs principais conforme a sua lógica de sucesso
                    if strains.get("brow", 0) < -3.0:
                        aus["AU4"] = max(aus["AU4"], 0.45)
                    if strains.get("nose", 0) < -2.5:
                        aus["AU9"] = max(aus["AU9"], 0.40)
                    if abs(strains.get("mouth", 0)) > 4.0:
                        for m_au in ["AU12", "AU24", "AU25"]:
                            if aus.get(m_au, 0) > 0.1:
                                aus[m_au] += 0.15

                # 3. Buffer de Cabeça e Janela
                nose, ear_l, ear_r = lm[1], lm[234], lm[454]
                head_yaw = (nose.x - ear_l.x) / (ear_r.x - ear_l.x + 1e-6)

                self.buffer.append(
                    {
                        "aus": aus.copy(),
                        "meta": {
                            "gaze": gaze_status,
                            "is_speaking": is_speaking,
                            "head_yaw": (head_yaw - 0.5) * 180,
                            "head_pitch": (nose.y - (ear_l.y + ear_r.y) / 2) * 200,
                        },
                    }
                )

                # 4. Processar Janela (4s)
                if time.time() - self.last_analysis_time >= self.window_seconds:
                    if len(self.buffer) >= self.window_size * 0.8:
                        # Extração estatística da janela (Percentil 95)
                        all_keys = self.buffer[0]["aus"].keys()
                        summary_aus = {
                            k: float(
                                np.percentile(
                                    [f["aus"].get(k, 0) for f in self.buffer], 95
                                )
                            )
                            for k in all_keys
                        }

                        window_payload = {
                            "aus": summary_aus,
                            "meta": self.buffer[-1][
                                "meta"
                            ],  # Usa o último meta como referência de estado
                        }

                        self.current_decision = self.scoring_engine.process(
                            window_payload
                        )

                        # Salvar em /outputs
                        json_path = os.path.join(
                            self.output_dir, "llm_decision_output.json"
                        )
                        with open(json_path, "w", encoding="utf-8") as f:
                            json.dump(
                                self.current_decision, f, indent=2, ensure_ascii=False
                            )

                        self.last_analysis_time = time.time()

                self.draw_hud(frame, aus, gaze_status)

                # Comandos de Teclado
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q"):
                    break
                if key == ord("c"):
                    self.engine.calibrate(aus)
                if key == ord("r"):
                    self.engine.reset_calibration()

            cv2.imshow("Sales Engine V11 - Janela 4s", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    SalesEngineV11_Production(window_seconds=4.0).run()
