# 角色設定檔怎麼做

要從 Unity 匯出的動作，一個角色（或一包動作）寫一個設定檔 `unity/characters/<名稱>.json`。匯出程式（`unity/export_motion.cs.txt`）讀它決定：要匯出哪些動作、每支的類別、用哪個 prefab 取樣（VRM 角色，可以掛好武器）、網頁用哪些武器模型。`_` 開頭的檔不會被讀（`_example.json` 是範本）。

## Unity 專案要有

- UniVRM（匯入 VRM；`setup_weapons` 匯出 glb 用到 UniGLTF）。
- Newtonsoft.Json（`com.unity.nuget.newtonsoft-json`）。
- VRM 角色放在 `Assets/Characters/AvatarSample_A/AvatarSample_A.vrm`（換別的角色就改 `export_motion.cs.txt` 的 `defaultCharacter`）。
- 腳本用 MCP for Unity 的 `execute_code`（compiler 選 codedom）跑：把 `unity/run_export.cs.txt` 整段丟進去，它會在 Unity 裡讀檔、編譯、執行指定的腳本。專案路徑有中文時，Assembly 不要呼叫 `GetName()`（會出錯），用 `FullName`。

## 設定檔格式

```json
{
  "character": "My_Character",
  "weapon": "單手劍",
  "prefab": "Assets/Characters/AvatarSample_A/AvatarSample_A_Sword.prefab",
  "sourcePrefab": "Assets/SomePack/My_Character/Prefab/My_Character.prefab",
  "weapons": [
    { "object": "Weapon_Sword", "socket": "Hand_R_Socket", "model": "models/sword.glb", "tip": [0, 0, 1.0], "base": [0, 0, -0.22] }
  ],
  "animators": ["My_Character_Controller"],
  "motions": [
    { "id": "MC_Walk", "file": "Assets/SomePack/My_Character/Animations/Walk.fbx", "category": "走路" }
  ],
  "notes": "給之後的人看的說明"
}
```

- `character`、`weapon`：網頁清單照武器分組，同武器裡照角色分。不拿武器就寫「通用」。
- `prefab`：取樣用的角色 prefab（VRM 角色，武器掛在對應的人骨底下）。沒有武器可以省略，會用 `defaultCharacter`。prefab 還沒做好時也會先用 `defaultCharacter` 匯出（不帶武器）。
- `motions`：要匯出的 Humanoid 動作 FBX。`id` 是網頁和檔案用的名稱，所有設定檔之間不能重複（不同角色包檔名一樣時加前綴）。
- `category` 只能用這些（照檔名判斷，前面的規則優先）：`射擊`（Shoot）、`換彈`（Reload）、`轉身`（Turn）、`瞄準`（Aim 開頭）、`蹲姿`（Crouch 開頭、不是瞄準的）、`拔收武器`（Take、Put）、`倒下`（Die）、`受擊`（Hit）、`暈眩`（Stun）、`閃避`（Evade）、`快速移位`（QuickShift）、`攻擊`（Attack）、`技能`（Skill）、`衝刺`（Sprint）、`跑步`（Run、Jog）、`走路`（Walk）、`待機`（Idle）、`表情`。網頁顯示的類型和名稱另外照 `NAMING.md` 寫在 `public/motions/names.json`。
- `animators`（可省略）：原版 Animator 匯出的 `unity/animators/<名稱>.json`，命名時給 AI 看原版狀態名和混合樹位置。
- 武器（可省略）：
  - `sourcePrefab`：原版角色 prefab（拿著武器的那個），`setup_weapons` 用它算握法。
  - `weapons[].object`：原版 prefab 裡武器的網格物件名稱（要有 MeshFilter）。左右手同名時寫「父物件名/物件名」，做出來的 prefab 裡會把 `/` 換成 `__`。只放拿在身上的武器（刀＋刀鞘、劍＋盾、槍身＋彈匣），衣服、飾品不要。
  - `weapons[].socket`（可省略）：原版武器用 ParentConstraint 掛在插槽上、動畫事件切換插槽時，填戰鬥時拿著它的那個插槽（例如 `Hand_R_Socket`）。這版武器固定在這個插槽，不會照原版切換。
  - `weapons[].model`：網頁用的 glb（`setup_weapons` 匯出到 `public/models/`）。
  - `weapons[].tip`／`base`：武器網格自己座標裡的兩個點（公尺），網頁畫軌跡用：刀劍＝劍尖／柄尾，槍＝槍口／槍托尾端。

## 做拿武器的 prefab 和 glb

用 `unity/setup_weapons.cs.txt`：它讓原版角色和 VRM 角色用同一個動作擺同一個姿勢，算出武器相對手的握法（取 8 支動作平均），報告每把武器掛在哪根人骨、各姿勢差多少、模型大小、貼圖；`save = true` 時存 prefab（VRM 的 Variant）和 glb。

用 `run_export.cs.txt` 跑：`script` 改成 `setup_weapons.cs.txt`、`pick` 填 `""`，`replace` 換掉 `config` 和 `save` 兩行：

```csharp
string[][] replace = { new[]{ "string config = ", "string config = System.IO.Path.Combine(repoRoot, \"unity\", \"characters\", \"My_Character.json\");" }, new[]{ "bool save = ", "bool save = false;" } };
```

步驟：先寫設定檔 → `save = false` 跑一次看報告（握法「姿勢之間最多差」一般在 10° 以內）→ 沒問題再 `save = true` 存檔。UniGLTF 匯出 glb 時會把原版貼圖的壓縮改掉，`setup_weapons` 會自動改回來。

## 匯出和驗證

1. `run_export.cs.txt` 的 `script` 指向 `export_motion.cs.txt`，`pick` 填這次要匯出的 id（一批約 15 支，太多 `execute_code` 會逾時，檔案照樣寫完）。
2. `node tools/build-index.mjs` 更新清單、產生 .gz。
3. `node tools/check-export.mjs [id 開頭]` 看匯出結果；`run_export` 改跑 `rebuild_clip.cs.txt` 只用 `curves.json` 在 Unity 重建、跟原檔比；網頁上 `motionCurves.verify()`。
