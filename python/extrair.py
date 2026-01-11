#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import cv2
import argparse
from pathlib import Path
import re
from typing import Tuple

VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"}

def safe_folder_name(stem: str) -> str:
    """
    Converte o nome do vídeo (stem) em algo seguro para pasta.
    Mantém letras/números/_-.
    Troca espaços e caracteres especiais por underscore.
    """
    # normaliza espaços
    stem = stem.strip()
    # substitui tudo que não for alfanumérico, hífen, underscore ou ponto por "_"
    stem = re.sub(r"[^0-9A-Za-zÀ-ÿ._-]+", "_", stem, flags=re.UNICODE)
    # remove underscores repetidos
    stem = re.sub(r"_+", "_", stem)
    return stem.strip("_")

def extract_frames_from_video(
    video_path: Path,
    out_root: Path,
    every: int = 1,
    start: int = 0,
    end: int = -1,
    jpg_quality: int = 95,
    force_fps: float = 0.0,
) -> Tuple[Path, int]:
    """
    Extrai frames de um vídeo e salva em out_root/<nome_do_video>/frame_XXXXXX_tTTT.jpg

    - every: salva 1 a cada N frames
    - start/end: intervalo de frames (end inclusive). end=-1 => até o fim
    - force_fps: se >0, usa esse fps só para calcular timestamp no nome (não reamostra)
    """
    if not video_path.exists():
        raise FileNotFoundError(f"Vídeo não encontrado: {video_path}")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Não consegui abrir o vídeo: {video_path}")

    # Metadados
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or -1
    src_fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
    fps_for_ts = float(force_fps) if force_fps and force_fps > 0 else src_fps

    # Pasta de saída (com nome do vídeo)
    folder_name = safe_folder_name(video_path.stem)
    out_dir = out_root / folder_name
    out_dir.mkdir(parents=True, exist_ok=True)

    # Define end padrão
    if end is None or end < 0:
        end = (total_frames - 1) if total_frames > 0 else 10**18

    # Ajustes
    every = max(1, int(every))
    start = max(0, int(start))

    # Pula para start
    if start > 0:
        cap.set(cv2.CAP_PROP_POS_FRAMES, start)

    params = [int(cv2.IMWRITE_JPEG_QUALITY), int(max(0, min(100, jpg_quality)))]

    print("\n" + "=" * 80)
    print(f"[VIDEO] {video_path}")
    print(f"[INFO ] src_fps={src_fps:.3f} | total_frames={total_frames}")
    if force_fps and force_fps > 0:
        print(f"[INFO ] force_fps={force_fps:.3f} (apenas para timestamp no nome)")
    print(f"[OUT  ] {out_dir}")
    print(f"[RANGE] frames {start}..{end} | every={every}")
    print("=" * 80)

    frame_idx = start
    saved = 0

    while True:
        if frame_idx > end:
            break

        ok, frame = cap.read()
        if not ok:
            break

        if (frame_idx - start) % every == 0:
            t = (frame_idx / fps_for_ts) if fps_for_ts and fps_for_ts > 0 else 0.0
            out_file = out_dir / f"frame_{frame_idx:06d}_t{t:010.3f}.jpg"
            ok_write = cv2.imwrite(str(out_file), frame, params)
            if not ok_write:
                raise RuntimeError(f"Falha ao salvar: {out_file}")
            saved += 1

            if saved % 200 == 0:
                print(f"[INFO ] Salvos: {saved} (último: {out_file.name})")

        frame_idx += 1

    cap.release()
    print(f"[DONE ] Frames salvos: {saved}")
    return out_dir, saved

def collect_videos(args_videos):
    # Permite passar caminhos diretos e também diretórios
    collected = []
    for v in args_videos:
        p = Path(v).expanduser().resolve()
        if p.is_dir():
            for ext in VIDEO_EXTS:
                collected.extend(sorted(p.glob(f"*{ext}")))
        else:
            collected.append(p)
    # remove duplicados preservando ordem
    seen = set()
    unique = []
    for p in collected:
        if str(p) not in seen:
            unique.append(p)
            seen.add(str(p))
    return unique

def main():
    ap = argparse.ArgumentParser(
        description="Extrai frames de um ou vários vídeos, salvando em uma pasta com o nome do vídeo."
    )
    ap.add_argument(
        "--videos",
        nargs="+",
        required=True,
        help="Caminhos dos vídeos (ou diretórios) — use aspas se tiver espaço/acentos.",
    )
    ap.add_argument(
        "--out_root",
        required=True,
        help="Pasta raiz de saída (será criado out_root/<nome_do_video>/...).",
    )
    ap.add_argument("--every", type=int, default=1, help="Salvar 1 a cada N frames (default: 1 = todos).")
    ap.add_argument("--start", type=int, default=0, help="Frame inicial (default: 0).")
    ap.add_argument("--end", type=int, default=-1, help="Frame final inclusive (default: -1 = até o fim).")
    ap.add_argument("--jpg_quality", type=int, default=95, help="Qualidade JPG 0..100 (default: 95).")
    ap.add_argument(
        "--force_fps",
        type=float,
        default=0.0,
        help="Se >0, usa esse fps só para calcular timestamp no nome (não reamostra).",
    )

    args = ap.parse_args()

    out_root = Path(args.out_root).expanduser().resolve()
    out_root.mkdir(parents=True, exist_ok=True)

    videos = collect_videos(args.videos)
    if not videos:
        raise SystemExit("Nenhum vídeo encontrado nos caminhos fornecidos.")

    total_saved = 0
    for vp in videos:
        out_dir, saved = extract_frames_from_video(
            video_path=vp,
            out_root=out_root,
            every=args.every,
            start=args.start,
            end=args.end,
            jpg_quality=args.jpg_quality,
            force_fps=args.force_fps,
        )
        total_saved += saved

    print("\n" + "-" * 80)
    print(f"[SUMMARY] Vídeos processados: {len(videos)} | Total de frames salvos: {total_saved}")
    print(f"[SUMMARY] Saída raiz: {out_root}")
    print("-" * 80)

if __name__ == "__main__":
    main()
