**English** | [繁體中文](data-format.zh-TW.md) · [Docs index](README.md)

# Data format

Each motion is three JSON files in `public/motions/<id>/`. The list of motions is `public/motions/index.json`, written by `tools/build-index.mjs`. `public/motions/` is not in git.

| File | Contents |
|---|---|
| `curves.json` | Unity's native curves: 137 curves (muscles 95, body center of mass 7, root motion 7, IK targets 28). Each curve stores keyframes + tangents + tangent modes, the value at every frame, and how Unity actually plays it (`playback`). Plus the clip settings. Motions imported in the browser only have basic info and no curves. |
| `angles.json` | The result on the VRM character. Each frame is split into several samples; each sample has every human bone's rotation relative to T-pose (VRM normalized), the hips position, and root motion (position + turning). Unity-exported motions also have each bone's world position, how the weapons are attached, and the weapon-tip trails. |
| `analysis.json` | 28 joint angles, foot-contact periods, sign conventions. Unity-exported motions also have the 95 muscle values for every frame. |

## Coordinates and units

glTF / three.js right-handed coordinates, +Y up, the character faces +Z, meters. Angles are in degrees. Muscle values range from -1 to 1.

## Details

- Keyframe fields (`keyFields` in `curves.json`): time, value, inTangent, outTangent, inWeight, outWeight, weightedMode, leftTangentMode, rightTangentMode, broken. Infinite tangents are stored as the strings `"Infinity"` and `"-Infinity"`.
- How Unity plays each curve, and the whole-motion check results (`playbackMode`, `playbackCheck`): see [How Unity plays curves](how-unity-plays.md).
- Samples per frame (`samplesPerFrame` in `angles.json`): 16 by default for Unity exports (`K` in `export_motion.cs.txt`), 4 for browser imports.
- Foot contact: the heel or toe is within 1.5 cm of its T-pose standing height for 2 or more frames in a row. Each period is `[start frame, end frame]`. For looping motions, the last frame equals the first.
- `build-index.mjs` also writes `.json.gz` copies and `play.json.gz` (`angles.json` without `worldPositions`). The page downloads these when they exist; the GitHub Pages build doesn't look for them.

## names.json (optional)

`public/motions/names.json` holds each motion's name, English Animator state name, type, description and tags. `build-index.mjs` writes them into `curves.json` and the list, so renaming doesn't need a new Unity export. Naming rules: [NAMING.md](../unity/characters/NAMING.md) (Chinese). To generate names with AI help, see [Development](development.md#naming-tools-optional).
