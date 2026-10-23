**English** | [繁體中文](troubleshooting.zh-TW.md) · [Docs index](README.md)

# Troubleshooting

Error messages on the page are in Chinese; they are quoted below with a translation.

## Importing

| What you see | What to do |
|---|---|
| 「FBX 骨頭名稱對不上（找不到 Hips／Pelvis）」 (FBX bone names don't match; no Hips / Pelvis) | Convert the file to VRMA, or use Mixamo, Unity Humanoid or UE bone names. See [Importing motions](importing.md). |
| 「FBX 裡沒有動畫」 (no animation in the FBX) | The FBX has no animation. Export it again with the animation included. |
| 「檔案裡沒有 VRM 動畫（VRMC_vrm_animation）」 (no VRM animation in the file) | The `.vrma` / `.glb` doesn't contain a VRM animation. |
| 「不支援 .xxx」 (.xxx not supported) | Motions must be `.vrma` or `.fbx`; characters must be `.vrm`. |
| Some bones don't move after an FBX import | Their names didn't match, so they stay in T-pose. Rename them or convert the file to VRMA. |
| A motion loops when it shouldn't (or the reverse) | Click 改成單次 / 改成循環 (Make one-shot / Make loop). |
| 「瀏覽器不給存，重新整理後就會不見」 (browser won't store it; it disappears on reload) | The browser blocks IndexedDB, for example in a private window or with site data turned off. Use a normal window. |
| Imported motions are gone | They live only in this browser's IndexedDB. Clearing browser data or switching computers removes them. On the dev server, use 存成檔案 to keep them as files. |

## Viewing

| What you see | What to do |
|---|---|
| The two Unity tabs are disabled | Motions imported in the browser have no Unity curves. Export from Unity to get them ([Exporting from Unity](unity-export.md)). |
| The info bar says 「關節角度是在 AvatarSample_A 上量的」 (joint angles were measured on AvatarSample_A) | Unity-exported motions were measured on `AvatarSample_A`. On another character, hips and root motion are scaled, and the joint-angle numbers stay those of `AvatarSample_A`. |
| A saved `.vrm` no longer loads | The page falls back to the default character on its own. Drag in another `.vrm` to replace the saved one. |
| `motionCurves.verify()` returns 「網頁匯入的動作沒有 Unity 取樣可以比」 (no Unity samples to compare) | Only Unity-exported motions can be verified. |
| Charts can't be zoomed | There is no chart zoom or pan. Click or drag on a chart to jump to a frame. |

## Running locally

| What you see | What to do |
|---|---|
| `npm run dev` stops right away | Port 5200 is in use (the script uses `--strictPort`). Close the other program, or change the port in `package.json`. Also check Node.js is 20.19+ or 22.12+. |
| No 存成檔案 (Save as file) button | It only appears on the local dev server (`npm run dev`). |
| 存成檔案 fails with 「id 只能用英數字、底線、減號」 | The id can only use letters, digits, `_` and `-`. |
| `npm run preview` shows no character | It serves `site/`, which has no `public/` files. Use `npm run build:pages` then `npm run preview -- --mode pages`. See [Development](development.md). |
| `node tools/build-index.mjs` or `check-export.mjs` fails with ENOENT | `public/motions/` doesn't exist yet (it isn't in git). Export or save a motion first. |

## Unity export

| What you see | What to do |
|---|---|
| `execute_code` times out | It times out after about 30 seconds, but the files still finish writing. Export about 15 motions per batch. |
| 「編譯錯誤（行號是腳本檔的）」 (compile error; line numbers refer to the script file) | Fix the script at the reported lines. Check the Unity project has UniVRM and Newtonsoft.Json. |
| Errors from `GetName()` when the project path has Chinese characters | Use the assembly's `FullName` instead of `GetName()` ([HOWTO.md](../unity/characters/HOWTO.md)). |
