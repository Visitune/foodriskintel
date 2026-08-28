import type { Dataset } from "./types";
import type { Lang } from "./i18n";

export default function Sources({ data, lang }: { data: Dataset; lang: Lang }) {
  return (
    <div className="page">
      <div className="page-header">
        <h2>{lang==="fr" ? "Sources & Méthodologie" : "Sources & Methodology"}</h2>
        <p className="subtitle">{lang==="fr" ? "Provenance, extraction et limites (données restent EN)" : "Data provenance, extraction and limitations (data remains EN)"}</p>
      </div>

      <div className="card">
        <h3>{lang==="fr"?"Sources de données":"Data Sources"}</h3>
        {lang==="fr" ? (
          <>
            <p><strong>IFS Trend Risk Reports</strong> (<a href="https://www.ifs-certification.com/" target="_blank" rel="noopener noreferrer">IFS</a>) — source primaire pour les <strong>rappels monde</strong> (cartes par pays).</p>
            <p><strong>Section Food Fraud d'IFS = reprise intégrale des JRC Food Fraud Monthly</strong> (KC-FFQ, DG JRC). Source officielle UE fondée sur <strong>veille presse / EMM</strong> — screening d'articles mondiaux filtrés par le JRC. <a href="https://knowledge4policy.ec.europa.eu/jrc-food-fraud-monthly-report_en" target="_blank" rel="noopener noreferrer">JRC Monthly</a> (ex : <a href="https://knowledge4policy.ec.europa.eu/sites/default/files/202604.pdf" target="_blank" rel="noopener noreferrer">202604.pdf</a>). Mêmes informations que JRC, lien presse par cas.</p>
            <p><strong>FFN Mensuel (DG SANTE)</strong> — <a href="https://food.ec.europa.eu/food-safety/acn/ffn-monthly_en" target="_blank" rel="noopener noreferrer">EU Agri-Food Fraud Network</a> via ACN (RASFF + AAC + FFN) : suspicions transfrontalières (≥2 États) du réseau officiel. Nature différente de la veille JRC/IFS.</p>
          </>
        ) : (
          <>
            <p><strong>IFS Trend Risk Reports</strong> (<a href="https://www.ifs-certification.com/" target="_blank" rel="noopener noreferrer">IFS</a>) — primary source for <strong>world recalls</strong> (country maps).</p>
            <p><strong>IFS Food Fraud section = verbatim JRC Food Fraud Monthly</strong> (KC-FFQ, DG JRC). Official EU source based on <strong>press / EMM monitoring</strong> — screening of world press filtered by JRC. <a href="https://knowledge4policy.ec.europa.eu/jrc-food-fraud-monthly-report_en" target="_blank" rel="noopener noreferrer">JRC Monthly</a> (e.g. <a href="https://knowledge4policy.ec.europa.eu/sites/default/files/202604.pdf" target="_blank" rel="noopener noreferrer">202604.pdf</a>). Same data as JRC, press link per case.</p>
            <p><strong>FFN Monthly (DG SANTE)</strong> — <a href="https://food.ec.europa.eu/food-safety/acn/ffn-monthly_en" target="_blank" rel="noopener noreferrer">EU Agri-Food Fraud Network</a> via ACN (RASFF + AAC + FFN): cross-border suspicions (≥2 Member States) from the official control network. Different nature from JRC/IFS press monitoring.</p>
          </>
        )}
      </div>

      <div className="card">
        <h3>{lang==="fr"?"Méthode d'extraction":"Extraction Method"}</h3>
        {lang==="fr" ? (
          <>
            <p>Extraction programmatique des PDF avec Python (pdfplumber) par coordonnées :</p>
            <ul>
              <li><strong>Rappels :</strong> noms pays localisés par coordonnées, nombre le plus proche en dessous apparié par proximité.</li>
              <li><strong>Fraude IFS/JRC :</strong> table détectée via mots-clés (product, reason, country) et colonnes positionnelles.</li>
              <li><strong>FFN :</strong> figures p3 (produit/fraude/détection) + tables p4-10 (CLASSIFICATION|PRODUCT|COMMODITY|ISSUE|ORIGIN|NOTIFIED BY) avec forward-fill des cellules fusionnées.</li>
            </ul>
          </>
        ) : (
          <>
            <p>Programmatic PDF extraction with Python (pdfplumber) using positional matching:</p>
            <ul>
              <li><strong>Recalls:</strong> country names by word coordinates, nearest number below matched by proximity.</li>
              <li><strong>IFS/JRC fraud:</strong> table via fraud-reason keywords and positional columns.</li>
              <li><strong>FFN:</strong> figures p3 + tables p4-10 (CLASSIFICATION|PRODUCT|COMMODITY|ISSUE|ORIGIN|NOTIFIED BY) with forward-fill on merged cells.</li>
            </ul>
          </>
        )}
      </div>

      <div className="card">
        <h3>{lang==="fr"?"Résumé dataset":"Dataset Summary"}</h3>
        <div className="stat-grid compact">
          <div className="stat-card">
            <div className="stat-value">{data.summary.total_reports}</div>
            <div className="stat-label">{lang==="fr"?"Rapports traités":"Reports processed"}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{data.summary.countries_with_data}</div>
            <div className="stat-label">{lang==="fr"?"Pays avec rappels":"Countries with recalls"}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{data.summary.total_recall_values}</div>
            <div className="stat-label">{lang==="fr"?"Valeurs rappels":"Recall values"}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{data.summary.total_food_fraud_cases}</div>
            <div className="stat-label">{lang==="fr"?"Cas fraude":"Fraud cases"}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>{lang==="fr"?"Glossaire":"Glossary"}</h3>
        {lang==="fr" ? (
          <ul className="glossary">
            <li><b>ACN</b> — Alert and Cooperation Network (réseau d'alerte et de coopération UE), ex-RRH/RSAS. Cadre regroupant RASFF, AAC et FFN.</li>
            <li><b>RASFF</b> — Rapid Alert System for Food and Feed : alertes sanitaires rapides notifiées par les États membres.</li>
            <li><b>AAC</b> — Administrative Assistance and Cooperation : assistance administrative pour non-conformités transfrontalières.</li>
            <li><b>FFN</b> — Food Fraud Network : volet « fraude » de l'ACN ; suspicions transfrontalières (≥2 États) signalées via AHF.</li>
            <li><b>EMM</b> — Early Warning and Monitoring System : veille presse quotidienne du JRC (base des JRC Food Fraud Monthly).</li>
            <li><b>MRL</b> — Maximum Residue Limits : limites maximales de résidus (pesticides, médicaments vétérinaires).</li>
            <li><b>JRC</b> — Joint Research Centre : service scientifique de la Commission européenne (source de la section fraude d'IFS).</li>
            <li><b>KO / fenêtre croisée</b> — mois sans rapport IFS publié (ex. août 2024) = lacune de collecte, jamais un zéro.</li>
          </ul>
        ) : (
          <ul className="glossary">
            <li><b>ACN</b> — Alert and Cooperation Network (EU), the framework covering RASFF, AAC and FFN.</li>
            <li><b>RASFF</b> — Rapid Alert System for Food and Feed: health alerts notified by Member States.</li>
            <li><b>AAC</b> — Administrative Assistance and Cooperation: cross-border non-compliances.</li>
            <li><b>FFN</b> — Food Fraud Network: the fraud strand of ACN; cross-border suspicions (≥2 states) via AHF.</li>
            <li><b>EMM</b> — Early Warning and Monitoring System: JRC daily press screening (basis of JRC Food Fraud Monthly).</li>
            <li><b>MRL</b> — Maximum Residue Limits (pesticides, veterinary medicines).</li>
            <li><b>JRC</b> — Joint Research Centre: the European Commission's science service (source of IFS fraud section).</li>
            <li><b>Cross window</b> — months with no published IFS report (e.g. Aug 2024) = collection gap, never a zero.</li>
          </ul>
        )}
      </div>

      <div className="card">
        <h3>{lang==="fr"?"Couverture":"Coverage"}</h3>
        <table>
          <thead>
            <tr>
              <th>{lang==="fr"?"Période":"Report Period"}</th>
              <th>{lang==="fr"?"Pays":"Countries"}</th>
              <th>{lang==="fr"?"Cas fraude":"Fraud Cases"}</th>
            </tr>
          </thead>
          <tbody>
            {data.reports.map((r) => (
              <tr key={r.id}>
                <td>{r.month} {r.year}</td>
                <td>{Object.keys(r.recalls).length}</td>
                <td>{r.food_fraud_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>{lang==="fr"?"Limites & distinction IFS/JRC vs FFN":"Limitations & IFS/JRC vs FFN"}</h3>
        {lang==="fr" ? (
          <ul>
            <li>IFS fraude = reprise JRC (veille presse). FFN = réseau officiel ACN (RASFF). Ne jamais sommer : périmètres/méthodes/biais opposés.</li>
            <li>Rapports IFS avant juin 2024 derrière login IFS Database.</li>
            <li>Noms pays variables (“USA (FDA)” vs “USA (USDA)”) normalisés.</li>
            <li>Rappels = chiffres affichés sur cartes IFS, non recomptés.</li>
          </ul>
        ) : (
          <ul>
            <li>IFS fraud = JRC mirror (press). FFN = official ACN (RASFF). Never sum: opposite scopes/methods/bias.</li>
            <li>IFS reports before June 2024 behind IFS Database login.</li>
            <li>Country names variable (“USA (FDA)” vs “USA (USDA)”) normalized.</li>
            <li>Recalls = numbers shown on IFS maps, not recounted.</li>
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Attribution</h3>
        <p>
          Sources : <a href="https://www.ifs-certification.com/" target="_blank" rel="noopener noreferrer">IFS Trend Risk Reports</a> (reprise JRC) · <a href="https://knowledge4policy.ec.europa.eu/jrc-food-fraud-monthly-report_en" target="_blank" rel="noopener noreferrer">JRC Food Fraud Monthly</a> · <a href="https://food.ec.europa.eu/food-safety/acn/ffn-monthly_en" target="_blank" rel="noopener noreferrer">EC FFN Monthly</a> |
          {lang==="fr"?" Généré: ":" Generated: "}{new Date(data.generated_at).toLocaleDateString(lang==="fr"?"fr-FR":"en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>
    </div>
  );
}
