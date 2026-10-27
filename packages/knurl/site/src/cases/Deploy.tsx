import { useEffect, useRef, useState } from "react";
import { Annunciator, Combo, Gauge, Gears, Keycap, Rocker, Timer, Track } from "knurl-ui/react";
import type { Finish } from "knurl-ui";

/**
 * A release console. Two flags set what the release does, a second
 * person's code arms it, and Deploy runs the train: each stage fills the
 * gauge, the gears turn while work is running, the annunciator shows the
 * services, and the change window counts down. Everything here is
 * simulated with timers.
 */

type State = "off" | "ok" | "warn" | "alert";
const STAGES = ["Build", "Test", "Stage", "Canary", "Prod"];
const SERVICES = ["API", "WEB", "DB", "QUEUE", "CDN", "AUTH"];
const ARM_CODE = "2468";

export function Deploy({ finish = "line" }: { finish?: Finish }) {
  const [canary, setCanary] = useState(true);
  const [migrate, setMigrate] = useState(false);
  const [code, setCode] = useState("");
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [window_, setWindow] = useState(25 * 60);
  const [services, setServices] = useState<Record<string, State>>(Object.fromEntries(SERVICES.map((s) => [s, "ok"])));
  const [log, setLog] = useState<string[]>(["Ready. Enter the arming code to deploy."]);
  const timer = useRef(0);

  const armed = code === ARM_CODE;
  const stages = canary ? STAGES : STAGES.filter((s) => s !== "Canary");
  const say = (line: string) => setLog((l) => [line, ...l].slice(0, 5));

  function deploy() {
    if (!armed || running) return;
    setRunning(true); setStage(0); setProgress(0);
    say(`Deploying v2.14.0${migrate ? " with migrations" : ""}${canary ? ", canary first" : ""}.`);
    let s = 0, p = 0;
    clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      p += 4 + Math.random() * 7;
      if (stages[s] === "Stage" && migrate && p > 40 && p < 52) setServices((x) => ({ ...x, DB: "warn" }));
      if (stages[s] === "Canary" && p > 30 && p < 40) setServices((x) => ({ ...x, QUEUE: "alert" }));
      if (stages[s] === "Canary" && p > 70) setServices((x) => ({ ...x, QUEUE: "ok" }));
      if (p >= 100) {
        say(`${stages[s]} passed.`);
        if (stages[s] === "Stage") setServices((x) => ({ ...x, DB: "ok" }));
        s++; p = 0;
        if (s >= stages.length) {
          clearInterval(timer.current);
          setRunning(false); setStage(stages.length - 1); setProgress(100); setCode("");
          say("v2.14.0 is live. Disarmed.");
          return;
        }
        setStage(s);
      }
      setProgress(Math.min(100, p));
    }, 220);
  }
  useEffect(() => () => clearInterval(timer.current), []);

  return (
    <div className="rack">
      <div className="rack-row">
        <figure className="wide"><Track finish={finish} label="Release" steps={stages} current={stage} style={{ width: 400 }} /><figcaption>{stages[stage]} · step {stage + 1} of {stages.length}</figcaption></figure>
        <figure><Gauge finish={finish} label={`${stages[stage]} progress`} value={progress} peak={false} style={{ width: 140 }} /><figcaption>Stage <output>{Math.round(progress)}%</output></figcaption></figure>
        <figure><Gears finish={finish} label={running ? "Deploying" : "Idle"} spinning={running} style={{ width: 130 }} /><figcaption>{running ? "Running" : "Idle"}</figcaption></figure>
      </div>
      <div className="rack-row">
        <figure><Annunciator finish={finish} label="Services" columns={3} items={SERVICES.map((s) => ({ id: s, label: s, state: services[s] }))} onTest={() => say("Lamp test.")} style={{ width: 300 }} /><figcaption>Services</figcaption></figure>
        <figure><Timer finish={finish} label="Change window" value={window_} onValueChange={setWindow} onDone={() => say("Change window closed.")} style={{ width: 140 }} /><figcaption>Window <output>{Math.floor(window_ / 60)}:{String(window_ % 60).padStart(2, "0")}</output></figcaption></figure>
      </div>
      <div className="rack-row">
        <figure><Rocker finish={finish} label="Canary first" checked={canary} onCheckedChange={setCanary} disabled={running} style={{ width: 110 }} /><figcaption>Canary</figcaption></figure>
        <figure><Rocker finish={finish} label="Run migrations" checked={migrate} onCheckedChange={setMigrate} disabled={running} style={{ width: 110 }} /><figcaption>Migrate</figcaption></figure>
        <figure><Combo finish={finish} label="Arming code" length={4} value={code} onValueChange={setCode} code={ARM_CODE} disabled={running} style={{ width: 170 }} /><figcaption>{armed ? "Armed" : `Code ${ARM_CODE}`}</figcaption></figure>
        <figure><Keycap finish={finish} legend="Deploy" units={2.25} disabled={!armed || running} onPress={deploy} style={{ width: 170 }} /><figcaption>{armed ? "Ready" : "Locked"}</figcaption></figure>
      </div>
      <ol className="rack-log" aria-live="polite">{log.map((l, i) => <li key={log.length - i}>{l}</li>)}</ol>
    </div>
  );
}
