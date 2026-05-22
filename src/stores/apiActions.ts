/**
 * Tauri IPC 薄封装，供组件经 stores 统一导入。
 */
import * as api from '../bindings/commands'

export const createTask = api.createTask
export const updateTask = api.updateTask
export const completeTask = api.completeTask
export const deleteTask = api.deleteTask
export const archiveTask = api.archiveTask
export const restoreTask = api.restoreTask
export const addTagToTask = api.addTagToTask
export const removeTagFromTask = api.removeTagFromTask

export const addSubtask = api.addSubtask
export const updateSubtask = api.updateSubtask
export const deleteSubtask = api.deleteSubtask
export const reorderSubtasks = api.reorderSubtasks

export const createCategory = api.createCategory
export const updateCategory = api.updateCategory
export const deleteCategory = api.deleteCategory

export const createTag = api.createTag
export const updateTag = api.updateTag
export const deleteTag = api.deleteTag

export const addReminder = api.addReminder
export const removeReminder = api.removeReminder

export const startFocus = api.startFocus
export const stopFocus = api.stopFocus
export const abandonFocus = api.abandonFocus
export const getCurrentFocus = api.getCurrentFocus
export const getTaskFocusHistory = api.getTaskFocusHistory

export const getSchedule = api.getSchedule
export const autoSchedule = api.autoSchedule
export const removeScheduleEntry = api.removeScheduleEntry
export const clearSchedule = api.clearSchedule

export const getWorkloadSummary = api.getWorkloadSummary
export const getDailyReview = api.getDailyReview

export const getCalendarMonth = api.getCalendarMonth
export const getStatsPanel = api.getStatsPanel

export const getSettings = api.getSettings
export const updateSettings = api.updateSettings
export const listHolidays = api.listHolidays
export const updateHolidays = api.updateHolidays
export const fetchHolidaysOnline = api.fetchHolidaysOnline
export const getDatabasePath = api.getDatabasePath
export const revealDatabaseFolder = api.revealDatabaseFolder

export const getDesktopPanelSnapshot = api.getDesktopPanelSnapshot
export const focusTaskFromPanel = api.focusTaskFromPanel

export const getNotificationSettings = api.getNotificationSettings
export const updateNotificationSettings = api.updateNotificationSettings
