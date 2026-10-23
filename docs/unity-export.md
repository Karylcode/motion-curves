**English** | [繁體中文](unity-export.zh-TW.md) · [Documentation index](README.md)

# Exporting from Unity

Export from Unity when you want Unity's native curves. They can be taken back into Unity to rebuild exactly the same motion. Motions imported in the browser don't have them ([Importing motions](importing.md)).

## Requirements

- A Unity project with UniVRM and Newtonsoft.Json (`com.unity.nuget.newtonsoft-json`). `setup_weapons` also uses UniGLTF (from UniVRM) to write glb files.
- [MCP for Unity](https://github.com/CoplayDev/unity-mcp). The scripts run in the Editor through its `execute_code` tool, with compiler `codedom`.
- The VRM character at `Assets/Characters/AvatarSample_A/AvatarSample_A.vrm`. For another character, change `defaultCharacter` in `export_motion.cs.txt`.

## The scripts

| File | What it does |
|---|---|
| `unity/run_export.cs.txt` | The part you send to `execute_code`. It reads one of the scripts below from disk, fills in the repo folder (`MOTION_CURVES_ROOT`), `pick` and any lines you list in `replace`, then compiles and runs it. |
| `unity/export_motion.cs.txt` | Exports `curves.json`, `angles.json` and `analysis.json` to `public/motions/<id>/`. |
| `unity/rebuild_clip.cs.txt` | Rebuilds the clip from `curves.json` only and compares it with the original. Can also save the rebuilt clip as `.anim`. |
| `unity/setup_weapons.cs.txt` | Works out how `AvatarSample_A` holds a character's original weapons, then makes the prefab and the glb used by the web page. |

## Steps

1. Write a config file in `unity/characters/` that lists the motion FBX files to export. Copy `_example.json`; the format is in [HOWTO.md](../unity/characters/HOWTO.md). Files starting with `_` are not read.
2. In [`unity/run_export.cs.txt`](../unity/run_export.cs.txt), set `script` to the path of your `export_motion.cs.txt` and `pick` to the ids to export. Send the whole file to `execute_code` (compiler `codedom`). Do about 15 motions per batch: `execute_code` times out after about 30 seconds (files still finish writing, you just don't see the report).
3. Run `node tools/build-index.mjs` to update the motion list and make the `.gz` files the page downloads.
4. Verify:
   - `node tools/check-export.mjs [id prefix…]`: per source character, the number of motions, playback modes, the largest difference from the original (mm), the weapon count and the last write time.
   - Point `run_export` at `rebuild_clip.cs.txt`: it rebuilds each motion in Unity from `curves.json` alone and compares it with the original file.
   - In the web page, run `motionCurves.verify()`.

Results from these checks: [How Unity plays curves](how-unity-plays.md).

## Weapons

For the character to hold the original weapons, use `unity/setup_weapons.cs.txt`. It works out the grip, makes the prefab and the glb for the web page. Run it through `run_export` with `pick` set to `""`, and use `replace` to change its `config` and `save` lines. Run once with `save = false` to read the report, then with `save = true` to save. Details in [HOWTO.md](../unity/characters/HOWTO.md).

## What stays out of git

`.gitignore` excludes `public/motions/`, everything in `public/models/` except `AvatarSample_A.vrm`, character configs in `unity/characters/` except `_example.json`, and `unity/animators/`. These come from asset packs and may not be publishable.

After exporting, you can name the motions with the naming tools: see [Development](development.md#naming-tools-optional).
