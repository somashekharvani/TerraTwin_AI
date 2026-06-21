import { calculateEmissions } from '../../src/routes/carbon';
import { haversine } from '../../src/routes/track';
import { getNFTEvolutionTier } from '../../src/routes/tokens';

describe('Carbon Calculations & Helper Utilities', () => {
  test('calculates emissions for all categories and types (coverage boost)', () => {
    // Energy category
    expect(calculateEmissions('energy', 'electricity', 100)).toBe(23.3);
    expect(calculateEmissions('energy', 'gas', 100)).toBe(20.0);
    expect(calculateEmissions('energy', 'unknown', 100)).toBe(0.0);

    // Transport category
    expect(calculateEmissions('transport', 'car', 10)).toBe(2.1);
    expect(calculateEmissions('transport', 'bus', 10)).toBe(1.1);
    expect(calculateEmissions('transport', 'bike', 10)).toBe(0.0);
    expect(calculateEmissions('transport', 'walk', 10)).toBe(0.0);

    // Food category
    expect(calculateEmissions('food', 'beef', 2)).toBe(54.0);
    expect(calculateEmissions('food', 'chicken', 2)).toBe(13.8);
    expect(calculateEmissions('food', 'vegetables', 2)).toBe(4.0);
    expect(calculateEmissions('food', 'plant-based', 2)).toBe(4.0);

    // Other categories
    expect(calculateEmissions('shopping', 'clothes', 10)).toBe(5.0);
    expect(calculateEmissions('waste', 'plastic', 10)).toBe(3.5);
    expect(calculateEmissions('unknown_category', 'anything', 10)).toBe(0.0);
  });

  test('calculates distance between coordinates using Haversine formula', () => {
    const lat1 = 40.7128;
    const lon1 = -74.006; // NYC
    const lat2 = 40.758;
    const lon2 = -73.9855; // Midtown
    const distance = haversine(lat1, lon1, lat2, lon2);
    expect(distance).toBeCloseTo(5.3, 1); // ~5.3 km
  });

  test('determines correct NFT evolution tier', () => {
    expect(getNFTEvolutionTier(10)).toBe('🌱 Seed');
    expect(getNFTEvolutionTier(100)).toBe('🌿 Sprout');
    expect(getNFTEvolutionTier(200)).toBe('🌳 Tree');
    expect(getNFTEvolutionTier(400)).toBe('🌲 Forest');
    expect(getNFTEvolutionTier(600)).toBe('🦁 Wildlife');
    expect(getNFTEvolutionTier(800)).toBe('🌍 Ecosystem');
  });
});
