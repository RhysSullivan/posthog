import { LemonTabs } from '@posthog/lemon-ui'
import { useActions, useValues } from 'kea'
import { CodeEditor } from 'lib/components/CodeEditors'

import { appsCodeLogic } from './appCodeLogic'

export function AppCode({ pluginId }: { pluginId: number }): JSX.Element {
    const logic = appsCodeLogic({ pluginId })
    const { currentFile, fileNames, pluginSource } = useValues(logic)
    const { setCurrentFile, updateCode } = useActions(logic)

    // Edit and save buttons at the top level

    return (
        <LemonTabs
            activeKey={currentFile}
            onChange={(filename) => setCurrentFile(filename)}
            tabs={Object.values(fileNames).map((filename) => ({
                label: filename,
                key: filename,
                content: (
                    <CodeEditor
                        path={currentFile}
                        language={currentFile.endsWith('.json') ? 'json' : 'typescript'}
                        value={pluginSource[filename] ?? ''}
                        onChange={(value) => updateCode(filename, value ?? '')}
                        height={700}
                        options={{
                            minimap: { enabled: false },
                            readOnly: true, // TODO: how to distinguish source apps that can be edited vs those that can't
                        }}
                    />
                ),
            }))}
        />
    )
}
