# Changelog

## 0.2.6

- Readouts add no click animation of their own: the press-and-sink from 0.2.5, the Gauge's needle jog, the Tank's knock slosh and the read-only Track's handcar shove are gone. On the site, a click on a Gauge, Tank or Track plays its demo's next step, so it moves the way it normally does, to another value.
- Gears: a tap is a gentle push (about twice its running speed for a moment), not a hard spin.
- Caliper is back to its 0.2.3 behaviour.

## 0.2.5

- The readouts answer a finger as clearly as the inputs do: Gauge, Gears, Tank and Track sink into the page while pressed (their contact shadows stay on the bench), every outline brightens, and they bounce back up on release. A hovering mouse lifts them a hair.
- Their own reactions are bigger: the Gauge's needle jumps about 40° and wobbles back, the Gears spin up hard and coast, the Tank's level jolts and sloshes, and a read-only Track's handcar is shoved well along the line before it rolls back.
- A shared `knock()` in core gives any readout this press.

## 0.2.4

The ten newer controls now have the same feel as the first eight: they lean toward what a click will do under a hovering mouse, give way the instant they are pressed, travel with a little overshoot, and something else answers.

- **Rocker**: hover tips the paddle toward its next throw; a press pushes it two-thirds of the way; release throws it 15° (was 12°) and it rebounds off the stop. Space shows the press too.
- **Selector**: detents snap with overshoot (k260 c13, was k420 c25); hover turns the knob toward the next position and brightens its tick; a press sinks the knob and pre-turns it.
- **Timer**: winding ratchets onto each minute with a small overshoot and flicks the bell striker; a press sinks the dial; outside jumps glide.
- **Caliper**: jaws land on their detents with overshoot (k340 c16, was k260 c30); a hovered head lifts, a grabbed one dips and turns its roller and locking screw.
- **Combo**: a hovered wheel turns a little, a press rolls it partway and release snaps it on; every detent knocks the shackle; the shackle pops open and swings past open before it settles.
- **Joystick**: the stick leans toward a hovering mouse, the ball sinks on a press, and the return to centre wobbles.
- **Tray**: a press sinks the tray on its feet and the top sheets hop; hover lifts the top sheet or shows where a sheet would land.
- **Annunciator**: lamps warm up and cool down like filaments; the lamp test cascades in reading order; a pressed lamp dips; alert blinks ease.
- **Track**: the handcar overshoots its station and its pump beam swings and settles; hovered and pressed stations answer; a step is chosen on release.
- **Tank**: the level sloshes and settles; a knock tilts the surface and ripples the meniscus; hover catches light on the sight glass.
- Reduced motion lands every one of these in one step. 46 new tests.

## 0.2.3

- No dead spots left: a click anywhere on a control does something. The Knob rocks in its play when its cap's centre is clicked, a Combo rattles its shackle when the lock body is tugged, the Tray dips on its feet as it opens the picker, a press on the Presets housing presses the key in that column, and a click anywhere on the Selector's plate turns it toward that side.

## 0.2.2

- The readouts answer a tap: the Gauge's needle jogs and settles back, the Tank's level sloshes away from the knock, a read-only Track's handcar rocks and rolls back to its station, and the Gears spin up and coast. None of them takes focus or changes its value.
- Site: every preview plays itself while nobody is using it, and stops the moment a pointer, focus or key reaches it (again 3 s after it leaves). Nothing plays offscreen, in a background tab or under reduced motion.

## 0.2.1

- Every input answers a plain click, not only a drag: a click on the Knob's scale turns it to that mark, a click on the Selector's knob turns it one detent, a click on the Counter's housing counts one, a click on a Combo wheel rolls it on by one, a press on the Annunciator's lamps runs the lamp test, and a Rocker click always throws the switch (the half already down toggles it).
- The frame loop survives an environment that disappears under a pending frame.

## 0.2.0

- Published as `@in-c0/knurl` (0.1.0 was never published as `knurl-ui`), from the `in-c0/my-awesome-web-ui-libs` workspace.
- Ten new controls: Rocker (checkbox), Caliper (range slider), Joystick (2D input), Combo (one-time code), Tray (file drop zone), Selector (select), Timer (countdown), Tank (level meter), Track (step progress) and Annunciator (status panel).
- Three examples on the site: Mono synth, Release console and Intake desk.
- Core: tilted convex solids (`poly3`, `cuboid`, `prism3`, `rot`); each control declares its option keys, so the React wrapper needs no per-control code.
- Gauge and Gears put back the host's own role and ARIA attributes on destroy.

## 0.1.0

- First release: Toggle, Fader, Knob, Keycap, Presets, Counter, Gauge and Gears, for React (`@in-c0/knurl/react`) and any DOM (`@in-c0/knurl`).
- Line and solid finishes from one geometry; light and dark themes; `--knurl-*` tokens.
- shadcn registry items for every control, served from the docs site at `/r`.
