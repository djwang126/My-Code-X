import { listWorkspaceFiles } from './workspace-list-files.js';
import { readWorkspaceFile, readWorkspaceFileContent } from './workspace-read-file.js';
import { saveWorkspaceFile } from './workspace-save-file.js';
export function createWorkspaceFilesService() {
    return {
        listFiles: listWorkspaceFiles,
        readFile: readWorkspaceFile,
        readFileContent: readWorkspaceFileContent,
        saveFile: saveWorkspaceFile,
    };
}
//# sourceMappingURL=workspace-files.service.js.map