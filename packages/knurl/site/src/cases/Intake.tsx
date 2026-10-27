import { useEffect, useRef, useState } from "react";
import { Annunciator, Caliper, Counter, Gauge, Gears, Presets, Selector, Tank, Tray } from "knurl-ui/react";
import type { Finish } from "knurl-ui";

/**
 * A document intake desk. Drop PDFs in the tray; choose the page range,
 * paper and quality, and how many copies; each file is then processed in
 * turn while the checks light up and the storage tank fills. Processing is
 * simulated; the files never leave the page.
 */

type Check = "off" | "ok" | "warn" | "alert";
const CHECKS = ["OCR", "PII", "SIGN", "SIZE"];
const QUOTA_MB = 500;

export function Intake({ finish = "line" }: { finish?: Finish }) {
  const [files, setFiles] = useState<File[]>([]);
  const [pages, setPages] = useState<[number, number]>([1, 12]);
  const [paper, setPaper] = useState("A4");
  const [quality, setQuality] = useState("STD");
  const [copies, setCopies] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [progress, setProgress] = useState(0);
  const [checks, setChecks] = useState<Record<string, Check>>(Object.fromEntries(CHECKS.map((c) => [c, "off"])));
  const [usedMb, setUsedMb] = useState(184);
  const timer = useRef(0);

  function add(list: File[]) { setFiles((f) => [...f, ...list]); }

  // one file at a time: four checks, then it is stored
  const settings = useRef({ copies, quality });
  settings.current = { copies, quality };
  useEffect(() => () => clearInterval(timer.current), []);
  useEffect(() => {
    if (busy || done >= files.length) return;
    const file = files[done];
    const { copies, quality } = settings.current;
    setBusy(true); setProgress(0);
    setChecks(Object.fromEntries(CHECKS.map((c) => [c, "off"])));
    let p = 0;
    timer.current = window.setInterval(() => {
      p += 6 + Math.random() * 8;
      const reached = Math.min(CHECKS.length, Math.floor(p / 25));
      setChecks(() => Object.fromEntries(CHECKS.map((c, i): [string, Check] => [c, i < reached ? (c === "PII" && /contract|invoice|id/i.test(file.name) ? "warn" : c === "SIZE" && file.size > 20e6 ? "alert" : "ok") : "off"])));
      setProgress(Math.min(100, p));
      if (p >= 100) {
        clearInterval(timer.current);
        const mb = (file.size / 1e6) * copies * (quality === "HIGH" ? 2 : quality === "DRAFT" ? 0.5 : 1);
        setUsedMb((u) => Math.min(QUOTA_MB, u + Math.max(0.4, mb)));
        setDone((d) => d + 1); setBusy(false);
      }
    }, 180);
  }, [files, done, busy]);

  const waiting = files.length - done;
  const [p0, p1] = pages;
  return (
    <div className="rack">
      <div className="rack-row">
        <figure><Tray finish={finish} label="Drop PDFs" accept=".pdf,application/pdf" count={files.length} onFiles={add} style={{ width: 190 }} /><figcaption>{files.length ? `${files.length} in · ${waiting} waiting` : "Drop PDFs or click"}</figcaption></figure>
        <figure><Gears finish={finish} label={busy ? "Processing" : "Idle"} spinning={busy} style={{ width: 130 }} /><figcaption>{busy ? files[done]?.name ?? "Processing" : "Idle"}</figcaption></figure>
        <figure><Gauge finish={finish} label="File progress" value={progress} peak={false} style={{ width: 150 }} /><figcaption>File <output>{Math.round(progress)}%</output></figcaption></figure>
        <figure><Annunciator finish={finish} label="Checks" columns={2} items={CHECKS.map((c) => ({ id: c, label: c, state: checks[c] }))} style={{ width: 180 }} /><figcaption>Checks</figcaption></figure>
      </div>
      <div className="rack-row">
        <figure className="wide"><Caliper finish={finish} label="Pages" min={1} max={40} value={pages} onValueChange={setPages} minGap={0} style={{ width: 360 }} /><figcaption>Pages <output>{p0}–{p1}</output> of 40</figcaption></figure>
        <figure><Presets finish={finish} label="Paper" options={["A4", "LTR", "A3"]} value={paper} onValueChange={setPaper} style={{ width: 200 }} /><figcaption>Paper {paper}</figcaption></figure>
      </div>
      <div className="rack-row">
        <figure><Selector finish={finish} label="Quality" options={["DRAFT", "STD", "HIGH"]} value={quality} onValueChange={setQuality} style={{ width: 150 }} /><figcaption>Quality</figcaption></figure>
        <figure><Counter finish={finish} label="Copies" min={1} max={99} value={copies} onValueChange={setCopies} style={{ width: 180 }} /><figcaption>Copies</figcaption></figure>
        <figure><Tank finish={finish} label="Storage used" value={usedMb} max={QUOTA_MB} high={QUOTA_MB * 0.9} format={(v) => `${Math.round(v)} of ${QUOTA_MB} MB`} style={{ width: 120 }} /><figcaption>Storage <output>{Math.round(usedMb)} MB</output></figcaption></figure>
      </div>
      <p className="rack-note">Files stay in this page. Names with “contract”, “invoice” or “id” trip the PII lamp; files over 20 MB trip SIZE.</p>
    </div>
  );
}
