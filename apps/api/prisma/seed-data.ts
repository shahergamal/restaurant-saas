/* Demo catalogue for the seed: a Riyadh restaurant serving Saudi and international dishes. */

export type Unit = 'kg' | 'L' | 'pack' | 'pcs';

export interface IngredientDef {
  slug: string;
  en: string;
  ar: string;
  unit: Unit;
  category: 'produce' | 'meat' | 'seafood' | 'dairy' | 'dry_goods' | 'beverages';
  /** SAR per unit */
  cost: number;
  min: number;
  reorder: number;
  /** Current on-hand quantity in the main branch */
  qty: number;
  image?: boolean;
  /** Days until the current lot expires (perishables) */
  shelfDays?: number;
  supplier: number;
}

// prettier-ignore
export const INGREDIENTS: IngredientDef[] = [
  // Produce
  { slug: 'tomatoes', en: 'Tomatoes', ar: 'طماطم', unit: 'kg', category: 'produce', cost: 6.5, min: 5, reorder: 15, qty: 12, image: true, shelfDays: 2, supplier: 0 },
  { slug: 'lettuce', en: 'Lettuce', ar: 'خس', unit: 'kg', category: 'produce', cost: 9, min: 4, reorder: 10, qty: 25, image: true, shelfDays: 2, supplier: 0 },
  { slug: 'onions', en: 'Onions', ar: 'بصل', unit: 'kg', category: 'produce', cost: 4, min: 5, reorder: 12, qty: 20, image: true, shelfDays: 20, supplier: 0 },
  { slug: 'basil', en: 'Basil', ar: 'ريحان', unit: 'kg', category: 'produce', cost: 38, min: 2, reorder: 4, qty: 2, image: true, shelfDays: 2, supplier: 0 },
  { slug: 'potatoes', en: 'Potatoes', ar: 'بطاطس', unit: 'kg', category: 'produce', cost: 4.5, min: 10, reorder: 25, qty: 60, image: true, shelfDays: 25, supplier: 0 },
  { slug: 'lemons', en: 'Lemons', ar: 'ليمون', unit: 'kg', category: 'produce', cost: 8, min: 3, reorder: 8, qty: 14, image: true, shelfDays: 12, supplier: 0 },
  { slug: 'mint', en: 'Mint', ar: 'نعناع', unit: 'kg', category: 'produce', cost: 22, min: 1, reorder: 3, qty: 4, image: true, shelfDays: 3, supplier: 0 },
  { slug: 'cucumbers', en: 'Cucumbers', ar: 'خيار', unit: 'kg', category: 'produce', cost: 6, min: 3, reorder: 8, qty: 15, image: true, shelfDays: 6, supplier: 0 },
  { slug: 'bell-peppers', en: 'Bell Peppers', ar: 'فلفل رومي', unit: 'kg', category: 'produce', cost: 12, min: 3, reorder: 7, qty: 11, image: true, shelfDays: 7, supplier: 0 },
  { slug: 'garlic', en: 'Garlic', ar: 'ثوم', unit: 'kg', category: 'produce', cost: 18, min: 1, reorder: 3, qty: 6, image: true, shelfDays: 30, supplier: 0 },
  { slug: 'parsley', en: 'Parsley', ar: 'بقدونس', unit: 'kg', category: 'produce', cost: 16, min: 1, reorder: 3, qty: 5, shelfDays: 3, supplier: 0 },
  { slug: 'mushrooms', en: 'Mushrooms', ar: 'فطر', unit: 'kg', category: 'produce', cost: 24, min: 2, reorder: 5, qty: 7, shelfDays: 3, supplier: 0 },
  { slug: 'oranges', en: 'Oranges', ar: 'برتقال', unit: 'kg', category: 'produce', cost: 6, min: 8, reorder: 20, qty: 40, image: true, shelfDays: 10, supplier: 0 },
  // Meat
  { slug: 'chicken-breast', en: 'Chicken Breast', ar: 'صدر دجاج', unit: 'kg', category: 'meat', cost: 32, min: 6, reorder: 15, qty: 8, image: true, shelfDays: 3, supplier: 1 },
  { slug: 'beef', en: 'Beef Tenderloin', ar: 'لحم بقري', unit: 'kg', category: 'meat', cost: 68, min: 5, reorder: 12, qty: 22, image: true, shelfDays: 4, supplier: 1 },
  { slug: 'lamb', en: 'Lamb', ar: 'لحم غنم', unit: 'kg', category: 'meat', cost: 75, min: 6, reorder: 14, qty: 26, image: true, shelfDays: 4, supplier: 1 },
  { slug: 'minced-beef', en: 'Minced Beef', ar: 'لحم مفروم', unit: 'kg', category: 'meat', cost: 52, min: 5, reorder: 12, qty: 18, shelfDays: 3, supplier: 1 },
  { slug: 'whole-chicken', en: 'Whole Chicken', ar: 'دجاج كامل', unit: 'kg', category: 'meat', cost: 22, min: 8, reorder: 20, qty: 34, shelfDays: 3, supplier: 1 },
  { slug: 'beef-ribs', en: 'Beef Ribs', ar: 'ريش بقري', unit: 'kg', category: 'meat', cost: 58, min: 4, reorder: 10, qty: 0, shelfDays: 4, supplier: 1 },
  { slug: 'lamb-chops-raw', en: 'Lamb Chops', ar: 'ريش غنم', unit: 'kg', category: 'meat', cost: 95, min: 3, reorder: 8, qty: 12, shelfDays: 4, supplier: 1 },
  // Seafood
  { slug: 'salmon', en: 'Fresh Salmon', ar: 'سلمون طازج', unit: 'kg', category: 'seafood', cost: 95, min: 2, reorder: 6, qty: 3, image: true, shelfDays: 2, supplier: 2 },
  { slug: 'shrimp', en: 'Shrimp', ar: 'روبيان', unit: 'kg', category: 'seafood', cost: 70, min: 2, reorder: 5, qty: 9, shelfDays: 2, supplier: 2 },
  { slug: 'calamari', en: 'Calamari', ar: 'كاليماري', unit: 'kg', category: 'seafood', cost: 55, min: 1, reorder: 4, qty: 0, shelfDays: 2, supplier: 2 },
  { slug: 'white-fish', en: 'Hammour Fish', ar: 'سمك هامور', unit: 'kg', category: 'seafood', cost: 48, min: 2, reorder: 5, qty: 10, shelfDays: 2, supplier: 2 },
  // Dairy
  { slug: 'mozzarella', en: 'Mozzarella Cheese', ar: 'جبن موزاريلا', unit: 'kg', category: 'dairy', cost: 42, min: 2, reorder: 6, qty: 4, image: true, shelfDays: 9, supplier: 3 },
  { slug: 'eggs', en: 'Eggs', ar: 'بيض', unit: 'pack', category: 'dairy', cost: 24, min: 6, reorder: 15, qty: 30, image: true, shelfDays: 14, supplier: 3 },
  { slug: 'milk', en: 'Fresh Milk', ar: 'حليب طازج', unit: 'L', category: 'dairy', cost: 6.5, min: 10, reorder: 25, qty: 48, image: true, shelfDays: 3, supplier: 3 },
  { slug: 'cream', en: 'Cooking Cream', ar: 'كريمة طبخ', unit: 'L', category: 'dairy', cost: 18, min: 4, reorder: 10, qty: 16, image: true, shelfDays: 8, supplier: 3 },
  { slug: 'butter', en: 'Butter', ar: 'زبدة', unit: 'kg', category: 'dairy', cost: 38, min: 2, reorder: 5, qty: 9, image: true, shelfDays: 30, supplier: 3 },
  { slug: 'parmesan', en: 'Parmesan', ar: 'جبن بارميزان', unit: 'kg', category: 'dairy', cost: 110, min: 1, reorder: 3, qty: 5, image: true, shelfDays: 60, supplier: 3 },
  { slug: 'feta', en: 'Feta Cheese', ar: 'جبن فيتا', unit: 'kg', category: 'dairy', cost: 45, min: 1, reorder: 3, qty: 4, shelfDays: 20, supplier: 3 },
  { slug: 'yogurt', en: 'Yogurt', ar: 'زبادي', unit: 'kg', category: 'dairy', cost: 9, min: 3, reorder: 8, qty: 14, shelfDays: 2, supplier: 3 },
  { slug: 'cream-cheese', en: 'Cream Cheese', ar: 'جبن كريمي', unit: 'kg', category: 'dairy', cost: 36, min: 2, reorder: 4, qty: 6, shelfDays: 20, supplier: 3 },
  // Dry goods
  { slug: 'olive-oil', en: 'Olive Oil', ar: 'زيت زيتون', unit: 'L', category: 'dry_goods', cost: 32, min: 4, reorder: 10, qty: 15, image: true, supplier: 4 },
  { slug: 'rice', en: 'Basmati Rice', ar: 'أرز بسمتي', unit: 'kg', category: 'dry_goods', cost: 9, min: 20, reorder: 50, qty: 120, image: true, supplier: 4 },
  { slug: 'flour', en: 'Flour', ar: 'دقيق', unit: 'kg', category: 'dry_goods', cost: 3.5, min: 10, reorder: 25, qty: 70, image: true, supplier: 4 },
  { slug: 'pasta', en: 'Dry Pasta', ar: 'مكرونة', unit: 'kg', category: 'dry_goods', cost: 8, min: 8, reorder: 20, qty: 45, image: true, supplier: 4 },
  { slug: 'sugar', en: 'Sugar', ar: 'سكر', unit: 'kg', category: 'dry_goods', cost: 4, min: 8, reorder: 20, qty: 40, image: true, supplier: 4 },
  { slug: 'black-pepper', en: 'Black Pepper', ar: 'فلفل أسود', unit: 'kg', category: 'dry_goods', cost: 60, min: 0.5, reorder: 1.5, qty: 3, supplier: 4 },
  { slug: 'cardamom', en: 'Cardamom', ar: 'هيل', unit: 'kg', category: 'dry_goods', cost: 140, min: 0.5, reorder: 1.5, qty: 4, image: true, supplier: 4 },
  { slug: 'saffron', en: 'Saffron', ar: 'زعفران', unit: 'kg', category: 'dry_goods', cost: 4500, min: 0.02, reorder: 0.05, qty: 0, supplier: 4 },
  { slug: 'kabsa-spices', en: 'Kabsa Spice Mix', ar: 'بهارات كبسة', unit: 'kg', category: 'dry_goods', cost: 85, min: 0.5, reorder: 2, qty: 5, supplier: 4 },
  { slug: 'cumin', en: 'Cumin', ar: 'كمون', unit: 'kg', category: 'dry_goods', cost: 55, min: 0.5, reorder: 1.5, qty: 3, supplier: 4 },
  { slug: 'chickpeas', en: 'Chickpeas', ar: 'حمص حب', unit: 'kg', category: 'dry_goods', cost: 7, min: 5, reorder: 12, qty: 25, image: true, supplier: 4 },
  { slug: 'tahini', en: 'Tahini', ar: 'طحينة', unit: 'kg', category: 'dry_goods', cost: 24, min: 2, reorder: 5, qty: 9, supplier: 4 },
  { slug: 'quinoa', en: 'Quinoa', ar: 'كينوا', unit: 'kg', category: 'dry_goods', cost: 28, min: 2, reorder: 5, qty: 8, supplier: 4 },
  { slug: 'bread-crumbs', en: 'Bread Crumbs', ar: 'بقسماط', unit: 'kg', category: 'dry_goods', cost: 10, min: 2, reorder: 5, qty: 7, supplier: 4 },
  { slug: 'burger-buns', en: 'Burger Buns', ar: 'خبز برجر', unit: 'pack', category: 'dry_goods', cost: 14, min: 4, reorder: 10, qty: 16, shelfDays: 3, supplier: 4 },
  { slug: 'pita-bread', en: 'Pita Bread', ar: 'خبز عربي', unit: 'pack', category: 'dry_goods', cost: 6, min: 6, reorder: 15, qty: 0, shelfDays: 2, supplier: 4 },
  { slug: 'tomato-sauce', en: 'Tomato Sauce', ar: 'صلصة طماطم', unit: 'L', category: 'dry_goods', cost: 9, min: 5, reorder: 12, qty: 22, supplier: 4 },
  { slug: 'chocolate', en: 'Dark Chocolate', ar: 'شوكولاتة داكنة', unit: 'kg', category: 'dry_goods', cost: 55, min: 1, reorder: 3, qty: 5, supplier: 4 },
  { slug: 'dates', en: 'Sukkari Dates', ar: 'تمر سكري', unit: 'kg', category: 'dry_goods', cost: 30, min: 3, reorder: 8, qty: 14, image: true, supplier: 4 },
  { slug: 'kunafa-dough', en: 'Kunafa Dough', ar: 'عجينة كنافة', unit: 'kg', category: 'dry_goods', cost: 18, min: 2, reorder: 5, qty: 7, shelfDays: 5, supplier: 4 },
  { slug: 'pistachio', en: 'Pistachio', ar: 'فستق حلبي', unit: 'kg', category: 'dry_goods', cost: 120, min: 0.5, reorder: 1.5, qty: 2, supplier: 4 },
  { slug: 'frying-oil', en: 'Frying Oil', ar: 'زيت قلي', unit: 'L', category: 'dry_goods', cost: 7, min: 10, reorder: 25, qty: 40, supplier: 4 },
  // Beverages
  { slug: 'coffee-beans', en: 'Coffee Beans', ar: 'حبوب قهوة', unit: 'kg', category: 'beverages', cost: 95, min: 2, reorder: 5, qty: 8, image: true, supplier: 5 },
  { slug: 'saudi-coffee', en: 'Saudi Coffee', ar: 'قهوة سعودية', unit: 'kg', category: 'beverages', cost: 120, min: 1, reorder: 3, qty: 5, supplier: 5 },
  { slug: 'tea', en: 'Black Tea', ar: 'شاي أسود', unit: 'kg', category: 'beverages', cost: 60, min: 0.5, reorder: 2, qty: 3, supplier: 5 },
  { slug: 'soft-drinks', en: 'Soft Drinks', ar: 'مشروبات غازية', unit: 'pcs', category: 'beverages', cost: 1.5, min: 48, reorder: 120, qty: 260, supplier: 5 },
  { slug: 'water', en: 'Mineral Water', ar: 'مياه معدنية', unit: 'pcs', category: 'beverages', cost: 0.8, min: 48, reorder: 120, qty: 300, supplier: 5 },
];

