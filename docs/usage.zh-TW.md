[English](usage.md) | **繁體中文** · [文件索引](README.zh-TW.md)

# 使用方式

## 開一支動作

- 從上方選單選動作。可以照武器、類型、姿勢、位移、播放（循環／單次）、手篩選，也能搜尋名稱、英文名、id、描述。選單打開時，↑／↓ 移動、Enter 開啟、Esc 關閉。
- 網址後面加 `#動作id` 會直接開那支動作，例如 `#S_Walk`。沒加的話，有 `S_Walk` 就開它，沒有就開第一支。換動作時網址會跟著變。
- 倉庫和線上版都不含動作，要自己匯入，見[匯入動作](importing.zh-TW.md)。

## 播放

- 播放／暫停、上一格／下一格（◀︎ ▶︎）、拖拉條，速度 0.25×、0.5×、1×。
- 六個視角：正面、右前、右側、背面、左側、正上方。在 3D 畫面上拖曳可以轉鏡頭（three.js 的 OrbitControls）。
- 開關：Root 移動、武器、武器尖端軌跡、骨架線、角色模型、頭髮物理。

## 圖表分頁

| 分頁 | 內容 |
|---|---|
| 關節角度 | 28 項，分 13 張圖，下面有左右腳踩地條 |
| 肌肉曲線（Unity） | 95 條 Humanoid 肌肉值。Unity 匯出的動作才有。 |
| 身體與 IK（Unity） | 身體重心、Root 移動、手腳 IK 目標。Unity 匯出的動作才有。 |
| 數據 | 下載、目前這一格的值、每項關節角度的範圍、腳踩地、給 AI 的程式介面說明 |

- 在圖上點或拖曳就跳到那一格，直線跟著播放位置走。圖表不能縮放或平移。
- 關節角度圖的標題下面寫了正負號的意思，例如膝蓋：0＝打直，越大越彎。完整定義用 `motionCurves.conventions()` 拿。
- Unity 曲線照 Unity 實際播放的方式畫，見 [Unity 實際怎麼播](how-unity-plays.zh-TW.md)。

## 下載（數據分頁）

- 目前這支動作的 `curves.json`、`angles.json`、`analysis.json`。格式見[資料格式](data-format.zh-TW.md)。
- CSV：每格一列，有關節角度和肌肉值。

## 換角色

把 `.vrm` 拖進網頁就換角色（VRM 1.0 和 0.x 都可以）。角色存在這台瀏覽器，下次打開還是它。按「恢復預設角色」換回 `AvatarSample_A`。

Unity 匯出的動作是在 `AvatarSample_A` 身上取樣的。換成別的角色時，骨盆位置和 Root 移動照骨盆高度等比縮放；顯示的關節角度還是在 `AvatarSample_A` 上量的（資訊列會寫出來）。

## 給 AI：`window.motionCurves`

在瀏覽器主控台或瀏覽器自動化工具裡呼叫。`motionCurves.help()` 會列出全部。

| 呼叫 | 回傳 |
|---|---|
| `motions()` | 動作清單 |
| `current()` | 目前動作、格數、時間、是否播放 |
| `select(id)` | 換動作（Promise） |
| `setFrame(n)`／`play()`／`pause()` | 控制播放 |
| `names()` | 所有數據名稱：`jointAngles`（關節角度）、`muscles`（肌肉）、`unityCurves`（Unity 曲線全部 137 條） |
| `series(name)` | 某條數據每一格的值（陣列，index＝格數） |
| `value(name, frame?)` | 某條數據在某格的值（frame 可以是小數；省略＝目前這一格） |
| `table(frame?)` | 某一格所有關節角度＋肌肉值 |
| `summary()` | 每條關節角度、肌肉的最小／最大值和出現的格數、平均 |
| `keys(attr)` | 某條 Unity 曲線的關鍵影格：[時間, 值, 入切線, 出切線, 入權重, 出權重, 權重模式, 左切線模式, 右切線模式, 斷開] |
| `conventions()` | 角度正負號、單位的定義 |
| `data()` | 三個原始 JSON。`angles` 一開始沒有 `worldPositions`，跑過 `verify()` 才有，或直接讀 `angles.json`。 |
| `verify()` | 自我檢查（Promise）：網頁算出的骨頭位置 vs Unity（mm），以及網頁的曲線內插 vs Unity 取樣 |
| `pose(frame?)` | 某一格（可小數）每根骨頭的世界位置 [x, y, z] 和旋轉四元數 [x, y, z, w] |
| `snapshot()` | 3D 畫面截圖（PNG data URL） |
| `importFiles(files)` | 匯入動作（`.vrma`、`.fbx`）或換角色（`.vrm`），`files` 是 File 陣列（Promise） |

單位：角度＝度；高度、距離＝公尺（網頁圖表換成 cm）；肌肉值＝-1～1。座標：glTF／three.js 右手座標，+Y 朝上，角色面向 +Z。
