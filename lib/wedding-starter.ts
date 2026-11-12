// What a new wedding plan starts with. Kept apart from the database code so
// the forms can use it too (for example, to suggest what to type in an area).

// The areas a new plan starts with. They can be renamed, removed and added to.
export const DEFAULT_AREAS: Array<[string, string]> = [
  ["🏛️", "Venue"],
  ["🍽️", "Catering"],
  ["🎀", "Decor"],
  ["💐", "Flowers"],
  ["📸", "Photo & video"],
  ["🎶", "Music & entertainment"],
  ["👗", "Outfits & beauty"],
  ["💌", "Invitations"],
  ["🧑‍🤝‍🧑", "Guests"],
  ["💍", "Rings"],
  ["📜", "Ceremony & paperwork"],
  ["🚗", "Transport"],
  ["✈️", "Honeymoon"],
];

// A starter checklist: the usual things to sort out, by area name.
export const STARTER: Record<string, string[]> = {
  Venue: ["Shortlist venues and book viewings", "Confirm the date and pay the venue deposit", "Agree timings, access and the wet-weather plan with the venue"],
  Catering: ["Get quotes from caterers", "Book a tasting and choose the menu", "Collect dietary needs and confirm final numbers"],
  Decor: ["Choose the colours and overall style", "Decide table layout and centrepieces", "Book lighting, draping and anything hired"],
  Flowers: ["Choose a florist", "Decide bouquets, buttonholes and table flowers"],
  "Photo & video": ["Book the photographer", "Book the videographer", "Write the list of must-have photos"],
  "Music & entertainment": ["Book the band or DJ", "Choose the first dance and entrance music", "Agree the running order for the evening"],
  "Outfits & beauty": ["Choose the dress", "Choose the suit", "Book hair and make-up, with a trial", "Plan fittings and alterations"],
  Invitations: ["Send save-the-dates", "Design and order the invitations", "Send the invitations and track replies"],
  Guests: ["Write the guest list for each side", "Draw up the seating plan", "Sort accommodation for guests travelling"],
  Rings: ["Choose and order the wedding rings"],
  "Ceremony & paperwork": ["Give notice and sort the legal paperwork", "Book the registrar or officiant", "Choose witnesses and readings"],
  Transport: ["Book the wedding car", "Arrange transport for guests if needed"],
  Honeymoon: ["Decide where to go", "Book flights and hotels", "Check passports and visas"],
};
