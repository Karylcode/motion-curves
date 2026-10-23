**English** | [繁體中文](importing.zh-TW.md) · [Docs index](README.md)

# Importing motions

No Unity needed. Drag files onto the page, or click 匯入動作／角色 (Import motion / character) at the top. You can drop several files at once.

| File | Notes |
|---|---|
| `.vrma` | VRM Animation. The skeleton already matches VRM, so this is the most accurate. A `.glb` / `.gltf` that contains a VRM animation (`VRMC_vrm_animation`) also works. |
| `.fbx` | Matched by bone names: Mixamo, Unity Humanoid, Unreal (`pelvis`, `thigh_l`…), VRoid (`J_Bip_…`), 3ds Max Biped. The rest pose doesn't have to be a T-pose; each bone is corrected by its direction. A file with several animations becomes several motions. |
| `.vrm` | Changes the character. |

## Where imported motions are stored

- Only in this browser (IndexedDB). Nothing is uploaded anywhere. If you switch computers or clear browser data, they are gone.
- If the browser won't allow storage (for example a private window, or site data turned off), the motion still plays, but it disappears when you reload.
- 刪除 (Delete) removes an imported motion from this browser.

## Saving as files (local dev server only)

When the page runs on `npm run dev`, each imported motion has a 存成檔案 (Save as file) button. It asks for an id (letters, digits, `_`, `-`), writes the motion to `public/motions/<id>/` and runs `tools/build-index.mjs`. After that the motion sits with the Unity-exported ones and is removed from browser storage.

## Limits

- Imported motions have no Unity curves, so the two Unity tabs are disabled. Joint angles and foot contacts still work: the page measures them on the current character.
- If the first and last poses are the same (every bone within 5°, hips height within 2 cm), the motion is treated as a loop. If the guess is wrong, click 改成單次 / 改成循環 (Make one-shot / Make loop).
- Imported motions are sampled at 30 fps, 4 samples per frame.
- Root motion: the hips' horizontal movement is split by a 0.4-second moving average into root motion and in-place sway. Turning stays in the hips rotation; root turning is always 0.
- FBX bones whose names don't match stay in T-pose. If no hips bone (`Hips` / `Pelvis`) is found, the import fails. Convert the file to VRMA, or rename the bones to Mixamo, Unity Humanoid or UE names.

## For developers

The import code is `src/importer.js`:

- `importFile(file, vrm)`: entry point; picks the loader by file extension.
- `clipsFromVRMA(buffer, vrm)` and `clipsFromFBX(buffer, vrm)`: return one clip per animation in the file.
- `vrmBoneOf(name)`: maps an FBX bone name to a VRM bone name.
- `sampleClip(vrm, clip, …)`: samples a clip on the VRM into the `angles.json` format ([Data format](data-format.md)).
