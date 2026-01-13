// json/au_mappings.json
var au_mappings_default = {
  mappings: {
    AU1: {
      type: "direct",
      blendshapes: ["browInnerUp"]
    },
    AU2: {
      type: "average",
      blendshapes: ["browOuterUpLeft", "browOuterUpRight"]
    },
    AU4: {
      type: "composite",
      base: {
        type: "average",
        blendshapes: ["browDownLeft", "browDownRight"]
      },
      additions: [
        {
          source: "AU1",
          multiplier: 0.1
        }
      ]
    },
    AU5: {
      type: "average",
      blendshapes: ["eyeWideLeft", "eyeWideRight"]
    },
    AU6: {
      type: "average",
      blendshapes: ["cheekSquintLeft", "cheekSquintRight"]
    },
    AU7: {
      type: "average",
      blendshapes: ["eyeSquintLeft", "eyeSquintRight"]
    },
    AU43: {
      type: "average",
      blendshapes: ["eyeBlinkLeft", "eyeBlinkRight"]
    },
    AU45: {
      type: "reference",
      source: "AU43"
    },
    AU9: {
      type: "average",
      blendshapes: ["noseSneerLeft", "noseSneerRight"]
    },
    AU10: {
      type: "average",
      blendshapes: ["mouthUpperUpLeft", "mouthUpperUpRight"]
    },
    AU12: {
      type: "composite",
      base: {
        type: "average",
        blendshapes: ["mouthSmileLeft", "mouthSmileRight"]
      },
      additions: [
        {
          source: {
            type: "average",
            blendshapes: ["mouthDimpleLeft", "mouthDimpleRight"]
          },
          multiplier: 1.3
        }
      ]
    },
    AU14: {
      type: "average",
      blendshapes: ["mouthDimpleLeft", "mouthDimpleRight"]
    },
    AU15: {
      type: "average",
      blendshapes: ["mouthFrownLeft", "mouthFrownRight"]
    },
    AU17: {
      type: "direct",
      blendshapes: ["chinRaise"]
    },
    AU18: {
      type: "direct",
      blendshapes: ["mouthPucker"]
    },
    AU20: {
      type: "average",
      blendshapes: ["mouthStretchLeft", "mouthStretchRight"]
    },
    AU23: {
      type: "composite",
      base: {
        type: "average",
        blendshapes: ["mouthPressLeft", "mouthPressRight"]
      },
      multiplier: 0.9
    },
    AU24: {
      type: "average",
      blendshapes: ["mouthPressLeft", "mouthPressRight"]
    },
    AU25: {
      type: "direct",
      blendshapes: ["jawOpen"]
    },
    AU26: {
      type: "direct",
      blendshapes: ["jawDrop"]
    },
    AU28: {
      type: "average",
      blendshapes: ["mouthRollUpper", "mouthRollLower"]
    }
  }
};

// config/au_mapper.ts
function calculateMappingValue(mapping, bs, calculatedAus) {
  switch (mapping.type) {
    case "direct": {
      const value = mapping.blendshapes.map((name) => bs[name] || 0).reduce((sum, val) => sum + val, 0);
      return value;
    }
    case "average": {
      const values = mapping.blendshapes.map((name) => bs[name] || 0);
      if (values.length === 0) return 0;
      const sum = values.reduce((acc, val) => acc + val, 0);
      return sum / values.length;
    }
    case "reference": {
      return calculatedAus[mapping.source] || 0;
    }
    case "composite": {
      let value = calculateMappingValue(mapping.base, bs, calculatedAus);
      if (mapping.multiplier !== void 0) {
        value *= mapping.multiplier;
      }
      if (mapping.additions) {
        for (const addition of mapping.additions) {
          let additionValue;
          if (typeof addition.source === "string") {
            additionValue = calculatedAus[addition.source] || 0;
          } else {
            additionValue = calculateMappingValue(
              addition.source,
              bs,
              calculatedAus
            );
          }
          value += additionValue * addition.multiplier;
        }
      }
      return value;
    }
    default:
      return 0;
  }
}
function calculateAUsFromMappings(bs) {
  const config = au_mappings_default;
  const aus = {};
  const auOrder = Object.keys(config.mappings);
  for (const auName of auOrder) {
    const mapping = config.mappings[auName];
    aus[auName] = calculateMappingValue(mapping, bs, aus);
  }
  return aus;
}

