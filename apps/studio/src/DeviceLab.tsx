import { MaterialEffect, type MaterialKind } from '@in-c0/paper-ui';
import { useEffect, useRef, useState } from 'react';
import './device-lab.css';

type Duration = 3 | 10 | 30;
type Phase = 'ready' | 'sampling' | 'complete' | 'interrupted';
type CheckStatus = 'not-tested' | 'pass' | 'issue';
type ManualCheck = 'screenReader' | 'focus' | 'rotation' | 'background' | 'zoom';
type MaterialChoice = 'paper-texture' | 'grain-blob' | 'grain-wave';

type SampleResult = {
  schema: 'paper-ui.device-lab.v1';
  sampledAt: string;
  requestedSeconds: Duration;
  observedSeconds: number;
  material: MaterialChoice;
  shaderStatus: string;
  pixelBudget: string | null;
  canvasCount: number;
  canvasBackBuffers: { width: number; height: number }[];
  requestAnimationFrame: {
    frameIntervals: number;
    hzEstimate: number | null;
    p50IntervalMs: number | null;
    p95IntervalMs: number | null;
    intervalsOver33ms: number;
    intervalsOver50ms: number;
  };
  longTasks: { supported: boolean; count: number; durationMs: number };
  device: {
    userAgent: string;
    viewport: { width: number; height: number };
    pixelRatio: number;
    reducedMotion: boolean;
    coarsePointer: boolean;
    online: boolean;
  };
  manualChecks: Record<ManualCheck, CheckStatus>;
  testerNotes: string;
  caveat: string;
};

const checkLabels: Record<ManualCheck, string> = {
  screenReader: 'VoiceOver / TalkBack announces and operates controls',
  focus: 'Keyboard or external-switch navigation is visible and usable',
  rotation: 'Rotate the device; content stays readable without clipping',
  background: 'Leave and return to the tab; material and controls recover',
  zoom: 'At 200% zoom or larger text, controls remain usable',
};
const checkKeys = Object.keys(checkLabels) as ManualCheck[];
const initialChecks: Record<ManualCheck, CheckStatus> = {
  screenReader: 'not-tested',
  focus: 'not-tested',
  rotation: 'not-tested',
  background: 'not-tested',
  zoom: 'not-tested',
};
const materialChoices: { key: MaterialChoice; name: string }[] = [
  { key: 'grain-blob', name: 'Gentle blob' },
  { key: 'grain-wave', name: 'Amber wave' },
  { key: 'paper-texture', name: 'Cotton paper' },
];
const precision = (value: number | null) => value === null ? 'n/a' : value.toFixed(1);
const percentile = (items: number[], portion: number) =>
  items.length ? items[Math.min(items.length - 1, Math.ceil(items.length * portion) - 1)] : null;

function diagnostics(result: SampleResult) {
  return JSON.stringify(result, null, 2);
}

