import { useCallback, useEffect, useState } from "react";
import type { Lang } from "../i18n";
import type { RiskIndex } from "../types";
import { asSaved, usePerimeter, type PerimeterPackage } from "./PerimeterContext";
import { download, packageFilename, serialize } from "./io";
import { forgetLink, recallLink, writeFile, type Link } from "./fileStore";
import { baselineFromIndex } from "./match";

export type SaveOutcome = "idle" | "written" | "downloaded" | "failed" | "cancelled";

/** Saving the perimeter file. Call `save` straight from a click. */
export function useSave(index: RiskIndex, lang: Lang) {
  const P = usePerimeter();
  const [link, setLink] = useState<Link | null>(null);
  const [outcome, setOutcome] = useState<SaveOutcome>("idle");

  useEffect(() => { recallLink().then((l) => { if (l) setLink(l); }); }, []);

  /** `pkg` and `rev` differ from the current state when a change is saved in the same click. */
  const save = useCallback(async (pkg: PerimeterPackage = P.pkg, rev: number = P.rev) => {
    const at = new Date().toISOString();
    const baseline = baselineFromIndex(index);
    const content = serialize(asSaved(pkg, baseline, at));
    const result = await writeFile({
      link,
      owner: pkg.created_at,
      suggestedName: packageFilename(),
      content,
      confirmOverwrite: (name) => window.confirm(lang === "fr"
        ? `Le fichier « ${name} » a été modifié en dehors de l'application depuis sa dernière lecture. L'écraser avec votre travail ?`
        : `“${name}” was changed outside the app since it was last read. Overwrite it with your work?`),
    });
    if (result.kind === "cancelled") return setOutcome("cancelled");
    if (result.kind === "failed") return setOutcome("failed");
    if (result.kind === "written") setLink(result.link);
    else download(packageFilename(), content);
    P.saved(rev, baseline, at);
    setOutcome(result.kind === "written" ? "written" : "downloaded");
  }, [P, index, lang, link]);

  /** Called when another file is loaded: the next save must target that one. */
  const relink = useCallback((next: Link | null) => {
    setLink(next);
    setOutcome("idle");
    if (!next) forgetLink();
  }, []);

  const fileName = link && link.owner === P.pkg.created_at ? link.handle.name : "";
  return { save, outcome, fileName, relink };
}

export type Saver = ReturnType<typeof useSave>;
