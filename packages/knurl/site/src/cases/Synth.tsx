import { useEffect, useRef, useState } from "react";
import { Fader, Gauge, Joystick, Keycap, Knob, Selector, Toggle } from "knurl-ui/react";
import type { Finish } from "knurl-ui";

/**
 * A monophonic synth voice on Web Audio: the selector picks the oscillator,
 * the knobs shape a low-pass filter and the envelope, the joystick bends
 * pitch and adds vibrato, and the gauge reads the output level.
 */

const WAVES = { SAW: "sawtooth", SQR: "square", TRI: "triangle", SIN: "sine" } as const;
type Wave = keyof typeof WAVES;
const KEYS = [
  { legend: "A", note: "C4", hz: 261.63 }, { legend: "S", note: "D4", hz: 293.66 }, { legend: "D", note: "E4", hz: 329.63 },
  { legend: "F", note: "F4", hz: 349.23 }, { legend: "G", note: "G4", hz: 392.0 }, { legend: "H", note: "A4", hz: 440.0 },
  { legend: "J", note: "B4", hz: 493.88 }, { legend: "K", note: "C5", hz: 523.25 },
];

export function Synth({ finish = "line" }: { finish?: Finish }) {
  const [power, setPower] = useState(true);
  const [wave, setWave] = useState<Wave>("SAW");
  const [cutoff, setCutoff] = useState(62);     // 0–100 → 80 Hz … 12 kHz, log
  const [resonance, setResonance] = useState(30);
  const [decay, setDecay] = useState(45);       // 0–100 → 0.05 … 2.5 s
  const [volume, setVolume] = useState(70);
  const [bend, setBend] = useState({ x: 0, y: 0 });
  const [level, setLevel] = useState(0);
  const audio = useRef<{ ctx: AudioContext; filter: BiquadFilterNode; amp: GainNode; out: GainNode; meter: AnalyserNode; osc?: OscillatorNode; lfo: OscillatorNode; lfoGain: GainNode } | null>(null);

  const hz = (v: number) => 80 * Math.pow(150, v / 100);
  const seconds = (v: number) => 0.05 + (v / 100) * 2.45;

  function ensure() {
    if (audio.current) return audio.current;
    const ctx = new AudioContext();
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass";
    const amp = ctx.createGain(); amp.gain.value = 0;
    const out = ctx.createGain();
    const meter = ctx.createAnalyser(); meter.fftSize = 512;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0;
    lfo.connect(lfoGain); lfo.start();
    filter.connect(amp).connect(out).connect(meter).connect(ctx.destination);
    audio.current = { ctx, filter, amp, out, meter, lfo, lfoGain };
    return audio.current;
  }

  // parameters follow the controls
  useEffect(() => {
    const a = audio.current; if (!a) return;
    const t = a.ctx.currentTime;
    a.filter.frequency.setTargetAtTime(hz(cutoff), t, 0.02);
    a.filter.Q.setTargetAtTime(0.5 + (resonance / 100) * 18, t, 0.02);
    a.out.gain.setTargetAtTime(power ? (volume / 100) ** 2 * 0.6 : 0, t, 0.03);
    a.lfoGain.gain.setTargetAtTime(Math.max(0, bend.y) * 18, t, 0.05);
    if (a.osc) {
      a.osc.type = WAVES[wave];
      a.osc.detune.setTargetAtTime(bend.x * 200, t, 0.02);
    }
  }, [cutoff, resonance, volume, power, wave, bend]);

  function play(f: number) {
    if (!power) return;
    const a = ensure();
    void a.ctx.resume();
    const t = a.ctx.currentTime;
    a.osc?.stop(t + 0.01);
    const osc = a.ctx.createOscillator();
    osc.type = WAVES[wave]; osc.frequency.value = f; osc.detune.value = bend.x * 200;
    a.lfoGain.connect(osc.frequency);
    osc.connect(a.filter); osc.start(t);
    a.osc = osc;
    a.filter.frequency.setValueAtTime(hz(cutoff), t);
    a.filter.Q.setValueAtTime(0.5 + (resonance / 100) * 18, t);
    a.out.gain.setValueAtTime((volume / 100) ** 2 * 0.6, t);
    a.amp.gain.cancelScheduledValues(t);
    a.amp.gain.setValueAtTime(0, t);
    a.amp.gain.linearRampToValueAtTime(1, t + 0.008);
    a.amp.gain.setTargetAtTime(0, t + 0.01, seconds(decay) / 4);
    osc.stop(t + seconds(decay) + 0.4);
  }

  // the level meter reads the analyser while sound is playing
  useEffect(() => {
    let raf = 0;
    const buf = new Float32Array(512);
    const read = () => {
      const a = audio.current;
      if (a) {
        a.meter.getFloatTimeDomainData(buf);
        let peak = 0; for (const s of buf) peak = Math.max(peak, Math.abs(s));
        setLevel(Math.round(Math.min(100, peak * 160)));
      }
      raf = requestAnimationFrame(read);
    };
    raf = requestAnimationFrame(read);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => () => { void audio.current?.ctx.close(); }, []);

  // the computer keyboard plays the keys too
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || (e.target as HTMLElement).closest("input, textarea, button")) return;
      const k = KEYS.find((k) => k.legend.toLowerCase() === e.key.toLowerCase());
      if (k) play(k.hz);
    };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  });

  return (
    <div className="rack">
      <div className="rack-row">
        <figure><Toggle finish={finish} label="Power" checked={power} onCheckedChange={setPower} style={{ width: 104 }} /><figcaption>Power</figcaption></figure>
        <figure><Selector finish={finish} label="Waveform" options={Object.keys(WAVES)} value={wave} onValueChange={(v) => setWave(v as Wave)} style={{ width: 150 }} /><figcaption>Wave</figcaption></figure>
        <figure><Knob finish={finish} label="Cutoff" value={cutoff} onValueChange={setCutoff} format={(v) => `${Math.round(hz(v))} Hz`} style={{ width: 118 }} /><figcaption>Cutoff <output>{hz(cutoff) >= 1000 ? (hz(cutoff) / 1000).toFixed(1) + "k" : Math.round(hz(cutoff))}</output></figcaption></figure>
        <figure><Knob finish={finish} label="Resonance" value={resonance} onValueChange={setResonance} style={{ width: 118 }} /><figcaption>Reso <output>{resonance}</output></figcaption></figure>
        <figure><Knob finish={finish} label="Decay" value={decay} onValueChange={setDecay} format={(v) => `${seconds(v).toFixed(2)} s`} style={{ width: 118 }} /><figcaption>Decay <output>{seconds(decay).toFixed(2)}s</output></figcaption></figure>
      </div>
      <div className="rack-row">
        <figure><Joystick finish={finish} label="Bend and vibrato" value={bend} onValueChange={setBend} style={{ width: 150 }} /><figcaption>Bend · Vibrato</figcaption></figure>
        <figure><div className="keys" role="group" aria-label="Keyboard, C4 to C5">
          {KEYS.map((k) => <Keycap key={k.note} finish={finish} legend={k.legend} label={k.note} onPress={() => play(k.hz)} style={{ width: 66 }} />)}
        </div><figcaption>C4 – C5</figcaption></figure>
      </div>
      <div className="rack-row">
        <figure><Gauge finish={finish} role="meter" label="Output level" value={level} peak style={{ width: 140 }} /><figcaption>Level</figcaption></figure>
        <figure><Fader finish={finish} label="Volume" value={volume} onValueChange={setVolume} style={{ width: 280 }} /><figcaption>Volume <output>{volume}</output></figcaption></figure>
      </div>
      <p className="rack-note">Press the keys, or type A S D F G H J K. Push the stick right or left to bend a whole tone; push it away for vibrato.</p>
    </div>
  );
}
