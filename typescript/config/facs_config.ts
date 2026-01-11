/**
 * FACS Configuration
 * Exporta a configuração FACS padrão para uso no engine
 */

import facsConfigJson from "../json/FACS_IA_decision_ready_v1.json";
import type { FACSConfig } from "../types/index";

export const defaultFACSConfig: FACSConfig = facsConfigJson as FACSConfig;
