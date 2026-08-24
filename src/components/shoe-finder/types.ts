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

/** Phase 2 contract for the Shoe Finder experience; this WI intentionally ships no quiz engine. */
export interface ShoeFinderConfig {
    steps: QuizStep[];
    resultMapping: SearchRefinements[];
}

export interface QuizStep {
    id: string;
    question: string;
    type: 'single' | 'multi';
    options: QuizOption[];
    skipCondition?: (answers: Record<string, string | string[]>) => boolean;
}

export interface QuizOption {
    value: string;
    label: string;
    description?: string;
    icon?: string;
}

export interface SearchRefinements {
    categoryId?: string;
    refinements: Record<string, string | string[]>;
}
