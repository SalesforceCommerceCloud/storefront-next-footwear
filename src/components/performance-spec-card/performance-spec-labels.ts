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
import type { CushioningLevel, SupportType, Terrain } from './performance-spec-data';

/**
 * Static experiential-language mapping table for `displayMode="experiential"`. Shipped with
 * the template — no AI/LLM call, no network request. Translation keys (under the `product`
 * namespace) hold the actual copy; this module only supplies the i18next key + interpolation
 * defaults and the dot-scale positions, so the mapping stays a build-time lookup.
 */

/** Dot-scale position (out of `DOT_SCALE_LENGTH`) for each cushioning level. */
export const CUSHIONING_SCALE: Record<CushioningLevel, number> = {
    light: 1,
    moderate: 2,
    maximum: 3,
} as const;

/** Dot-scale position (out of `DOT_SCALE_LENGTH`) for each support type. */
export const SUPPORT_SCALE: Record<SupportType, number> = {
    neutral: 1,
    stability: 2,
    motion_control: 3,
} as const;

export const DOT_SCALE_LENGTH = 3;

/** i18next key + English default for the technical (raw enum) label of each spec value. */
export const CUSHIONING_TECHNICAL_KEY: Record<CushioningLevel, { key: string; defaultValue: string }> = {
    light: { key: 'performanceSpecs.cushioning.technical.light', defaultValue: 'Light' },
    moderate: { key: 'performanceSpecs.cushioning.technical.moderate', defaultValue: 'Moderate' },
    maximum: { key: 'performanceSpecs.cushioning.technical.maximum', defaultValue: 'Maximum' },
};

export const SUPPORT_TECHNICAL_KEY: Record<SupportType, { key: string; defaultValue: string }> = {
    neutral: { key: 'performanceSpecs.support.technical.neutral', defaultValue: 'Neutral' },
    stability: { key: 'performanceSpecs.support.technical.stability', defaultValue: 'Stability' },
    motion_control: { key: 'performanceSpecs.support.technical.motion_control', defaultValue: 'Motion control' },
};

export const TERRAIN_TECHNICAL_KEY: Record<Terrain, { key: string; defaultValue: string }> = {
    road: { key: 'performanceSpecs.terrain.technical.road', defaultValue: 'Road' },
    trail: { key: 'performanceSpecs.terrain.technical.trail', defaultValue: 'Trail' },
    track: { key: 'performanceSpecs.terrain.technical.track', defaultValue: 'Track' },
    treadmill: { key: 'performanceSpecs.terrain.technical.treadmill', defaultValue: 'Treadmill' },
    multi: { key: 'performanceSpecs.terrain.technical.multi', defaultValue: 'Multi-surface' },
};

/**
 * i18next key + English default for the experiential (descriptive) language of each spec
 * value. This is the static mapping table called out by the WI: fixed, shipped copy, never
 * generated at request time.
 */
export const CUSHIONING_EXPERIENTIAL_KEY: Record<CushioningLevel, { key: string; defaultValue: string }> = {
    light: { key: 'performanceSpecs.cushioning.experiential.light', defaultValue: 'Fast and responsive underfoot' },
    moderate: {
        key: 'performanceSpecs.cushioning.experiential.moderate',
        defaultValue: 'Balanced cushioning for everyday miles',
    },
    maximum: {
        key: 'performanceSpecs.cushioning.experiential.maximum',
        defaultValue: 'Plush, high-cushion ride for long distances',
    },
};

export const SUPPORT_EXPERIENTIAL_KEY: Record<SupportType, { key: string; defaultValue: string }> = {
    neutral: {
        key: 'performanceSpecs.support.experiential.neutral',
        defaultValue: 'Natural stride with no added correction',
    },
    stability: {
        key: 'performanceSpecs.support.experiential.stability',
        defaultValue: 'Gentle guidance to counter overpronation',
    },
    motion_control: {
        key: 'performanceSpecs.support.experiential.motion_control',
        defaultValue: 'Maximum structure for significant overpronation',
    },
};

export const TERRAIN_EXPERIENTIAL_KEY: Record<Terrain, { key: string; defaultValue: string }> = {
    road: { key: 'performanceSpecs.terrain.experiential.road', defaultValue: 'Built for pavement and paved paths' },
    trail: { key: 'performanceSpecs.terrain.experiential.trail', defaultValue: 'Grips loose dirt, rock, and roots' },
    track: { key: 'performanceSpecs.terrain.experiential.track', defaultValue: 'Tuned for speed on the track' },
    treadmill: {
        key: 'performanceSpecs.terrain.experiential.treadmill',
        defaultValue: 'Lightweight feel for indoor running',
    },
    multi: {
        key: 'performanceSpecs.terrain.experiential.multi',
        defaultValue: 'Versatile traction for mixed surfaces',
    },
};