export const SUPPLIERS = [
  { name: 'مزارع القصيم للخضار', phone: '+966112345601', vat: '300112233400003' },
  { name: 'ملحمة الوطنية', phone: '+966112345602', vat: '300223344500003' },
  { name: 'أسماك الخليج', phone: '+966112345603', vat: '300334455600003' },
  { name: 'ألبان المراعي للتوزيع', phone: '+966112345604', vat: '300445566700003' },
  { name: 'مؤسسة الجزيرة للمواد الغذائية', phone: '+966112345605', vat: '300556677800003' },
  { name: 'محمصة الرياض', phone: '+966112345606', vat: '300667788900003' },
];

export const CATEGORIES = [
  { key: 'seafood', en: 'Seafood', ar: 'مأكولات بحرية' },
  { key: 'meat', en: 'Meat', ar: 'لحوم ومشويات' },
  { key: 'saudi', en: 'Saudi Dishes', ar: 'أطباق سعودية' },
  { key: 'pasta', en: 'Pasta', ar: 'مكرونة' },
  { key: 'salad', en: 'Salad', ar: 'سلطات' },
  { key: 'pizza', en: 'Pizza', ar: 'بيتزا' },
  { key: 'burgers', en: 'Burgers', ar: 'برجر' },
  { key: 'soups', en: 'Soup', ar: 'شوربات' },
  { key: 'sides', en: 'Sides', ar: 'أطباق جانبية' },
  { key: 'desserts', en: 'Desserts', ar: 'حلويات' },
  { key: 'drinks', en: 'Cold Drinks', ar: 'مشروبات باردة' },
  { key: 'hot_drinks', en: 'Hot Drinks', ar: 'مشروبات ساخنة' },
];

