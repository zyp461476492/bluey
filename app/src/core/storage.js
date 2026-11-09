/**
 * localStorage 封装。
 * 全部 try/catch —— 隐私模式、TV 浏览器禁用存储都会抛异常，
 * 但设置存不住不该让应用崩掉。
 */
export function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

export function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export function remove(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}
