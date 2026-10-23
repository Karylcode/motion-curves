**English** | [繁體中文](usage.zh-TW.md) · [Documentation index](README.md)

# Usage

The interface is in Traditional Chinese. Below, UI labels are written as 中文 (English).

## Open a motion

- Pick a motion from the menu at the top. You can filter by 武器 (weapon), 類型 (type), 姿勢 (posture), 位移 (displacement), 播放 (playback: loop / once) and 手 (hands), and search by name, English name, id or description. In the open menu, ↑ / ↓ move, Enter opens, Esc closes.
- Add `#<motion id>` to the URL to open that motion directly, for example `#S_Walk`. Without it, the page opens `S_Walk` if it exists, otherwise the first motion. The URL changes when you switch motions.
- The repo and the live site contain no motions. Bring your own: see [Importing motions](importing.md).

## Playback

- Play / pause, previous / next frame (◀︎ ▶︎), a scrub bar, and speed 0.25×, 0.5× or 1×.
- Six views: 正面 (front), 右前 (front right), 右側 (right), 背面 (back), 左側 (left), 正上方 (top). Drag in the 3D view to move the camera (three.js OrbitControls).
- Toggles: Root 移動 (root motion), 武器 (weapon), 武器尖端軌跡 (weapon-tip trail), 骨架線 (skeleton lines), 角色模型 (character mesh), 頭髮物理 (hair physics).

## Chart tabs

| Tab | Contents |
|---|---|
| 關節角度 (Joint angles) | 28 items in 13 charts, with left / right foot-contact bars |
| 肌肉曲線（Unity）(Muscle curves) | 95 Humanoid muscle values. Unity-exported motions only. |
| 身體與 IK（Unity）(Body and IK) | Body center of mass, root motion, hand and foot IK targets. Unity-exported motions only. |
| 數據 (Data) | Downloads, values at the current frame, each joint angle's range, foot contacts, the AI interface help |

- Click or drag on a chart to jump to that frame. A vertical line follows playback. Charts have no zoom or pan.
- Joint-angle charts show the sign convention under the title, for example knee: 0 = straight, larger = more bent. `motionCurves.conventions()` returns the full list.
- Unity curves are drawn the way Unity plays them. See [How Unity plays curves](how-unity-plays.md).

## Downloads (數據 tab)

- `curves.json`, `angles.json`, `analysis.json` for the current motion. See [Data format](data-format.md).
- CSV: one row per frame with joint angles and muscle values.

## Change character

Drag a `.vrm` file into the page (VRM 1.0 or 0.x). It is stored in this browser and loads again next time. 恢復預設角色 (Restore default character) switches back to `AvatarSample_A`.

Unity-exported motions were sampled on `AvatarSample_A`. On another character, the hips position and root motion are scaled by hips height, and the joint angles shown are still the ones measured on `AvatarSample_A` (the info bar says so).

## For AI: `window.motionCurves`

Call these from the browser console or a browser automation tool. `motionCurves.help()` prints the list.

| Call | Returns |
|---|---|
| `motions()` | The motion list |
| `current()` | Current motion, frame, time, whether it is playing |
| `select(id)` | Switches motion (Promise) |
| `setFrame(n)` / `play()` / `pause()` | Controls playback |
| `names()` | All series names: `jointAngles`, `muscles`, `unityCurves` (all 137) |
| `series(name)` | One series' value at every frame (array, index = frame) |
| `value(name, frame?)` | One series at one frame (frame can be fractional; default is the current frame) |
| `table(frame?)` | All joint angles and muscle values at one frame |
| `summary()` | Min / max (and the frame where they occur) and mean of every joint angle and muscle |
| `keys(attr)` | One Unity curve's keyframes: [time, value, inTangent, outTangent, inWeight, outWeight, weightedMode, leftTangentMode, rightTangentMode, broken] |
| `conventions()` | Sign and unit definitions |
| `data()` | The three raw JSON files. `angles` has no `worldPositions` until `verify()` runs; or read `angles.json` directly. |
| `verify()` | Self-check (Promise): bone positions computed by the page vs Unity (mm), and the page's curve evaluation vs Unity samples |
| `pose(frame?)` | Each bone's world position [x, y, z] and rotation quaternion [x, y, z, w] at a frame (can be fractional) |
| `snapshot()` | Screenshot of the 3D view (PNG data URL) |
| `importFiles(files)` | Imports motions (`.vrma`, `.fbx`) or changes character (`.vrm`); `files` is an array of File (Promise) |

Units: angles in degrees; heights and distances in meters (the charts show cm); muscle values from -1 to 1. Coordinates: glTF / three.js right-handed, +Y up, the character faces +Z.
