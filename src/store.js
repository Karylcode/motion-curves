// 網頁匯入的動作和換上的 VRM 角色存在這台瀏覽器的 IndexedDB（不會上傳到任何地方）。
// 瀏覽器不給存（私密視窗、關掉網站資料）時每個函式都會失敗，呼叫的地方要接住，網頁照常能用。
const DB = 'motion-curves';
let opening;

function db() {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('motions', { keyPath: 'id' });
      req.result.createObjectStore('files');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

async function run(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// 動作：{ id, label, createdAt, angles, curves }
export const listMotions = () => run('motions', 'readonly', (s) => s.getAll());
export const putMotion = (m) => run('motions', 'readwrite', (s) => s.put(m));
export const deleteMotion = (id) => run('motions', 'readwrite', (s) => s.delete(id));
// 角色檔：key 'vrm' → { name, buffer }
export const getFile = (key) => run('files', 'readonly', (s) => s.get(key));
export const putFile = (key, value) => run('files', 'readwrite', (s) => s.put(value, key));
export const deleteFile = (key) => run('files', 'readwrite', (s) => s.delete(key));