// core/geometry_utils.ts
function euclideanDistance(p1, p2) {
  return Math.sqrt(
    (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2
  );
}
function calculateDivergence(landmarks, indices, w, h) {
  const pts = indices.map((i) => {
    const landmark = landmarks[i];
    if (!landmark) return [0, 0];
    return [landmark.x * w, landmark.y * h];
  });
  if (pts.length === 0) return 0;
  const centerX = pts.reduce((sum, pt) => sum + pt[0], 0) / pts.length;
  const centerY = pts.reduce((sum, pt) => sum + pt[1], 0) / pts.length;
  let divergence = 0;
  for (const pt of pts) {
    const [x, y] = pt;
    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    divergence += dist;
  }
  return divergence;
}

// json/physical_validations.json
var physical_validations_default = {
  validations: {
    AU4: {
      type: "divergence",
      description: "Valida AU4 (testa franzida) usando diverg\xEAncia geom\xE9trica das sobrancelhas",
      landmarkIndices: [107, 336, 9, 66, 296],
      conditions: {
        auThreshold: 0.15,
        divergenceDeltaThreshold: 6
      },
      action: {
        type: "penalize",
        multiplier: 0.2
      }
    }
  }
};

// config/physical_validator.ts
function createPhysicalValidator() {
  const config = physical_validations_default;
  const states = /* @__PURE__ */ new Map();
  function applyValidations(aus, landmarks, w, h) {
    const result = { ...aus };
    for (const [auName, validation] of Object.entries(config.validations)) {
      if (validation.type === "divergence") {
        const state = states.get(auName) || {
          baselineDiv: null,
          calibrated: false
        };
        const currDiv = calculateDivergence(
          landmarks,
          validation.landmarkIndices,
          w,
          h
        );
        if (!state.calibrated) {
          state.baselineDiv = currDiv;
          state.calibrated = true;
          states.set(auName, state);
          continue;
        }
        const divDelta = currDiv - (state.baselineDiv || 0);
        const auValue = result[auName] || 0;
        if (auValue > validation.conditions.auThreshold && divDelta > validation.conditions.divergenceDeltaThreshold) {
          if (validation.action.type === "penalize") {
            result[auName] = auValue * validation.action.multiplier;
          }
        }
        states.set(auName, state);
      }
    }
    return result;
  }
  function resetCalibration() {
    states.clear();
  }
  return {
    applyValidations,
    resetCalibration
  };
}

// analyzers/hybrid_engine.ts
function calculateRotationPenalty(landmarks) {
  if (landmarks.length < 455) return 1;
  const nose = landmarks[1];
  const earL = landmarks[234];
  const earR = landmarks[454];
  if (!nose || !earL || !earR) return 1;
  const faceWidth = Math.abs(earR.x - earL.x);
  if (faceWidth === 0) return 1;
  const ratio = Math.abs(nose.x - earL.x) / faceWidth;
  const deviation = Math.abs(ratio - 0.5);
  if (deviation > 0.12) {
    return Math.min((deviation - 0.12) * 6, 1);
  }
  return 0;
}
function createHybridEngine() {
  const sensitivity = 2.8;
  const noiseGate = 0.04;
  const alpha = 0.6;
  const prevAus = /* @__PURE__ */ new Map();
  const physicalValidator = createPhysicalValidator();
  let manualOffsets = {};
  let isCalibratedManual = false;
  function calibrate(currentAus) {
    console.log(">>> CALIBRATING... NEUTRAL FACE DEFINED.");
    manualOffsets = { ...currentAus };
    isCalibratedManual = true;
  }
  function resetCalibration() {
    console.log(">>> CALIBRATION RESET.");
    manualOffsets = {};
    isCalibratedManual = false;
  }
  function process2(blendshapes, landmarks, w, h) {
    const bs = {};
    for (const b of blendshapes) {
      bs[b.category_name] = b.score;
    }
    const rotPenalty = calculateRotationPenalty(landmarks);
    const currentGain = sensitivity * (1 - rotPenalty * 0.8);
    let aus = calculateAUsFromMappings(bs);
    aus = physicalValidator.applyValidations(aus, landmarks, w, h);
    const finalAus = {};
    for (const [k, v] of Object.entries(aus)) {
      let val = (v || 0) ** 0.75 * currentGain;
      const prev = prevAus.get(k) || 0;
      const smoothedVal = val * alpha + prev * (1 - alpha);
      prevAus.set(k, smoothedVal);
      val = smoothedVal;
      if (isCalibratedManual) {
        const offset = manualOffsets[k] || 0;
        val = Math.max(0, val - offset);
      }
      if (val < noiseGate) val = 0;
      finalAus[k] = Math.min(val, 1);
    }
    return {
      aus: finalAus,
      rotPenalty
    };
  }
  return {
    process: process2,
    calibrate,
    resetCalibration
  };
}

// analyzers/landmark_based_flow.ts
var ROIS = {
  // Brow: Corrugator (AU4) e Frontalis (AU1/2)
  brow: [336, 107, 66, 296],
  // Nariz Superior: Procerus/Nasalis (AU9 - Nojo)
  nose: [198, 420, 279, 49],
  // Bochecha Esq: Zygomaticus Major (AU6/12)
  l_cheek: [117, 119, 100, 47],
  // Bochecha Dir: Zygomaticus Major (AU6/12)
  r_cheek: [346, 348, 329, 277],
  // Boca Completa: Orbicularis Oris
  mouth: [61, 291, 0, 17]
};
function calculateDistance(p1, p2) {
  const dx = (p1.x - p2.x) ** 2;
  const dy = (p1.y - p2.y) ** 2;
  const dz = (p1.z - p2.z) ** 2;
  return Math.sqrt(dx + dy + dz);
}
function calculateROIVelocity(currentLandmarks, prevLandmarks, roiIndices, w, h, deltaTime) {
  if (deltaTime <= 0) return 0;
  let totalVelocity = 0;
  let validPoints = 0;
  for (const idx of roiIndices) {
    const curr = currentLandmarks[idx];
    const prev = prevLandmarks[idx];
    if (!curr || !prev) continue;
    const distance = calculateDistance(
      { x: curr.x * w, y: curr.y * h, z: curr.z },
      { x: prev.x * w, y: prev.y * h, z: prev.z }
    );
    const velocity = distance / deltaTime;
    totalVelocity += velocity;
    validPoints++;
  }
  if (validPoints === 0) return 0;
  return totalVelocity / validPoints;
}
function calculateROIAcceleration(currentVelocity, prevVelocity, deltaTime) {
  if (deltaTime <= 0) return 0;
  return Math.abs(currentVelocity - prevVelocity) / deltaTime;
}
function createLandmarkFlowEngine() {
  let previous = null;
  const prevVelocities = /* @__PURE__ */ new Map();
  function analyze(landmarks, w, h) {
    const now = performance.now();
    const results = {
      brow: 0,
      nose: 0,
      l_cheek: 0,
      r_cheek: 0,
      mouth: 0
    };
    if (!previous) {
      previous = {
        landmarks: landmarks.map((l) => ({ ...l })),
        velocities: [],
        timestamp: now
      };
      return Promise.resolve(results);
    }
    const deltaTime = (now - previous.timestamp) / 1e3;
    if (deltaTime <= 0 || deltaTime > 1) {
      previous = {
        landmarks: landmarks.map((l) => ({ ...l })),
        velocities: [],
        timestamp: now
      };
      prevVelocities.clear();
      return Promise.resolve(results);
    }
    for (const [roiName, roiIndices] of Object.entries(ROIS)) {
      const currentVelocity = calculateROIVelocity(
        landmarks,
        previous.landmarks,
        roiIndices,
        w,
        h,
        deltaTime
      );
      const prevVelocity = prevVelocities.get(roiName) || 0;
      const acceleration = calculateROIAcceleration(
        currentVelocity,
        prevVelocity,
        deltaTime
      );
      const velocityStrain = currentVelocity * 50;
      const accelerationStrain = acceleration * 200;
      const strain = velocityStrain - accelerationStrain;
      results[roiName] = strain;
      prevVelocities.set(roiName, currentVelocity);
    }
    previous = {
      landmarks: landmarks.map((l) => ({ ...l })),
      velocities: [],
      timestamp: now
    };
    return Promise.resolve(results);
  }
  function reset() {
    previous = null;
    prevVelocities.clear();
  }
  return {
    analyze,
    reset
  };
}

// config/thresholds_config.ts
var defaultThresholdsConfig = {
  safety: {
    max_head_rotation_yaw: 30,
    max_head_rotation_pitch: 25,
    min_iod_pixels: 40,
    max_gaze_deviation: 30
  },
  vad: {
    speaking_threshold: 0.2
  }
};

// json/FACS_IA_decision_ready_v1.json
var FACS_IA_decision_ready_v1_default = {
  version: "FACS_IA_decision_ready_v1",
  generated_at: "2025-12-22T02:30:31Z",
  dimensions: {
    engagement: {
      desc: "engajamento/aten\xE7\xE3o (tend\xEAncia a participar)",
      range: "-100..+100"
    },
    affiliation: {
      desc: "afeto/aproxima\xE7\xE3o (tend\xEAncia a v\xEDnculo/acolhimento)",
      range: "-100..+100"
    },
    approval: {
      desc: "aprova\xE7\xE3o/alinhamento com proposta",
      range: "-100..+100"
    },
    resistance: {
      desc: "resist\xEAncia/bloqueio (tend\xEAncia a discordar/fechar)",
      range: "-100..+100"
    },
    stress_load: {
      desc: "carga/estresse (sobrecarga cognitiva/press\xE3o)",
      range: "-100..+100"
    },
    aversion: {
      desc: "avers\xE3o/nojo/desprezo (rejei\xE7\xE3o do est\xEDmulo)",
      range: "-100..+100"
    },
    incongruence_risk: {
      desc: "risco de incongru\xEAncia (fala vs sinais) / reten\xE7\xE3o",
      range: "-100..+100"
    }
  },
  scales: {
    intensity_scale: [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    laterality_scale: [
      "L",
      "R",
      "B",
      "ASYM",
      "UNK"
    ],
    microexpression_threshold_ms: 500
  },
  rules: {
    three_confirmations_rule: {
      description: "Trate hip\xF3tese como 'alta confian\xE7a' apenas se houver confirma\xE7\xE3o em 3\ncamadas (face/voz/corpo/conte\xFAdo/olhar).",
      layers: [
        "face",
        "voice",
        "body",
        "content",
        "gaze"
      ],
      min_layers: 3
    },
    baseline_required: {
      description: "Sempre comparar contra baseline individual (10\u201320s neutros) para evitar\nfalsos positivos."
    }
  },
  weights_by_code: {
    AU1: {
      engagement: -5,
      affiliation: 5,
      approval: 0,
      resistance: 0,
      stress_load: 10,
      aversion: 0,
      incongruence_risk: 0
    },
    AU2: {
      engagement: 10,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 5,
      aversion: 0,
      incongruence_risk: 0
    },
    AU4: {
      engagement: -5,
      affiliation: -5,
      approval: -10,
      resistance: 25,
      stress_load: 15,
      aversion: 5,
      incongruence_risk: 10
    },
    AU5: {
      engagement: 15,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 10,
      aversion: 0,
      incongruence_risk: 5
    },
    AU6: {
      engagement: 10,
      affiliation: 25,
      approval: 15,
      resistance: -10,
      stress_load: -5,
      aversion: -10,
      incongruence_risk: -5
    },
    AU7: {
      engagement: -5,
      affiliation: -5,
      approval: -5,
      resistance: 10,
      stress_load: 15,
      aversion: 0,
      incongruence_risk: 10
    },
    AU8: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 0,
      aversion: 0,
      incongruence_risk: 0
    },
    AU9: {
      engagement: -10,
      affiliation: -20,
      approval: -25,
      resistance: 25,
      stress_load: 10,
      aversion: 40,
      incongruence_risk: 10
    },
    AU10: {
      engagement: -5,
      affiliation: -15,
      approval: -20,
      resistance: 20,
      stress_load: 5,
      aversion: 25,
      incongruence_risk: 10
    },
    AU11: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 0,
      aversion: 0,
      incongruence_risk: 0
    },
    AU12: {
      engagement: 10,
      affiliation: 25,
      approval: 25,
      resistance: -10,
      stress_load: -5,
      aversion: -10,
      incongruence_risk: -5
    },
    AU13: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 0,
      aversion: 0,
      incongruence_risk: 0
    },
    AU14: {
      engagement: 0,
      affiliation: -10,
      approval: -10,
      resistance: 15,
      stress_load: 5,
      aversion: 5,
      incongruence_risk: 10
    },
    AU15: {
      engagement: -10,
      affiliation: -10,
      approval: -20,
      resistance: 20,
      stress_load: 10,
      aversion: 10,
      incongruence_risk: 5
    },
    AU16: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 0,
      aversion: 0,
      incongruence_risk: 0
    },
    AU17: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 0,
      aversion: 0,
      incongruence_risk: 0
    },
    AU18: {
      engagement: 0,
      affiliation: -5,
      approval: -5,
      resistance: 10,
      stress_load: 10,
      aversion: 0,
      incongruence_risk: 10
    },
    AU19: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 5,
      stress_load: 20,
      aversion: 0,
      incongruence_risk: 15
    },
    AU20: {
      engagement: -5,
      affiliation: -10,
      approval: -10,
      resistance: 10,
      stress_load: 25,
      aversion: 0,
      incongruence_risk: 15
    },
    AU21: {
      engagement: -5,
      affiliation: -5,
      approval: -5,
      resistance: 20,
      stress_load: 25,
      aversion: 0,
      incongruence_risk: 10
    },
    AU22: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 0,
      aversion: 0,
      incongruence_risk: 0
    },
    AU23: {
      engagement: -5,
      affiliation: -5,
      approval: -10,
      resistance: 25,
      stress_load: 15,
      aversion: 5,
      incongruence_risk: 10
    },
    AU24: {
      engagement: -5,
      affiliation: -5,
      approval: -15,
      resistance: 35,
      stress_load: 15,
      aversion: 5,
      incongruence_risk: 15
    },
    AU25: {
      engagement: 10,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 5,
      aversion: 0,
      incongruence_risk: 5
    },
    AU26: {
      engagement: 10,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 10,
      aversion: 0,
      incongruence_risk: 5
    },
    AU27: {
      engagement: 10,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 20,
      aversion: 0,
      incongruence_risk: 10
    },
    AU28: {
      engagement: -5,
      affiliation: -5,
      approval: -5,
      resistance: 10,
      stress_load: 25,
      aversion: 0,
      incongruence_risk: 10
    },
    AU41: {
      engagement: -25,
      affiliation: 0,
      approval: -10,
      resistance: 10,
      stress_load: 10,
      aversion: 0,
      incongruence_risk: 0
    },
    AU42: {
      engagement: -5,
      affiliation: -5,
      approval: -5,
      resistance: 10,
      stress_load: 10,
      aversion: 0,
      incongruence_risk: 10
    },
    AU43: {
      engagement: -10,
      affiliation: -5,
      approval: -10,
      resistance: 10,
      stress_load: 15,
      aversion: 0,
      incongruence_risk: 10
    },
    AU44: {
      engagement: -5,
      affiliation: -10,
      approval: -10,
      resistance: 15,
      stress_load: 10,
      aversion: 5,
      incongruence_risk: 10
    },
    AU45: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 5,
      stress_load: 15,
      aversion: 0,
      incongruence_risk: 10
    },
    AU46: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 0,
      aversion: 0,
      incongruence_risk: 0
    },
    HEAD51: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 0,
      aversion: 0,
      incongruence_risk: 0
    },
    HEAD52: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 0,
      aversion: 0,
      incongruence_risk: 0
    },
    HEAD53: {
      engagement: 0,
      affiliation: -5,
      approval: -5,
      resistance: 10,
      stress_load: 5,
      aversion: 0,
      incongruence_risk: 5
    },
    HEAD54: {
      engagement: -5,
      affiliation: 0,
      approval: -5,
      resistance: 5,
      stress_load: 5,
      aversion: 0,
      incongruence_risk: 0
    },
    HEAD55: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 0,
      aversion: 0,
      incongruence_risk: 0
    },
    HEAD56: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 0,
      aversion: 0,
      incongruence_risk: 0
    },
    HEAD57: {
      engagement: 10,
      affiliation: 0,
      approval: 5,
      resistance: -5,
      stress_load: 5,
      aversion: 0,
      incongruence_risk: 0
    },
    HEAD58: {
      engagement: -10,
      affiliation: -5,
      approval: -10,
      resistance: 10,
      stress_load: 10,
      aversion: 0,
      incongruence_risk: 5
    },
    GAZE61: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 5,
      aversion: 0,
      incongruence_risk: 10
    },
    GAZE62: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 5,
      aversion: 0,
      incongruence_risk: 10
    },
    GAZE63: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 5,
      aversion: 0,
      incongruence_risk: 10
    },
    GAZE64: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 10,
      aversion: 0,
      incongruence_risk: 10
    },
    AD_EXT29: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 0,
      aversion: 0,
      incongruence_risk: 0
    },
    AD_EXT30: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 0,
      aversion: 0,
      incongruence_risk: 0
    },
    AD_EXT31: {
      engagement: -5,
      affiliation: -5,
      approval: -10,
      resistance: 25,
      stress_load: 20,
      aversion: 0,
      incongruence_risk: 10
    },
    AD_EXT32: {
      engagement: -5,
      affiliation: -5,
      approval: -5,
      resistance: 10,
      stress_load: 25,
      aversion: 0,
      incongruence_risk: 10
    },
    AD_EXT34: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 0,
      aversion: 0,
      incongruence_risk: 0
    },
    AD_EXT35: {
      engagement: -5,
      affiliation: -5,
      approval: -5,
      resistance: 10,
      stress_load: 20,
      aversion: 0,
      incongruence_risk: 10
    },
    AD_EXT37: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 0,
      stress_load: 0,
      aversion: 0,
      incongruence_risk: 0
    },
    AD_EXT38: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 10,
      stress_load: 15,
      aversion: 0,
      incongruence_risk: 10
    },
    AD_EXT39: {
      engagement: 0,
      affiliation: 0,
      approval: 0,
      resistance: 10,
      stress_load: 15,
      aversion: 0,
      incongruence_risk: 10
    }
  },
  combo_rules: [
    {
      id: "C_DUCHENNE",
      requires: [
        "AU12",
        "AU6"
      ],
      forbids: [],
      description: "Sorriso genu\xEDno (Duchenne)",
      adjustments: {
        engagement: 10,
        affiliation: 15,
        approval: 10,
        resistance: -10,
        stress_load: -5,
        aversion: -10,
        incongruence_risk: -10
      },
      tag: [
        "joy_genuine",
        "trust_signal"
      ],
      recommended_action: "avan\xE7ar e consolidar acordo",
      validation_questions: [
        "Faz sentido seguir assim?",
        "Quer que eu formalize os pr\xF3ximos passos?",
        "Tem algo que voc\xEA quer ajustar antes de fechar?"
      ]
    },
    {
      id: "C_SOCIAL_SMILE",
      requires: [
        "AU12"
      ],
      forbids: [
        "AU6"
      ],
      description: "Sorriso social (boca sem olhos)",
      adjustments: {
        engagement: 0,
        affiliation: -5,
        approval: -5,
        resistance: 5,
        stress_load: 0,
        aversion: 0,
        incongruence_risk: 15
      },
      tag: [
        "polite_mask"
      ],
      recommended_action: "calibrar antes de avan\xE7ar",
      validation_questions: [
        "Em uma escala de 0 a 10, qu\xE3o ok voc\xEA est\xE1 com isso?",
        "O que voc\xEA ainda n\xE3o est\xE1 dizendo?",
        "O que precisaria ser verdade pra voc\xEA topar?"
      ]
    },
    {
      id: "C_CYNICAL_DEFENSE",
      requires: [
        "AU14",
        "AU7"
      ],
      forbids: [],
      description: "Cinismo defensivo / ironia sob tens\xE3o",
      adjustments: {
        engagement: -5,
        affiliation: -10,
        approval: -15,
        resistance: 20,
        stress_load: 10,
        aversion: 5,
        incongruence_risk: 15
      },
      tag: [
        "defensive_irony"
      ],
      recommended_action: "reduzir press\xE3o e perguntar obje\xE7\xE3o real",
      validation_questions: [
        "O que aqui n\xE3o funciona pra voc\xEA?",
        "Qual parte ainda n\xE3o est\xE1 confort\xE1vel?",
        "Se fosse ajustar 1 coisa, qual seria?"
      ]
    },
    {
      id: "C_ANGER_SUPPRESSED",
      requires: [
        "AU4",
        "AU23"
      ],
      forbids: [],
      description: "Raiva contida (tens\xE3o + boca)",
      adjustments: {
        engagement: -5,
        affiliation: -10,
        approval: -15,
        resistance: 30,
        stress_load: 20,
        aversion: 5,
        incongruence_risk: 10
      },
      tag: [
        "anger_suppressed"
      ],
      recommended_action: "pausar e descompress\xE3o",
      validation_questions: [
        "O que aqui n\xE3o funciona pra voc\xEA?",
        "Qual parte ainda n\xE3o est\xE1 confort\xE1vel?",
        "Se fosse ajustar 1 coisa, qual seria?"
      ]
    },
    {
      id: "C_BLOCKED_NO",
      requires: [
        "AU24"
      ],
      forbids: [],
      description: "Bloqueio/discord\xE2ncia forte (pressor)",
      adjustments: {
        engagement: -5,
        affiliation: -5,
        approval: -20,
        resistance: 35,
        stress_load: 15,
        aversion: 0,
        incongruence_risk: 10
      },
      tag: [
        "hard_block"
      ],
      recommended_action: "pausar, espelhar e pedir obje\xE7\xE3o",
      validation_questions: [
        "O que aqui n\xE3o funciona pra voc\xEA?",
        "Qual parte ainda n\xE3o est\xE1 confort\xE1vel?",
        "Se fosse ajustar 1 coisa, qual seria?"
      ]
    },
    {
      id: "C_DISGUST_MORAL",
      requires: [
        "AU9",
        "AU10"
      ],
      forbids: [],
      description: "Nojo + desprezo (avers\xE3o moral)",
      adjustments: {
        engagement: -15,
        affiliation: -25,
        approval: -30,
        resistance: 25,
        stress_load: 10,
        aversion: 40,
        incongruence_risk: 10
      },
      tag: [
        "moral_disgust"
      ],
      recommended_action: "mudar frame e recontratar valor",
      validation_questions: [
        "O que te incomodou especificamente?",
        "Qual parte soa ruim/errada pra voc\xEA?",
        "Que alternativa faria sentido?"
      ]
    },
    {
      id: "C_SADNESS",
      requires: [
        "AU1",
        "AU15"
      ],
      forbids: [],
      description: "Tristeza/des\xE2nimo (brow + mouth down)",
      adjustments: {
        engagement: -15,
        affiliation: 5,
        approval: -10,
        resistance: 10,
        stress_load: 15,
        aversion: 0,
        incongruence_risk: 0
      },
      tag: [
        "sadness"
      ],
      recommended_action: "acolher e reduzir exig\xEAncia",
      validation_questions: [
        "Quer que a gente fa\xE7a isso mais simples agora?",
        "O que est\xE1 pesado hoje?",
        "Como eu posso te ajudar aqui?"
      ]
    },
    {
      id: "C_HIGH_LOAD",
      requires: [
        "AU45",
        "AU7"
      ],
      forbids: [],
      description: "Carga alta (piscar + aperto ocular)",
      adjustments: {
        engagement: -5,
        affiliation: 0,
        approval: -5,
        resistance: 10,
        stress_load: 30,
        aversion: 0,
        incongruence_risk: 15
      },
      tag: [
        "high_cognitive_load"
      ],
      recommended_action: "diminuir ritmo e oferecer pausa",
      validation_questions: [
        "Quer que eu resuma em 1 frase?",
        "Prefere decidir depois com calma?",
        "O que deixaria isso mais leve?"
      ]
    },
    {
      id: "C_AVOIDANCE_RECOIL",
      requires: [
        "HEAD58"
      ],
      forbids: [],
      description: "Recuo/evita\xE7\xE3o (cabe\xE7a para tr\xE1s)",
      adjustments: {
        engagement: -10,
        affiliation: -5,
        approval: -10,
        resistance: 15,
        stress_load: 10,
        aversion: 0,
        incongruence_risk: 5
      },
      tag: [
        "avoidance"
      ],
      recommended_action: "dar espa\xE7o e perguntar prefer\xEAncia",
      validation_questions: [
        "Prefere outra op\xE7\xE3o?",
        "Quer pensar e me dizer depois?",
        "O que deixaria isso confort\xE1vel?"
      ]
    }
  ],
  default_actions_questions: {
    resistance: {
      action: "pausar, reduzir press\xE3o e convidar obje\xE7\xE3o real",
      questions: [
        "O que aqui n\xE3o funciona pra voc\xEA?",
        "Qual parte ainda n\xE3o est\xE1 confort\xE1vel?",
        "Se fosse ajustar 1 coisa, qual seria?"
      ]
    },
    stress_load: {
      action: "diminuir ritmo, oferecer op\xE7\xE3o simples e tempo",
      questions: [
        "Quer que eu resuma em 1 frase?",
        "Prefere decidir depois com calma?",
        "O que deixaria isso mais leve?"
      ]
    },
    aversion: {
      action: "mudar enquadramento/t\xF3pico e checar valor percebido",
      questions: [
        "O que te incomodou especificamente?",
        "Qual parte soa ruim/errada pra voc\xEA?",
        "Que alternativa faria sentido?"
      ]
    },
    affiliation: {
      action: "aprofundar v\xEDnculo e avan\xE7ar com pr\xF3xima etapa",
      questions: [
        "O que mais te agradou nisso?",
        "Quer que eu mostre o pr\xF3ximo passo?",
        "Qual resultado voc\xEA quer primeiro?"
      ]
    },
    engagement: {
      action: "aproveitar aten\xE7\xE3o: perguntar e co-construir",
      questions: [
        "O que voc\xEA quer priorizar?",
        "Onde isso encaixa na sua rotina?",
        "Qual seria o melhor formato pra voc\xEA?"
      ]
    },
    incongruence_risk: {
      action: "calibrar com pergunta neutra e checar congru\xEAncia",
      questions: [
        "Em uma escala de 0 a 10, qu\xE3o ok voc\xEA est\xE1 com isso?",
        "O que voc\xEA ainda n\xE3o est\xE1 dizendo?",
        "O que precisaria ser verdade pra voc\xEA topar?"
      ]
    },
    approval: {
      action: "fechar pr\xF3ximos passos com clareza e confirma\xE7\xE3o",
      questions: [
        "Faz sentido seguir assim?",
        "Quer que eu formalize os pr\xF3ximos passos?",
        "Tem algo que voc\xEA quer ajustar antes de fechar?"
      ]
    }
  },
  scoring_pipeline: [
    "1) Calibrar baseline individual (10\u201320s).",
    "2) Registrar eventos (AUs/HEAD/GAZE/AD_EXT) com intensidade, lateralidade e\ntiming.",
    "3) Somar pesos por evento (opcional: multiplicar por intensidade A\u2013E => 0.2..1.0).",
    "4) Aplicar ajustes de combo_rules quando padr\xF5es ocorrerem.",
    "5) Normalizar dimens\xF5es (ex.: clamp -100..+100) e mapear para 0..100 se necess\xE1rio.",
    "6) Escolher a\xE7\xE3o e perguntas: use a dimens\xE3o dominante negativa\n(resistance/stress/aversion/incongruence) ou positiva (approval/affiliation/engagement)."
  ],
  notes: "Pesos s\xE3o heur\xEDsticos (ponto de partida). Ajuste com seus dados e valida\xE7\xE3o\nhumana."
};

