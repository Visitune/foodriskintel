import type { Lang } from "./i18n";

/** Plain-language definitions shown by <Term> and on the "How to read" page. */
export const GLOSSARY: Record<string, { term: Record<Lang, string>; def: Record<Lang, string> }> = {
  trendRisk: {
    term: { fr: "Rapport IFS Trend Risk", en: "IFS Trend Risk Report" },
    def: {
      fr: "Rapport mensuel gratuit publié par IFS pour son réseau : rappels produits dans le monde, cas de fraude, actualités. Ce n'est pas le référentiel IFS Food : c'est une veille.",
      en: "Free monthly report published by IFS for its network: product recalls worldwide, fraud cases, news. It is not the IFS Food standard: it is a monitoring digest.",
    },
  },
  recall: {
    term: { fr: "Rappel", en: "Recall" },
    def: {
      fr: "Retrait d'un produit du marché publié par une autorité nationale (ex. RappelConso en France, FDA/USDA aux États-Unis). Le pays affiché est celui de l'autorité qui publie, pas l'origine du produit.",
      en: "Withdrawal of a product published by a national authority (e.g. FDA/USDA in the US). The country shown is the publishing authority, not the product's origin.",
    },
  },
  jrc: {
    term: { fr: "JRC (veille presse)", en: "JRC (press monitoring)" },
    def: {
      fr: "Centre commun de recherche de la Commission européenne. Son « Food Fraud Monthly » recense des cas de fraude parus dans la presse mondiale ; l'IFS en reprend une sélection. Ce sont des faits rapportés par la presse, pas des décisions officielles.",
      en: "The European Commission's Joint Research Centre. Its Food Fraud Monthly lists fraud cases reported in the world press; IFS republishes a selection. These are press-reported facts, not official decisions.",
    },
  },
  ffn: {
    term: { fr: "FFN (suspicions UE)", en: "FFN (EU suspicions)" },
    def: {
      fr: "Food Fraud Network : le volet « fraude » du réseau d'alerte européen. Chaque mois, la DG SANTE publie les suspicions de fraude ou de non-conformité échangées entre au moins deux États membres. Ce sont des suspicions officielles, pas des condamnations.",
      en: "Food Fraud Network: the fraud strand of the EU alert network. Each month DG SANTE publishes suspected fraud or non-compliance cases exchanged between at least two Member States. They are official suspicions, not convictions.",
    },
  },
  acn: {
    term: { fr: "ACN", en: "ACN" },
    def: {
      fr: "Alert and Cooperation Network : réseau européen qui regroupe le RASFF (alertes sanitaires), l'AAC (assistance administrative) et le FFN (fraude).",
      en: "Alert and Cooperation Network: the EU network grouping RASFF (health alerts), AAC (administrative assistance) and FFN (fraud).",
    },
  },
  rasff: {
    term: { fr: "RASFF", en: "RASFF" },
    def: {
      fr: "Système d'alerte rapide européen pour les dangers sanitaires (pathogènes, allergènes, corps étrangers…). Il n'est pas intégré ici : cet outil couvre la fraude et les non-conformités.",
      en: "EU rapid alert system for health hazards (pathogens, allergens, foreign bodies…). It is not included here: this tool covers fraud and non-compliance.",
    },
  },
  origin: {
    term: { fr: "Origine", en: "Origin" },
    def: {
      fr: "Pays d'où provient le produit signalé (FFN) ou pays où le cas de fraude a été découvert (presse JRC).",
      en: "Country the flagged product comes from (FFN) or country where the fraud case was found (JRC press).",
    },
  },
  notifier: {
    term: { fr: "Notifiant", en: "Notifier" },
    def: {
      fr: "État membre qui a signalé le cas au réseau européen — souvent le pays d'importation ou de contrôle.",
      en: "Member State that reported the case to the EU network — often the importing or controlling country.",
    },
  },
  mrl: {
    term: { fr: "LMR", en: "MRL" },
    def: {
      fr: "Limite maximale de résidus autorisée dans l'UE pour un pesticide ou un médicament vétérinaire.",
      en: "Maximum residue limit allowed in the EU for a pesticide or veterinary drug.",
    },
  },
  vaccp: {
    term: { fr: "Évaluation de vulnérabilité à la fraude", en: "Food fraud vulnerability assessment" },
    def: {
      fr: "Exigence IFS Food v8 (chapitre 4, food fraud) : évaluer, pour chaque matière première, le risque de fraude (substitution, dilution, fausse origine…) en s'appuyant sur des informations historiques et actuelles. Les données de cet outil peuvent nourrir cette analyse, sans la remplacer.",
      en: "IFS Food v8 requirement (chapter 4, food fraud): assess for each raw material the risk of fraud (substitution, dilution, false origin…) using historical and current information. This tool's data can feed that assessment, not replace it.",
    },
  },
};
