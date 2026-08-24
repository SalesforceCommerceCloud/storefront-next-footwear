/**
 * Copyright 2026 Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export type CushioningLevel = 'light' | 'moderate' | 'maximum';
export type SupportType = 'neutral' | 'stability' | 'motion_control';
export type Terrain = 'road' | 'trail' | 'track' | 'treadmill' | 'multi';

const CUSHIONING_LEVELS: readonly CushioningLevel[] = ['light', 'moderate', 'maximum'];
const SUPPORT_TYPES: readonly SupportType[] = ['neutral', 'stability', 'motion_control'];
const TERRAINS: readonly Terrain[] = ['road', 'trail', 'track', 'treadmill', 'multi'];

/** Sanity bounds for numeric custom attributes — values outside these are treated as absent. */
const HEEL_TOE_DROP_MAX_MM = 20;
const WEIGHT_MAX_G = 1000;

export interface PerformanceSpec {
    /** Midsole cushioning level (`c_cushioning`) */
    cushioning?: CushioningLevel;
    /** Heel-to-toe offset in millimeters (`c_heelDrop`) */
    heelToeDrop?: number;
    /** Shoe weight in grams, display-only (`c_weight`) */
    weight?: number;
    /** Pronation-control category (`c_supportType`) */
    supportType?: SupportType;
    /** Intended running/wear surface (`c_terrain`) */
    terrain?: Terrain;
}

/** Shape of the untyped custom attributes read off a SCAPI product. */
interface RawPerformanceProduct {
    c_cushioning?: unknown;
    c_heelDrop?: unknown;
    c_weight?: unknown;
    c_supportType?: unknown;
    c_terrain?: unknown;
    customProperties?: unknown;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function readAttribute(product: RawPerformanceProduct, key: keyof PerformanceSpecAttributes): unknown {
    const flatValue = product[key];
    if (flatValue !== undefined) return flatValue;

    if (!Array.isArray(product.customProperties)) return undefined;
    const matchingEntry = product.customProperties.find(
        (property): property is { id: unknown; value: unknown } =>
            typeof property === 'object' &&
            property !== null &&
            'id' in property &&
            'value' in property &&
            property.id === key
    );
    const value = matchingEntry?.value;
    return Array.isArray(value) ? value[0] : value;
}

type PerformanceSpecAttributes = Pick<
    RawPerformanceProduct,
    'c_cushioning' | 'c_heelDrop' | 'c_weight' | 'c_supportType' | 'c_terrain'
>;

/**
 * Parses a footwear product's performance custom attributes (`c_cushioning`, `c_heelDrop`,
 * `c_weight`, `c_supportType`, `c_terrain`) into a {@link PerformanceSpec}.
 *
 * Unlike `parseFitFeedback`, this is NOT all-or-nothing: each attribute is validated
 * independently and only recognized values are included. Returns `null` only when none of
 * the five attributes resolve to a valid value, so `PerformanceSpecCard` can render nothing
 * rather than an empty shell.
 */
export function parsePerformanceSpec(product: unknown): PerformanceSpec | null {
    if (typeof product !== 'object' || product === null) return null;
    const raw = product as RawPerformanceProduct;

    const spec: PerformanceSpec = {};

    const cushioning = readAttribute(raw, 'c_cushioning');
    const heelDrop = readAttribute(raw, 'c_heelDrop');
    const weight = readAttribute(raw, 'c_weight');
    const supportType = readAttribute(raw, 'c_supportType');
    const terrain = readAttribute(raw, 'c_terrain');

    if (typeof cushioning === 'string' && CUSHIONING_LEVELS.includes(cushioning as CushioningLevel)) {
        spec.cushioning = cushioning as CushioningLevel;
    }

    if (isFiniteNumber(heelDrop) && heelDrop >= 0 && heelDrop <= HEEL_TOE_DROP_MAX_MM) {
        spec.heelToeDrop = heelDrop;
    }

    if (isFiniteNumber(weight) && weight > 0 && weight <= WEIGHT_MAX_G) {
        spec.weight = weight;
    }

    if (typeof supportType === 'string' && SUPPORT_TYPES.includes(supportType as SupportType)) {
        spec.supportType = supportType as SupportType;
    }

    if (typeof terrain === 'string' && TERRAINS.includes(terrain as Terrain)) {
        spec.terrain = terrain as Terrain;
    }

    return Object.keys(spec).length > 0 ? spec : null;
}
