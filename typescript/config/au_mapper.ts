/**
 * AU Mapper: Processa a configuração JSON para calcular Action Units a partir de blendshapes
 */

import auMappingsConfig from "@json/au_mappings.json";

type BlendshapeMap = Record<string, number>;
type ActionUnits = Record<string, number>;

interface DirectMapping {
	type: "direct";
	blendshapes: string[];
}

interface AverageMapping {
	type: "average";
	blendshapes: string[];
}

interface ReferenceMapping {
	type: "reference";
	source: string;
}

interface CompositeMapping {
	type: "composite";
	base: DirectMapping | AverageMapping | CompositeMapping;
	multiplier?: number;
	additions?: Array<{
		source: string | DirectMapping | AverageMapping;
		multiplier: number;
	}>;
}

type AUMapping =
	| DirectMapping
	| AverageMapping
	| ReferenceMapping
	| CompositeMapping;

interface AUMappingsConfig {
	mappings: Record<string, AUMapping>;
}

function calculateMappingValue(
	mapping: AUMapping,
	bs: BlendshapeMap,
	calculatedAus: ActionUnits,
): number {
	switch (mapping.type) {
		case "direct": {
			const value = mapping.blendshapes
				.map((name) => bs[name] || 0)
				.reduce((sum, val) => sum + val, 0);
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

			if (mapping.multiplier !== undefined) {
				value *= mapping.multiplier;
			}

			if (mapping.additions) {
				for (const addition of mapping.additions) {
					let additionValue: number;
					if (typeof addition.source === "string") {
						additionValue = calculatedAus[addition.source] || 0;
					} else {
						additionValue = calculateMappingValue(
							addition.source,
							bs,
							calculatedAus,
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

export function calculateAUsFromMappings(bs: BlendshapeMap): ActionUnits {
	const config = auMappingsConfig as AUMappingsConfig;
	const aus: ActionUnits = {};

	const auOrder = Object.keys(config.mappings);
	for (const auName of auOrder) {
		const mapping = config.mappings[auName];
		aus[auName] = calculateMappingValue(mapping as AUMapping, bs, aus);
	}

	return aus;
}
