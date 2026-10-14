"""
Monthly updater — IFS + FFN
Downloads new PDFs, extracts, rebuilds datasets, writes cross table.
Designed for local cron or GitHub Actions.

Usage:
    python scripts/update_monthly.py
    python scripts/update_monthly.py --dry-run
"""
import subprocess, sys, json, argparse
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent

def run(cmd, dry=False):
    print(f"\n$ {' '.join(cmd)}")
    if dry:
        print("  (dry-run — skipped)")
        return True
    r = subprocess.run(cmd, cwd=ROOT)
    return r.returncode == 0

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    steps = [
        [sys.executable, "scripts/discover_ifs_pdfs.py", "--output", "data/inventory.json"],
        [sys.executable, "scripts/discover_ffn_pdfs.py", "--output", "data/inventory_ffn.json"],
        [sys.executable, "scripts/extract.py", "--inventory", "data/inventory.json", "--output", "data/raw_extractions.json"],
        [sys.executable, "scripts/extract_ffn.py", "--inventory", "data/inventory_ffn.json", "--output", "data/raw_ffn_extractions.json"],
        [sys.executable, "scripts/normalize_and_build.py", "--input", "data/raw_extractions.json", "--output", "data/dataset.json"],
        [sys.executable, "scripts/build_ffn_dataset.py"],
        [sys.executable, "scripts/build_index.py"],
        [sys.executable, "scripts/check_dataset.py"],
    ]
    ok_all=True
    for cmd in steps:
        ok=run(cmd, dry=args.dry_run)
        if not ok:
            print(f"FAILED: {' '.join(cmd)}")
            ok_all=False
            break
    # Summary + propagate datasets to app/public (served copy)
    if not args.dry_run and ok_all:
        for name in ("dataset.json", "dataset_ffn.json", "dataset_cross.json", "index.json"):
            src = ROOT / "data" / name
            dst = ROOT / "app" / "public" / name
            if src.exists():
                dst.write_bytes(src.read_bytes())
                print(f"Synced {dst.relative_to(ROOT)}")
        try:
            ffn=json.loads((ROOT/"data/dataset_ffn.json").read_text(encoding="utf-8"))
            cross=json.loads((ROOT/"data/dataset_cross.json").read_text(encoding="utf-8"))
            print("\n--- Monthly update summary ---")
            print(f"FFN: {ffn['summary']['total_reports']} reports, {ffn['summary']['total_suspicions']} suspicions")
            print(f"Cross window {cross['window']['start']}->{cross['window']['end']}: {cross['summary']['months_with_both_sources']}/{cross['summary']['months_in_window']} months with both sources")
            # detect new month
            last_ffn = ffn["reports"][-1]["id"] if ffn["reports"] else "none"
            last_ifs = cross["cross"][-1]["month"] if cross["cross"] else "none"
            print(f"Latest FFN: {last_ffn}  Latest cross: {last_ifs}")
            print(f"Generated at {datetime.now().isoformat()}")
        except Exception as e:
            print(f"Summary error: {e}")
    sys.exit(0 if ok_all else 1)

if __name__=="__main__":
    main()
