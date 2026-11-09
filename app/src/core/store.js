/**
 * 极简 store：一个可变状态 + 订阅。
 * 不做不可变更新——本应用状态极小，全量替换即可。
 * 见 docs/05-architecture.md §4
 */
export function createStore(initial) {
  let state = Object.assign({}, initial);
  const listeners = [];

  return {
    get: function () {
      return state;
    },
    set: function (patch) {
      const prev = state;
      state = Object.assign({}, state, patch);
      for (let i = 0; i < listeners.length; i++) {
        try {
          listeners[i](state, prev);
        } catch (err) {
          console.error('[store] listener error', err);
        }
      }
    },
    subscribe: function (fn) {
      listeners.push(fn);
      return function () {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    }
  };
}
