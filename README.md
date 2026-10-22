# motion-curves

把人形動作變成看得懂、也讀得到的數據：在網頁上用 VRM 角色播放動作，旁邊畫出關節角度、Unity 肌肉曲線，每一格的數字都能下載，也能讓 AI 直接在瀏覽器裡讀。

**線上試用：https://karylcode.github.io/motion-curves/**

這個倉庫**不含任何動作**，只附一個角色（`AvatarSample_A.vrm`）。打開網頁後把自己的動作檔拖進去就能看。

## 可以做什麼

- **播放**：六個視角、逐格、慢速、Root 移動（位置和轉向）、骨架線、武器和武器尖端軌跡、頭髮物理。
- **關節角度**：膝蓋、手肘、大腿、上臂、上身傾斜、骨盆和胸口轉向、頭、腳離地高度、兩腳距離、手高度共 28 項，加上左右腳踩地的時段。點圖就跳到那一格。
- **Unity 曲線**（Unity 匯出的動作才有）：95 條 Humanoid 肌肉值、身體重心、Root 移動、手腳 IK 目標，照 Unity 實際播放的方式畫。
- **選單**：照武器、類型、姿勢、位移、播放（循環／單次）、手篩選，也能搜尋名稱、英文名、描述。
- **換角色**：把 `.vrm` 拖進來就換成你的角色（VRM 1.0 和 0.x 都可以），下次打開還是它。
- **給 AI**：網頁上有 `window.motionCurves`，可以拿任一條數據每一格的值、某一格全部的值、骨頭位置、截圖（`motionCurves.help()` 看全部）。

## 匯入自己的動作

### 方法一：拖進網頁（不用 Unity）

把檔案拖進網頁，或按上面的「匯入動作／角色」：

| 檔案 | 說明 |
|---|---|
| `.vrma` | VRM 動畫，骨架本來就對應 VRM，最準 |
| `.fbx` | 靠骨頭名稱對照：Mixamo、Unity Humanoid、Unreal（pelvis、thigh_l…）、VRoid（J_Bip_…）、3ds Max Biped。預設姿勢不是 T-pose 也可以（照骨頭方向自動修正）。一個檔裡有好幾段動畫會分成好幾支 |
| `.vrm` | 換角色 |

- 動作只存在這台瀏覽器（IndexedDB），不會上傳到任何地方；換電腦或清除瀏覽器資料就沒了。
- 用本機開發伺服器（`npm run dev`）打開時，每支匯入的動作多一個「存成檔案」按鈕，會存進 `public/motions/<id>/`，之後跟 Unity 匯出的放在一起。
- 網頁匯入的動作沒有 Unity 曲線，兩個 Unity 分頁會關掉；關節角度、腳踩地照樣有（在網頁上用現在的角色量）。
- 頭尾姿勢一樣就自動當成循環動作，猜錯可以按「改成單次／改成循環」。

### 方法二：從 Unity 匯出（完整曲線）

