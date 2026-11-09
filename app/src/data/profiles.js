/**
 * 年龄档：配置驱动，不是内容分库。
 * 见 docs/11-curriculum-design.md §3、ADR-013
 *
 * 三档的差异全部落在参数上（模式、倒计时、选项数、语速、单轮题数），
 * 词库只有一份，靠 words.minAge 过滤。
 */
import { CONFIG } from '../config.js';

let cached = null;

export function loadProfiles() {
  if (cached) return Promise.resolve(cached);
  return fetch(CONFIG.PATHS.PROFILES, { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) {
        const err = new Error('HTTP ' + res.status + ' age-profiles.json');
        err.code = 'FETCH_FAILED';
        throw err;
      }
      return res.json();
    })
    .then(function (data) {
      if (!data || !Array.isArray(data.profiles) || !data.profiles.length) {
        const err = new Error('age-profiles.json 缺少 profiles');
        err.code = 'SCHEMA_INVALID';
        throw err;
      }
      cached = data.profiles;
      return cached;
    });
}

export function getProfile(profiles, id) {
  for (let i = 0; i < profiles.length; i++) {
    if (profiles[i].id === id) return profiles[i];
  }
  return profiles[0];
}

/**
 * 按档位筛词：只出「引入年龄不超过该档上限」的词。
 * toddler(2-3) 只出 minAge<=2 的词；school(6-8) 出 minAge<=6 的全部。
 */
export function filterByProfile(items, profile) {
  const maxAge = typeof profile.maxWordAge === 'number' ? profile.maxWordAge : 6;
  return items.filter(function (item) {
    const minAge = typeof item.minAge === 'number' ? item.minAge : 2;
    return minAge <= maxAge;
  });
}

export function labelOf(profile, lang) {
  const l = profile && profile.label;
  if (!l) return '';
  return lang === 'en' ? l.en || l.zh : l.zh || l.en;
}

export function hintOf(profile, lang) {
  const h = profile && profile.hint;
  if (!h) return '';
  return lang === 'en' ? h.en || h.zh : h.zh || h.en;
}
