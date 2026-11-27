import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Lang } from "../i18n";
import type { Dataset, RiskIndex } from "../types";
import { useFfn, useJrc } from "../data";
import { downloadCsv, fmtMonth, fmtNum } from "../format";
import { SourceTag } from "../components/ui";
import { Card } from "./shared";
import { usePerimeter } from "../perimeter/PerimeterContext";
import type { CaseRef, Criticality, PerimeterPackage } from "../perimeter/PerimeterContext";
import { baselineFromIndex, caseRefs, matchesItem, toDatasets } from "../perimeter/match";
import { diffAgainstPackage } from "../perimeter/diff";
import { download, migrate, packageFilename, readPackageFile, serialize } from "../perimeter/io";
import { buildCaseIndex, exportPerimeterXlsx } from "../perimeter/xlsx";
import { CRITICALITIES, criticalityLabel, statusLabel, typeLabel } from "../perimeter/model";

export default function Perimeter({ ifs, index, lang }: { ifs: Dataset; index: RiskIndex; lang: Lang }) {
  const fr = lang === "fr";
  const P = usePerimeter();
  const { data: ffn, error: ffnErr } = useFfn();
  const { data: jrc } = useJrc();
  const [previewPkg, setPreviewPkg] = useState<PerimeterPackage | null>(null);
  const [importErr, setImportErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [flash, setFlash] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  const datasets = useMemo(() => toDatasets(ffn, jrc, ifs), [ffn, jrc, ifs]);
  const perItem = useMemo(() => {
    const m: Record<string, CaseRef[]> = {};
    for (const item of P.pkg.perimeter) m[item.id] = caseRefs(item, matchesItem(item, datasets));
    return m;
  }, [P.pkg.perimeter, datasets]);
  const allRefs = useMemo(() => Object.values(perItem).flat(), [perItem]);
  const diff = useMemo(() => diffAgainstPackage(P.pkg, allRefs), [P.pkg, allRefs]);
  const caseById = useMemo(() => buildCaseIndex(allRefs), [allRefs]);
  const baseline = baselineFromIndex(index);
  const loading = !ffn && !ffnErr;

  const ok = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(""), 4000); };

  const doExportVey = () => {
    const seen = new Set(allRefs.map((r) => r.key));
    const known = { ffn: [] as string[], jrc: [] as string[], ifs: [] as string[] };
    for (const k of seen) (k.startsWith("jrc|") ? known.jrc : k.startsWith("ifs|") ? known.ifs : known.ffn).push(k);
    const out: PerimeterPackage = { ...P.pkg, baseline, known_cases: known, updated_at: new Date().toISOString() };
    download(packageFilename(), serialize(out));
    P.exportDone([...seen]);
    ok(fr ? "Périmètre enregistré (.vey) — conservez le fichier." : "Perimeter saved (.vey) — keep the file.");
  };

  const doExportXlsx = async () => {
    await exportPerimeterXlsx({ pkg: P.pkg, index, items: P.pkg.perimeter, followUps: P.pkg.follow_up, caseById, lang });
    ok(fr ? "Export Excel téléchargé." : "Excel export downloaded.");
  };

  const doExportCsv = () =>
    downloadCsv(`perimetre-FRI-${new Date().toISOString().slice(0, 10)}.csv`, P.pkg.follow_up.map((f) => {
      const ref = caseById.get(f.case_key);
      const item = P.pkg.perimeter.find((i) => i.id === f.item_id);
      return {
        [fr ? "Référence" : "Reference"]: ref?.reference ?? f.case_key,
        [fr ? "Source" : "Source"]: f.source.toUpperCase(),
        [fr ? "Élément" : "Item"]: item?.label ?? "",
        [fr ? "Statut" : "Status"]: statusLabel(f.status, lang),
        [fr ? "Mesure de maîtrise" : "Control measure"]: f.control_measure,
        [fr ? "Fréquence" : "Frequency"]: f.frequency,
        [fr ? "Responsable" : "Owner"]: f.owner,
        [fr ? "Date de revue" : "Review date"]: f.date_reviewed,
        [fr ? "Commentaire" : "Comment"]: f.comment,
        [fr ? "Lien source" : "Source link"]: f.url || ref?.url || "",
      };
    }), lang);

  const doImport = async (file: File) => {
    const res = await readPackageFile(file);
    if (!res.ok) {
      const why = {
        too_big: fr ? "Fichier trop volumineux (2 Mo max)." : "File too large (2 MB max).",
        not_json: fr ? "Fichier illisible (JSON attendu)." : "Unreadable file (JSON expected).",
        bad_format: fr ? "Ce n'est pas un fichier de périmètre Food Risk Intelligence." : "Not a Food Risk Intelligence perimeter file.",
        future_version: fr ? "Version de fichier plus récente que l'application — mettez l'app à jour." : "File version newer than the app — update the app first.",
        bad_version: fr ? "Version de fichier inconnue." : "Unknown file version.",
        bad_perimeter: fr ? "Contenu du périmètre invalide." : "Invalid perimeter content.",
        bad_followup: fr ? "Contenu du suivi invalide." : "Invalid follow-up content.",
        not_object: fr ? "Structure inattendue." : "Unexpected structure.",
        read_error: fr ? "Lecture impossible." : "Could not read the file.",
      }[res.reason] ?? (fr ? "Fichier refusé." : "File rejected.");
      setImportErr(why);
      setPreviewPkg(null);
      return;
    }
    setImportErr("");
    setPreviewPkg(migrate(res.pkg));
  };

  const acceptImport = () => {
    if (!previewPkg) return;
    P.replace(migrate(previewPkg));
    setPreviewPkg(null);
    ok(fr ? "Périmètre chargé — pensez à l'enregistrer." : "Perimeter loaded — remember to save it.");
  };

  const dataUpTo = fr
    ? `Données : FFN ${fmtMonth(baseline.ffn_latest, lang, "short")} · JRC ${fmtMonth(baseline.jrc_latest, lang, "short")} · IFS ${fmtMonth(baseline.ifs_latest, lang, "short")}`
    : `Data: FFN ${fmtMonth(baseline.ffn_latest, lang, "short")} · JRC ${fmtMonth(baseline.jrc_latest, lang, "short")} · IFS ${fmtMonth(baseline.ifs_latest, lang, "short")}`;

  return (
    <div className="page perimeter">
      {/* Print-only header (audit trace) */}
      <div className="print-header" aria-hidden="true">
        <h2>{fr ? "Mon périmètre — Food Risk Intelligence" : "My perimeter — Food Risk Intelligence"}</h2>
        <p>
          {P.pkg.owner.company || "—"}{P.pkg.owner.site ? ` · ${P.pkg.owner.site}` : ""} — {new Date().toLocaleDateString(fr ? "fr-FR" : "en-GB")}
          {" — "}{dataUpTo}
        </p>
      </div>

      <header className="page-header">
        <h2>{fr ? "Mon périmètre" : "My perimeter"}</h2>
        <p className="subtitle">{fr
          ? "Vos matières, origines et dangers suivis dans le temps. Votre fichier .vey est votre seule copie : enregistrez-le après chaque modification."
          : "Your materials, origins and hazards tracked over time. Your .vey file is your only copy: save it after each change."}</p>
        <button type="button" className="btn ghost" aria-expanded={helpOpen} onClick={() => setHelpOpen((v) => !v)}>
          {fr ? "Comment l'utiliser ?" : "How to use it?"}
        </button>
      </header>

      {helpOpen && <HelpPanel lang={lang} />}

      {/* Status banner */}
      <div className="perimeter-status" role="status" aria-live="polite">
        <span>{dataUpTo}</span>
        <span className={P.dirty ? "dirty" : "clean"}>
          {P.dirty ? (fr ? "● Modifications non enregistrées" : "● Unsaved changes") : (fr ? "À jour" : "Up to date")}
        </span>
        {P.pkg.perimeter.length > 0 && diff.newCases.length > 0 && (
          <span className="fresh">{fmtNum(diff.newCases.length, lang)} {fr ? "nouveauté(s) depuis votre dernier enregistrement" : "new case(s) since your last save"}</span>
        )}
        {flash && <span className="flash">{flash}</span>}
      </div>

      {loading ? <div className="loading" role="status">{fr ? "Chargement des données…" : "Loading data…"}</div> : (
        <>
          {P.pkg.perimeter.length === 0 && !previewPkg && <EmptyState lang={lang} onHelp={() => setHelpOpen(true)} />}

          {/* Identity */}
          {P.pkg.perimeter.length > 0 && (
            <Card title={fr ? "Votre société (reprise dans les exports)" : "Your company (included in exports)"}>
              <div className="owner-grid">
                <label>{fr ? "Entreprise" : "Company"}<input type="text" value={P.pkg.owner.company} onChange={(e) => P.setOwner("company", e.target.value)} /></label>
                <label>{fr ? "Site" : "Site"}<input type="text" value={P.pkg.owner.site} onChange={(e) => P.setOwner("site", e.target.value)} /></label>
                <label>{fr ? "Auteur" : "Author"}<input type="text" value={P.pkg.owner.author} onChange={(e) => P.setOwner("author", e.target.value)} /></label>
              </div>
            </Card>
          )}

          {/* New cases since last save */}
          {diff.newCases.length > 0 && (
            <Card title={fr ? `Nouveautés (${fmtNum(diff.newCases.length, lang)})` : `New cases (${fmtNum(diff.newCases.length, lang)})`}>
              <p className="meta">{fr
                ? "Cas apparu dans les sources depuis votre dernier enregistrement. Classez chaque cas ou marquez-le comme vu — ils ne seront plus comptés après le prochain enregistrement."
                : "Cases that appeared in the sources since your last save. Triage each case or mark it seen — they stop being counted after the next save."}</p>
              <ul className="case-list new-cases">
                {diff.newCases.slice(0, 100).map((c) => (
                  <li key={c.key}>
                    <span className="new-head"><SourceTag src={c.source} lang={lang} /> <span className="new-ref">{c.reference}</span></span>
                    <div className="cell-sub">{c.summary}</div>
                    <div className="new-actions">
                      <button type="button" className="btn" onClick={() => P.ensureFollowUp(c)}>{fr ? "À évaluer" : "To assess"}</button>
                      <button type="button" className="btn ghost" onClick={() => { P.ensureFollowUp(c); P.setFollowUp(c.key, "status", "non_pertinent"); }}>{fr ? "Non pertinent" : "Not relevant"}</button>
                      <button type="button" className="btn ghost" onClick={() => P.markSeen([c.key])}>{fr ? "Marquer comme vu" : "Mark seen"}</button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {P.pkg.perimeter.length > 0 && diff.newCases.length === 0 && (
            <p className="meta all-seen">{fr ? "Aucune nouveauté depuis votre dernier enregistrement." : "Nothing new since your last save."}</p>
          )}

          {/* Follow-up register */}
          {P.pkg.follow_up.length > 0 && (
            <Card title={fr ? "Suivi des cas" : "Case follow-up"}>
              <div className="table-head">
                <span className="meta">{fmtNum(P.pkg.follow_up.length, lang)} {fr ? "cas suivis" : "followed cases"}</span>
                <button type="button" className="btn" onClick={doExportCsv} disabled={!P.pkg.follow_up.length}>{fr ? "Exporter CSV" : "Export CSV"}</button>
              </div>
              <div className="table-scroll">
                <table className="data-table follow-table">
                  <thead><tr>
                    <th>{fr ? "Référence" : "Reference"}</th><th>{fr ? "Élément" : "Item"}</th><th>{fr ? "Statut" : "Status"}</th>
                    <th>{fr ? "Mesure de maîtrise" : "Control measure"}</th><th>{fr ? "Fréquence" : "Freq."}</th>
                    <th>{fr ? "Responsable" : "Owner"}</th><th>{fr ? "Revue" : "Review"}</th><th>{fr ? "Commentaire" : "Comment"}</th><th>{fr ? "Lien" : "Link"}</th><th aria-label={fr ? "Retirer" : "Remove"} />
                  </tr></thead>
                  <tbody>
                    {P.pkg.follow_up.map((f) => {
                      const ref = caseById.get(f.case_key);
                      const item = P.pkg.perimeter.find((i) => i.id === f.item_id);
                      return (
                        <tr key={f.case_key}>
                          <td className="nowrap">
                            {ref?.reference ?? f.case_key.split("|").slice(0, 3).join(" ")}
                            {diff.disappeared.includes(f.case_key) && <div className="cell-sub warn-text">{fr ? "Plus visible dans la source actuelle" : "No longer visible in the current source"}</div>}
                          </td>
                          <td>{item ? <Link to={itemLink(item)}>{item.label}</Link> : "—"}</td>
                          <td>
                            <select value={f.status} onChange={(e) => P.setFollowUp(f.case_key, "status", e.target.value)} aria-label={fr ? "Statut" : "Status"}>
                              {(["a_evaluer", "evalue", "non_pertinent"] as const).map((s) => <option key={s} value={s}>{statusLabel(s, lang)}</option>)}
                            </select>
                          </td>
                          <td><input type="text" value={f.control_measure} onChange={(e) => P.setFollowUp(f.case_key, "control_measure", e.target.value)} aria-label={fr ? "Mesure de maîtrise" : "Control measure"} /></td>
                          <td><input type="text" value={f.frequency} onChange={(e) => P.setFollowUp(f.case_key, "frequency", e.target.value)} aria-label={fr ? "Fréquence" : "Frequency"} /></td>
                          <td><input type="text" value={f.owner} onChange={(e) => P.setFollowUp(f.case_key, "owner", e.target.value)} aria-label={fr ? "Responsable" : "Owner"} /></td>
                          <td><input type="date" value={f.date_reviewed} onChange={(e) => P.setFollowUp(f.case_key, "date_reviewed", e.target.value)} aria-label={fr ? "Date de revue" : "Review date"} /></td>
                          <td><input type="text" value={f.comment} onChange={(e) => P.setFollowUp(f.case_key, "comment", e.target.value)} aria-label={fr ? "Commentaire" : "Comment"} /></td>
                          <td>{(f.url || ref?.url) && <a href={f.url || ref?.url} target="_blank" rel="noopener noreferrer">{fr ? "source" : "source"}</a>}</td>
                          <td><button type="button" className="btn ghost" onClick={() => P.removeFollowUp(f.case_key)} aria-label={fr ? "Retirer ce cas du suivi" : "Remove from follow-up"}>×</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Perimeter items */}
          {P.pkg.perimeter.length > 0 && (
            <Card title={fr ? "Matières, origines et dangers suivis" : "Tracked materials, origins and hazards"}>
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr>
                    <th>{fr ? "Libellé" : "Label"}</th><th>{fr ? "Type" : "Type"}</th><th>{fr ? "Criticité" : "Criticality"}</th>
                    <th>{fr ? "Note" : "Note"}</th><th>{fr ? "Cas suivis" : "Followed cases"}</th><th aria-label={fr ? "Retirer" : "Remove"} />
                  </tr></thead>
                  <tbody>
                    {P.pkg.perimeter.map((item) => {
                      const refs = perItem[item.id] ?? [];
                      const followed = refs.filter((r) => P.pkg.follow_up.some((f) => f.case_key === r.key)).length;
                      return (
                        <tr key={item.id}>
                          <td><ItemLink item={item} lang={lang} /></td>
                          <td>{typeLabel(item.type, lang)}</td>
                          <td>
                            <select value={item.criticality} onChange={(e) => P.setCriticality(item.id, e.target.value as Criticality)} aria-label={fr ? "Criticité" : "Criticality"}>
                              {CRITICALITIES.map((c) => <option key={c} value={c}>{criticalityLabel(c, lang)}</option>)}
                            </select>
                          </td>
                          <td><input type="text" value={item.note} onChange={(e) => P.setNote(item.id, e.target.value)} aria-label={fr ? "Note" : "Note"} placeholder={fr ? "Fournisseur, gamme…" : "Supplier, range…"} /></td>
                          <td>{fmtNum(followed, lang)} / {fmtNum(refs.length, lang)}</td>
                          <td><button type="button" className="btn ghost" onClick={() => P.remove(item.id)} aria-label={fr ? "Retirer du périmètre" : "Remove from perimeter"}>×</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="meta">{fr ? "« Cas suivis » : cas classés dans le suivi / cas correspondants dans les sources." : "“Followed cases”: triaged cases / matching cases in the sources."}</p>
            </Card>
          )}

          {/* Export & import */}
          <Card title={fr ? "Enregistrer / charger" : "Save / load"}>
            <p className="meta">{fr
              ? "Votre fichier .vey est un simple fichier texte : conservez-le (réseau de l'entreprise, dossier d'audit). Il ne contient que vos choix et notes — jamais le contenu des rapports."
              : "Your .vey file is plain text: keep it (company network, audit file). It holds only your choices and notes — never report content."}</p>
            <div className="btn-row">
              <button type="button" className="btn primary" onClick={doExportVey}>{fr ? "Enregistrer mon périmètre (.vey)" : "Save my perimeter (.vey)"}</button>
              <button type="button" className="btn" onClick={doExportXlsx} disabled={!P.pkg.perimeter.length}>{fr ? "Exporter Excel (.xlsx)" : "Export Excel (.xlsx)"}</button>
              <button type="button" className="btn" onClick={doExportCsv} disabled={!P.pkg.follow_up.length}>{fr ? "Exporter CSV" : "Export CSV"}</button>
              <button type="button" className="btn" onClick={() => window.print()} disabled={!P.pkg.perimeter.length}>{fr ? "Imprimer la synthèse (PDF)" : "Print summary (PDF)"}</button>
            </div>
            <hr className="sep" />
            <div className="import-row">
              <input ref={fileRef} type="file" accept=".vey,application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ""; }} id="vey-input" />
              <label htmlFor="vey-input" className="btn">{fr ? "Charger mon périmètre (.vey)" : "Load my perimeter (.vey)"}</label>
            </div>
            {importErr && <p className="import-preview error"><span className="warn-text">{importErr}</span></p>}
            {previewPkg && (
              <div className="import-preview ok">
                <p>{fr ? "Contenu du fichier :" : "File content:"} <strong>{previewPkg.perimeter.length}</strong> {fr ? "élément(s)" : "item(s)"}, <strong>{previewPkg.follow_up.length}</strong> {fr ? "cas suivi(s)" : "followed case(s)"}
                  {previewPkg.created_at ? ` · ${fr ? "créé le" : "created"} ${new Date(previewPkg.created_at).toLocaleDateString(fr ? "fr-FR" : "en-GB")}` : ""}</p>
                {previewPkg.baseline.ffn_latest && <p className="meta">{fr ? `Données du package : FFN ${previewPkg.baseline.ffn_latest} · IFS ${previewPkg.baseline.ifs_latest ?? "—"}` : `Package data: FFN ${previewPkg.baseline.ffn_latest} · IFS ${previewPkg.baseline.ifs_latest ?? "—"}`}</p>}
                <ImportLivePreview pkg={previewPkg} lang={lang} current={allRefs} baselineNow={baseline} />
                <div className="btn-row">
                  <button type="button" className="btn primary" onClick={acceptImport}>{fr ? "Valider le chargement" : "Confirm load"}</button>
                  <button type="button" className="btn ghost" onClick={() => setPreviewPkg(null)}>{fr ? "Annuler" : "Cancel"}</button>
                </div>
              </div>
            )}
          </Card>

          {ffnErr && <p className="notice warn">{fr ? "Les suspicions UE n'ont pas pu être chargées — la détection des nouveautés sera incomplète." : "EU suspicions could not be loaded — new-case detection will be incomplete."}</p>}
        </>
      )}
    </div>
  );
}

function itemLink(item: PerimeterPackage["perimeter"][number]): string {
  if (item.type === "family") return `/matiere/${item.ref}`;
  if (item.type === "origin") return `/origine/${encodeURIComponent(item.ref)}`;
  return `/matieres`;
}

function ItemLink({ item, lang }: { item: PerimeterPackage["perimeter"][number]; lang: Lang }) {
  const fr = lang === "fr";
  if (item.type === "family") return <Link to={`/matiere/${item.ref}`}>{item.label}</Link>;
  if (item.type === "origin") return <Link to={`/origine/${encodeURIComponent(item.ref)}`}>{item.label}</Link>;
  return <span>{item.label}<div className="cell-sub">{fr ? "filtre texte" : "text filter"}</div></span>;
}

function EmptyState({ lang, onHelp }: { lang: Lang; onHelp: () => void }) {
  const fr = lang === "fr";
  return (
    <div className="empty-perimeter">
      <p>{fr ? "Votre périmètre est vide." : "Your perimeter is empty."}</p>
      <ol>
        <li>{fr ? "Ajoutez vos matières et origines : recherchez-les depuis l'accueil, puis cliquez « Ajouter à mon périmètre » sur la fiche." : "Add your materials and origins: search from the home page, then click “Add to my perimeter” on the sheet."}</li>
        <li>{fr ? "Classez les nouveautés chaque mois : à évaluer, évalué, non pertinent." : "Triage new cases each month: to assess, assessed, not relevant."}</li>
        <li>{fr ? "Enregistrez votre fichier .vey : c'est votre seule copie, conservez-le." : "Save your .vey file: it is your only copy, keep it."}</li>
        <li>{fr ? "Le mois suivant, rechargez-le : l'app affiche les nouveautés de votre périmètre." : "Next month, load it back: the app shows your perimeter's new cases."}</li>
      </ol>
      <p className="meta">{fr ? "Tout reste sur votre poste. Le fichier ne contient pas le contenu des rapports, seulement des références et vos notes." : "Everything stays on your computer. The file holds no report content, only references and your notes."}</p>
      <div className="btn-row">
        <button type="button" className="btn ghost" onClick={onHelp}>{fr ? "Voir l'aide détaillée" : "Detailed help"}</button>
        <Link className="btn" to="/matieres">{fr ? "Choisir mes matières" : "Pick my materials"}</Link>
      </div>
    </div>
  );
}

function HelpPanel({ lang }: { lang: Lang }) {
  const fr = lang === "fr";
  return (
    <div className="help-panel">
      <h3>{fr ? "Comment utiliser Mon périmètre" : "How to use My perimeter"}</h3>
      <ol>
        <li><strong>{fr ? "Ajouter" : "Add"}</strong> — {fr ? "depuis la recherche de l'accueil, la fiche matière ou la fiche origine, cliquez « Ajouter à mon périmètre »." : "from the home search, the material sheet or the origin sheet, click “Add to my perimeter”."}</li>
        <li><strong>{fr ? "Qualifier" : "Triage"}</strong> — {fr ? "classez chaque nouveauté (à évaluer / évalué / non pertinent), notez la mesure de maîtrise, la fréquence et le responsable." : "triage each new case (to assess / assessed / not relevant), note the control measure, frequency and owner."}</li>
        <li><strong>{fr ? "Enregistrer" : "Save"}</strong> — {fr ? "téléchargez le fichier .vey et conservez-le (il ne contient que vos choix, jamais le contenu des rapports)." : "download the .vey file and keep it (it holds only your choices, never report content)."}</li>
        <li><strong>{fr ? "Mettre à jour" : "Update"}</strong> — {fr ? "au mois suivant, rechargez votre .vey : les nouveautés de votre périmètre sont listées, vos qualifications conservées." : "next month, load your .vey back: your perimeter's new cases are listed, your triage preserved."}</li>
      </ol>
      <p className="meta">{fr
        ? "Confidentialité : tout reste sur votre poste (aucun serveur). Le fichier contient vos matières et notes — traitez-le comme un document interne. Exemple fictif : "
        : "Privacy: everything stays on your computer (no server). The file holds your materials and notes — treat it as an internal document. Fictional example: "}
        <a href={`${import.meta.env.BASE_URL}exemple-perimetre.vey`} download>exemple-perimetre.vey</a></p>
    </div>
  );
}

function ImportLivePreview({ pkg, lang, current, baselineNow }: { pkg: PerimeterPackage; lang: Lang; current: CaseRef[]; baselineNow: PerimeterPackage["baseline"] }) {
  const fr = lang === "fr";
  const d = diffAgainstPackage(pkg, current);
  const changes = previewText(pkg, baselineNow);
  return (
    <div className="merge-preview">
      <p>{fr ? `Si vous validez : ${d.newCases.length} nouveauté(s) dans votre périmètre, ${d.disappeared.length} cas suivi(s) plus visible(s) dans les sources.` : `If you confirm: ${d.newCases.length} new case(s) in your perimeter, ${d.disappeared.length} followed case(s) no longer visible in the sources.`}</p>
      {changes.length > 0 && <p className="meta">{changes.join(" · ")}</p>}
    </div>
  );
}

function previewText(pkg: PerimeterPackage, baselineNow: PerimeterPackage["baseline"]): string[] {
  const out: string[] = [];
  const pairs: [string, string | null, string | null][] = [
    ["FFN", pkg.baseline.ffn_latest, baselineNow.ffn_latest],
    ["JRC", pkg.baseline.jrc_latest, baselineNow.jrc_latest],
    ["IFS", pkg.baseline.ifs_latest, baselineNow.ifs_latest],
  ];
  for (const [n, was, now] of pairs) if (was && now && was !== now) out.push(`${n} : ${was} → ${now}`);
  return out;
}
