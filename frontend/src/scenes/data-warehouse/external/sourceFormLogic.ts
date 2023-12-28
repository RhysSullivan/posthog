import { lemonToast } from '@posthog/lemon-ui'
import { actions, connect, kea, listeners, path, props } from 'kea'
import { forms } from 'kea-forms'
import { router } from 'kea-router'
import api from 'lib/api'
import { urls } from 'scenes/urls'

import { ExternalDataSourceCreatePayload, ExternalDataSourceType } from '~/types'

import type { sourceFormLogicType } from './sourceFormLogicType'
import { sourceModalLogic } from './sourceModalLogic'

export interface SourceFormProps {
    sourceType: ExternalDataSourceType
}

const getPayloadDefaults = (sourceType: string): Record<string, any> => {
    switch (sourceType) {
        case 'Stripe':
            return {
                account_id: '',
                client_secret: '',
            }
        default:
            return {}
    }
}

const getErrorsDefaults = (sourceType: string): ((args: Record<string, any>) => Record<string, any>) => {
    switch (sourceType) {
        case 'Stripe':
            return ({ payload }) => ({
                payload: {
                    account_id: !payload.account_id && 'Please enter an account id.',
                    client_secret: !payload.client_secret && 'Please enter a client secret.',
                },
            })
        default:
            return () => ({})
    }
}

export const sourceFormLogic = kea<sourceFormLogicType>([
    path(['scenes', 'data-warehouse', 'external', 'sourceFormLogic']),
    props({} as SourceFormProps),
    connect({
        actions: [sourceModalLogic, ['onClear', 'toggleSourceModal', 'loadSources']],
    }),
    actions({
        onBack: true,
    }),
    listeners(({ actions }) => ({
        onBack: () => {
            actions.resetExternalDataSource()
            actions.onClear()
        },
        submitExternalDataSourceSuccess: () => {
            lemonToast.success('New Data Resource Created')
            actions.toggleSourceModal()
            actions.resetExternalDataSource()
            actions.loadSources()
            router.actions.push(urls.dataWarehouseSettings())
        },
        submitExternalDataSourceFailure: ({ error }) => {
            lemonToast.error(error?.message || 'Something went wrong')
        },
    })),
    forms(({ props }) => ({
        externalDataSource: {
            defaults: {
                prefix: '',
                source_type: props.sourceType,
                payload: getPayloadDefaults(props.sourceType),
            } as ExternalDataSourceCreatePayload,
            errors: getErrorsDefaults(props.sourceType),
            submit: async (payload: ExternalDataSourceCreatePayload) => {
                const newResource = await api.externalDataSources.create(payload)
                return newResource
            },
        },
    })),
])
