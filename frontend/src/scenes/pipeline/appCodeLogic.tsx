import { actions, afterMount, kea, key, path, props, reducers, selectors } from 'kea'
import { loaders } from 'kea-loaders'
import api from 'lib/api'
import { lemonToast } from 'lib/lemon-ui/lemonToast'

import type { appsCodeLogicType } from './appCodeLogicType'

export interface AppCodeProps {
    pluginId: number
}

export const appsCodeLogic = kea<appsCodeLogicType>([
    props({} as AppCodeProps),
    key(({ pluginId }: AppCodeProps) => pluginId),
    path((id) => ['scenes', 'pipeline', 'appsCodeLogic', id]),
    actions({
        setCurrentFile: (currentFile: string) => ({ currentFile }),
        setEditMode: (editMode: boolean) => ({ editMode }),
        updateCode: (fileName: string, code: string) => ({ fileName, code }),
        saveCode: true,
    }),
    loaders(({ values, props, actions }) => ({
        pluginSource: [
            {} as Record<string, string>,
            {
                fetchPluginSource: async () => {
                    const response = await api.get(`api/organizations/@current/plugins/${props.pluginId}/source`)
                    const formattedCode = {}
                    for (const [file, source] of Object.entries(response || {})) {
                        if (source && file.match(/\.(ts|tsx|js|jsx|json)$/)) {
                            try {
                                const prettySource = await formatSource(file, source as string)
                                formattedCode[file] = prettySource
                            } catch (e: any) {
                                formattedCode[file] = source
                            }
                        }
                    }
                    return formattedCode
                },
                updateCode: async ({ fileName, code }) => {
                    return { ...values.pluginSource, [fileName]: code }
                },
                saveCode: async () => {
                    const formattedCode = {}
                    const errors = {}
                    for (const [file, source] of Object.entries(values.pluginSource)) {
                        if (source && file.match(/\.(ts|tsx|js|jsx|json)$/)) {
                            try {
                                const prettySource = await formatSource(file, source)
                                formattedCode[file] = prettySource
                            } catch (e: any) {
                                errors[file] = e.message
                            }
                        }
                    }
                    if (errors) {
                        lemonToast.error(`Errors in your code: ${JSON.stringify(errors)}`)
                        // keep the files that errored as is and formatted versions of the rest
                        return { ...values.pluginSource, ...formattedCode }
                    } else {
                        actions.setEditMode(false)
                        // TODO: this fails not sure why
                        const res = await api.update(
                            `api/organizations/@current/plugins/${props.pluginId}/source`,
                            formattedCode
                        )
                        lemonToast.success('Successfully saved!')
                        return res
                    }
                },
            },
        ],
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
        editMode: [
            false,
            {
                setEditMode: (_, { editMode }) => editMode,
                fetchPluginSource: () => false,
            },
        ],
    }),
    afterMount(({ actions }) => {
        actions.fetchPluginSource()
    }),
])

async function formatSource(filename: string, source: string): Promise<string> {
    if (filename.endsWith('.json')) {
        return JSON.stringify(JSON.parse(source), null, 4) + '\n'
    }

    // Lazy-load prettier, as it's pretty big and its only use is formatting app source code
    // @ts-expect-error
    const prettier = (await import('prettier/standalone')).default
    // @ts-expect-error
    const parserTypeScript = (await import('prettier/parser-typescript')).default

    return prettier.format(source, {
        filepath: filename,
        parser: 'typescript',
        plugins: [parserTypeScript],
        // copied from .prettierrc
        semi: false,
        trailingComma: 'es5',
        singleQuote: true,
        tabWidth: 4,
        printWidth: 120,
    })
}
