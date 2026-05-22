import { completeTask as apiCompleteTask } from '../bindings/commands'
import { invalidateAfterTaskMutation } from './invalidate'
import { pushToast } from './toast'

export async function completeTaskFromList(id: number): Promise<void> {
  try {
    await apiCompleteTask(id)
    pushToast('success', '任务已完成')
    invalidateAfterTaskMutation()
  } catch (e) {
    pushToast('error', `操作失败: ${e}`)
  }
}
