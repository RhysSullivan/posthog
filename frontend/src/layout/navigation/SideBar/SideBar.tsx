import { DebugNotice } from 'lib/components/DebugNotice'
import { NotebookPopover } from 'scenes/notebooks/NotebookPanel/NotebookPopover'

export function SideBar(): JSX.Element {
    return (
        <div>
            <DebugNotice />
            <NotebookPopover />
        </div>
    )
}
