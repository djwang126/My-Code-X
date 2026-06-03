import { FolderOpen } from "lucide-react";

export function WorkspacePanelButton() {
  return (
    <button className="icon-button" type="button" aria-label="Open workspace panel">
      <FolderOpen size={20} aria-hidden="true" />
    </button>
  );
}
