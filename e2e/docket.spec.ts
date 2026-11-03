import { test, expect } from '@playwright/test'
import { bootApp } from './fixtures'

const AGENDA_FIXTURES = {
  list_agenda: [
    { kind: 'task', id: 1, title: '工作任务甲', subtitle: null, due_date: null, priority: 0, matter_id: null, missing_evidence: false, category_id: 1, tag_ids: [] },
    { kind: 'task', id: 2, title: '个人事项乙', subtitle: null, due_date: null, priority: 0, matter_id: null, missing_evidence: false, category_id: 2, tag_ids: [] },
  ],
  list_tasks: [
    { id: 1, title: '工作任务甲', status: 'active', priority: 0, due_date: null, category_id: 1, created_at: '2026-11-01T00:00:00+00:00', tags: [], subtasks_progress: { total: 0, completed: 0 } },
    { id: 2, title: '个人事项乙', status: 'active', priority: 0, due_date: null, category_id: 2, created_at: '2026-11-01T00:00:00+00:00', tags: [], subtasks_progress: { total: 0, completed: 0 } },
  ],
  list_matters: [
    { id: 1, playbook_id: null, title: '工作任务甲', status: 'active', priority: 0, category_id: 1, due_date: null, created_at: '2026-11-01T00:00:00+00:00', completed_at: null, tags: [], current_step: null, missing_evidence: false },
    { id: 2, playbook_id: null, title: '个人事项乙', status: 'active', priority: 0, category_id: 2, due_date: null, created_at: '2026-11-01T00:00:00+00:00', completed_at: null, tags: [], current_step: null, missing_evidence: false },
  ],
}

