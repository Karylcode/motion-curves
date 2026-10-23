[English](how-unity-plays.md) | **繁體中文** · [文件索引](README.zh-TW.md)

# Unity 實際怎麼播

FBX 匯入時動畫壓縮設成 Optimal，Unity 播放時**每條曲線各自**決定怎麼播：

- 關鍵影格夠多的（7 × 關鍵影格數 ≥ 格數，格數＝長度 × fps、不含最後一格，剛好相等也算）：存成「每格一個值、格與格之間直線」（`playback: "dense"`），不是照動畫視窗那條平滑曲線走。
- 其他的：照關鍵影格和切線（`playback: "curve"`），跟動畫視窗一樣。

這條規則是用 AnimationHumanStream 直接讀 Unity 播放時的肌肉值比出來的。匯出時會把三種還原方式（全部 curve、全部 dense、每條照規則）都跟原檔比一次、選最準的，結果記在 `curves.json` 的 `playbackMode` 和 `playbackCheck`。沒用 Optimal 壓縮的動畫，Unity 全部照關鍵影格播。

## 網頁怎麼算

- `dense` 的曲線：用存好的每格值，格與格之間直線。
- `curve` 的曲線：用 Unity 非加權關鍵影格的 Hermite 公式（`src/curves.js` 的 `evaluateCurve`）。切線是無限大時，值停在前一個關鍵影格，直到下一個。
- 關鍵影格的權重（`inWeight`、`outWeight`、`weightedMode`）有存在 `curves.json`，`rebuild_clip.cs.txt` 會把它們還給 Unity，但網頁不使用。

## 驗證

用一套 Unity 商城的動作（440 支）驗證過：

- **Unity 還原**：只用 `curves.json` 重建，跟原檔比（開 Foot IK＋Root 移動、連續播 4 遍、每 1/120 秒）：骨頭位置最大差 0.010 mm，角度 0°。
- **網頁播放**：每份取樣都比，骨頭位置最大差 0.0046 mm。
- **網頁匯入**：把 Unity 匯出的動作轉成 VRMA 再拖進網頁，網頁量的關節角度和 Unity 量的最多差 0.015°。

這些是作者自己量的結果。要自己重做，照[從 Unity 匯出](unity-export.zh-TW.md#步驟)的驗證步驟，以及 `motionCurves.verify()`（見[使用方式](usage.zh-TW.md)）。
