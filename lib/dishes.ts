// The dinner game's built-in deck. Both people swipe through the same
// dishes (shuffled the same way each day); the first one you both say yes
// to is dinner. Your own ideas from Us › Dinner are mixed in too.
export type Dish = { key: string; title: string; emoji: string };

export const DISHES: Dish[] = [
  { key: "lahmacun", title: "Lahmacun", emoji: "🫓" },
  { key: "pide", title: "Pide", emoji: "🫓" },
  { key: "adana", title: "Adana kebab", emoji: "🍢" },
  { key: "iskender", title: "İskender", emoji: "🥩" },
  { key: "doner", title: "Döner", emoji: "🥙" },
  { key: "manti", title: "Mantı", emoji: "🥟" },
  { key: "kofte", title: "Köfte", emoji: "🧆" },
  { key: "menemen", title: "Menemen", emoji: "🍳" },
  { key: "karniyarik", title: "Karnıyarık", emoji: "🍆" },
  { key: "mercimek", title: "Lentil soup", emoji: "🥣" },
  { key: "meze", title: "Meze platter", emoji: "🫒" },
  { key: "balik", title: "Grilled fish", emoji: "🐟" },
  { key: "sushi", title: "Sushi", emoji: "🍣" },
  { key: "ramen", title: "Ramen", emoji: "🍜" },
  { key: "katsu", title: "Katsu curry", emoji: "🍛" },
  { key: "dim-sum", title: "Dim sum", emoji: "🥟" },
  { key: "chinese", title: "Chinese takeaway", emoji: "🥡" },
  { key: "pad-thai", title: "Pad Thai", emoji: "🍜" },
  { key: "thai-curry", title: "Thai green curry", emoji: "🍛" },
  { key: "pho", title: "Pho", emoji: "🍲" },
  { key: "korean-bbq", title: "Korean BBQ", emoji: "🥩" },
  { key: "indian", title: "Indian curry", emoji: "🍛" },
  { key: "biryani", title: "Biryani", emoji: "🍚" },
  { key: "pizza", title: "Pizza", emoji: "🍕" },
  { key: "pasta", title: "Pasta", emoji: "🍝" },
  { key: "carbonara", title: "Carbonara", emoji: "🍝" },
  { key: "lasagne", title: "Lasagne", emoji: "🍝" },
  { key: "risotto", title: "Risotto", emoji: "🍚" },
  { key: "burger", title: "Burgers", emoji: "🍔" },
  { key: "steak", title: "Steak", emoji: "🥩" },
  { key: "roast", title: "Sunday roast", emoji: "🍗" },
  { key: "fish-chips", title: "Fish and chips", emoji: "🐟" },
  { key: "pie", title: "Pie and mash", emoji: "🥧" },
  { key: "fried-chicken", title: "Fried chicken", emoji: "🍗" },
  { key: "peri-peri", title: "Peri-peri chicken", emoji: "🌶️" },
  { key: "tacos", title: "Tacos", emoji: "🌮" },
  { key: "burrito", title: "Burrito", emoji: "🌯" },
  { key: "fajitas", title: "Fajitas", emoji: "🫑" },
  { key: "lebanese", title: "Lebanese mezze", emoji: "🧆" },
  { key: "shawarma", title: "Shawarma", emoji: "🥙" },
  { key: "greek", title: "Souvlaki and Greek salad", emoji: "🥗" },
  { key: "paella", title: "Paella", emoji: "🥘" },
  { key: "tapas", title: "Tapas", emoji: "🍤" },
  { key: "poke", title: "Poke bowl", emoji: "🥗" },
  { key: "salad", title: "Big salad", emoji: "🥗" },
  { key: "soup", title: "Soup and bread", emoji: "🍲" },
  { key: "stir-fry", title: "Stir-fry at home", emoji: "🥢" },
  { key: "jacket-potato", title: "Jacket potatoes", emoji: "🥔" },
  { key: "breakfast", title: "Breakfast for dinner", emoji: "🥞" },
  { key: "kahvalti", title: "Turkish breakfast spread", emoji: "🧀" },
  { key: "bbq", title: "Barbecue", emoji: "🔥" },
  { key: "wings", title: "Chicken wings", emoji: "🍗" },
  { key: "seafood", title: "Seafood", emoji: "🦐" },
  { key: "dumplings", title: "Dumplings", emoji: "🥟" },
  { key: "noodles", title: "Noodles", emoji: "🍜" },
  { key: "toasties", title: "Toasties", emoji: "🥪" },
  { key: "cheese-board", title: "Cheese and wine night", emoji: "🧀" },
  { key: "leftovers", title: "Leftovers", emoji: "🥡" },
];

export const dishByKey = new Map(DISHES.map((d) => [d.key, d]));

/** Same shuffle for both people on the same day, different each day. */
export function shuffleForDay<T>(items: T[], day: string): T[] {
  let seed = 0;
  for (const ch of day) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
