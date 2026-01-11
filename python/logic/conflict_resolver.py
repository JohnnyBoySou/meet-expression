class ConflictResolver:
    """
    Árbitro de Conflitos: Remove AUs que são anatomicamente incompatíveis
    ou causadas por comportamentos não-emocionais (Fala, Olhar).
    """
    
    @staticmethod
    def resolve(candidate_aus, gaze_status, vad_is_speaking):
        """
        Filtra a lista de AUs candidatas baseada no contexto.
        """
        validated_aus = set(candidate_aus) # Usa set para facilitar remoção
        
        # REGRA 1: Bloqueio de Fala (VAD)
        # Se estiver falando, movimentos de boca são articulação, não emoção.
        if vad_is_speaking:
            # Remove AU10, AU12, AU15, AU20, AU25, AU26
            mouth_aus = {"AU10", "AU12", "AU15", "AU20", "AU25", "AU26"}
            validated_aus = validated_aus - mouth_aus
            
        # REGRA 2: Bloqueio de Olhar para Cima (Gaze Up)
        # Olhar pra cima levanta a pálpebra (AU5) e a testa (AU1/2) mecanicamente.
        if gaze_status == "THINKING_UP":
            upper_face_aus = {"AU1", "AU2", "AU5"}
            validated_aus = validated_aus - upper_face_aus

        # REGRA 3: Bloqueio de Olhar para Baixo (Gaze Down)
        # Olhar pra baixo cria falsa pálpebra fechada (AU7) ou bochecha (AU6).
        if gaze_status == "THINKING_DOWN":
            eye_aus = {"AU6", "AU7", "AU43"}
            validated_aus = validated_aus - eye_aus

        # REGRA 4: Conflito AU6 (Olho) vs AU12 (Boca) - Sorriso Falso vs Real
        # (Lógica simplificada para MVP: Se AU12 existe mas AU6 não, mantemos.
        # A diferenciação Duchenne acontece no InsightGenerator).
        
        return list(validated_aus)
