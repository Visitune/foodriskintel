"""
Shared taxonomy — one vocabulary across IFS/JRC fraud cases and FFN cases.

  * MATERIAL_FAMILIES   raw-material / product families (FR + EN labels)
  * CLASSIFICATION_GROUPS  FFN non-compliance families (70 raw PDF variants → 14)
  * SUBSTANCES          named hazards found in FFN "issue" text
  * FRAUD_REASONS       IFS/JRC fraud reasons (composites split)

Used by normalize_and_build.py, build_ffn_dataset.py and build_index.py.
"""
import re

# ─── Material families ──────────────────────────────────────────────────────────
# (id, fr, en, official FFN/RASFF categories, keyword regex for free text)
MATERIAL_FAMILIES = [
    ("meat", "Viandes & produits carnés", "Meat & meat products",
     ["meat and meat products (other than poultry)", "poultry meat and poultry meat products"],
     r"\b(meats?|beef|veal|pork|lamb|mutton|chicken|poultry|turkey meat|ham|jerky|bushmeat|cattle|buffalo|bear meat|sausage|salami|bacon)\b"),
    ("fish", "Poissons, crustacés & mollusques", "Fish, crustaceans & molluscs",
     ["fish and fish products", "crustaceans and products thereof", "bivalve molluscs and products thereof",
      "cephalopods and products thereof", "gastropods"],
     r"\b(fish|tuna|salmon|cod|seafood|sea- food|eels?|clams?|mussels?|octopus|squid|shrimps?|prawns?|oysters?|crab|lobster|caviar|anchov\w*|sardines?)\b"),
    ("dairy", "Lait & produits laitiers", "Milk & dairy products",
     ["milk and milk products", "ices and desserts"],
     r"\b(milk|dairy|cheese|mozz?arella|mozeralla|butter|ghee|paneer|ricotta|yogh?urt|cream|whey|parmigiano|parmesan)\b"),
    ("eggs", "Œufs & ovoproduits", "Eggs & egg products",
     ["eggs and egg products"], r"\beggs?\b"),
    ("oils", "Huiles & matières grasses", "Fats & oils",
     ["fats and oils"], r"\b(oils?|olive|fats?|lard|margarine)\b"),
    ("alcohol", "Vins, bières & spiritueux", "Wine, beer & spirits",
     ["alcoholic beverages", "wine"],
     r"\b(wines?|vodka|liquor|spirits?|grappa|whisk(e)?y|rum|gin|beer|(?<!non-)alcohol(ic)?|chacha|champagne|prosecco|cognac)\b"),
    ("beverages", "Boissons non alcoolisées & eaux", "Soft drinks & waters",
     ["non-alcoholic beverages", "natural mineral waters", "water for human consumption (other)"],
     r"\b(mineral water|water|juices?|soft drinks?|non-alcoholic|energy drinks?)\b"),
    ("honey", "Miel & produits de la ruche", "Honey & bee products",
     ["honey and royal jelly"], r"\b(honey|royal jelly|propolis|pollen)\b"),
    ("cocoa_coffee_tea", "Cacao, café & thé", "Cocoa, coffee & tea",
     ["cocoa and cocoa preparations, coffee and tea"],
     r"\b(cacao|cocoa|chocolate|coffee|tea|matcha)\b"),
    ("confectionery", "Sucres & confiserie", "Sugar & confectionery",
     ["confectionery"], r"\b(sugar|candy|candies|confectioner\w*|sweets|jelly confectionery|chewing gum)\b"),
    ("cereals", "Céréales, farines & boulangerie", "Cereals & bakery",
     ["cereals and bakery products"],
     r"\b(rice|basmati|wheat|flour|bread|pasta|noodles?|maize|corn|oats?|barley|biscuits?|cereals?|bakery)\b"),
    ("fruits_veg", "Fruits & légumes", "Fruits & vegetables",
     ["fruits and vegetables"],
     r"\b(fruits?|vegetables?|tomato\w*|oranges?|citrus|lemons?|broccoli|carrots?|onions?|garlic|mushrooms?|berries|strawberr\w*|figs?|pomegranates?|potato\w*|peppers?|grapes?|bananas?|avocados?|apples?|dates|olives)\b"),
    ("nuts_seeds", "Fruits à coque & graines", "Nuts & seeds",
     ["nuts, nut products and seeds"],
     r"\b(nuts?|peanuts?|chestnuts?|hazelnuts?|almonds?|pistachios?|cashews?|walnuts?|sesame|seeds?)\b"),
    ("spices", "Herbes & épices", "Herbs & spices",
     ["herbs and spices"],
     r"\b(spices?|herbs?|pepper|paprika|chill?i|curcuma|turmeric|cumin|oregano|saffron|vanilla|cinnamon|nutmeg)\b"),
    ("supplements", "Compléments & aliments diététiques", "Supplements & dietetic foods",
     ["dietetic foods, food supplements and fortified foods"],
     r"\b(supplements?|dietary|dietetic|vitamins?|capsules?|protein powder)\b"),
    ("additives", "Additifs & arômes", "Additives & flavourings",
     ["food additives and flavourings"], r"\b(additives?|flavou?rings?|colou?rings?|enzymes?)\b"),
    ("sauces_prepared", "Sauces, plats préparés & snacks", "Sauces, prepared dishes & snacks",
     ["soups, broths, sauces and condiments", "prepared dishes and snacks"],
     r"\b(sauces?|soups?|condiments?|puree|ketchup|dishes|snacks?|ready meals?)\b"),
    ("feed", "Alimentation animale", "Animal feed",
     ["feed materials", "compound feeds", "feed additives", "pet food", "feed premixtures"],
     r"\b(feed|pet ?food)\b"),
    ("fcm", "Matériaux au contact des aliments", "Food contact materials",
     ["food contact materials"], r"\b(food contact|packaging|bamboo|melamine)\b"),
    ("live_animals", "Animaux vivants", "Live animals",
     ["live animals"], r"\b(live animals?|livestock|horses?)\b"),
    ("other", "Divers / non précisé", "Various / unspecified",
     ["other food product / mixed"], r"\b(various|mixed|other)\b"),
]