export const STATIONS = [
  { key: 'grill', en: 'Grill Station', ar: 'محطة الشواء' },
  { key: 'pasta', en: 'Pasta Station', ar: 'محطة المكرونة' },
  { key: 'salad', en: 'Salad Station', ar: 'محطة السلطات' },
  { key: 'desserts', en: 'Desserts Station', ar: 'محطة الحلويات' },
  { key: 'drinks', en: 'Drinks Station', ar: 'محطة المشروبات' },
];

export interface MenuDef {
  slug: string;
  en: string;
  ar: string;
  cat: string;
  station: string;
  price: number;
  /** relative popularity */
  weight: number;
  /** "ingredient:qty[:waste%]" where qty is grams/ml or thousandths of a pack/piece */
  recipe: string[];
}

// prettier-ignore
export const MENU: MenuDef[] = [
  { slug: 'grilled-salmon', en: 'Grilled Salmon', ar: 'سلمون مشوي', cat: 'seafood', station: 'grill', price: 69, weight: 10, recipe: ['salmon:180:8', 'lemons:30', 'olive-oil:15', 'potatoes:120:10', 'butter:10'] },
  { slug: 'beef-steak', en: 'Beef Steak', ar: 'ستيك لحم', cat: 'meat', station: 'grill', price: 85, weight: 6, recipe: ['beef:220:8', 'butter:15', 'potatoes:150:10', 'garlic:5', 'black-pepper:2'] },
  { slug: 'ribeye-steak', en: 'Ribeye Steak', ar: 'ستيك ريب آي', cat: 'meat', station: 'grill', price: 110, weight: 3, recipe: ['beef:300:10', 'butter:15', 'garlic:5', 'black-pepper:2'] },
  { slug: 'lamb-chops', en: 'Lamb Chops', ar: 'ريش غنم', cat: 'meat', station: 'grill', price: 89, weight: 4, recipe: ['lamb-chops-raw:280:12', 'olive-oil:10', 'garlic:5', 'mint:5'] },
  { slug: 'mixed-grill', en: 'Mixed Grill', ar: 'مشاوي مشكلة', cat: 'meat', station: 'grill', price: 95, weight: 4, recipe: ['lamb:150:10', 'chicken-breast:150:8', 'minced-beef:120', 'onions:50', 'bell-peppers:50', 'pita-bread:250'] },
  { slug: 'bbq-ribs', en: 'BBQ Ribs', ar: 'ريش باربكيو', cat: 'meat', station: 'grill', price: 92, weight: 2, recipe: ['beef-ribs:450:15', 'tomato-sauce:60', 'sugar:20'] },
  { slug: 'chicken-breast', en: 'Chicken Breast', ar: 'صدر دجاج مشوي', cat: 'meat', station: 'grill', price: 49, weight: 8, recipe: ['chicken-breast:220:8', 'olive-oil:10', 'garlic:5', 'potatoes:120:10'] },
  { slug: 'chicken-kabsa', en: 'Chicken Kabsa', ar: 'كبسة دجاج', cat: 'saudi', station: 'grill', price: 45, weight: 9, recipe: ['whole-chicken:450:20', 'rice:200', 'kabsa-spices:8', 'onions:40', 'tomatoes:40', 'cardamom:2'] },
  { slug: 'lamb-mandi', en: 'Lamb Mandi', ar: 'مندي لحم', cat: 'saudi', station: 'grill', price: 75, weight: 6, recipe: ['lamb:380:18', 'rice:220', 'kabsa-spices:8', 'onions:40', 'saffron:1'] },
  { slug: 'chicken-shawarma', en: 'Chicken Shawarma', ar: 'شاورما دجاج', cat: 'saudi', station: 'grill', price: 22, weight: 9, recipe: ['chicken-breast:140:8', 'pita-bread:170', 'garlic:10', 'yogurt:30', 'potatoes:60'] },
  { slug: 'mutabbal', en: 'Mutabbal', ar: 'متبل', cat: 'saudi', station: 'salad', price: 18, weight: 3, recipe: ['tahini:40', 'yogurt:40', 'garlic:5', 'olive-oil:10', 'lemons:10'] },
  { slug: 'hummus', en: 'Hummus', ar: 'حمص', cat: 'saudi', station: 'salad', price: 16, weight: 5, recipe: ['chickpeas:120', 'tahini:40', 'olive-oil:15', 'lemons:15', 'garlic:5'] },
  { slug: 'chicken-pasta', en: 'Chicken Pasta', ar: 'مكرونة بالدجاج', cat: 'pasta', station: 'pasta', price: 42, weight: 5, recipe: ['pasta:150', 'chicken-breast:120:8', 'cream:80', 'parmesan:15', 'mushrooms:40'] },
  { slug: 'pasta-alfredo', en: 'Pasta Alfredo', ar: 'باستا ألفريدو', cat: 'pasta', station: 'pasta', price: 24, weight: 7, recipe: ['pasta:160', 'cream:220', 'parmesan:70', 'butter:40', 'garlic:8', 'mushrooms:80'] },
  { slug: 'fettuccine-alfredo', en: 'Fettuccine Alfredo', ar: 'فيتوتشيني ألفريدو', cat: 'pasta', station: 'pasta', price: 46, weight: 3, recipe: ['pasta:160', 'cream:120', 'parmesan:30', 'butter:20'] },
  { slug: 'penne-arrabbiata', en: 'Penne Arrabbiata', ar: 'بيني أرابياتا', cat: 'pasta', station: 'pasta', price: 38, weight: 3, recipe: ['pasta:150', 'tomato-sauce:150', 'garlic:8', 'olive-oil:15', 'basil:4'] },
  { slug: 'spaghetti-bolognese', en: 'Spaghetti Bolognese', ar: 'سباغيتي بولونيز', cat: 'pasta', station: 'pasta', price: 44, weight: 4, recipe: ['pasta:150', 'minced-beef:130', 'tomato-sauce:120', 'onions:30', 'parmesan:10'] },
  { slug: 'lasagna', en: 'Lasagna', ar: 'لازانيا', cat: 'pasta', station: 'pasta', price: 48, weight: 3, recipe: ['pasta:130', 'minced-beef:140', 'tomato-sauce:100', 'mozzarella:80', 'milk:100', 'flour:15'] },
  { slug: 'pesto-pasta', en: 'Pesto Pasta', ar: 'مكرونة بيستو', cat: 'pasta', station: 'pasta', price: 40, weight: 2, recipe: ['pasta:150', 'basil:25', 'olive-oil:30', 'parmesan:20', 'garlic:5'] },
  { slug: 'carbonara', en: 'Carbonara', ar: 'كاربونارا', cat: 'pasta', station: 'pasta', price: 46, weight: 3, recipe: ['pasta:150', 'eggs:67', 'parmesan:30', 'cream:60', 'black-pepper:2'] },
  { slug: 'seafood-pasta', en: 'Seafood Pasta', ar: 'مكرونة مأكولات بحرية', cat: 'pasta', station: 'pasta', price: 62, weight: 2, recipe: ['pasta:150', 'shrimp:100:10', 'calamari:60:10', 'tomato-sauce:100', 'garlic:8'] },
  { slug: 'caesar-salad', en: 'Caesar Salad', ar: 'سلطة سيزر', cat: 'salad', station: 'salad', price: 32, weight: 9, recipe: ['lettuce:180:15', 'parmesan:20', 'chicken-breast:80:8', 'bread-crumbs:20', 'eggs:33', 'lemons:10'] },
  { slug: 'greek-salad', en: 'Greek Salad', ar: 'سلطة يونانية', cat: 'salad', station: 'salad', price: 30, weight: 4, recipe: ['tomatoes:120:10', 'cucumbers:100:10', 'feta:60', 'onions:30', 'olive-oil:20'] },
  { slug: 'quinoa-salad', en: 'Quinoa Salad', ar: 'سلطة كينوا', cat: 'salad', station: 'salad', price: 34, weight: 3, recipe: ['quinoa:80', 'cucumbers:60:10', 'tomatoes:60:10', 'parsley:20', 'lemons:20', 'olive-oil:15'] },
  { slug: 'garden-salad', en: 'Garden Salad', ar: 'سلطة خضراء', cat: 'salad', station: 'salad', price: 26, weight: 3, recipe: ['lettuce:120:15', 'tomatoes:80:10', 'cucumbers:80:10', 'bell-peppers:40', 'olive-oil:15'] },
  { slug: 'margherita-pizza', en: 'Margherita Pizza', ar: 'بيتزا مارغريتا', cat: 'pizza', station: 'pasta', price: 39, weight: 6, recipe: ['flour:220', 'mozzarella:150', 'tomato-sauce:90', 'basil:5', 'olive-oil:10'] },
  { slug: 'beef-burger', en: 'Beef Burger', ar: 'برجر لحم', cat: 'burgers', station: 'grill', price: 45, weight: 7, recipe: ['minced-beef:180', 'burger-buns:83', 'lettuce:20', 'tomatoes:30', 'onions:20', 'potatoes:150:10', 'frying-oil:40'] },
  { slug: 'veggie-burger', en: 'Veggie Burger', ar: 'برجر نباتي', cat: 'burgers', station: 'grill', price: 38, weight: 2, recipe: ['chickpeas:150', 'burger-buns:83', 'lettuce:20', 'tomatoes:30', 'bread-crumbs:20'] },
  { slug: 'grilled-cheese', en: 'Grilled Cheese', ar: 'ساندويتش جبن مشوي', cat: 'burgers', station: 'grill', price: 28, weight: 2, recipe: ['pita-bread:170', 'mozzarella:90', 'butter:15'] },
  { slug: 'tomato-soup', en: 'Tomato Soup', ar: 'شوربة طماطم', cat: 'soups', station: 'salad', price: 19, weight: 3, recipe: ['tomatoes:200:10', 'cream:40', 'onions:30', 'basil:3', 'butter:10'] },
  { slug: 'french-fries', en: 'French Fries', ar: 'بطاطس مقلية', cat: 'sides', station: 'grill', price: 14, weight: 8, recipe: ['potatoes:220:12', 'frying-oil:60'] },
  { slug: 'onion-rings', en: 'Onion Rings', ar: 'حلقات بصل', cat: 'sides', station: 'grill', price: 16, weight: 3, recipe: ['onions:150:10', 'flour:40', 'bread-crumbs:30', 'frying-oil:60'] },
  { slug: 'garlic-bread', en: 'Garlic Bread', ar: 'خبز بالثوم', cat: 'sides', station: 'pasta', price: 14, weight: 4, recipe: ['flour:120', 'butter:30', 'garlic:10', 'parsley:5'] },
  { slug: 'mashed-potatoes', en: 'Mashed Potatoes', ar: 'بطاطس مهروسة', cat: 'sides', station: 'grill', price: 15, weight: 3, recipe: ['potatoes:220:12', 'butter:25', 'milk:60'] },
  { slug: 'roasted-veggies', en: 'Roasted Veggies', ar: 'خضار مشوية', cat: 'sides', station: 'grill', price: 18, weight: 3, recipe: ['bell-peppers:80', 'mushrooms:60', 'onions:50', 'olive-oil:15'] },
  { slug: 'chocolate-lava-cake', en: 'Chocolate Lava Cake', ar: 'كيكة الشوكولاتة الذائبة', cat: 'desserts', station: 'desserts', price: 32, weight: 4, recipe: ['chocolate:80', 'butter:40', 'eggs:67', 'sugar:40', 'flour:20'] },
  { slug: 'cheesecake', en: 'Cheesecake', ar: 'تشيز كيك', cat: 'desserts', station: 'desserts', price: 29, weight: 4, recipe: ['cream-cheese:120', 'sugar:35', 'eggs:33', 'cream:40', 'butter:20'] },
  { slug: 'kunafa', en: 'Kunafa', ar: 'كنافة', cat: 'desserts', station: 'desserts', price: 35, weight: 5, recipe: ['kunafa-dough:120', 'mozzarella:80', 'butter:40', 'sugar:40', 'pistachio:10'] },
  { slug: 'soft-drink', en: 'Soft Drink', ar: 'مشروب غازي', cat: 'drinks', station: 'drinks', price: 9, weight: 9, recipe: ['soft-drinks:1000'] },
  { slug: 'iced-latte', en: 'Iced Latte', ar: 'آيس لاتيه', cat: 'drinks', station: 'drinks', price: 21, weight: 5, recipe: ['coffee-beans:18', 'milk:200', 'sugar:10'] },
  { slug: 'fresh-juice', en: 'Fresh Juice', ar: 'عصير طازج', cat: 'drinks', station: 'drinks', price: 18, weight: 5, recipe: ['oranges:250:10', 'lemons:30', 'sugar:15'] },
  { slug: 'orange-juice', en: 'Orange Juice', ar: 'عصير برتقال', cat: 'drinks', station: 'drinks', price: 17, weight: 5, recipe: ['oranges:350:10'] },
  { slug: 'mint-lemonade', en: 'Mint Lemonade', ar: 'ليمون بالنعناع', cat: 'drinks', station: 'drinks', price: 18, weight: 6, recipe: ['lemons:80', 'mint:10', 'sugar:30'] },
  { slug: 'iced-tea', en: 'Iced Tea', ar: 'شاي مثلج', cat: 'drinks', station: 'drinks', price: 15, weight: 3, recipe: ['tea:6', 'lemons:20', 'sugar:20'] },
  { slug: 'lemonade', en: 'Lemonade', ar: 'ليموناضة', cat: 'drinks', station: 'drinks', price: 16, weight: 4, recipe: ['lemons:90', 'sugar:30'] },
  { slug: 'cappuccino', en: 'Cappuccino', ar: 'كابتشينو', cat: 'hot_drinks', station: 'drinks', price: 18, weight: 4, recipe: ['coffee-beans:18', 'milk:150'] },
  { slug: 'americano', en: 'Americano', ar: 'أمريكانو', cat: 'hot_drinks', station: 'drinks', price: 14, weight: 3, recipe: ['coffee-beans:18', 'water:500'] },
  { slug: 'saudi-coffee', en: 'Saudi Coffee', ar: 'قهوة سعودية', cat: 'hot_drinks', station: 'drinks', price: 12, weight: 6, recipe: ['saudi-coffee:15', 'cardamom:3', 'dates:60'] },
];

