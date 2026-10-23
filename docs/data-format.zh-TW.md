[English](data-format.md) | **繁體中文** · [文件索引](README.zh-TW.md)

# 資料格式

每支動作是 `public/motions/<id>/` 裡的三個 JSON。動作清單在 `public/motions/index.json`，由 `tools/build-index.mjs` 產生。`public/motions/` 不進 git。

| 檔案 | 內容 |
|---|---|
| `curves.json` | Unity 原生曲線：137 條（肌肉 95、身體重心 7、Root 移動 7、IK 目標 28），每條存關鍵影格＋切線＋切線模式、每格的值、Unity 實際怎麼播（`playback`），加上片段設定。網頁匯入的只有基本資訊、沒有曲線。 |
| `angles.json` | 套到 VRM 角色上的結果：每格切好幾份，每份有每根人骨相對 T-pose 的旋轉（VRM normalized）、骨盆位置、Root 移動（位置＋轉向）。Unity 匯出的還有每根骨頭的世界座標、武器掛法和尖端軌跡。 |
| `analysis.json` | 28 個關節角度、腳踩地時段、正負號定義。Unity 匯出的還有 95 條肌肉逐格值。 |

## 座標和單位

glTF／three.js 右手座標，+Y 朝上，角色面向 +Z，公尺。角度用度。肌肉值在 -1～1 之間。

## 細節

- 關鍵影格欄位（`curves.json` 的 `keyFields`）：時間、值、入切線、出切線、入權重、出權重、權重模式、左切線模式、右切線模式、斷開。無限大的切線存成字串 `"Infinity"`、`"-Infinity"`。
- 每條曲線 Unity 怎麼播、整支動作的比對結果（`playbackMode`、`playbackCheck`）：見 [Unity 實際怎麼播](how-unity-plays.zh-TW.md)。
- 每格切幾份（`angles.json` 的 `samplesPerFrame`）：Unity 匯出預設 16（`export_motion.cs.txt` 的 `K`），網頁匯入是 4。
- 腳踩地：腳跟或腳尖離 T-pose 站立高度 1.5 cm 以內，連續 2 格以上才算。每段寫成 `[開始格, 結束格]`。循環動作的最後一格＝第一格。
- `build-index.mjs` 還會產生 `.json.gz`，以及 `play.json.gz`（`angles.json` 拿掉 `worldPositions`）。網頁有 .gz 就下載 .gz；GitHub Pages 版不會去找。

## names.json（選用）

`public/motions/names.json` 寫每支動作的名稱、英文 Animator 狀態名、類型、描述、標籤。`build-index.mjs` 會把它們寫進 `curves.json` 和清單，改名不用重新從 Unity 匯出。命名規範見 [NAMING.md](../unity/characters/NAMING.md)。要讓 AI 幫忙命名，見[開發](development.zh-TW.md#命名工具選用)。
