import type { ChangeEvent } from 'react';

import { getOfficialModelContextWindowMax, type RuntimeSettings } from '../../runtime-settings';

type SelectOption = {
  value: string;
  label: string;
};

type RuntimeSettingsDrawerProps = {
  open: boolean;
  runtimeSettings: RuntimeSettings | null;
  modelOptions: SelectOption[];
  collaborationModeOptions: SelectOption[];
  reasoningEffortOptions: SelectOption[];
  reasoningSummaryOptions: SelectOption[];
  promptOverrideOptions: SelectOption[];
  approvalPolicyOptions: SelectOption[];
  sandboxModeOptions: SelectOption[];
  onRuntimeSettingChange: <K extends keyof RuntimeSettings>(key: K, value: RuntimeSettings[K]) => void;
};

export function RuntimeSettingsDrawer({
  open,
  runtimeSettings,
  modelOptions,
  collaborationModeOptions,
  reasoningEffortOptions,
  reasoningSummaryOptions,
  promptOverrideOptions,
  approvalPolicyOptions,
  sandboxModeOptions,
  onRuntimeSettingChange,
}: RuntimeSettingsDrawerProps) {
  if (!runtimeSettings) {
    return null;
  }

  function readNextIntegerValue(event: ChangeEvent<HTMLInputElement>, currentValue: number | null | undefined): number | null {
    if (!event.target.value) {
      return null;
    }

    const parsed = Number.parseInt(event.target.value, 10);
    return Number.isNaN(parsed) ? (currentValue ?? null) : parsed;
  }

  const officialModelContextWindowMax = getOfficialModelContextWindowMax(runtimeSettings.model);
  const contextWindowMaxPlaceholder = officialModelContextWindowMax ? `max: ${officialModelContextWindowMax}` : '';

  return (
    <div aria-label="runtime settings" className={`settings-drawer ${open ? 'open' : ''}`}>
      <div className="settings-group">
        <span className="settings-label">Model</span>
        <select className="settings-select" aria-label="Model" onChange={event => onRuntimeSettingChange('model', event.target.value as RuntimeSettings['model'])} value={runtimeSettings.model}>
          {modelOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="settings-group">
        <span className="settings-label">Mode</span>
        <select className="settings-select" aria-label="Mode" onChange={event => onRuntimeSettingChange('collaborationModeKind', (event.target.value || null) as RuntimeSettings['collaborationModeKind'])} value={runtimeSettings.collaborationModeKind ?? ''}>
          {collaborationModeOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="settings-group">
        <span className="settings-label">Approval</span>
        <select className="settings-select" aria-label="Approval policy" onChange={event => onRuntimeSettingChange('approvalPolicy', event.target.value as RuntimeSettings['approvalPolicy'])} value={runtimeSettings.approvalPolicy}>
          {approvalPolicyOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="settings-group">
        <span className="settings-label">Sandbox</span>
        <select className="settings-select" aria-label="Sandbox mode" onChange={event => onRuntimeSettingChange('sandboxMode', event.target.value as RuntimeSettings['sandboxMode'])} value={runtimeSettings.sandboxMode}>
          {sandboxModeOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="settings-group">
        <span className="settings-label">Reasoning effort</span>
        <select className="settings-select" aria-label="Reasoning effort" onChange={event => onRuntimeSettingChange('reasoningEffort', event.target.value as RuntimeSettings['reasoningEffort'])} value={runtimeSettings.reasoningEffort ?? ''}>
          {reasoningEffortOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="settings-group">
        <span className="settings-label">Reasoning summary</span>
        <select className="settings-select" aria-label="Reasoning summary" onChange={event => onRuntimeSettingChange('reasoningSummary', event.target.value as RuntimeSettings['reasoningSummary'])} value={runtimeSettings.reasoningSummary ?? ''}>
          {reasoningSummaryOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="settings-group">
        <span className="settings-label">Prompt override</span>
        <select className="settings-select" aria-label="Prompt override" onChange={event => onRuntimeSettingChange('promptOverride', (event.target.value || null) as RuntimeSettings['promptOverride'])} value={runtimeSettings.promptOverride ?? ''}>
          <option value="">None</option>
          {promptOverrideOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="settings-group">
        <span className="settings-label">Context window</span>
        <input
          aria-label="Model context window"
          className="settings-input"
          inputMode="numeric"
          min={1}
          onChange={event => onRuntimeSettingChange('modelContextWindow', readNextIntegerValue(event, runtimeSettings.modelContextWindow) as RuntimeSettings['modelContextWindow'])}
          placeholder={contextWindowMaxPlaceholder}
          step={1}
          type="number"
          value={runtimeSettings.modelContextWindow ?? ''}
        />
      </div>
    </div>
  );
}