/** Static floor-map elements in a 1000 x 700 canvas. */
export const FLOOR_LAYOUTS = {
  ground: {
    walls: true,
    kitchen: { x: 55, y: 40, w: 210, h: 110 },
    bar: { x: 620, y: 70, w: 270, h: 70, stools: 5 },
    booth: { x: 470, y: 420, w: 150, h: 120 },
    entrance: { x: 430, w: 140 },
    plants: [[40, 40], [510, 60], [920, 40], [35, 250], [975, 300], [30, 560], [945, 600], [470, 655], [585, 655]],
    counterLine: { x1: 270, y1: 10, x2: 980, y2: 10 },
  },
  first: {
    walls: true,
    bar: { x: 830, y: 170, w: 120, h: 230, vertical: true, stools: 3 },
    plants: [[960, 25], [25, 300], [610, 590], [960, 470]],
    featured: true,
  },
  terrace: {
    walls: false,
    plants: [[60, 60], [940, 60], [60, 620], [940, 620], [500, 40]],
  },
};

// Table positions (canvas coordinates). Ground floor mirrors a 23-table dining room.
// prettier-ignore
export const TABLES: { floor: keyof typeof FLOOR_LAYOUTS; label: number; x: number; y: number; seats: number; shape: 'square' | 'round'; section: 'family' | 'single' }[] = [
  { floor: 'ground', label: 1, x: 156, y: 226, seats: 4, shape: 'square', section: 'family' },
  { floor: 'ground', label: 2, x: 317, y: 215, seats: 4, shape: 'square', section: 'family' },
  { floor: 'ground', label: 3, x: 476, y: 222, seats: 4, shape: 'square', section: 'family' },
  { floor: 'ground', label: 4, x: 724, y: 226, seats: 6, shape: 'round', section: 'family' },
  { floor: 'ground', label: 5, x: 873, y: 224, seats: 6, shape: 'round', section: 'family' },
  { floor: 'ground', label: 6, x: 133, y: 347, seats: 4, shape: 'square', section: 'family' },
  { floor: 'ground', label: 7, x: 265, y: 349, seats: 4, shape: 'square', section: 'family' },
  { floor: 'ground', label: 8, x: 395, y: 349, seats: 4, shape: 'square', section: 'single' },
  { floor: 'ground', label: 9, x: 668, y: 354, seats: 4, shape: 'round', section: 'family' },
  { floor: 'ground', label: 10, x: 784, y: 355, seats: 4, shape: 'square', section: 'family' },
  { floor: 'ground', label: 11, x: 896, y: 353, seats: 4, shape: 'square', section: 'family' },
  { floor: 'ground', label: 12, x: 85, y: 471, seats: 2, shape: 'square', section: 'single' },
  { floor: 'ground', label: 13, x: 217, y: 474, seats: 4, shape: 'square', section: 'single' },
  { floor: 'ground', label: 14, x: 356, y: 474, seats: 4, shape: 'square', section: 'single' },
  { floor: 'ground', label: 15, x: 547, y: 484, seats: 4, shape: 'square', section: 'family' },
  { floor: 'ground', label: 16, x: 764, y: 482, seats: 4, shape: 'square', section: 'family' },
  { floor: 'ground', label: 17, x: 893, y: 483, seats: 4, shape: 'square', section: 'family' },
  { floor: 'ground', label: 18, x: 105, y: 597, seats: 6, shape: 'round', section: 'family' },
  { floor: 'ground', label: 19, x: 235, y: 597, seats: 4, shape: 'square', section: 'family' },
  { floor: 'ground', label: 20, x: 403, y: 605, seats: 4, shape: 'square', section: 'single' },
  { floor: 'ground', label: 21, x: 527, y: 602, seats: 4, shape: 'square', section: 'single' },
  { floor: 'ground', label: 22, x: 739, y: 602, seats: 4, shape: 'square', section: 'family' },
  { floor: 'ground', label: 23, x: 868, y: 602, seats: 4, shape: 'square', section: 'family' },
  // First floor: 14 tables around a bar
  { floor: 'first', label: 24, x: 110, y: 90, seats: 4, shape: 'square', section: 'family' },
  { floor: 'first', label: 25, x: 330, y: 85, seats: 2, shape: 'square', section: 'single' },
  { floor: 'first', label: 26, x: 545, y: 85, seats: 2, shape: 'square', section: 'single' },
  { floor: 'first', label: 27, x: 760, y: 95, seats: 4, shape: 'square', section: 'family' },
  { floor: 'first', label: 28, x: 110, y: 290, seats: 4, shape: 'square', section: 'family' },
  { floor: 'first', label: 29, x: 330, y: 290, seats: 4, shape: 'square', section: 'family' },
  { floor: 'first', label: 30, x: 545, y: 290, seats: 2, shape: 'square', section: 'single' },
  { floor: 'first', label: 31, x: 110, y: 470, seats: 4, shape: 'square', section: 'family' },
  { floor: 'first', label: 32, x: 330, y: 470, seats: 4, shape: 'square', section: 'family' },
  { floor: 'first', label: 33, x: 545, y: 470, seats: 2, shape: 'square', section: 'single' },
  { floor: 'first', label: 34, x: 110, y: 630, seats: 4, shape: 'square', section: 'family' },
  { floor: 'first', label: 35, x: 330, y: 630, seats: 2, shape: 'square', section: 'single' },
  { floor: 'first', label: 36, x: 545, y: 630, seats: 4, shape: 'square', section: 'family' },
  { floor: 'first', label: 37, x: 790, y: 610, seats: 6, shape: 'square', section: 'family' },
  // Terrace
  { floor: 'terrace', label: 38, x: 250, y: 330, seats: 4, shape: 'round', section: 'family' },
  { floor: 'terrace', label: 39, x: 500, y: 330, seats: 4, shape: 'round', section: 'family' },
  { floor: 'terrace', label: 40, x: 750, y: 330, seats: 6, shape: 'round', section: 'family' },
];

export const FEEDBACK_COMMENTS = [
  { text: 'أكل لذيذ وخدمة سريعة. الطاقم كان ودود جداً!', author: 'سارة م.' },
  { text: 'الكبسة ممتازة والجلسات العائلية مريحة.', author: 'عبدالله ع.' },
  { text: 'Amazing food and fast service. The staff were very friendly!', author: 'Sarah M.' },
  { text: 'السلمون طازج والتقديم راقي.', author: 'نورة ق.' },
  { text: 'تجربة رائعة، القهوة السعودية مضبوطة.', author: 'فهد س.' },
];