FAMILY_LABELS = {fid: {"fr": fr, "en": en} for fid, fr, en, _, _ in MATERIAL_FAMILIES}
_CAT_TO_FAMILY = {cat: fid for fid, _, _, cats, _ in MATERIAL_FAMILIES for cat in cats}
_FAMILY_RX = [(fid, re.compile(rx, re.I)) for fid, _, _, _, rx in MATERIAL_FAMILIES if fid != "other"]

# Canonical FFN categories (fix casing, merged cells, commodity leaking into the category)
_CANON_CATS = {cat: cat[0].upper() + cat[1:] for _, _, _, cats, _ in MATERIAL_FAMILIES for cat in cats}


def canonical_ffn_category(raw: str) -> str:
    s = re.sub(r"\s+", " ", (raw or "")).strip().lower()
    if s in _CANON_CATS:
        return _CANON_CATS[s]
    s = {"fish and products thereof": "fish and fish products", "egg and egg products": "eggs and egg products",
         "confectionary": "confectionery"}.get(s, s)
    if s in _CANON_CATS:
        return _CANON_CATS[s]
    if "wine" in s:
        return "Wine"
    if s.startswith("confectionery dietetic"):
        return _CANON_CATS["confectionery"]
    if "confectionery" in s:
        return _CANON_CATS["confectionery"]
    for cat in _CANON_CATS:
        if s.startswith(cat[:18]):
            return _CANON_CATS[cat]
    return (raw or "").strip() or "Unknown"


def material_family(category: str = "", text: str = "") -> str:
    """Family id from an official category (FFN) and/or free text (product, commodity)."""
    cat = re.sub(r"\s+", " ", (category or "")).strip().lower()
    fam = _CAT_TO_FAMILY.get(cat)
    if fam and fam != "other":
        return fam
    for fid, rx in _FAMILY_RX:
        if text and rx.search(text):
            return fid
    return fam or "other"


