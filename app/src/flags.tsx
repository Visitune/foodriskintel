/** Country name (as normalised by the pipeline) → ISO 3166-1 alpha-2 code. */
const ISO: Record<string, string> = {
  Albania: "AL", Algeria: "DZ", Argentina: "AR", Armenia: "AM", Australia: "AU", Austria: "AT", Azerbaijan: "AZ",
  Bahrain: "BH", Bangladesh: "BD", Belarus: "BY", Belgium: "BE", Bolivia: "BO", "Bosnia and Herzegovina": "BA",
  Brazil: "BR", Bulgaria: "BG", "Burkina Faso": "BF", Burundi: "BI", Cambodia: "KH", Cameroon: "CM", Canada: "CA",
  Chile: "CL", China: "CN", Colombia: "CO", "Congo DR": "CD", Congo: "CG", "Costa Rica": "CR", Croatia: "HR", Cuba: "CU",
  Cyprus: "CY", Czechia: "CZ", "Côte d'Ivoire": "CI", Denmark: "DK", "Dominican Republic": "DO", Ecuador: "EC",
  Egypt: "EG", "El Salvador": "SV", Estonia: "EE", Ethiopia: "ET", "European Union": "EU", "Falkland Islands": "FK",
  Fiji: "FJ", Finland: "FI", France: "FR", Gambia: "GM", Georgia: "GE", Germany: "DE", Ghana: "GH", Greece: "GR",
  Guatemala: "GT", Guinea: "GN", Honduras: "HN", "Hong Kong": "HK", Hungary: "HU", Iceland: "IS", India: "IN",
  Indonesia: "ID", Iran: "IR", Iraq: "IQ", Ireland: "IE", Israel: "IL", Italy: "IT", Japan: "JP", Jordan: "JO",
  Kazakhstan: "KZ", Kenya: "KE", Kosovo: "XK", Kuwait: "KW", Kyrgyzstan: "KG", Laos: "LA", Latvia: "LV", Lebanon: "LB",
  Liberia: "LR", Libya: "LY", Lithuania: "LT", Luxembourg: "LU", Madagascar: "MG", Malawi: "MW", Malaysia: "MY",
  Mali: "ML", Malta: "MT", Mauritania: "MR", Mauritius: "MU", Mexico: "MX", Moldova: "MD", Monaco: "MC",
  Montenegro: "ME", Morocco: "MA", Myanmar: "MM", Namibia: "NA", Nepal: "NP", Netherlands: "NL", "New Zealand": "NZ",
  Nicaragua: "NI", Nigeria: "NG", "North Korea": "KP", "North Macedonia": "MK", Norway: "NO", Oman: "OM",
  Pakistan: "PK", Panama: "PA", Paraguay: "PY", Peru: "PE", Philippines: "PH", Poland: "PL", Portugal: "PT",
  Qatar: "QA", Romania: "RO", Russia: "RU", Rwanda: "RW", "Saint Lucia": "LC", "Saudi Arabia": "SA", Senegal: "SN",
  Serbia: "RS", "Sierra Leone": "SL", Singapore: "SG", Slovakia: "SK", Slovenia: "SI", "South Africa": "ZA",
  "South Korea": "KR", Spain: "ES", "Sri Lanka": "LK", Suriname: "SR", Sweden: "SE", Switzerland: "CH", Syria: "SY",
  Taiwan: "TW", Tajikistan: "TJ", Tanzania: "TZ", Thailand: "TH", Togo: "TG", "Trinidad and Tobago": "TT",
  Tunisia: "TN", Turkey: "TR", Uganda: "UG", Ukraine: "UA", "United Arab Emirates": "AE", "United Kingdom": "GB",
  "United States": "US", Uruguay: "UY", Uzbekistan: "UZ", Venezuela: "VE", Vietnam: "VN", "Western Sahara": "EH",
  Yemen: "YE", Zambia: "ZM", Zimbabwe: "ZW",
};

// Each flag is emitted as its own small SVG asset and only fetched when displayed.
const FLAG_URLS = import.meta.glob("../node_modules/country-flag-icons/3x2/*.svg", {
  query: "?url", import: "default", eager: true,
}) as Record<string, string>;

const urlFor = (code: string) => FLAG_URLS[`../node_modules/country-flag-icons/3x2/${code}.svg`];

/** Small SVG flag (emoji flags do not render on Windows). Renders nothing for unknown names. */
export function Flag({ country }: { country: string }) {
  const code = ISO[country.replace("�", "ô")];
  const src = code ? urlFor(code) : undefined;
  if (!src) return null;
  return <img className="flag" src={src} alt="" aria-hidden="true" width={18} height={12} loading="lazy" />;
}
