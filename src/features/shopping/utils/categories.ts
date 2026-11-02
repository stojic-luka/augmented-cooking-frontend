import type { ShoppingItemCategory } from '../types';

const KEYWORDS: [RegExp, ShoppingItemCategory][] = [
  [/(apple|banana|orange|lemon|lime|berry|berries|tomato|onion|garlic|potato|carrot|salad|spinach|lettuce|pepper|cucumber|mushroom|broccoli|herb|basil|parsley|avocado|celery|zucchini)/, 'produce'],
  [/(milk|cheese|butter|yogurt|cream|egg|cheddar|mozzarella|parmesan|feta)/, 'dairy'],
  [/(chicken|beef|pork|lamb|turkey|bacon|sausage|steak|mince)/, 'meat'],
  [/(salmon|fish|shrimp|prawn|tuna|cod|seafood|squid)/, 'seafood'],
  [/(rice|pasta|noodle|flour|bread|quinoa|oat|cereal|grain|tortilla|noodle)/, 'grains'],
  [/(salt|pepper|spice|paprika|cumin|cinnamon|chili|oregano|thyme|curry|vanilla|baking)/, 'spices'],
  [/(oil|vinegar|sugar|honey|sauce|ketchup|mustard|mayo|stock|broth|can|canned|jam|syrup)/, 'pantry'],
  [/(frozen|ice cream|peas \(frozen\))/, 'frozen'],
  [/(bread|baguette|bun|roll|croissant|bagel)/, 'bakery'],
  [/(water|juice|soda|wine|beer|coffee|tea)/, 'beverages'],
];

export function guessCategory(name: string): ShoppingItemCategory {
  const normalized = name.toLowerCase();
  for (const [pattern, category] of KEYWORDS) {
    if (pattern.test(normalized)) {
      return category;
    }
  }
  return 'other';
}
