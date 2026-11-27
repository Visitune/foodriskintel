import { useEffect, useMemo, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import type { Lang } from "../i18n";
import type { Dataset, RiskIndex } from "../types";
import { useFfn, useJrc } from "../data";
import { fmtMonth, fmtNum } from "../format";
import { usePerimeter } from "../perimeter/PerimeterContext";
import { baselineFromIndex, caseRefs, matchesItem, toDatasets, type CaseRef } from "../perimeter/match";
import { latestMonths, uniqueCases, upgradeKeys } from "../perimeter/review";
import { useSave, type Saver } from "../perimeter/useSave";
import { canRewriteFile } from "../perimeter/fileStore";
import ReviewTab from "./perimeter/ReviewTab";
import RegisterTab from "./perimeter/RegisterTab";
import ItemsTab from "./perimeter/ItemsTab";
import FileTab from "./perimeter/FileTab";
import PrintSummary from "./perimeter/PrintSummary";
import Setup, { type SetupStep } from "./perimeter/Setup";
import { fmtDay, type PerimeterView } from "./perimeter/view";

const month = (year: number, m: number) => ({ month: `${year}-${String(m).padStart(2, "0")}` });

export default function Perimeter({ ifs, index, lang }: { ifs: Dataset; index: RiskIndex; lang: Lang }) {
  const fr = lang === "fr";
  const P = usePerimeter();
  const { tab = "revue" } = useParams();
  const ffn = useFfn();
  const jrc = useJrc();
  const saver = useSave(index, lang);
  const [helpOpen, setHelpOpen] = useState(false);
  const [flow, setFlow] = useState<SetupStep | null>(null);

  const complete = !!ffn.data && !!jrc.data;
  const failed = [ffn.error && "FFN", jrc.error && "JRC"].filter(Boolean).join(", ");
  const loading = (!ffn.data && !ffn.error) || (!jrc.data && !jrc.error);

  const datasets = useMemo(() => toDatasets(ffn.data, jrc.data, ifs), [ffn.data, jrc.data, ifs]);
  // Matching only depends on what is watched: typing a note must not recompute it.
  const watched = JSON.stringify(P.pkg.perimeter.map((i) => [i.id, i.type, i.ref, i.criticality]));
  const { cases, matches } = useMemo(() => {
    const perItem: Record<string, CaseRef[]> = {};
    const keys: Record<string, string[]> = {};
    for (const item of P.pkg.perimeter) {
      perItem[item.id] = caseRefs(item, matchesItem(item, datasets));
      keys[item.id] = perItem[item.id].map((c) => c.key);
    }
    return { cases: uniqueCases(P.pkg.perimeter, perItem), matches: keys };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched, datasets]);
  const caseById = useMemo(() => new Map(cases.map((c) => [c.key, c])), [cases]);
  const latest = useMemo(() => latestMonths({ ffn: datasets.ffn.map((c) => month(c.year, c.month_num)), jrc: datasets.jrc }), [datasets]);
  const view: PerimeterView = { lang, index, cases, caseById, matches, latest, complete };

  // Files and drafts from v1: carry keys over, only once nothing is missing.
  const { upgrade, pkg } = P;
  useEffect(() => {
    if (complete) upgrade((p) => upgradeKeys(p, cases));
  }, [complete, cases, pkg, upgrade]);

  // First use: nothing reviewed and no starting point chosen yet.
  const fresh = !pkg.reviews.length && !pkg.follow_up.length && pkg.perimeter.every((i) => i.history_scope === "");
  const step: SetupStep | null = flow ?? (fresh ? "pick" : null);

  const current = ["revue", "registre", "elements", "fichier"].includes(tab) ? tab : "revue";
  const tabs: [string, string][] = [
    ["revue", fr ? "Revue" : "Review"],
    ["registre", fr ? "Registre" : "Register"],
    ["elements", fr ? "Périmètre" : "Perimeter"],
    ["fichier", fr ? "Fichier et exports" : "File and exports"],
  ];
  const dataLine = `FFN ${fmtMonth(index.sources.ffn.latest, lang, "short")} · JRC ${fmtMonth(index.sources.jrc.latest, lang, "short")} · IFS ${fmtMonth(index.sources.ifs.latest, lang, "short")}`;

  return (
    <div className="page perimeter">
      <PrintSummary view={view} />

      <header className="page-header">
        <h2>{fr ? "Mon périmètre" : "My perimeter"}</h2>
        <p className="subtitle">{fr ? `Surveillez vos matières, origines et dangers. Données : ${dataLine}.` : `Watch your materials, origins and hazards. Data: ${dataLine}.`}</p>
        <button type="button" className="btn ghost" aria-expanded={helpOpen} onClick={() => setHelpOpen((v) => !v)}>{fr ? "Comment ça marche ?" : "How does it work?"}</button>
      </header>

      {helpOpen && <HelpPanel lang={lang} />}

      {!step && <SaveBar lang={lang} saver={saver} />}
      {!step && <NewData lang={lang} index={index} />}
      <UndoBar lang={lang} />

      {failed && (
        <div className="notice warn" role="alert">
          {fr ? `Sources non chargées : ${failed}. Les listes sont incomplètes et la revue ne peut pas être close.` : `Sources not loaded: ${failed}. Lists are incomplete and the review cannot be closed.`}{" "}
          <button type="button" className="btn" onClick={() => { if (ffn.error) ffn.retry(); if (jrc.error) jrc.retry(); }}>{fr ? "Réessayer" : "Retry"}</button>
        </div>
      )}

      {!step && (
        <nav className="tabs" aria-label={fr ? "Sections de mon périmètre" : "My perimeter sections"}>
          {tabs.map(([id, label]) => (
            <NavLink key={id} to={id === "revue" ? "/perimetre" : `/perimetre/${id}`} className={current === id ? "tab on" : "tab"} aria-current={current === id ? "page" : undefined} end>{label}</NavLink>
          ))}
        </nav>
      )}

      {loading ? <div className="loading" role="status">{fr ? "Chargement des données…" : "Loading data…"}</div>
        : step ? <Setup view={view} saver={saver} step={step} onStep={setFlow} />
        : current === "registre" ? <RegisterTab view={view} />
        : current === "elements" ? <ItemsTab view={view} />
        : current === "fichier" ? <FileTab view={view} saver={saver} />
        : <ReviewTab view={view} saver={saver} />}
    </div>
  );
}

/** Where the work stands, in plain words. */
function SaveBar({ lang, saver }: { lang: Lang; saver: Saver }) {
  const fr = lang === "fr";
  const P = usePerimeter();
  const lastSave = [...P.pkg.history].reverse().find((h) => h.event === "export");
  const unsaved = P.pkg.follow_up.filter((f) => f.decided_at && f.decided_at > (lastSave?.at ?? "")).length;
  const when = lastSave ? `${fmtDay(lastSave.at, lang)} ${new Date(lastSave.at).toLocaleTimeString(fr ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" })}` : "";
  const file = saver.fileName ? `« ${saver.fileName} »` : fr ? "votre fichier" : "your file";

  let tone = P.dirty ? "pending" : "safe";
  let message: string;
  if (P.draftFailed) {
    tone = "failed";
    message = fr ? "Ce navigateur ne peut pas garder votre travail. Enregistrez le fichier maintenant." : "This browser cannot keep your work. Save the file now.";
  } else if (saver.outcome === "failed" && P.dirty) {
    tone = "failed";
    message = fr ? "L'écriture du fichier a échoué. Votre travail reste dans ce navigateur : réessayez." : "Writing the file failed. Your work is still in this browser: try again.";
  } else if (P.dirty) {
    const what = unsaved ? (fr ? `${fmtNum(unsaved, lang)} décision(s) gardée(s)` : `${fmtNum(unsaved, lang)} decision(s) kept`) : fr ? "Changements gardés" : "Changes kept";
    message = `${what} ${fr ? "dans ce navigateur, pas encore dans votre fichier." : "in this browser, not in your file yet."}`;
    if (saver.outcome === "cancelled") message = `${fr ? "Enregistrement interrompu." : "Save cancelled."} ${message}`;
  } else if (saver.outcome === "downloaded") {
    message = fr ? `Fichier téléchargé le ${when}. Rangez-le avec vos documents.` : `File downloaded on ${when}. Store it with your documents.`;
  } else {
    message = lastSave
      ? (fr ? `Enregistré dans ${file} le ${when}.` : `Saved in ${file} on ${when}.`)
      : (fr ? "Aucun changement depuis le chargement du fichier." : "No change since the file was loaded.");
  }

  return (
    <div className={`save-bar ${tone}`} role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" className={tone === "safe" ? "btn" : "btn primary"} onClick={() => void saver.save()}>
        {saver.fileName ? (fr ? "Mettre à jour le fichier" : "Update the file") : fr ? "Enregistrer le fichier" : "Save the file"}
      </button>
    </div>
  );
}

/** Shown when sources were published after the last save. */
function NewData({ lang, index }: { lang: Lang; index: RiskIndex }) {
  const fr = lang === "fr";
  const { pkg } = usePerimeter();
  const now = baselineFromIndex(index);
  const changes = ([["FFN", pkg.baseline.ffn_latest, now.ffn_latest], ["JRC", pkg.baseline.jrc_latest, now.jrc_latest], ["IFS", pkg.baseline.ifs_latest, now.ifs_latest]] as const)
    .filter(([, was, is]) => was && is && was !== is)
    .map(([name, was, is]) => `${name} ${fmtMonth(was, lang, "short")} → ${fmtMonth(is, lang, "short")}`);
  if (!changes.length) return null;
  return <p className="notice" role="status">{fr ? "Nouvelles données publiées depuis votre dernier enregistrement : " : "New data published since your last save: "}{changes.join(" · ")}</p>;
}

function UndoBar({ lang }: { lang: Lang }) {
  const fr = lang === "fr";
  const P = usePerimeter();
  if (!P.undoable) return null;
  const n = fmtNum(P.undoable.count, lang);
  const text = {
    decision: fr ? `Décision enregistrée sur ${n} cas.` : `Decision recorded on ${n} case(s).`,
    item: fr ? `Élément retiré, avec ${n} cas du registre.` : `Item removed, with ${n} register case(s).`,
    case: fr ? "Cas retiré du registre." : "Case removed from the register.",
    bulk: fr ? `${n} cas modifiés.` : `${n} case(s) changed.`,
  }[P.undoable.kind];
  return (
    <div className="undo-bar" role="status">
      <span>{text}</span>
      <button type="button" className="btn" onClick={P.undo}>{fr ? "Annuler" : "Undo"}</button>
    </div>
  );
}

function HelpPanel({ lang }: { lang: Lang }) {
  const fr = lang === "fr";
  const steps: [string, string][] = fr
    ? [["Choisir", "matières, origines et dangers sur un seul écran (ou « + périmètre » dans la recherche), puis le point de départ."],
       ["Passer en revue", "les cas sont réunis par sujet. Décidez : non pertinent, maîtrisé, action à prévoir ou plus tard."],
       ["Clore", "la revue est datée et le fichier de périmètre est enregistré."],
       ["Le mois suivant", "seuls les cas jamais décidés sont présentés ; les revues et actions en retard sont signalées."]]
    : [["Choose", "materials, origins and hazards on one screen (or “+ perimeter” in the search), then the starting point."],
       ["Review", "cases are grouped by topic. Decide: not relevant, controlled, action needed or later."],
       ["Close", "the review is dated and the perimeter file is saved."],
       ["Next month", "only cases never decided are shown; overdue reviews and actions are flagged."]];
  return (
    <div className="help-panel">
      <h3>{fr ? "Votre revue en quatre temps" : "Your review in four steps"}</h3>
      <ol>{steps.map(([title, body]) => <li key={title}><strong>{title}</strong> — {body}</li>)}</ol>
      <p className="meta">{canRewriteFile()
        ? (fr ? "Dans ce navigateur, l'application réécrit le même fichier après votre autorisation." : "In this browser, the app rewrites the same file once you allow it.")
        : (fr ? "Dans ce navigateur, chaque enregistrement télécharge un fichier." : "In this browser, each save downloads a file.")}{" "}
        {fr ? "Les cas sont des signaux publiés (suspicions, presse), pas des condamnations." : "Cases are published signals (suspicions, press), not convictions."}</p>
    </div>
  );
}