test.describe('壳层与设置', () => {
  test('设置六页可达，选中态只有背景（无色条）', async ({ page }) => {
    await bootApp(page)

    // 主侧栏选中项：无 inset 色条
    const todayBtn = page.getByRole('button', { name: '今日' })
    await expect(todayBtn).toBeVisible()
    expect(await todayBtn.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none')

    // 打开设置浮层：六页导航
    await page.getByRole('button', { name: '设置' }).click()
    for (const label of ['常规', '提醒与面板', '分类', '标签', '模板', '数据']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible()
    }

    // 选中项（常规）与未选中项（提醒与面板）：背景不同、均无色条
    const sel = page.getByRole('button', { name: '常规', exact: true })
    const un = page.getByRole('button', { name: '提醒与面板', exact: true })
    expect(await sel.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none')
    expect(await un.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none')
    const selBg = await sel.evaluate((el) => getComputedStyle(el).backgroundColor)
    const unBg = await un.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(selBg).not.toBe(unBg)

    // 每页标题可达
    await expect(page.getByRole('heading', { name: '常规' })).toBeVisible()
    for (const [label, heading] of [
      ['提醒与面板', '提醒与面板'],
      ['分类', '分类'],
      ['标签', '标签'],
      ['模板', '模板'],
      ['数据', '数据'],
    ] as const) {
      await page.getByRole('button', { name: label, exact: true }).click()
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    }
  })
})

test.describe('分类独立页', () => {
  test('点侧栏分类进入独立页并只显示该分类内容', async ({ page }) => {
    await bootApp(page, AGENDA_FIXTURES)

    await page.getByRole('button', { name: '工作', exact: true }).click()
    await expect(page.getByRole('heading', { name: '工作' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '今日' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '任务' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '事项' })).toBeVisible()

    // 该分类的内容可见，另一分类的被滤掉
    await expect(page.getByText('工作任务甲').first()).toBeVisible()
    await expect(page.getByText('个人事项乙').first()).toBeHidden()
  })
})

test.describe('toast 禁则', () => {
  test('删除标签的 toast 无彩色左条，图标与文案齐', async ({ page }) => {
    await bootApp(page)

    await page.getByRole('button', { name: '设置' }).click()
    await page.getByRole('button', { name: '标签', exact: true }).click()
    await page.getByRole('button', { name: '删除' }).first().click()

    const toast = page.locator('div[role="status"] > div').filter({ hasText: '已删除' })
    await expect(toast).toBeVisible()
    // 禁则：左边框与右边框一致（旧样式是 3px 彩色左条）
    const [left, right] = await toast.evaluate((el) => {
      const s = getComputedStyle(el)
      return [s.borderLeftWidth, s.borderRightWidth]
    })
    expect(left).toBe(right)
    await expect(toast.getByText('✓')).toBeVisible()

    const deleted = await page.evaluate(() => window.__E2E_STATE__?.deletedTagIds ?? [])
    expect(deleted).toContain(1)
  })
})

test.describe('模板步骤编辑器', () => {
  test('动作按钮横排不断字（挤扁回归）', async ({ page }) => {
    await bootApp(page)

    await page.getByRole('button', { name: '设置' }).click()
    await page.getByRole('button', { name: '模板', exact: true }).click()
    await page.getByText('手测模板', { exact: true }).click()
    await expect(page.getByText('编辑：手测模板')).toBeVisible()

    const up = page.getByRole('button', { name: '上移' }).first()
    const down = page.getByRole('button', { name: '下移' }).first()
    const del = page.getByRole('button', { name: '删除' }).first()
    await expect(up).toBeVisible()

    const [ub, db, xb] = await Promise.all([up.boundingBox(), down.boundingBox(), del.boundingBox()])
    // 同一行（旧病灶：竖排一字一格）
    expect(Math.abs(ub!.y - db!.y)).toBeLessThan(5)
    expect(Math.abs(ub!.y - xb!.y)).toBeLessThan(5)
    // 不折字：两字按钮宽 ≥ 40px、单行高
    for (const b of [ub!, db!, xb!]) {
      expect(b.width).toBeGreaterThanOrEqual(40)
      expect(b.height).toBeLessThanOrEqual(44)
    }

    // 「需要依据」标签不再断成竖排
    const label = page.getByText('需要依据').first()
    const lb = await label.boundingBox()
    expect(lb!.height).toBeLessThanOrEqual(44)
  })
})

test.describe('指标期间文案', () => {
  test('10 月指标卡显示「至 10-31」，不写 11-01', async ({ page }) => {
    const cadence = {
      id: 1,
      title: '月度办结',
      period: 'month',
      target_count: null,
      created_at: '2026-11-01T00:00:00+00:00',
      playbook_ids: [],
      tag_ids: [],
    }
    await bootApp(page, {
      list_cadences: [cadence],
      get_cadence_progress: {
        cadence,
        completed_count: 0,
        matching_matters: [],
        period_start: '2026-10-01',
        period_end: '2026-11-01',
      },
    })
    await page.getByRole('button', { name: '进展' }).click()
    await expect(page.getByText('2026-10-01 至 2026-10-31')).toBeVisible()
    await expect(page.getByText('至 2026-11-01')).toHaveCount(0)
  })
})

test.describe('桌面面板', () => {
  test('缺依据的当前步带角标', async ({ page }) => {
    await bootApp(page, {
      get_desktop_panel_snapshot: {
        today: [
          { kind: 'matter_step', id: 5, title: '依据步', subtitle: '手测事项', due_date: null, priority: 0, matter_id: 1, missing_evidence: true },
        ],
        overdue: [],
        generated_at: '2026-11-03T00:00:00+00:00',
      },
    })
    await page.goto('/panel.html')
    await expect(page.getByText('依据步')).toBeVisible()
    await expect(page.getByText('缺依据')).toBeVisible()
  })
})

test.describe('事项主线推进', () => {
  test('从模板建事项，完成当前步露出下一步（缺依据不拦）', async ({ page }) => {
    await bootApp(page)

    // 从模板建事项
    await page.getByRole('button', { name: '新建', exact: true }).click()
    await page.getByRole('button', { name: '从模板' }).click()
    await page.locator('select').filter({ hasText: '选择流程模板' }).selectOption({ label: '手测模板' })
    await page.getByPlaceholder('事项标题').fill('主线事项')
    await page.getByRole('button', { name: '创建事项' }).click()
    await page.keyboard.press('Escape')

    // 今日露出当前步；依据步缺依据，徽标在
    await expect(page.getByText('依据步')).toBeVisible()
    await expect(page.getByText('缺依据').first()).toBeVisible()

    // 缺依据不拦完成：勾掉当前步 → 下一步顶上
    await page.getByRole('checkbox', { name: '未完成' }).first().click()
    await expect(page.getByText('已完成当前步')).toBeVisible()
    await expect(page.getByText('第二步')).toBeVisible()
    await expect(page.getByText('缺依据')).toHaveCount(0)
  })
})