要 Unity 原生曲線（可以拿回 Unity 還原出一模一樣的動作）就從 Unity 匯出。Unity 專案要有 UniVRM、Newtonsoft.Json，腳本透過 [MCP for Unity](https://github.com/CoplayDev/unity-mcp) 的 `execute_code` 在編輯器裡跑。

1. 在 `unity/characters/` 寫一個設定檔，列出要匯出的動作 FBX（照 `_example.json`，格式見 [`unity/characters/HOWTO.md`](unity/characters/HOWTO.md)）。
2. 把 [`unity/run_export.cs.txt`](unity/run_export.cs.txt) 的 `script` 改成你的 `export_motion.cs.txt` 路徑、`pick` 填要匯出的 id，整段丟給 `execute_code`（compiler 選 codedom）。一批約 15 支。
3. `node tools/build-index.mjs` 更新動作清單，並產生網頁下載用的 `.gz`。
4. 驗證：`node tools/check-export.mjs`；`run_export` 改跑 `rebuild_clip.cs.txt`，只用 `curves.json` 在 Unity 重建、跟原檔比；網頁上 `motionCurves.verify()`。

要角色拿著原版的武器，用 `unity/setup_weapons.cs.txt` 算握法、做 prefab 和網頁用的 glb（見 HOWTO）。

## 在自己電腦上跑

```bash
npm install
npm run dev
```

打開 http://127.0.0.1:5200/ 。Windows 也可以雙擊 `啟動網站.bat`。網址後面加 `#動作id` 會直接開那支動作。

- `npm run build`：只打包網頁程式到 `site/`，角色和動作由你的伺服器直接從 `public/` 提供（動作多的時候不用每次重新打包）。
- `npm run build:pages`：連 `public/` 一起打包到 `dist/`，GitHub Pages 用（推到 main 會自動部署，見 `.github/workflows/pages.yml`）。

## 每支動作的檔案

`public/motions/<id>/` 三個 JSON，清單在 `public/motions/index.json`（`build-index.mjs` 產生）：

| 檔案 | 內容 |
|---|---|
| `curves.json` | Unity 原生曲線：137 條（肌肉 95、身體重心 7、Root 移動 7、IK 目標 28），每條存關鍵影格＋切線＋切線模式、每格的值、Unity 實際怎麼播（`playback`），加上片段設定。網頁匯入的只有基本資訊、沒有曲線 |
| `angles.json` | 套到 VRM 角色上的結果：每格切好幾份，每份每根人骨相對 T-pose 的旋轉（VRM normalized）、骨盆位置、Root 移動（位置＋轉向）；Unity 匯出的還有每根骨頭的世界座標、武器掛法和尖端軌跡 |
| `analysis.json` | 28 個關節角度、腳踩地時段、正負號定義；Unity 匯出的還有 95 條肌肉逐格值 |

座標是 glTF／three.js 右手座標，+Y 朝上，角色面向 +Z，公尺。名稱、英文 Animator 狀態名、描述、標籤寫在 `public/motions/names.json`（選用，`build-index.mjs` 會寫進清單）。

## 命名工具（選用）

動作很多時，可以讓 AI 照 [`unity/characters/NAMING.md`](unity/characters/NAMING.md) 的規範命名（「類型・姿態・方向（差異）」＋英文 Animator 狀態名＋四欄固定標籤）：

1. `python -X utf8 tools/naming-pack.py <輸出資料夾>`：每支動作算統一的數據表，畫連拍火柴人圖（後方、右側、俯視三個視角＋全程軌跡），四欄標籤照數據自動算。
2. `python -X utf8 tools/naming-draft.py <輸出資料夾>`：照原檔 id 產生命名草稿，每個角色寫一份資料包。
3. 讓 AI 看資料包和連拍圖，填攻擊、技能的特徵、處理撞名、寫描述。
4. `python -X utf8 tools/naming-merge.py <輸出資料夾> --write`：檢查格式、用詞、撞名，寫進 `names.json`。

需要 Python 3、numpy、Pillow。

## Unity 實際怎麼播

FBX 匯入時動畫壓縮設成 Optimal，Unity 播放時**每條曲線各自**決定怎麼播：

- 關鍵影格夠多的（7 × 關鍵影格數 ≥ 格數，格數＝長度 × fps、不含最後一格，剛好相等也算）：存成「每格一個值、格與格之間直線」（`playback: "dense"`），不是照動畫視窗那條平滑曲線走。
- 其他的：照關鍵影格和切線（`playback: "curve"`），跟動畫視窗一樣。

這條規則是用 AnimationHumanStream 直接讀 Unity 播放時的肌肉值比出來的。匯出時會把三種還原方式（全部 curve、全部 dense、每條照規則）都跟原檔比一次、選最準的，結果記在 `curves.json` 的 `playbackMode` 和 `playbackCheck`。沒用 Optimal 壓縮的動畫，Unity 全部照關鍵影格播。

用一套 Unity 商城的動作（440 支）驗證過：

- **Unity 還原**：只用 `curves.json` 重建，跟原檔比（開 Foot IK＋Root 移動、連續播 4 遍、每 1/120 秒）：骨頭位置最大差 0.010 mm，角度 0°。
- **網頁播放**：每份取樣都比，骨頭位置最大差 0.0046 mm。
- **網頁匯入**：把 Unity 匯出的動作轉成 VRMA 再拖進網頁，網頁量的關節角度和 Unity 量的最多差 0.015°。

## 授權

- 程式碼：[MIT](LICENSE)。
- `public/models/AvatarSample_A.vrm`：用 VRoid Studio 做的角色，檔案裡的授權（[VRM Public License 1.0](https://vrm.dev/licenses/1.0/)）允許所有人使用、商用、再散布、改作後再散布，不用標示作者。
- 用到 [three.js](https://threejs.org/)、[@pixiv/three-vrm](https://github.com/pixiv/three-vrm)（都是 MIT）。
- 這個倉庫不含任何第三方動作或模型素材。用商城素材匯出的動作和武器模型不要放進公開倉庫（`.gitignore` 已經排除 `public/motions/` 和武器模型）。
