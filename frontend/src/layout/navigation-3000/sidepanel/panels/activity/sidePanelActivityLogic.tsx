import { actions, afterMount, beforeUnmount, connect, kea, listeners, path, reducers, selectors } from 'kea'
import { loaders } from 'kea-loaders'
import { subscriptions } from 'kea-subscriptions'
import api from 'lib/api'
import { describerFor } from 'lib/components/ActivityLog/activityLogLogic'
import { ActivityLogItem, humanize, HumanizedActivityLogItem } from 'lib/components/ActivityLog/humanizeActivity'
import { dayjs } from 'lib/dayjs'
import { LemonMarkdown } from 'lib/lemon-ui/LemonMarkdown'
import { toParams } from 'lib/utils'
import posthog from 'posthog-js'
import { sceneLogic } from 'scenes/sceneLogic'
import { SceneConfig } from 'scenes/sceneTypes'
import { teamLogic } from 'scenes/teamLogic'

import { ActivityScope, UserBasicType } from '~/types'

import type { sidePanelActivityLogicType } from './sidePanelActivityLogicType'

const POLL_TIMEOUT = 5 * 60 * 1000

export interface ChangelogFlagPayload {
    notificationDate: dayjs.Dayjs
    markdown: string
}

export interface ChangesResponse {
    results: ActivityLogItem[]
    next: string | null
    last_read: string
}

export enum SidePanelActivityTab {
    Unread = 'unread',
    All = 'all',
}

export type ActivityFilters = {
    scope?: ActivityScope
    item_id?: ActivityLogItem['item_id']
    user?: UserBasicType['id']
}

const activityFiltersForScene = (sceneConfig: SceneConfig | null): ActivityFilters | null => {
    if (sceneConfig?.activityScope) {
        return { scope: sceneConfig.activityScope }
    }
    return null
}

