import { useEffect, useState } from "react";
import type { FfnDataset, CrossDataset } from "./types";

const base = import.meta.env.BASE_URL;

function loadJson<T>(name: string): Promise<T> {
  return fetch(`${base}${name}`).then((r) => {
    if (!r.ok) throw new Error(name);
    return r.json() as Promise<T>;
  });
}

// Large datasets are loaded on demand and shared between pages.
let ffnPromise: Promise<FfnDataset> | null = null;
let crossPromise: Promise<CrossDataset> | null = null;

function useLazy<T>(get: () => Promise<T>): { data: T | null; error: boolean } {
  const [state, setState] = useState<{ data: T | null; error: boolean }>({ data: null, error: false });
  useEffect(() => {
    let alive = true;
    get().then((d) => alive && setState({ data: d, error: false })).catch(() => alive && setState({ data: null, error: true }));
    return () => { alive = false; };
  }, [get]);
  return state;
}

const getFfn = () => (ffnPromise ??= loadJson<FfnDataset>("dataset_ffn.json"));
const getCross = () => (crossPromise ??= loadJson<CrossDataset>("dataset_cross.json"));

export const useFfn = () => useLazy(getFfn);
export const useCross = () => useLazy(getCross);
export { loadJson };