// config/facs_config.ts
var defaultFACSConfig = FACS_IA_decision_ready_v1_default;

// logic/scoring_engine.ts
function getIntensityMultiplier(value, isAu = true) {
  if (!isAu) {
    return 1;
  }
  if (value >= 0.8) return 1;
  if (value >= 0.6) return 0.8;
  if (value >= 0.4) return 0.6;
  if (value >= 0.2) return 0.4;
  if (value >= 0.1) return 0.2;
  return 0;
}
function createSalesScoringEngine(rules) {
  if (!rules) {
    throw new Error(
      "[ScoringEngine] rules \xE9 obrigat\xF3rio. Forne\xE7a a configura\xE7\xE3o FACS."
    );
  }
  if (!rules.weights_by_code) {
    throw new Error(
      "[ScoringEngine] Configura\xE7\xE3o inv\xE1lida: 'weights_by_code' n\xE3o encontrado no FACS config."
    );
  }
  if (!rules.combo_rules) {
    throw new Error(
      "[ScoringEngine] Configura\xE7\xE3o inv\xE1lida: 'combo_rules' n\xE3o encontrado no FACS config."
    );
  }
  if (!rules.dimensions) {
    throw new Error(
      "[ScoringEngine] Configura\xE7\xE3o inv\xE1lida: 'dimensions' n\xE3o encontrado no FACS config."
    );
  }
  const weights = rules.weights_by_code;
  const combos = rules.combo_rules;
  const dimensionsList = Object.keys(rules.dimensions);
  const actionsMap = rules.default_actions_questions || {};
  function process2(inputPayload) {
    const aus = inputPayload.aus || {};
    const meta = inputPayload.meta || {};
    const scores = {};
    for (const dim of dimensionsList) {
      scores[dim] = 0;
    }
    const activeCodes = [];
    for (const [code, rawVal] of Object.entries(aus)) {
      const sI = getIntensityMultiplier(rawVal, true);
      if (sI > 0 && code in weights) {
        activeCodes.push(code);
        const weightMap = weights[code] || {};
        for (const [dim, weight] of Object.entries(weightMap)) {
          scores[dim] = (scores[dim] || 0) + sI * weight;
        }
      }
    }
    const metaSignals = [];
    const gaze = meta.gaze || "CENTER";
    if (gaze === "LOOKING_DOWN") metaSignals.push("GAZE64");
    const pitch = meta.head_pitch || 0;
    if (pitch > 15) metaSignals.push("HEAD54");
    else if (pitch < -15) metaSignals.push("HEAD53");
    for (const mCode of metaSignals) {
      if (mCode in weights) {
        activeCodes.push(mCode);
        const weightMap = weights[mCode] || {};
        for (const [dim, weight] of Object.entries(weightMap)) {
          scores[dim] = (scores[dim] || 0) + 1 * weight;
        }
      }
    }
    const triggeredCombos = [];
    for (const combo of combos) {
      const requiresMet = combo.requires.every(
        (req) => activeCodes.includes(req)
      );
      const forbidsMet = combo.forbids && combo.forbids.length > 0 ? combo.forbids.some((forbid) => activeCodes.includes(forbid)) : false;
      if (requiresMet && !forbidsMet) {
        if (combo.tag && combo.tag.length > 0) {
          triggeredCombos.push(combo.tag);
        } else if (combo.id) {
          triggeredCombos.push([combo.id]);
        }
        for (const [dim, adj] of Object.entries(combo.adjustments || {})) {
          scores[dim] = (scores[dim] || 0) + adj;
        }
      }
    }
    const finalScores = {};
    for (const [k, v] of Object.entries(scores)) {
      finalScores[k] = Math.max(-100, Math.min(100, v));
    }
    let domDim = dimensionsList[0] || "engagement";
    let maxAbs = Math.abs(finalScores[domDim] || 0);
    for (const [k, v] of Object.entries(finalScores)) {
      const abs = Math.abs(v);
      if (abs > maxAbs) {
        maxAbs = abs;
        domDim = k;
      }
    }
    const actionData = actionsMap[domDim] || {
      action: "Analise",
      questions: []
    };
    return {
      dominant_dimension: domDim,
      dominant_value: Math.round(finalScores[domDim] || 0),
      active_combos: triggeredCombos,
      scores: finalScores,
      recommended_actions: [actionData.action],
      questions: actionData.questions
    };
  }
  return {
    process: process2
  };
}

