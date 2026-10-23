[English](troubleshooting.md) | **繁體中文** · [文件索引](README.zh-TW.md)

# 疑難排解

## 匯入

| 看到什麼 | 怎麼辦 |
|---|---|
| 「FBX 骨頭名稱對不上（找不到 Hips／Pelvis）」 | 先轉成 VRMA，或改用 Mixamo、Unity Humanoid、UE 的骨頭名稱。見[匯入動作](importing.zh-TW.md)。 |
| 「FBX 裡沒有動畫」 | 這個 FBX 沒有動畫，重新匯出時要包含動畫。 |
| 「檔案裡沒有 VRM 動畫（VRMC_vrm_animation）」 | 這個 `.vrma`／`.glb` 裡沒有 VRM 動畫。 |
| 「不支援 .xxx」 | 動作要用 `.vrma` 或 `.fbx`，角色要用 `.vrm`。 |
| FBX 匯入後有些骨頭不會動 | 那些骨頭名稱沒對上，所以維持 T-pose。改骨頭名稱，或先轉成 VRMA。 |
| 不該循環的動作在循環（或反過來） | 按「改成單次／改成循環」。 |
| 「瀏覽器不給存，重新整理後就會不見」 | 瀏覽器擋了 IndexedDB，例如私密視窗或關掉網站資料。改用一般視窗。 |
| 匯入的動作不見了 | 動作只存在這台瀏覽器的 IndexedDB，清除瀏覽器資料或換電腦就沒了。用開發伺服器時可以按「存成檔案」留成檔案。 |

## 觀看

| 看到什麼 | 怎麼辦 |
|---|---|
| 兩個 Unity 分頁按不了 | 網頁匯入的動作沒有 Unity 曲線，要從 Unity 匯出才有（見[從 Unity 匯出](unity-export.zh-TW.md)）。 |
| 資訊列寫「關節角度是在 AvatarSample_A 上量的」 | Unity 匯出的動作是在 `AvatarSample_A` 身上量的。換成別的角色時，骨盆和 Root 移動會等比縮放，關節角度的數字還是 `AvatarSample_A` 的。 |
| 存起來的 `.vrm` 讀不了 | 網頁會自動改用預設角色。再拖一個 `.vrm` 進來就會蓋掉存起來的那個。 |
| `motionCurves.verify()` 回傳「網頁匯入的動作沒有 Unity 取樣可以比」 | 只有 Unity 匯出的動作能驗證。 |
| 圖表不能縮放 | 圖表本來就不能縮放或平移。在圖上點或拖曳可以跳到那一格。 |

## 在自己電腦上跑

| 看到什麼 | 怎麼辦 |
|---|---|
| `npm run dev` 馬上停掉 | 5200 埠被占用（指令有加 `--strictPort`）。關掉占用的程式，或改 `package.json` 裡的埠號。也確認 Node.js 是 20.19 以上或 22.12 以上。 |
| 沒有「存成檔案」按鈕 | 只有本機開發伺服器（`npm run dev`）才有。 |
| 「存成檔案」失敗：「id 只能用英數字、底線、減號」 | id 只能用英數字、底線、減號。 |
| `npm run preview` 看不到角色 | 它提供的是 `site/`，裡面沒有 `public/` 的檔。改用 `npm run build:pages`，再 `npm run preview -- --mode pages`。見[開發](development.zh-TW.md)。 |
| `node tools/build-index.mjs` 或 `check-export.mjs` 出現 ENOENT | 還沒有 `public/motions/`（它不在 git 裡）。先匯出或存一支動作。 |

## Unity 匯出

| 看到什麼 | 怎麼辦 |
|---|---|
| `execute_code` 逾時 | 跑超過約 30 秒會逾時，但檔案照樣會寫完。一批約 15 支。 |
| 「編譯錯誤（行號是腳本檔的）」 | 照回報的行號改腳本。確認 Unity 專案有 UniVRM、Newtonsoft.Json。 |
| 專案路徑有中文時，`GetName()` 出錯 | Assembly 改用 `FullName`，不要呼叫 `GetName()`（見 [HOWTO.md](../unity/characters/HOWTO.md)）。 |
