import { completeTask as apiCompleteTask, reopenTask } from '../bindings/commands'
import { invalidateAfterTaskMutation } from './invalidate'
import { pushToast } from './toast'

export async function completeTaskFromList(id: number): Promise<void> {
  try {
    await apiCompleteTask(id)
    pushToast('success', '任务已完成', {
      label: '撤销',
      onClick: () => {
        void reopenTask(id)
          .then(() => invalidateAfterTaskMutation())
          .catch((e) => pushToast('error', `操作失败: ${e}`))
      },
    })
    invalidateAfterTaskMutation()
  } catch (e) {
    pushToast('error', `操作失败: ${e}`)
  }
}
