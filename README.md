# BMW M4 (G82) — scroll teardown

**[Open it and scroll →](https://baxr1lloev.github.io/m4-s58-teardown/)**

![BMW M4 scroll teardown](docs/m4.gif)

A black M4 Competition in a dark studio. Scroll: the body dissolves into x-ray, the S58 inside runs from its real dimensions, then lifts out of the bay and comes apart.

- **The engine is built from numbers, not drawn.** Bore 84 mm, stroke 90 mm, rod 144.4 mm, bore spacing 91 mm. Every piston follows the exact slider-crank from one crank angle; the cams turn at half speed and lift the valves; cylinders fire in the real order 1‑5‑3‑6‑2‑4, and the panel shows which one just fired.
- **The scroll is the timeline.** One pure `render(t)` poses the camera, the dissolve and the explode, so the page and the recorded film are the same frames.
- **One HTML page**, three.js bundled in (~1 MB), the model next to it (2.8 MB, meshopt + webp from 20 MB).

Built with three.js and the [teardown](https://github.com/elvarofficial/teardown) Claude Code skill.

## Run it

```
npm install
npm run model   # model/source/scene.gltf → site/m4.glb (the source glTF is not in the repo)
npm run pages   # → docs/index.html + docs/m4.glb (what GitHub Pages serves)
npm run film    # → teardown-out/film.mp4, the scroll recorded frame by frame
```

The build uses the teardown skill's bundler from `~/.claude/skills/teardown`.

## Credits

The car is ["2021 BMW M4 Competition"](https://sketchfab.com/3d-models/2021-bmw-m4-competition-d3f07b471d9f4a2c9a2acf79d88a3645) by [Ricy](https://sketchfab.com/ngon_3d), licensed under [CC BY-NC 4.0](http://creativecommons.org/licenses/by-nc/4.0/). The engine is a reconstruction from published S58 dimensions. Code: MIT. Non-commercial fan project, not affiliated with or endorsed by BMW AG.