# ─── FFN classification groups ──────────────────────────────────────────────────
CLASSIFICATION_GROUPS = {
    "not_authorised": ("Aliment / ingrédient non autorisé UE", "Food / ingredient not authorised (EU)"),
    "pesticides": ("Résidus de pesticides", "Pesticide residues"),
    "vet_residues": ("Résidus de médicaments vétérinaires", "Veterinary drug residues"),
    "origin": ("Origine non autorisée / import illégal", "Unauthorised origin / illegal import"),
    "adulteration": ("Adultération / substitution / dilution", "Adulteration / substitution / dilution"),
    "process": ("Procédé non approuvé ou non déclaré", "Unapproved / undeclared process"),
    "additives": ("Additifs / arômes non conformes", "Non-compliant additives / flavourings"),
    "claims": ("Allégations / étiquetage", "Claims / labelling"),
    "protected_designation": ("Appellation protégée UE (AOP/IGP)", "EU protected designation (PDO/PGI)"),
    "fcm": ("Matériaux au contact", "Food contact materials"),
    "feed_additives": ("Additifs pour l'alimentation animale", "Feed additives"),
    "illegal_trade": ("Commerce illégal (CITES, pêche INN)", "Illegal trade (CITES, IUU)"),
    "tampering": ("Falsification de documents / autre", "Record tampering / other"),
    "unknown": ("Non précisé", "Not specified"),
}


def classification_group(raw: str) -> str:
    s = re.sub(r"[^a-z ]", " ", (raw or "").lower())
    s = re.sub(r"\s+", " ", s).strip()
    squashed = s.replace(" ", "")
    if not s or s == "unknown":
        return "unknown"
    if "notauthorised" in squashed or "ingredientnot" in squashed or "unauthorisedplacing" in squashed:
        return "not_authorised"
    if "veterinary" in squashed:
        return "vet_residues"
    if "pesticide" in squashed or "mrl" in squashed or s.startswith("residue"):
        return "pesticides"
    if "fcm" in squashed or "foodcontact" in squashed:
        return "fcm"
    if "illegaltrade" in squashed or "cites" in squashed:
        return "illegal_trade"
    if "unauthorisedorigin" in squashed or "illegalimport" in squashed:
        return "origin"
    if "adulteration" in squashed or "substitution" in squashed or "dilution" in squashed:
        return "adulteration"
    if "process" in squashed or "concealment" in squashed or s in ("unapproved", "undeclared"):
        return "process"
    if "feedadditive" in squashed:
        return "feed_additives"
    if "additive" in squashed or "flavouring" in squashed or "mls" in squashed or s.startswith("food additives"):
        return "additives"
    if "protected" in squashed:
        return "protected_designation"
    if "claim" in squashed or "nutrition" in squashed or "othernon" in squashed or "dietary" in squashed:
        return "claims"
    if "tampering" in squashed or "others" in squashed or "counterfeit" in squashed:
        return "tampering"
    return "unknown"


# ─── Named substances / hazards in FFN "issue" text ─────────────────────────────
# (canonical name, regex). Canonical names are English (as in source documents).
SUBSTANCES = [
    ("Ethylene oxide", r"ethylene oxide|2-chloroethanol"),
    ("Chlorpyrifos", r"chlorpyrifos"),
    ("Acetamiprid", r"acetamiprid"),
    ("Imidacloprid", r"imidacloprid"),
    ("Thiamethoxam", r"thiamethoxam"),
    ("Chlorate", r"chlorate"),
    ("Carbendazim", r"carbendazim"),
    ("Glyphosate", r"glyphosate"),
    ("Tricyclazole", r"tricyclazole"),
    ("Acephate / methamidophos", r"acephate|methamidophos"),
    ("Dithiocarbamates", r"dithiocarbamate"),
    ("Fipronil", r"fipronil"),
    ("Nitrofurans", r"nitrofuran|furazolidone|semicarbazide|AOZ|AMOZ"),
    ("Malachite green", r"malachite green"),
    ("Antibiotics (doxycycline, etc.)", r"doxycycline|tetracycline|enrofloxacin|chloramphenicol|sulfonamide"),
    ("Sulphites / SO2", r"sulph?ites?|sulfites?|sulph?ur dioxide|sulfur dioxide"),
    ("Titanium dioxide (E171)", r"titanium dioxide|e ?171"),
    ("Sudan dyes", r"sudan"),
    ("Unauthorised colours", r"sunset yellow|tartrazine|ponceau|erythrosine|rhodamine|azorubine|allura red|orange ii"),
    ("Preservatives (benzoic/sorbic acid)", r"benzoic acid|sodium benzoate|sorbic acid|potassium sorbate|natamycin"),
    ("Cannabinoids (CBD, THC, HHC)", r"cannabidiol|\bcbd\b|tetrahydrocannabinol|\bthc\b|hexahydrocannabinol|\bhhc\b"),
    ("Undeclared medicines (sildenafil, sibutramine…)", r"sildenafil|tadalafil|sibutramine|yohimbine|phenolphthalein|dmaa|dmha"),
    ("Unauthorised novel food", r"novel food|nicotinamide mononucleotide|\bnmn\b|kratom|tongkat ali|muscimol|mucuna|cordyceps|clitoria|lithium orotate|serratiopeptidase|pancreatin"),
    ("GMO not authorised", r"\bgmo\b|genetically modified"),
    ("Irradiation", r"irradiat"),
    ("Water addition", r"water addition|added water|water content"),
    ("Species / DNA substitution", r"\bdna\b|species substitution|horse ?meat|mechanically separated"),
    ("Sugar adulteration (syrups)", r"sugar profile|syrup|c4 sugar|higher content of sugar|sugar content"),
    ("Undeclared fat / composition", r"content of fat|fat content|lower content of meat|vegetable oils?|sunflower oil"),
    ("Undeclared allergen", r"undeclared|allergen|gluten|peanut|soy|sesame|mustard|celery|lupin"),
    ("Health / nutrition claims", r"health claims?|nutrition claims?|misleading"),
    ("Traceability / skipped controls", r"traceability|skipped border|illegal import|without registration|unauthorised operator|falsification of origin|falsified"),
    ("Temperature abuse", r"temperature"),
]
_SUBSTANCE_RX = [(name, re.compile(rx, re.I)) for name, rx in SUBSTANCES]


