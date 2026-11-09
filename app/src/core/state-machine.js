/**
 * 题目生命周期状态机。
 * 目的不是"炫技"，而是把非法跳转暴露成警告——这类应用的 bug
 * 十次有九次是"状态和界面不一致"。
 * 见 docs/05-architecture.md §3
 */
export const STATES = {
  IDLE: 'IDLE',
  LOADING_MEDIA: 'LOADING_MEDIA',
  COUNTDOWN: 'COUNTDOWN',
  ANSWER_SHOWN: 'ANSWER_SHOWN',
  ERROR_STATE: 'ERROR_STATE'
};

const ALLOWED = {
  IDLE: [STATES.LOADING_MEDIA, STATES.ERROR_STATE],
  // LOADING_MEDIA → ANSWER_SHOWN 是 flashcard 模式：2 岁档没有倒计时，
  // 图片一出来就直接是"答案态"
  LOADING_MEDIA: [STATES.COUNTDOWN, STATES.ANSWER_SHOWN, STATES.IDLE, STATES.ERROR_STATE],
  COUNTDOWN: [STATES.ANSWER_SHOWN, STATES.IDLE, STATES.ERROR_STATE],
  ANSWER_SHOWN: [STATES.LOADING_MEDIA, STATES.IDLE, STATES.ERROR_STATE],
  ERROR_STATE: [STATES.IDLE, STATES.LOADING_MEDIA]
};

export function canTransition(from, to) {
  if (from === to) return true;
  const list = ALLOWED[from];
  return !!list && list.indexOf(to) !== -1;
}

/**
 * 非法跳转不抛异常（用户不该看到崩溃），但要留痕。
 * 返回值表示是否真的允许，调用方可据此决定要不要继续。
 */
export function assertTransition(from, to) {
  if (canTransition(from, to)) return true;
  console.warn('[state] 非法跳转 ' + from + ' → ' + to + '（已放行，但说明有逻辑漏洞）');
  return true;
}