export function DeviceLab() {
  const [material, setMaterial] = useState<MaterialChoice>('grain-blob');
  const [duration, setDuration] = useState<Duration>(10);
  const [phase, setPhase] = useState<Phase>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<SampleResult | null>(null);
  const [manualChecks, setManualChecks] = useState<Record<ManualCheck, CheckStatus>>(initialChecks);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [motionPreference, setMotionPreference] = useState(false);
  const materialRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef<(() => void) | null>(null);

  // Never leave a measurement running once the user navigates away.
  useEffect(() => () => runningRef.current?.(), []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionPreference(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const startSample = () => {
    if (phase === 'sampling') return;
    setMessage('');
    setResult(null);
    setElapsed(0);
    setPhase('sampling');

    const intervals: number[] = [];
    let longTaskCount = 0;
    let longTaskTotal = 0;
    let supported = false;
    let observer: PerformanceObserver | null = null;
    const before = performance.now();
    let previous = 0;
    let lastUpdate = before;
    let rafId = 0;
    let closed = false;
    const selectedMaterial = material;
    const selectedDuration = duration;

    try {
      if (typeof PerformanceObserver !== 'undefined' &&
        PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.startTime >= before && !closed) {
              longTaskCount += 1;
              longTaskTotal += entry.duration;
            }
          }
        });
        observer.observe({ type: 'longtask' });
        supported = true;
      }
    } catch {
      observer?.disconnect();
      observer = null;
    }

    const stop = () => {
      if (closed) return false;
      closed = true;
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', visibilityChanged);
      runningRef.current = null;
      return true;
    };
    const visibilityChanged = () => {
      if (document.hidden && stop()) {
        setPhase('interrupted');
        setMessage('Measurement interrupted by a background tab. Run again while the display stays awake.');
      }
    };
    document.addEventListener('visibilitychange', visibilityChanged);
    runningRef.current = stop;

    const step = (now: number) => {
      if (closed) return;
      if (previous > 0) intervals.push(now - previous);
      previous = now;
      if (now - lastUpdate >= 400) {
        setElapsed(Math.min(selectedDuration, (now - before) / 1000));
        lastUpdate = now;
      }
      if (now - before < selectedDuration * 1000) {
        rafId = requestAnimationFrame(step);
        return;
      }

      if (!stop()) return;
      const sorted = [...intervals].sort((a, b) => a - b);
      const shader = materialRef.current?.querySelector<HTMLElement>('[data-shader-status]');
      const canvases = Array.from(materialRef.current?.querySelectorAll('canvas') ?? []);
      const sample: SampleResult = {
        schema: 'paper-ui.device-lab.v1',
        sampledAt: new Date().toISOString(),
        requestedSeconds: selectedDuration,
        observedSeconds: Number(((now - before) / 1000).toFixed(2)),
        material: selectedMaterial,
        shaderStatus: shader?.dataset.shaderStatus ?? 'unknown',
        pixelBudget: shader?.dataset.shaderPixelBudget ?? null,
        canvasCount: canvases.length,
        canvasBackBuffers: canvases.map((canvas) => ({ width: canvas.width, height: canvas.height })),
        requestAnimationFrame: {
          frameIntervals: intervals.length,
          hzEstimate: intervals.length ? Number((1000 * intervals.length / intervals.reduce((s, n) => s + n, 0)).toFixed(1)) : null,
          p50IntervalMs: percentile(sorted, 0.5),
          p95IntervalMs: percentile(sorted, 0.95),
          intervalsOver33ms: intervals.filter((n) => n > 33.3).length,
          intervalsOver50ms: intervals.filter((n) => n > 50).length,
        },
        longTasks: {
          supported,
          count: longTaskCount,
          durationMs: Math.round(longTaskTotal),
        },
        device: {
          userAgent: navigator.userAgent,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          pixelRatio: window.devicePixelRatio,
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          coarsePointer: window.matchMedia('(pointer: coarse)').matches,
          online: navigator.onLine,
        },
        manualChecks: { ...manualChecks },
        testerNotes: notes,
        caveat: 'RAF cadence is scheduling responsiveness, NOT GPU shader FPS. Long Tasks are main-thread events. An automated sample cannot certify screen-reader access, battery use, sustained GPU throughput, or real rendering accuracy.',
      };
      setElapsed(selectedDuration);
      setResult(sample);
      setPhase('complete');
      setMessage('Sample complete. You can export the locally generated report.');
    };
    rafId = requestAnimationFrame(step);
  };

  const report = () => result ? {
    ...result,
    manualChecks,
    testerNotes: notes,
  } : null;

  const download = () => {
    const data = report();
    if (!data) return;
    const file = new Blob([diagnostics(data)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const element = document.createElement('a');
    element.href = url;
    element.download = 'paper-ui-device-lab-' + new Date().toISOString().replaceAll(':', '-') + '.json';
    document.body.appendChild(element);
    element.click();
    element.remove();
    // Schedule only object URL cleanup; no measurement runs in the background.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copyReport = async () => {
    const data = report();
    if (!data) return;
    try {
      await navigator.clipboard.writeText(diagnostics(data));
      setMessage('Report copied. Your measurements were not uploaded.');
    } catch {
      setMessage('Clipboard unavailable. Use Download JSON instead.');
    }
  };

  return (
    <div className="device-lab">
      <a className="device-lab__skip" href="#device-lab-main">Skip to device test</a>
      <header className="device-lab__header">
        <a href="/" className="device-lab__back">← Paper UI Studio</a>
        <span>WHISPERS / PAPER UI</span>
      </header>
      <main className="device-lab__main" id="device-lab-main">
        <div className="device-lab__intro">
          <div className="device-lab__eyebrow">FIELD NOTES / 01</div>
          <h1>How does paper feel on this device?</h1>
          <p>Measure scheduling responsiveness while a real material is rendered. Use the same page on iPhone Safari or Android Chrome, then record your hands-on accessibility checks.</p>
          <p className="device-lab__privacy">Runs entirely in this browser. No telemetry, automatic uploads, or remote collection. Downloading the report includes browser and screen details you may choose to share.</p>
        </div>
        <div className="device-lab__layout">
          <section className="device-lab__stage" aria-labelledby="lab-material-heading">
            <div className="device-lab__panel-heading">
              <span>01 — LIVE MATERIAL</span>
              <h2 id="lab-material-heading">One surface, one shader</h2>
            </div>
            <div ref={materialRef} className="device-lab__surface">
              <MaterialEffect kind={material} paused={phase !== 'sampling'} className="device-lab__effect">
                <div className="device-lab__composition">
                  <span>paper / graphite</span>
                  <strong>A little, over time.</strong>
                  <span>visual material is not a benchmark score</span>
                </div>
              </MaterialEffect>
            </div>
            <p className="device-lab__caption">The canvas runs only while visible; its output is decorative. If WebGL is unavailable, the page remains readable.</p>
            <div className="device-lab__materials" role="group" aria-label="Material to test">
              {materialChoices.map((choice) => (
                <button key={choice.key} type="button" aria-pressed={material === choice.key}
                  disabled={phase === 'sampling'} onClick={() => { setMaterial(choice.key); setPhase('ready'); setResult(null); }}>
                  {choice.name}
                </button>
              ))}
            </div>
          </section>
          <section className="device-lab__controls" aria-labelledby="lab-capture-heading">
            <div className="device-lab__panel-heading">
              <span>02 — CAPTURE</span>
              <h2 id="lab-capture-heading">Sample the experience</h2>
            </div>
            <p>Keep this tab in the foreground. The sample measures browser animation-frame intervals and, if supported, main-thread Long Tasks.</p>
            <div className="device-lab__durations" role="group" aria-label="Capture duration">
              {([3, 10, 30] as const).map((seconds) => (
                <button key={seconds} type="button" disabled={phase === 'sampling'}
                  aria-pressed={duration === seconds} onClick={() => setDuration(seconds)}>
                  {seconds} s
                </button>
              ))}
            </div>
            <button className="device-lab__primary" type="button" disabled={phase === 'sampling'}
              onClick={startSample}>{phase === 'sampling' ? 'Sampling…' : result ? 'Run another sample' : 'Start local sample'}</button>
            <progress aria-label="Sampling progress" value={elapsed} max={duration} />
            <p className="device-lab__phase" role="status">{phase === 'sampling' ? 'Recording animation-frame intervals…' : message || 'Ready. Nothing is measured until you start.'}</p>
            {result && (
              <div className="device-lab__metrics" aria-label="Device measurement results">
                <div><span>Estimated RAF cadence</span><strong data-testid="lab-hz">{precision(result.requestAnimationFrame.hzEstimate)} Hz</strong></div>
                <div><span>95th percentile frame interval</span><strong data-testid="lab-p95">{precision(result.requestAnimationFrame.p95IntervalMs)} ms</strong></div>
                <div><span>Intervals above 33 ms</span><strong>{result.requestAnimationFrame.intervalsOver33ms}</strong></div>
                <div><span>GPU pixel budget</span><strong>{result.pixelBudget ?? 'n/a'}</strong></div>
                <div><span>Canvas buffers observed</span><strong>{result.canvasCount}</strong></div>
                <div><span>Long Tasks</span><strong>{result.longTasks.supported ? result.longTasks.count : 'unsupported'}</strong></div>
              </div>
            )}
            <p className="device-lab__note">{motionPreference ? 'Reduced motion is enabled: Paper UI suppresses shader animation to respect this preference.' : 'These values represent browser scheduling, not measured GPU FPS.'} Do not compare different hardware using this number alone.</p>
          </section>
        </div>
        <section className="device-lab__field" aria-labelledby="lab-check-heading">
          <div className="device-lab__panel-heading">
            <span>03 — HUMAN OBSERVATIONS</span>
            <h2 id="lab-check-heading">What automation cannot tell us</h2>
          </div>
          <div className="device-lab__checklist">
            {checkKeys.map((key) => (
              <div className="device-lab__check" key={key}>
                <span>{checkLabels[key]}</span>
                <select aria-label={checkLabels[key]} value={manualChecks[key]}
                  onChange={(event) => setManualChecks((old) => ({ ...old, [key]: event.target.value as CheckStatus }))}>
                  <option value="not-tested">Not tested</option>
                  <option value="pass">Pass</option>
                  <option value="issue">Issue</option>
                </select>
              </div>
            ))}
          </div>
          <label className="device-lab__notes-label" htmlFor="lab-notes">Device, screen-reader version or observed issues (optional)</label>
          <textarea id="lab-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)}
            placeholder="What actually happened on this device?" />
          <div className="device-lab__export">
            <button type="button" onClick={download} disabled={!result}>Download JSON report</button>
            <button type="button" onClick={copyReport} disabled={!result}>Copy report</button>
            <span>Data stays local until you decide to export.</span>
          </div>
        </section>
        <footer className="device-lab__footer">Experimental diagnostics · Not an iOS Safari, Android, VoiceOver or TalkBack certification.</footer>
      </main>
    </div>
  );
}
