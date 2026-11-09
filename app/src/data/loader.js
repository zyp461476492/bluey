/**
 * 题库加载：fetch 分类清单与各主题文件。
 * 只在文件损坏或 fetch 失败时抛错，由上层转 ERROR_STATE。
 * 见 docs/05-architecture.md §5.1
 */
import { CONFIG } from '../config.js';

const cache = new Map();

function fetchJson(path) {
  return fetch(path, { cache: 'no-cache' }).then(function (res) {
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status + ' ' + path);
      err.code = 'FETCH_FAILED';
      err.path = path;
      throw err;
    }
    return res.text().then(function (text) {
      try {
        return JSON.parse(text);
      } catch (e) {
        const err = new Error('JSON 解析失败：' + path);
        err.code = 'PARSE_FAILED';
        err.path = path;
        throw err;
      }
    });
  });
}

function cached(key, factory) {
  if (cache.has(key)) return cache.get(key);
  const p = factory();
  cache.set(key, p);
  // 失败不缓存，下次重试还能重新请求
  p.catch(function () {
    cache.delete(key);
  });
  return p;
}

export function loadIndex() {
  return cached('__index__', function () {
    return fetchJson(CONFIG.PATHS.DATA_ROOT + 'index.json').then(function (data) {
      if (!data || !Array.isArray(data.categories) || data.categories.length === 0) {
        const err = new Error('index.json 缺少 categories');
        err.code = 'SCHEMA_INVALID';
        throw err;
      }
      return data;
    });
  });
}

export function loadCategory(category) {
  return cached(category.id, function () {
    return fetchJson(CONFIG.PATHS.DATA_ROOT + category.file).then(function (data) {
      if (!data || !Array.isArray(data.items)) {
        const err = new Error(category.file + ' 缺少 items');
        err.code = 'SCHEMA_INVALID';
        throw err;
      }
      return data.items.map(function (item) {
        // 补上所属分类，出题与面包屑都要用
        return Object.assign({}, item, { categoryId: category.id, category: category });
      });
    });
  });
}

/**
 * 载入全部主题，合并成一个题目池。
 * M1 不做分类选择，所以一次全载；M2 再按分类懒加载。
 */
export function loadAll() {
  return loadIndex().then(function (index) {
    const jobs = index.categories.map(function (cat) {
      return loadCategory(cat);
    });
    return Promise.all(jobs).then(function (groups) {
      const items = [];
      for (let i = 0; i < groups.length; i++) {
        for (let j = 0; j < groups[i].length; j++) items.push(groups[i][j]);
      }
      return { index: index, items: items };
    });
  });
}

export function clearCache() {
  cache.clear();
}
