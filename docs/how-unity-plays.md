**English** | [繁體中文](how-unity-plays.zh-TW.md) · [Documentation index](README.md)

# How Unity plays curves

When an FBX is imported with animation compression set to Optimal, Unity decides **for each curve separately** how to play it:

- Curves with enough keyframes (7 × keyframe count ≥ frame count, where frame count = length × fps, not counting the last frame; exactly equal also counts) are stored as "one value per frame, straight lines between frames" (`playback: "dense"`). They do not follow the smooth curve shown in the Animation window.
- All other curves follow the keyframes and tangents (`playback: "curve"`), the same as the Animation window.

This rule was found by reading the muscle values Unity produces during playback directly with AnimationHumanStream and comparing them. On export, three ways of restoring the motion (all curve, all dense, each curve by the rule) are each compared with the original file, and the most accurate one is used. The result is recorded in `playbackMode` and `playbackCheck` in `curves.json`. Animations without Optimal compression are played entirely from keyframes by Unity.

## How the web page evaluates them

- `dense` curves: the stored per-frame values, with straight lines between frames.
- `curve` curves: Unity's Hermite formula for non-weighted keyframes (`evaluateCurve` in `src/curves.js`). When a tangent is infinite, the value holds at the previous key until the next one.
- Key weights (`inWeight`, `outWeight`, `weightedMode`) are stored in `curves.json`, and `rebuild_clip.cs.txt` passes them back to Unity, but the web page does not use them.

## Verification

Checked with one motion pack from the Unity Asset Store (440 motions):

- **Rebuilt in Unity**: rebuilt from `curves.json` only and compared with the original (Foot IK and root motion on, played 4 times in a row, checked every 1/120 second): largest bone-position difference 0.010 mm, angle difference 0°.
- **Web playback**: every sample compared; largest bone-position difference 0.0046 mm.
- **Web import**: Unity-exported motions converted to VRMA and dragged into the page; the joint angles measured by the page differ from Unity's by at most 0.015°.

These are the author's measurements. You can repeat the checks with the steps in [Exporting from Unity](unity-export.md#steps) and `motionCurves.verify()` ([Usage](usage.md)).
