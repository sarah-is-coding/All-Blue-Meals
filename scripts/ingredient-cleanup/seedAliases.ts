// Synonyms and misspellings no spelling rule finds (docs/ingredient-
// normalization.md, section 10b), as canonical name → variants. The cleanup
// merges each variant into the canonical ingredient and records the variant as
// a "seed" row in ingredient_aliases. Only true synonyms belong here:
// coriander is not cilantro (ground coriander is the seed).

export const SEED_ALIASES: Record<string, string[]> = {
  "green onion": ["scallion", "spring onion"],
  "chili powder": ["chile powder"],
  potato: ["potatoe"],
  "kewpie mayo": ["kewpi mayo"],
  "heavy cream": ["heavy whipping cream"],
  "hamburger bun": ["burger bun"],
  "cayenne pepper": ["cayenne", "ground cayenne pepper", "ground cayenne"],
  "red pepper flakes": ["crushed red pepper", "red crushed pepper", "crushed red pepper flakes", "red chili flakes"],
  "bok choy": ["pak choi", "pak choy", "bok choi"],
  feta: ["feta cheese"],
  ricotta: ["ricotta cheese"],
  parmesan: ["parmesan cheese", "parm", "parm cheese"],
  "parmigiano-reggiano": ["parmigiano-reggiano cheese"],
  mascarpone: ["mascarpone cheese"],
  "white miso": ["white miso paste"],
  "red miso": ["red miso paste"],
  macaroni: ["macaroni pasta"],
  "black pepper": ["ground black pepper", "cracked black pepper", "ground pepper"],
  "barbecue sauce": ["bbq sauce"],
  "barbecue pulled pork": ["bbq pulled pork"],
  "powdered sugar": ["confectioners sugar", "icing sugar"],
};
