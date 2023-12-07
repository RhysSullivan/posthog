import { LemonButton, LemonTabs, Spinner } from '@posthog/lemon-ui'
import { useActions, useValues } from 'kea'
import { CodeEditor } from 'lib/components/CodeEditors'

import { PluginInstallationType } from '~/types'

import { appsCodeLogic } from './appCodeLogic'
import { appsManagementLogic } from './appsManagementLogic'

export function AppCode({
    pluginId,
    pluginType,
}: {
    pluginId: number
    pluginType: PluginInstallationType
}): JSX.Element {
    const logic = appsCodeLogic({ pluginId })
    const { currentFile, fileNames, pluginSource, pluginSourceLoading, editMode } = useValues(logic)
    const { setCurrentFile, updateCode, setEditMode, saveCode, fetchPluginSource } = useActions(logic)
    const { canGloballyManagePlugins } = useValues(appsManagementLogic)

    if (pluginSourceLoading) {
        return <Spinner />
    }

    const canEdit = canGloballyManagePlugins && pluginType === PluginInstallationType.Source
    const formattedFileContent = pluginSource[currentFile]

    const content = (
        <>
            {canEdit && (
                <div className="flex items-center gap-2">
                    {editMode ? (
                        <>
                            <LemonButton
                                type="secondary"
                                onClick={() => {
                                    fetchPluginSource()
                                }}
                            >
                                Reset
                            </LemonButton>
                            <LemonButton
                                type="primary"
                                onClick={() => {
                                    saveCode()
                                }}
                            >
                                Save
                            </LemonButton>
                        </>
                    ) : (
                        <LemonButton type="secondary" onClick={() => setEditMode(true)}>
                            Edit
                        </LemonButton>
                    )}
                </div>
            )}
            <CodeEditor
                // TODO: For some reason the editor doesn't keep the cursor focus and then I can type only one char and need to click again
                path={`${pluginId}/${currentFile}`}
                language={currentFile.endsWith('.json') ? 'json' : 'typescript'}
                value={formattedFileContent}
                onChange={(value) => updateCode(currentFile, value ?? '')}
                options={{
                    minimap: { enabled: false },
                    readOnly: !editMode, // TODO: would it be better to use CodeSnippet for non-source plugins?
                }}
                height={500}
            />
        </>
    )

    return (
        <LemonTabs
            activeKey={currentFile}
            onChange={(filename) => setCurrentFile(filename)}
            tabs={Object.values(fileNames).map((filename) => ({
                label: filename,
                key: filename,
                content: content,
            }))}
        />
    )
}
