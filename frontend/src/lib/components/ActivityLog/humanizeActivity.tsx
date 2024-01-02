import { dayjs } from 'lib/dayjs'
import { fullName } from 'lib/utils'

import { ActivityScope, InsightShortId, PersonType } from '~/types'

export interface ActivityChange {
    type: ActivityScope
    action: 'changed' | 'created' | 'deleted' | 'exported' | 'split'
    field?: string
    before?: string | number | Record<string, any> | boolean | null
    after?: string | number | Record<string, any> | boolean | null
}

export interface PersonMerge {
    type: 'Person'
    source: PersonType[]
    target: PersonType
}

export interface Trigger {
    job_type: string
    job_id: string
    payload: Record<string, any>
}

export interface ActivityLogDetail {
    merge: PersonMerge | null
    trigger: Trigger | null
    changes: ActivityChange[] | null
    name: string | null
    short_id?: InsightShortId | null
    /** e.g. for property definition carries event, person, or group */
    type?: string
}

export interface ActivityUser {
    email: string | null
    first_name: string
    is_system?: boolean
}

export type ActivityLogItem = {
    user?: ActivityUser
    activity: string
    created_at: string
    scope: ActivityScope
    item_id?: string
    detail: ActivityLogDetail
    unread?: boolean // when used as a notification
    is_system?: boolean // when auto-created e.g. an exported image when sharing an insight
}

// the description of a single activity log is a sentence describing one or more changes that makes up the entry
export type Description = string | JSX.Element | null
// the extended description gives extra context, like the insight details card to describe a change to an insight
export type ExtendedDescription = JSX.Element | undefined
export type ChangeMapping = {
    description: Description[] | null
    extendedDescription?: ExtendedDescription
    suffix?: string | JSX.Element | null // to override the default suffix
}
export type HumanizedChange = { description: Description | null; extendedDescription?: ExtendedDescription }

export type HumanizedActivityLogItem = {
    email?: string | null
    name?: string
    isSystem?: boolean
    description: Description
    extendedDescription?: ExtendedDescription // e.g. an insight's filters summary
    created_at: dayjs.Dayjs
    unread?: boolean
}

export type Describer = (logItem: ActivityLogItem, asNotification?: boolean) => HumanizedChange

export function detectBoolean(candidate: unknown): boolean {
    let b: boolean = !!candidate
    if (typeof candidate === 'string') {
        b = candidate.toLowerCase() === 'true'
    }
    return b
}

export function humanize(
    results: ActivityLogItem[],
    describerFor?: (logItem?: ActivityLogItem) => Describer | undefined,
    asNotification?: boolean
): HumanizedActivityLogItem[] {
    const logLines: HumanizedActivityLogItem[] = []

    for (const logItem of results) {
        const describer = describerFor?.(logItem)

        if (!describer) {
            continue
        }
        const { description, extendedDescription } = describer(logItem, asNotification)

        if (description !== null) {
            logLines.push({
                email: logItem.user?.email,
                name: logItem.user ? fullName(logItem.user) : undefined,
                isSystem: logItem.is_system,
                description,
                extendedDescription,
                created_at: dayjs(logItem.created_at),
                unread: logItem.unread,
            })
        }
    }
    return logLines
}

export function userNameForLogItem(logItem: ActivityLogItem): string {
    if (logItem.is_system) {
        return 'PostHog'
    }
    return logItem.user ? fullName(logItem.user) : 'A user'
}

const NO_PLURAL_SCOPES: ActivityScope[] = [
    ActivityScope.DATA_MANAGEMENT,
    ActivityScope.EVENT_DEFINITION,
    ActivityScope.PROPERTY_DEFINITION,
]

export function humanizeScope(scope: ActivityScope, singular = false): string {
    let output = scope.split(/(?=[A-Z])/).join(' ')

    if (!singular && !NO_PLURAL_SCOPES.includes(scope)) {
        output += 's'
    }

    return output
}

export function defaultDescriber(
    logItem: ActivityLogItem,
    asNotification = false,
    resource?: string | JSX.Element
): HumanizedChange {
    resource = resource || logItem.detail.name || `a ${humanizeScope(logItem.scope, true)}`

    if (logItem.activity == 'deleted') {
        return {
            description: (
                <>
                    <strong>{userNameForLogItem(logItem)}</strong> deleted <b>{resource}</b>
                </>
            ),
        }
    }

    if (logItem.activity == 'commented' && logItem.scope === 'Comment') {
        return {
            description: (
                <>
                    <strong>{userNameForLogItem(logItem)}</strong> replied to a {humanizeScope(logItem.scope, true)}
                </>
            ),
        }
    }

    if (logItem.activity == 'commented') {
        return {
            description: (
                <>
                    <strong>{userNameForLogItem(logItem)}</strong> commented
                    {asNotification ? <> on a {humanizeScope(logItem.scope, true)}</> : null}
                </>
            ),
        }
    }

    return { description: null }
}
