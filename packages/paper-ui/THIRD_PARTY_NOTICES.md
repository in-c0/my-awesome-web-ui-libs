# Third-party software and attribution

This project contains original React UI components and directly depends on two independent open-source packages. It is **not** an official Tegaki or Paper Design project.

## Tegaki
- Author: Gokhan Kurt — https://github.com/gkurt/tegaki
- Package: `tegaki` (MIT license)
- Used for stroke-based handwriting animation in `PencilText`.
- Tegaki is installed as a dependency; its source code is not copied into this repository.
- MIT copyright notice: Copyright (c) 2026 Gokhan Kurt.
- License: https://github.com/gkurt/tegaki/blob/main/LICENSE

## Paper Shaders
- Copyright Lost Coast Labs, Inc. — https://github.com/paper-design/shaders
- Package: `@paper-design/shaders-react` (Apache-2.0 license)
- Used for PaperTexture, GrainGradient, Dithering, and HalftoneDots effects.
- The shader implementation is not copied into this repository.
- License: https://github.com/paper-design/shaders/blob/main/LICENSE
- Notice: https://github.com/paper-design/shaders/blob/main/NOTICE

## Fonts and assets
- The demo loads the Nanum Pen Script font bundle distributed with Tegaki. Review that bundle's font-specific license before redistribution.
- The demo's graphite branch SVG is an original example asset.
- No third-party artwork or proprietary storyboard references are distributed.

Do not remove license or NOTICE files from dependencies when redistributing their source or builds.