// modules/gaze_tracker.ts
var IDX_IRIS_L = 468;
var IDX_EYE_L_CORNERS = [33, 133];
var IDX_NOSE = 1;
var IDX_FACE_EDGES = [234, 454];
function createGazeTracker(config) {
  const maxDeviation = config.safety?.max_gaze_deviation || 100;
  function analyze(landmarks) {
    const nose = landmarks[IDX_NOSE];
    const leftEar = landmarks[IDX_FACE_EDGES[0]];
    const rightEar = landmarks[IDX_FACE_EDGES[1]];
    if (!nose || !leftEar || !rightEar) {
      return {
        isLooking: false,
        deviation: 0,
        status: "ERROR"
      };
    }
    const faceWidth = rightEar.x - leftEar.x;
    if (Math.abs(faceWidth) < 1e-6) {
      return {
        isLooking: false,
        deviation: 0,
        status: "ERROR"
      };
    }
    const headYawRatio = (nose.x - leftEar.x) / faceWidth;
    const headYawDeviation = Math.abs(headYawRatio - 0.5) * 200;
    const irisL = landmarks[IDX_IRIS_L];
    const eyeLStart = landmarks[IDX_EYE_L_CORNERS[0]];
    const eyeLEnd = landmarks[IDX_EYE_L_CORNERS[1]];
    if (!irisL || !eyeLStart || !eyeLEnd) {
      return {
        isLooking: false,
        deviation: 0,
        status: "ERROR"
      };
    }
    const eyeLWidth = eyeLEnd.x - eyeLStart.x;
    const irisRatio = Math.abs(eyeLWidth) < 1e-6 ? 0.5 : (irisL.x - eyeLStart.x) / eyeLWidth;
    const irisDeviation = Math.abs(irisRatio - 0.5) * 200;
    const totalDeviation = headYawDeviation + irisDeviation * 0.5;
    const irisY = irisL.y;
    const eyeYCenter = (eyeLStart.y + eyeLEnd.y) / 2;
    const verticalDiff = (irisY - eyeYCenter) * 1e3;
    let status = "DIRECT";
    if (totalDeviation > maxDeviation) {
      if (verticalDiff < -15) {
        status = "THINKING_UP";
      } else if (verticalDiff > 15) {
        status = "THINKING_DOWN";
      } else {
        status = "SIDEWAY";
      }
      return {
        isLooking: false,
        deviation: totalDeviation,
        status
      };
    }
    return {
      isLooking: true,
      deviation: totalDeviation,
      status: "DIRECT"
    };
  }
  return {
    analyze
  };
}

