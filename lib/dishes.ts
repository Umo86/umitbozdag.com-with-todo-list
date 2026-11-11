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
  { key: "chinese", title: "Chinese takeaway", emoji: "🥡" },
  { key: "pad-thai", title: "Pad Thai", emoji: "🍜" },
  { key: "thai-curry", title: "Thai green curry", emoji: "🍛" },
  { key: "pho", title: "Pho", emoji: "🍲" },
  { key: "korean-bbq", title: "Korean BBQ", emoji: "🥩" },
  { key: "indian", title: "Indian curry", emoji: "🍛" },
  { key: "biryani", title: "Biryani", emoji: "🍚" },
  { key: "pizza", title: "Pizza", emoji: "🍕" },
  { key: "pasta", title: "Pasta", emoji: "🍝" },
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
  { key: "breakfast", title: "Breakfast for dinner", emoji: "🥞" },
  { key: "kahvalti", title: "Turkish breakfast spread", emoji: "🧀" },
  { key: "bbq", title: "Barbecue", emoji: "🔥" },
  { key: "seafood", title: "Seafood", emoji: "🦐" },
  { key: "dumplings", title: "Dumplings", emoji: "🥟" },
  { key: "cheese-board", title: "Cheese and wine night", emoji: "🧀" },
];

// The dates game's built-in ideas (your own are mixed in). Both people swipe
// through them like the dinner deck; the first you both say yes to is the next date.
export const DATE_IDEAS: Array<{ title: string; emoji: string }> = [
  { title: "Picnic in Greenwich Park", emoji: "🧺" },
  { title: "Sunset walk along the South Bank", emoji: "🌇" },
  { title: "Cooking class together", emoji: "👩‍🍳" },
  { title: "Comedy night", emoji: "😂" },
  { title: "West End show", emoji: "🎭" },
  { title: "Cinema and popcorn", emoji: "🍿" },
  { title: "Outdoor cinema", emoji: "🎬" },
  { title: "Boat along the Thames", emoji: "⛴️" },
  { title: "Sky Garden views", emoji: "🌿" },
  { title: "Rooftop bar", emoji: "🍹" },
  { title: "Afternoon tea", emoji: "🫖" },
  { title: "Borough Market food crawl", emoji: "🧀" },
  { title: "Columbia Road flower market", emoji: "💐" },
  { title: "Kew Gardens", emoji: "🌺" },
  { title: "Richmond Park deer walk", emoji: "🦌" },
  { title: "Hampstead Heath and Parliament Hill", emoji: "🌳" },
  { title: "Museum date (V&A or Natural History)", emoji: "🏛️" },
  { title: "Art gallery and coffee", emoji: "🖼️" },
  { title: "Bowling", emoji: "🎳" },
  { title: "Mini golf", emoji: "⛳" },
  { title: "Escape room", emoji: "🔐" },
  { title: "Karaoke", emoji: "🎤" },
  { title: "Live music gig", emoji: "🎸" },
  { title: "Jazz bar", emoji: "🎷" },
  { title: "Ice skating", emoji: "⛸️" },
  { title: "Spa day", emoji: "🧖" },
  { title: "Turkish hammam", emoji: "🛁" },
  { title: "Pottery class", emoji: "🏺" },
  { title: "Paint and sip", emoji: "🎨" },
  { title: "Wine tasting", emoji: "🍷" },
  { title: "Dessert crawl", emoji: "🍰" },
  { title: "Brunch somewhere new", emoji: "🥞" },
  { title: "Try a new cuisine", emoji: "🍜" },
  { title: "Cook a three-course dinner at home", emoji: "🕯️" },
  { title: "Movie marathon in pyjamas", emoji: "🛋️" },
  { title: "Board games and takeaway", emoji: "🎲" },
  { title: "Bake something together", emoji: "🧁" },
  { title: "Stargazing", emoji: "✨" },
  { title: "Day trip to Brighton", emoji: "🏖️" },
  { title: "Day trip to Oxford or Cambridge", emoji: "🚲" },
  { title: "Countryside walk and pub lunch", emoji: "🍺" },
  { title: "Weekend away in the Cotswolds", emoji: "🏡" },
  { title: "Bike ride along the canal", emoji: "🚴" },
  { title: "Go-karting", emoji: "🏎️" },
  { title: "Climbing wall", emoji: "🧗" },
  { title: "Dance class", emoji: "💃" },
  { title: "Photo walk around the city", emoji: "📸" },
  { title: "Bookshop browse and coffee", emoji: "📚" },
  { title: "Plan our next holiday", emoji: "✈️" },
  { title: "Breakfast in bed", emoji: "🥐" },
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

// Built-in date ideas as cards, keyed "date:<slug>" (the dinner deck uses "dish:<key>").
const slug = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
export const DATES: Dish[] = DATE_IDEAS.map((d) => ({ key: slug(d.title), title: d.title, emoji: d.emoji }));
export const dateByKey = new Map(DATES.map((d) => [d.key, d]));

export type Game = "dinner" | "date";
/** What a built-in card's vote is filed under: "dish:<key>" or "date:<key>". */
export const GAME_PREFIX: Record<Game, string> = { dinner: "dish:", date: "date:" };
