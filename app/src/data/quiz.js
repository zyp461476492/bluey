/**
 * 出题：洗牌、建队列、取下一题。
 * 只管"出什么"，不碰 DOM。见 docs/05-architecture.md §2
 */
import { CONFIG } from '../config.js';

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/**
 * 建本轮队列。返回题目 id 数组。
 * @param {Array} items 题目池
 * @param {Object} [opts] { shuffle: boolean }
 */
export function buildQueue(items, opts) {
  const options = opts || {};
  const shouldShuffle = options.shuffle !== undefined ? options.shuffle : CONFIG.SHUFFLE;
  const source = shouldShuffle ? shuffle(items) : items.slice();
  return source.map(function (item) {
    return item.id;
  });
}

export function indexById(items) {
  const map = Object.create(null);
  for (let i = 0; i < items.length; i++) {
    map[items[i].id] = items[i];
  }
  return map;
}

/**
 * 这个词条现在能不能出题？
 *
 * media.type === 'pending' 表示"词条已录入、素材还没做"。
 * 这类词必须排除在队列外 —— 它的 fallbackEmoji 只是个占位符
 * （工程车根本没有能用的 emoji），拿出来就是教错的。
 * 见 docs/11-curriculum-design.md §4.1
 */
export function isPlayable(item) {
  const media = item.media || {};
  return media.type !== 'pending';
}

export function filterPlayable(items) {
  return items.filter(isPlayable);
}