// modules/landmark_tracker.ts
function convertToFaceLandmarkResult(mpResult) {
  if (!Array.isArray(mpResult.faceLandmarks)) {
    console.warn("faceLandmarks is not an array:", mpResult.faceLandmarks);
    return {
      faceLandmarks: []
    };
  }
  const faceLandmarks = mpResult.faceLandmarks.filter((face) => Array.isArray(face)).map(
    (face) => face.map((point) => ({
      x: point.x,
      y: point.y,
      z: point.z
    }))
  );
  let faceBlendshapes;
  if (mpResult.faceBlendshapes) {
    if (!Array.isArray(mpResult.faceBlendshapes)) {
      console.warn(
        "faceBlendshapes is not an array:",
        typeof mpResult.faceBlendshapes,
        mpResult.faceBlendshapes
      );
    } else {
      try {
        faceBlendshapes = mpResult.faceBlendshapes.filter((faceBlendshape) => {
          const isValid = faceBlendshape && typeof faceBlendshape === "object" && "categories" in faceBlendshape && Array.isArray(faceBlendshape.categories);
          if (!isValid && process.env.NODE_ENV === "development") {
            console.warn(
              "faceBlendshapes element is not in expected format:",
              typeof faceBlendshape,
              faceBlendshape
            );
          }
          return isValid;
        }).map(
          (faceBlendshape) => faceBlendshape.categories.map((blendshape) => ({
            category_name: blendshape.categoryName,
            score: blendshape.score
          }))
        );
      } catch (error) {
        console.error("Error converting faceBlendshapes:", error);
        faceBlendshapes = void 0;
      }
    }
  }
  const converted = {
    faceLandmarks
  };
  if (faceBlendshapes) {
    converted.faceBlendshapes = faceBlendshapes;
  }
  return converted;
}
function createLandmarkTracker(detector, modelPath = "/models/face_landmarker.task") {
  const initialized = true;
  function processFrame(frame, timestamp = Date.now()) {
    try {
      if (!detector || !initialized) {
        console.warn("LandmarkTracker not initialized.");
        return null;
      }
      const detectionResult = detector.detectForVideo(frame, timestamp);
      if (!detectionResult) {
        return null;
      }
      if (typeof window !== "undefined") {
        const win = window;
        if (!win.__mpDebugLogged) {
          win.__mpDebugLogged = true;
          const firstBlendshape = detectionResult.faceBlendshapes?.[0];
          console.log("MediaPipe result structure:", {
            hasFaceLandmarks: !!detectionResult.faceLandmarks,
            faceLandmarksLength: Array.isArray(detectionResult.faceLandmarks) ? detectionResult.faceLandmarks.length : 0,
            hasFaceBlendshapes: !!detectionResult.faceBlendshapes,
            faceBlendshapesLength: Array.isArray(
              detectionResult.faceBlendshapes
            ) ? detectionResult.faceBlendshapes.length : 0,
            firstBlendshapeType: firstBlendshape ? typeof firstBlendshape : "N/A",
            firstBlendshapeKeys: firstBlendshape && typeof firstBlendshape === "object" ? Object.keys(firstBlendshape) : [],
            hasCategories: firstBlendshape && typeof firstBlendshape === "object" ? "categories" in firstBlendshape : false,
            categoriesType: firstBlendshape && typeof firstBlendshape === "object" && "categories" in firstBlendshape ? Array.isArray(firstBlendshape.categories) ? "array" : typeof firstBlendshape.categories : "N/A",
            categoriesLength: firstBlendshape && typeof firstBlendshape === "object" && "categories" in firstBlendshape && Array.isArray(firstBlendshape.categories) ? firstBlendshape.categories.length : 0,
            sample: firstBlendshape
          });
        }
      }
      if (!detectionResult.faceLandmarks || !Array.isArray(detectionResult.faceLandmarks) || detectionResult.faceLandmarks.length === 0) {
        return null;
      }
      return convertToFaceLandmarkResult(detectionResult);
    } catch (error) {
      console.error("Error in LandmarkTracker:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message, error.stack);
      }
      return null;
    }
  }
  function isInitialized() {
    return initialized;
  }
  function getModelPath() {
    return modelPath;
  }
  return {
    processFrame,
    isInitialized,
    getModelPath
  };
}

