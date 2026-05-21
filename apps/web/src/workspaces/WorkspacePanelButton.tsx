import { Menu } from "lucide-react";

export function WorkspacePanelButton() {
  return (
    <button className="icon-button" type="button" aria-label="Open workspace panel">
      <Menu size={20} aria-hidden="true" />
    </button>
  );
}
