import { actions, afterMount, kea, key, path, props, reducers, selectors } from 'kea'
import { loaders } from 'kea-loaders'
import api from 'lib/api'

import { PluginInstallationType } from '~/types'

import type { appsCodeLogicType } from './appCodeLogicType'

export interface AppCodeProps {
    pluginId: number
    pluginType: PluginInstallationType
}

export const appsCodeLogic = kea<appsCodeLogicType>([
    props({} as AppCodeProps),
    key(({ pluginId }: AppCodeProps) => pluginId),
    path((id) => ['scenes', 'pipeline', 'appsCodeLogic', id]),
    actions({
        setCurrentFile: (currentFile: string) => ({ currentFile }),
        updateCode: (fileName: string, code: string) => ({ fileName, code }),
        saveCode: true,
    }),
    loaders(({ values, props }) => ({
        pluginSource: {
            fetchPluginSource: async () => {
                const response = await api.get(`api/organizations/@current/plugins/${props.pluginId}/source`)
                return response ?? {}
            },
            updateCode: async ({ fileName, code }) => {
                return { ...values.pluginSource, [fileName]: code }
            },
            saveCode: async () => {
                // TODO: validate code and format it

                // errors: (values) => ({
                //     'plugin.json': !validateJson(values['plugin.json']) ? 'Not valid JSON' : '',
                // }),
                // preSubmit: async () => {
                //     const changes = {}
                //     const errors = {}
                //     for (const [file, source] of Object.entries(values.pluginSource)) {
                //         if (source && file.match(/\.(ts|tsx|js|jsx|json)$/)) {
                //             try {
                //                 const prettySource = await formatSource(file, source)
                //                 if (prettySource !== source) {
                //                     changes[file] = prettySource
                //                 }
                //             } catch (e: any) {
                //                 errors[file] = e.message
                //             }
                //         }
                //     }
                //     if (Object.keys(changes).length > 0) {
                //         actions.setPluginSourceValues(changes)
                //     }
                //     actions.setPluginSourceManualErrors(errors)
                return await api.update(
                    `api/organizations/@current/plugins/${props.pluginId}/source`,
                    values.pluginSource
                )
            },
        },
    })),
    selectors({
        fileNames: [
            (s) => [s.pluginSource],
            (pluginSource): string[] => {
                return pluginSource ? Object.keys(pluginSource) : []
            },
        ],
    }),
    reducers({
        currentFile: [
            'plugin.json',
            {
                setCurrentFile: (_, { currentFile }) => currentFile,
            },
        ],
    }),
    afterMount(({ actions }) => {
        actions.fetchPluginSource()
    }),
])
