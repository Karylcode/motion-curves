[English](importing.md) | **繁體中文** · [文件目錄](README.zh-TW.md)

# 匯入動作

不用 Unity。把檔案拖進網頁，或按上面的「匯入動作／角色」。一次可以拖好幾個檔。

| 檔案 | 說明 |
|---|---|
| `.vrma` | VRM 動畫，骨架本來就對應 VRM，最準。裡面有 VRM 動畫（`VRMC_vrm_animation`）的 `.glb`／`.gltf` 也可以。 |
| `.fbx` | 靠骨頭名稱對照：Mixamo、Unity Humanoid、Unreal（pelvis、thigh_l…）、VRoid（J_Bip_…）、3ds Max Biped。預設姿勢不是 T-pose 也可以（照骨頭方向自動修正）。一個檔裡有好幾段動畫會分成好幾支。 |
| `.vrm` | 換角色 |

## 匯入的動作存在哪

- 只存在這台瀏覽器（IndexedDB），不會上傳到任何地方。換電腦或清除瀏覽器資料就沒了。
- 瀏覽器不給存時（例如私密視窗、關掉網站資料），動作照樣能播，但重新整理後就會不見。
- 按「刪除」可以從這台瀏覽器刪掉匯入的動作。

## 存成檔案（只有本機開發伺服器）

用 `npm run dev` 打開時，每支匯入的動作多一個「存成檔案」按鈕。它會問 id（英數字、底線、減號），把動作存進 `public/motions/<id>/`，再跑 `tools/build-index.mjs`。之後這支動作跟 Unity 匯出的放在一起，瀏覽器裡的那份會刪掉。

## 限制

- 網頁匯入的動作沒有 Unity 曲線，兩個 Unity 分頁會關掉。關節角度、腳踩地照樣有，是在網頁上用現在的角色量的。
- 頭尾姿勢一樣（每根骨頭差 5° 以內、骨盆高度差 2 cm 以內）就自動當成循環動作。猜錯可以按「改成單次／改成循環」。
- 網頁匯入用 30 fps 取樣，每格切 4 份。
- Root 移動：骨盆的水平移動用 0.4 秒移動平均，分成「Root 移動」和「原地晃動」兩部分。轉向留在骨盆旋轉裡，Root 轉向一律是 0。
- FBX 裡名稱對不上的骨頭維持 T-pose。找不到骨盆（Hips／Pelvis）就會匯入失敗：先轉成 VRMA，或把骨頭改成 Mixamo、Unity Humanoid、UE 的名稱。

## 給開發者

匯入的程式在 `src/importer.js`：

- `importFile(file, vrm)`：入口，照副檔名選讀檔方式。
- `clipsFromVRMA(buffer, vrm)`、`clipsFromFBX(buffer, vrm)`：檔案裡每段動畫回傳一個片段。
- `vrmBoneOf(name)`：FBX 骨頭名稱 → VRM 骨頭名稱。
- `sampleClip(vrm, clip, …)`：把片段套到 VRM 上取樣，轉成 `angles.json` 的格式（見[資料格式](data-format.zh-TW.md)）。