export const sidePanelActivityLogic = kea<sidePanelActivityLogicType>([
    path(['scenes', 'navigation', 'sidepanel', 'sidePanelActivityLogic']),
    connect({
        values: [sceneLogic, ['sceneConfig']],
    }),
    actions({
        togglePolling: (pageIsVisible: boolean) => ({ pageIsVisible }),
        incrementErrorCount: true,
        clearErrorCount: true,
        markAllAsRead: true,
        setActiveTab: (tab: SidePanelActivityTab) => ({ tab }),
        loadAllActivity: true,
        loadOlderActivity: true,
        maybeLoadOlderActivity: true,
        loadImportantChanges: (onlyUnread = true) => ({ onlyUnread }),
        setFilters: (filters: ActivityFilters | null) => ({ filters }),
    }),
    reducers({
        activeTab: [
            SidePanelActivityTab.Unread as SidePanelActivityTab,
            {
                setActiveTab: (_, { tab }) => tab,
            },
        ],
        errorCounter: [
            0,
            {
                incrementErrorCount: (state) => (state >= 5 ? 5 : state + 1),
                clearErrorCount: () => 0,
            },
        ],
        filters: [
            null as ActivityFilters | null,
            {
                setFilters: (_, { filters }) => filters,
            },
        ],
    }),
    loaders(({ actions, values, cache }) => ({
        importantChanges: [
            null as ChangesResponse | null,
            {
                markAllAsRead: async () => {
                    const current = values.importantChanges
                    if (!current) {
                        return null
                    }

                    const latestNotification = values.notifications.reduce((a, b) =>
                        a.created_at.isAfter(b.created_at) ? a : b
                    )

                    if (!latestNotification.unread) {
                        return current
                    }

                    await api.create(
                        `api/projects/${teamLogic.values.currentTeamId}/activity_log/bookmark_activity_notification`,
                        {
                            bookmark: latestNotification.created_at.toISOString(),
                        }
                    )

                    return {
                        last_read: latestNotification.created_at.toISOString(),
                        next: current.next,
                        results: current.results.map((ic) => ({ ...ic, unread: false })),
                    }
                },
                loadImportantChanges: async ({ onlyUnread }, breakpoint) => {
                    await breakpoint(1)

                    clearTimeout(cache.pollTimeout)

                    try {
                        const response = await api.get<ChangesResponse>(
                            `api/projects/${teamLogic.values.currentTeamId}/activity_log/important_changes?` +
                                toParams({ unread: onlyUnread })
                        )

                        // we can't rely on automatic success action here because we swallow errors so always succeed
                        actions.clearErrorCount()
                        return response
                    } catch (e) {
                        // swallow errors as this isn't user initiated
                        // increment a counter to backoff calling the API while errors persist
                        actions.incrementErrorCount()
                        return null
                    } finally {
                        const pollTimeoutMilliseconds = values.errorCounter
                            ? POLL_TIMEOUT * values.errorCounter
                            : POLL_TIMEOUT
                        cache.pollTimeout = window.setTimeout(actions.loadImportantChanges, pollTimeoutMilliseconds)
                    }
                },
            },
        ],
        allActivityResponse: [
            null as ChangesResponse | null,
            {
                loadAllActivity: async (_, breakpoint) => {
                    const response = await api.get<ChangesResponse>(
                        `api/projects/${teamLogic.values.currentTeamId}/activity_log?` + toParams(values.filters ?? {})
                    )
                    breakpoint()
                    return response
                },

                loadOlderActivity: async (_, breakpoint) => {
                    await breakpoint(1)

                    if (!values.allActivityResponse?.next) {
                        return values.allActivityResponse
                    }

                    const response = await api.get<ChangesResponse>(values.allActivityResponse.next)

                    response.results = [...values.allActivityResponse.results, ...response.results]

                    return response
                },
            },
        ],
    })),

    listeners(({ values, actions }) => ({
        setActiveTab: ({ tab }) => {
            if (tab === SidePanelActivityTab.All && !values.allActivityResponseLoading) {
                actions.loadAllActivity()
            }
        },

        maybeLoadOlderActivity: () => {
            if (!values.allActivityResponseLoading && values.allActivityResponse?.next) {
                actions.loadOlderActivity()
            }
        },

        setFilters: () => {
            if (values.activeTab === SidePanelActivityTab.All) {
                actions.loadAllActivity()
            }
        },
    })),
    selectors({
        allActivity: [
            (s) => [s.allActivityResponse],
            (allActivityResponse): HumanizedActivityLogItem[] => {
                return humanize(allActivityResponse?.results || [], describerFor, true)
            },
        ],
        allActivityHasNext: [(s) => [s.allActivityResponse], (allActivityResponse) => !!allActivityResponse?.next],
        notifications: [
            (s) => [s.importantChanges],
            (importantChanges): HumanizedActivityLogItem[] => {
                try {
                    const importantChangesHumanized = humanize(importantChanges?.results || [], describerFor, true)

                    let changelogNotification: ChangelogFlagPayload | null = null
                    const flagPayload = posthog.getFeatureFlagPayload('changelog-notification')
                    if (flagPayload) {
                        changelogNotification = {
                            markdown: flagPayload['markdown'],
                            notificationDate: dayjs(flagPayload['notificationDate']),
                        } as ChangelogFlagPayload
                    }

                    if (changelogNotification) {
                        const lastRead = importantChanges?.last_read ? dayjs(importantChanges.last_read) : null
                        const changeLogIsUnread =
                            !!lastRead &&
                            (lastRead.isBefore(changelogNotification.notificationDate) ||
                                lastRead == changelogNotification.notificationDate)

                        const changelogNotificationHumanized: HumanizedActivityLogItem = {
                            email: 'joe@posthog.com',
                            name: 'Joe',
                            isSystem: true,
                            description: <LemonMarkdown>{changelogNotification.markdown}</LemonMarkdown>,
                            created_at: changelogNotification.notificationDate,
                            unread: changeLogIsUnread,
                        }
                        const notifications = [changelogNotificationHumanized, ...importantChangesHumanized]
                        notifications.sort((a, b) => {
                            if (a.created_at.isBefore(b.created_at)) {
                                return 1
                            } else if (a.created_at.isAfter(b.created_at)) {
                                return -1
                            } else {
                                return 0
                            }
                        })
                        return notifications
                    }

                    return humanize(importantChanges?.results || [], describerFor, true)
                } catch (e) {
                    // swallow errors as this isn't user initiated
                    return []
                }
            },
        ],

        hasNotifications: [(s) => [s.notifications], (notifications) => !!notifications.length],
        unread: [
            (s) => [s.notifications],
            (notifications: HumanizedActivityLogItem[]) => notifications.filter((ic) => ic.unread),
        ],
        unreadCount: [(s) => [s.unread], (unread) => (unread || []).length],
        hasUnread: [(s) => [s.unreadCount], (unreadCount) => unreadCount > 0],
    }),

    subscriptions(({ actions, values }) => ({
        sceneConfig: (sceneConfig) => {
            // TODO: Parse sceneConfig into scope and item_id
            const filters = activityFiltersForScene(sceneConfig)
            if (sceneConfig?.activityScope) {
                actions.setFilters({ ...values.filters, ...filters })
            }
        },
    })),

    afterMount(({ actions, values }) => {
        actions.loadImportantChanges()

        const sceneConfig = values.sceneConfig
        const filters = activityFiltersForScene(sceneConfig)
        if (sceneConfig?.activityScope) {
            actions.setFilters({ ...values.filters, ...filters })
        }

        if (values.sceneConfig?.activityScope) {
            actions.setFilters({ ...values.filters, scope: values.sceneConfig.activityScope })
        }
    }),

    beforeUnmount(({ cache }) => {
        clearTimeout(cache.pollTimeout)
    }),
])
