[English](unity-export.md) | **繁體中文** · [文件目錄](README.zh-TW.md)

# 從 Unity 匯出

要 Unity 原生曲線（可以拿回 Unity 還原出一模一樣的動作）就從 Unity 匯出。網頁匯入的動作沒有這些曲線（見[匯入動作](importing.zh-TW.md)）。

## 需要什麼

- Unity 專案要有 UniVRM、Newtonsoft.Json（`com.unity.nuget.newtonsoft-json`）。`setup_weapons` 匯出 glb 還會用到 UniGLTF（UniVRM 裡有）。
- [MCP for Unity](https://github.com/CoplayDev/unity-mcp)：腳本透過它的 `execute_code` 在編輯器裡跑，compiler 選 `codedom`。
- VRM 角色放在 `Assets/Characters/AvatarSample_A/AvatarSample_A.vrm`。換別的角色就改 `export_motion.cs.txt` 的 `defaultCharacter`。

## 腳本

| 檔案 | 做什麼 |
|---|---|
| `unity/run_export.cs.txt` | 丟給 `execute_code` 的就是這個。它從硬碟讀下面其中一個腳本，填入倉庫資料夾（`MOTION_CURVES_ROOT`）、`pick` 和 `replace` 列出的設定行，再編譯、執行。 |
| `unity/export_motion.cs.txt` | 匯出 `curves.json`、`angles.json`、`analysis.json` 到 `public/motions/<id>/`。 |
| `unity/rebuild_clip.cs.txt` | 只用 `curves.json` 在 Unity 重建動作片段，跟原檔比。也可以把重建的片段存成 `.anim`。 |
| `unity/setup_weapons.cs.txt` | 算 `AvatarSample_A` 怎麼拿某個角色的原版武器，做 prefab 和網頁用的 glb。 |

## 步驟

1. 在 `unity/characters/` 寫一個設定檔，列出要匯出的動作 FBX。照 `_example.json` 寫，格式見 [HOWTO.md](../unity/characters/HOWTO.md)。`_` 開頭的檔不會被讀。
2. 把 [`unity/run_export.cs.txt`](../unity/run_export.cs.txt) 的 `script` 改成你的 `export_motion.cs.txt` 路徑、`pick` 填要匯出的 id，整段丟給 `execute_code`（compiler 選 codedom）。一批約 15 支：`execute_code` 跑超過約 30 秒會逾時（檔案照樣寫完，只是看不到回報）。
3. `node tools/build-index.mjs` 更新動作清單，並產生網頁下載用的 `.gz`。
4. 驗證：
   - `node tools/check-export.mjs [id 開頭…]`：每個來源角色匯出了幾支、播放方式、跟原檔最多差幾 mm、武器幾把、最後寫入時間。
   - `run_export` 改跑 `rebuild_clip.cs.txt`：只用 `curves.json` 在 Unity 重建每支動作，跟原檔比。
   - 網頁上跑 `motionCurves.verify()`。

驗證結果見 [Unity 實際怎麼播](how-unity-plays.zh-TW.md)。

## 武器

要角色拿著原版的武器，用 `unity/setup_weapons.cs.txt` 算握法、做 prefab 和網頁用的 glb。用 `run_export` 跑：`pick` 填 `""`，用 `replace` 換掉 `config` 和 `save` 兩行。先用 `save = false` 跑一次看報告，沒問題再用 `save = true` 存檔。詳細見 [HOWTO.md](../unity/characters/HOWTO.md)。

## 不進 git 的東西

`.gitignore` 排除了 `public/motions/`、`public/models/` 裡 `AvatarSample_A.vrm` 以外的檔、`unity/characters/` 裡 `_example.json` 以外的設定檔，還有 `unity/animators/`。這些來自素材包，可能不能公開。

匯出後可以用命名工具幫動作取名，見[開發](development.zh-TW.md#命名工具選用)。
