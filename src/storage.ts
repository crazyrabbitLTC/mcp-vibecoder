/**
 * In-memory storage for features and related data.
 */
import { Feature, FeatureStorage } from './types.js';

/**
 * In-memory storage for features
 */
export const features: FeatureStorage = {};

/**
 * Add a new feature to storage
 * @param feature The feature to store
 * @returns The stored feature
 */
export function storeFeature(feature: Feature): Feature {
  features[feature.id] = feature;
  return feature;
}

/**
 * Retrieve a feature by ID
 * @param id The feature ID
 * @returns The feature or undefined if not found
 */
export function getFeature(id: string): Feature | undefined {
  return features[id];
}

/**
 * Update an existing feature
 * @param id The feature ID
 * @param updatedFields Fields to update on the feature
 * @returns The updated feature or undefined if not found
 */
export function updateFeature(
  id: string,
  updatedFields: Partial<Omit<Feature, 'id' | 'createdAt'>>
): Feature | undefined {
  const feature = features[id];
  
  if (!feature) {
    return undefined;
  }
  
  // Update the feature with new fields
  const updatedFeature = {
    ...feature,
    ...updatedFields,
    updatedAt: new Date()
  };
  
  features[id] = updatedFeature;
  return updatedFeature;
}

/**
 * List all features
 * @returns Array of all features
 */
export function listFeatures(): Feature[] {
  return Object.values(features);
}

/**
 * Delete a feature by ID
 * @param id The feature ID
 * @returns True if deleted, false if not found
 */
export function deleteFeature(id: string): boolean {
  if (features[id]) {
    delete features[id];
    return true;
  }
  return false;
} 