def substances(issue: str) -> list:
    return [name for name, rx in _SUBSTANCE_RX if issue and rx.search(issue)]


# ─── IFS / JRC fraud reasons ────────────────────────────────────────────────────
FRAUD_REASONS = {
    "grey market": ("Marché gris", "Grey market"),
    "adulteration": ("Adultération", "Adulteration"),
    "document forgery": ("Falsification de documents", "Document forgery"),
    "counterfeit": ("Contrefaçon", "Counterfeit"),
    "mislabelling": ("Étiquetage trompeur", "Mislabelling"),
    "misbranding": ("Usurpation de marque / dénomination", "Misbranding"),
    "misdescription": ("Description trompeuse", "Misdescription"),
    "product tampering": ("Altération du produit", "Product tampering"),
    "smuggling": ("Contrebande", "Smuggling"),
    "contraband": ("Contrebande", "Contraband"),
    "illegal trade": ("Commerce illégal", "Illegal trade"),
    "bribery of officials": ("Corruption d'agents", "Bribery of officials"),
    "illegal hoarding": ("Stockage illégal", "Illegal hoarding"),
    "lack of traceability": ("Défaut de traçabilité", "Lack of traceability"),
    "theft": ("Vol", "Theft"),
}
_REASON_ALIASES = {"mislabeling": "mislabelling", "prod uct tampering": "product tampering",
                   "product tamper ing": "product tampering"}


def split_reasons(raw: str) -> list:
    """'Counterfeit / Adulteration', 'Document forgery Grey market' → canonical keys."""
    s = re.sub(r"(\w)- (\w)", r"\1\2", (raw or "")).lower()
    s = re.sub(r"\s+", " ", s).strip()
    found = []
    for alias, canon in _REASON_ALIASES.items():
        s = s.replace(alias, canon)
    # Longest keys first so that "product tampering" wins over partial words
    for key in sorted(FRAUD_REASONS, key=len, reverse=True):
        idx = s.find(key)
        if idx >= 0:
            found.append((idx, key))
            s = s[:idx] + " " * len(key) + s[idx + len(key):]
    return [k for _, k in sorted(found)]


# ─── Countries (IFS fraud table spellings) ──────────────────────────────────────
IFS_COUNTRY_FIXES = {
    "tunesia": "Tunisia", "dominican republik": "Dominican Republic", "ivory coast": "Côte d'Ivoire",
    "côte d’ivoire": "Côte d'Ivoire", "cote d'ivoire": "Côte d'Ivoire", "türkiye": "Turkey",
    "uk": "United Kingdom", "scotland": "United Kingdom", "england": "United Kingdom", "usa": "United States",
    "eu": "European Union", "eu (14 countries)": "European Union",
    "south korea china": ["South Korea", "China"],
}