// modules/voice_activity.ts
var IDX_LIP_TOP = 13;
var IDX_LIP_BOTTOM = 14;
var IDX_NOSE2 = 1;
var IDX_CHIN = 152;
function createVoiceActivityDetector(config) {
  const threshold = config.vad?.speaking_threshold || 0.2;
  function isSpeaking(landmarks) {
    const lipTop = landmarks[IDX_LIP_TOP];
    const lipBottom = landmarks[IDX_LIP_BOTTOM];
    if (!lipTop || !lipBottom) return false;
    const lipDist = euclideanDistance(lipTop, lipBottom);
    const nose = landmarks[IDX_NOSE2];
    const chin = landmarks[IDX_CHIN];
    if (!nose || !chin) return false;
    const faceRefDist = euclideanDistance(nose, chin);
    if (faceRefDist === 0) return false;
    const openingRatio = lipDist / faceRefDist;
    return openingRatio > threshold;
  }
  return {
    isSpeaking
  };
}

// index.ts
async function sendToAPI(apiUrl, result) {
  try {
    await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(result)
    });
  } catch (error) {
    console.warn("[Engine] Erro ao enviar para API (n\xE3o bloqueante):", error);
  }
}
function createFaceExpressionEngine(options, faceLandmarker) {
  const config = options.thresholdsConfig || defaultThresholdsConfig;
  const facsConfig = options.facsConfig || defaultFACSConfig;
  if (!facsConfig.weights_by_code) {
    throw new Error(
      "[Engine] facsConfig inv\xE1lido: 'weights_by_code' n\xE3o encontrado.\nVerifique se o JSON est\xE1 correto."
    );
  }
  if (!facsConfig.combo_rules) {
    throw new Error(
      "[Engine] facsConfig inv\xE1lido: 'combo_rules' n\xE3o encontrado.\nVerifique se o JSON est\xE1 correto."
    );
  }
  if (!facsConfig.dimensions) {
    throw new Error(
      "[Engine] facsConfig inv\xE1lido: 'dimensions' n\xE3o encontrado.\nVerifique se o JSON est\xE1 correto."
    );
  }
  const apiUrl = options.apiUrl;
  const windowSeconds = options.windowSeconds || 4;
  const fps = options.fps || 30;
  const windowSize = Math.floor(windowSeconds * fps);
  const tracker = createLandmarkTracker(faceLandmarker);
  const gazeTracker = createGazeTracker(config);
  const vad = createVoiceActivityDetector(config);
  const hybridEngine = createHybridEngine();
  const flowEngine = createLandmarkFlowEngine();
  const scoringEngine = createSalesScoringEngine(facsConfig);
  let buffer = [];
  let lastAnalysisTime = Date.now();
  let lastOpticalFlowTime = 0;
  const OPTICAL_FLOW_INTERVAL = 3;
  let frameCount = 0;
  let currentDecision = null;
  let onResultCallback;
  let onDecisionCallback;
  function onResult(callback) {
    onResultCallback = callback;
  }
  function onDecision(callback) {
    onDecisionCallback = callback;
  }
  async function processFrame(frame) {
    const timestamp = Date.now();
    const detectionResult = tracker.processFrame(frame, timestamp);
    if (!detectionResult || !detectionResult.faceLandmarks || detectionResult.faceLandmarks.length === 0) {
      return null;
    }
    const firstLandmarks = detectionResult.faceLandmarks[0];
    if (!firstLandmarks) {
      return null;
    }
    const landmarks = firstLandmarks;
    const blendshapes = detectionResult.faceBlendshapes?.[0] || [];
    let width = 1280;
    let height = 720;
    if (frame instanceof HTMLVideoElement) {
      width = frame.videoWidth;
      height = frame.videoHeight;
    } else if (frame instanceof HTMLCanvasElement) {
      width = frame.width;
      height = frame.height;
    } else if (frame instanceof ImageData) {
      width = frame.width;
      height = frame.height;
    }
    const { aus, rotPenalty } = hybridEngine.process(
      blendshapes,
      landmarks,
      width,
      height
    );
    const gazeResult = gazeTracker.analyze(landmarks);
    const isSpeaking = vad.isSpeaking(landmarks);
    frameCount++;
    const shouldRunFlow = rotPenalty < 0.3 && (frameCount % OPTICAL_FLOW_INTERVAL === 0 || lastOpticalFlowTime === 0);
    if (shouldRunFlow) {
      try {
        const flowStart = performance.now();
        const strains = await flowEngine.analyze(landmarks, width, height);
        const flowTime = performance.now() - flowStart;
        lastOpticalFlowTime = flowTime;
        if (flowTime > 10) {
          console.warn(
            `[Engine] Flow analysis lento: ${flowTime.toFixed(1)}ms`
          );
        }
        if (strains.brow < -3) {
          aus.AU4 = Math.max(aus.AU4 || 0, 0.45);
        }
        if (strains.nose < -2.5) {
          aus.AU9 = Math.max(aus.AU9 || 0, 0.4);
        }
        if (Math.abs(strains.mouth) > 4) {
          const mouthAus = ["AU12", "AU24", "AU25"];
          for (const mAu of mouthAus) {
            if ((aus[mAu] || 0) > 0.1) {
              aus[mAu] = (aus[mAu] || 0) + 0.15;
            }
          }
        }
      } catch {
      }
    }
    const nose = landmarks[1];
    const earL = landmarks[234];
    const earR = landmarks[454];
    if (nose && earL && earR) {
      const faceWidth = earR.x - earL.x;
      const headYaw = faceWidth !== 0 ? (nose.x - earL.x) / faceWidth : 0.5;
      const meta = {
        gaze: gazeResult.status,
        is_speaking: isSpeaking,
        head_yaw: (headYaw - 0.5) * 180,
        head_pitch: (nose.y - (earL.y + earR.y) / 2) * 200
      };
      buffer.push({
        aus: { ...aus },
        meta,
        timestamp
      });
      if (buffer.length > windowSize) {
        buffer.shift();
      }
      const timeSinceLastAnalysis = (timestamp - lastAnalysisTime) / 1e3;
      if (timeSinceLastAnalysis >= windowSeconds) {
        if (buffer.length >= windowSize * 0.8) {
          const firstEntry = buffer[0];
          if (!firstEntry) {
            return null;
          }
          const allKeys = Object.keys(firstEntry.aus);
          const summaryAus = {};
          for (const key of allKeys) {
            const values = buffer.map((entry) => entry.aus[key] || 0).sort((a, b) => a - b);
            const percentile95Index = Math.floor(values.length * 0.95);
            summaryAus[key] = values[percentile95Index] || 0;
          }
          const lastEntry = buffer[buffer.length - 1];
          if (!lastEntry) {
            return null;
          }
          const windowPayload = {
            aus: summaryAus,
            meta: lastEntry.meta
          };
          currentDecision = scoringEngine.process(windowPayload);
          lastAnalysisTime = timestamp;
          if (onDecisionCallback && currentDecision) {
            try {
              onDecisionCallback(currentDecision);
            } catch (error) {
              console.error("[Engine] Erro no callback onDecision:", error);
            }
          }
          if (apiUrl && currentDecision) {
            sendToAPI(apiUrl, currentDecision).catch(() => {
            });
          }
        }
      }
      const result = {
        aus,
        meta,
        rotPenalty,
        isStable: buffer.length >= windowSize * 0.3,
        currentDecision: currentDecision || void 0
      };
      if (onResultCallback) {
        try {
          onResultCallback(result);
        } catch (error) {
          console.error("[Engine] Erro no callback onResult:", error);
        }
      }
      return result;
    }
    return null;
  }
  function calibrate(currentAus) {
    hybridEngine.calibrate(currentAus);
  }
  function resetCalibration() {
    hybridEngine.resetCalibration();
  }
  function getCurrentDecision() {
    return currentDecision;
  }
  function clearBuffer() {
    buffer = [];
    lastAnalysisTime = Date.now();
  }
  return {
    processFrame,
    calibrate,
    resetCalibration,
    getCurrentDecision,
    clearBuffer,
    onResult,
    onDecision
  };
}

export { createFaceExpressionEngine, defaultFACSConfig };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map