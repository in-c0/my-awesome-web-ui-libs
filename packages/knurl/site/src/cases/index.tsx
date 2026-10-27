import type { ComponentType } from "react";
import type { Finish } from "knurl-ui";
import { Deploy } from "./Deploy";
import { Intake } from "./Intake";
import { Synth } from "./Synth";
import synthSrc from "./Synth.tsx?raw";
import deploySrc from "./Deploy.tsx?raw";
import intakeSrc from "./Intake.tsx?raw";

export type Case = {
  id: string; name: string; summary: string; body: string[];
  uses: string[]; source: string; file: string;
  View: ComponentType<{ finish?: Finish }>;
};

export const CASES: Case[] = [
  {
    id: "synth", name: "Mono synth", file: "Synth.tsx", source: synthSrc, View: Synth,
    summary: "A playable synth voice on Web Audio: oscillator, low-pass filter, envelope and a level meter.",
    body: [
      "The selector picks the oscillator. Three knobs set the filter cutoff on a log scale, its resonance and the envelope decay. The joystick bends pitch by up to a whole tone and adds vibrato; it springs back to centre when you let go, as a pitch stick does.",
      "Each keycap plays a note on release of the press, and the gauge reads the analyser's peak every frame, so its tell-tale hand keeps the loudest note you played.",
    ],
    uses: ["toggle", "selector", "knob", "joystick", "keycap", "gauge", "fader"],
  },
  {
    id: "release", name: "Release console", file: "Deploy.tsx", source: deploySrc, View: Deploy,
    summary: "A deploy train with flags, two-person arming, stage progress, service lamps and a change window.",
    body: [
      "Two rockers decide whether the release runs migrations and goes to a canary first; turning the canary off removes that station from the track. The Deploy key stays locked until the combination lock opens with the second person's code.",
      "While the train runs, the gears turn, the gauge fills once per stage, and the annunciator shows what the services do: the database warns during migrations and the queue alarms for a moment on the canary. The timer counts down the change window.",
    ],
    uses: ["track", "gauge", "gears", "annunciator", "rocker", "combo", "keycap", "timer"],
  },
  {
    id: "intake", name: "Intake desk", file: "Intake.tsx", source: intakeSrc, View: Intake,
    summary: "A document intake form: drop PDFs, pick pages, paper, quality and copies, and watch each file processed.",
    body: [
      "The tray takes PDFs by drag and drop or the file picker. The caliper picks the page range, the preset keys the paper, the selector the quality and the counter the copies.",
      "Files are processed one at a time: the gears turn, the gauge fills, and four check lamps light in turn. Storage use rises in the tank, with its high mark at 90% of the quota.",
    ],
    uses: ["tray", "gears", "gauge", "annunciator", "caliper", "presets", "selector", "counter", "tank"],
  },
];
