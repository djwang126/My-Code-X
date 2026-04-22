import fs from 'node:fs';
import path from 'node:path';

export const REAL_RESUME_FIXTURE_THREAD_ID = '019d28cc-1dec-7d00-a19d-aab3d2cbc1dd';

const fixtureRelativePath = path.join(
  'sessions',
  '2026',
  '03',
  '26',
  `rollout-2026-03-26T14-19-18-${REAL_RESUME_FIXTURE_THREAD_ID}.jsonl`,
);

function createFixtureJsonl() {
  const lines = [
    {
      timestamp: '2026-03-26T06:19:27.566Z',
      type: 'session_meta',
      payload: {
        id: REAL_RESUME_FIXTURE_THREAD_ID,
        timestamp: '2026-03-26T06:19:18.898Z',
        cwd: 'D:\\workspace\\example-app',
        originator: 'codex_vscode',
        cli_version: '0.116.0',
        source: 'vscode',
        model_provider: 'openai',
        base_instructions: {
          text: 'You are a cute cat',
        },
      },
    },
    {
      timestamp: '2026-03-26T06:19:27.567Z',
      type: 'event_msg',
      payload: {
        type: 'task_started',
        turn_id: '019d28cc-1e0a-7b51-b0ff-920c85f2316a',
        model_context_window: 258400,
        collaboration_mode_kind: 'default',
      },
    },
    {
      timestamp: '2026-03-26T06:19:27.568Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'developer',
        content: [
          {
            type: 'input_text',
            text:
              '<permissions instructions>\nFilesystem sandboxing defines which files can be read or written. `sandbox_mode` is `workspace-write`: The sandbox permits reading files, and editing files in `cwd` and `writable_roots`. Editing files in other directories requires approval. Network access is restricted.\nApproval policy is currently never. Do not provide the `sandbox_permissions` for any reason, commands will be rejected.\r\n The writable roots are `C:\\Users\\example\\.codex\\memories`, `D:\\workspace\\example-app`.\n</permissions instructions>',
          },
          {
            type: 'input_text',
            text:
              '<skills_instructions>\n## Skills\nA skill is a set of local instructions to follow that is stored in a `SKILL.md` file. Below is the list of skills that can be used. Each entry includes a name, description, and file path so you can open the source for full instructions when using a specific skill.\n### Available skills\n- doc: Use when the task involves reading, creating, or editing `.docx` documents, especially when formatting or layout fidelity matters; prefer `python-docx` plus the bundled `scripts/render_docx.py` for visual checks. (file: C:/Users/example/.codex/skills/doc/SKILL.md)\n- pdf: Use when tasks involve reading, creating, or reviewing PDF files where rendering and layout matter; prefer visual checks by rendering pages (Poppler) and use Python tools such as `reportlab`, `pdfplumber`, and `pypdf` for generation and extraction. (file: C:/Users/example/.codex/skills/pdf/SKILL.md)\n- playwright: Use when the task requires automating a real browser from the terminal (navigation, form filling, snapshots, screenshots, data extraction, UI-flow debugging) via `playwright-cli` or the bundled wrapper script. (file: C:/Users/example/.codex/skills/playwright/SKILL.md)\n- skill-creator: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Codex\'s capabilities with specialized knowledge, workflows, or tool integrations. (file: C:/Users/example/.codex/skills/.system/skill-creator/SKILL.md)\n### How to use skills\n- Discovery: The list above is the skills available in this session (name + description + file path). Skill bodies live on disk at the listed paths.\n- Trigger rules: If the user names a skill (with `$SkillName` or plain text) OR the task clearly matches a skill\'s description shown above, you must use that skill for that turn. Multiple mentions mean use them all. Do not carry skills across turns unless re-mentioned.\n- Missing/blocked: If a named skill isn\'t in the list or the path can\'t be read, say so briefly and continue with the best fallback.\n- How to use a skill (progressive disclosure):\n  1) After deciding to use a skill, open its `SKILL.md`. Read only enough to follow the workflow.\n  2) When `SKILL.md` references relative paths (e.g., `scripts/foo.py`), resolve them relative to the skill directory listed above first, and only consider other paths if needed.\n  3) If `SKILL.md` points to extra folders such as `references/`, load only the specific files needed for the request; don\'t bulk-load everything.\n  4) If `scripts/` exist, prefer running or patching them instead of retyping large code blocks.\n  5) If `assets/` or templates exist, reuse them instead of recreating from scratch.\n- Coordination and sequencing:\n  - If multiple skills apply, choose the minimal set that covers the request and state the order you\'ll use them.\n  - Announce which skill(s) you\'re using and why (one short line). If you skip an obvious skill, say why.\n- Context hygiene:\n  - Keep context small: summarize long sections instead of pasting them; only load extra files when needed.\n  - Avoid deep reference-chasing: prefer opening only files directly linked from `SKILL.md` unless you\'re blocked.\n  - When variants exist (frameworks, providers, domains), pick only the relevant reference file(s) and note that choice.\n- Safety and fallback: If a skill can\'t be applied cleanly (missing files, unclear instructions), state the issue, pick the next-best approach, and continue.\n</skills_instructions>',
          },
        ],
      },
    },
    {
      timestamp: '2026-03-26T06:19:27.568Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text:
              '<environment_context>\n  <cwd>D:\\workspace\\example-app</cwd>\n  <shell>powershell</shell>\n  <current_date>2026-03-26</current_date>\n  <timezone>Asia/Shanghai</timezone>\n</environment_context>',
          },
        ],
      },
    },
    {
      timestamp: '2026-03-26T06:19:27.568Z',
      type: 'turn_context',
      payload: {
        turn_id: '019d28cc-1e0a-7b51-b0ff-920c85f2316a',
        cwd: 'D:\\workspace\\example-app',
        current_date: '2026-03-26',
        timezone: 'Asia/Shanghai',
        approval_policy: 'never',
        sandbox_policy: {
          type: 'workspace-write',
          writable_roots: ['C:\\Users\\example\\.codex\\memories'],
          network_access: false,
          exclude_tmpdir_env_var: false,
          exclude_slash_tmp: false,
        },
        model: 'gpt-5.4',
        personality: 'pragmatic',
        collaboration_mode: {
          mode: 'default',
          settings: {
            model: 'gpt-5.4',
            reasoning_effort: 'medium',
            developer_instructions: null,
          },
        },
        realtime_active: false,
        effort: 'medium',
        summary: 'none',
        truncation_policy: {
          mode: 'tokens',
          limit: 10000,
        },
      },
    },
    {
      timestamp: '2026-03-26T06:19:27.569Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'hi',
          },
        ],
      },
    },
    {
      timestamp: '2026-03-26T06:19:27.570Z',
      type: 'event_msg',
      payload: {
        type: 'user_message',
        message: 'hi',
        images: [],
        local_images: [],
        text_elements: [],
      },
    },
    {
      timestamp: '2026-03-26T06:19:28.080Z',
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: null,
        rate_limits: {
          limit_id: 'codex',
          limit_name: null,
          primary: {
            used_percent: 32,
            window_minutes: 300,
            resets_at: 1774517443,
          },
          secondary: {
            used_percent: 30,
            window_minutes: 10080,
            resets_at: 1775053128,
          },
          credits: null,
          plan_type: 'team',
        },
      },
    },
    {
      timestamp: '2026-03-26T06:19:32.620Z',
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        message: 'Hi! 😸 How can I help?',
        phase: 'final_answer',
        memory_citation: null,
      },
    },
    {
      timestamp: '2026-03-26T06:19:32.621Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: 'Hi! 😸 How can I help?',
          },
        ],
        phase: 'final_answer',
      },
    },
    {
      timestamp: '2026-03-26T06:19:32.621Z',
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          total_token_usage: {
            input_tokens: 7505,
            cached_input_tokens: 2432,
            output_tokens: 13,
            reasoning_output_tokens: 0,
            total_tokens: 7518,
          },
          last_token_usage: {
            input_tokens: 7505,
            cached_input_tokens: 2432,
            output_tokens: 13,
            reasoning_output_tokens: 0,
            total_tokens: 7518,
          },
          model_context_window: 258400,
        },
        rate_limits: {
          limit_id: 'codex',
          limit_name: null,
          primary: {
            used_percent: 32,
            window_minutes: 300,
            resets_at: 1774517443,
          },
          secondary: {
            used_percent: 30,
            window_minutes: 10080,
            resets_at: 1775053128,
          },
          credits: null,
          plan_type: 'team',
        },
      },
    },
    {
      timestamp: '2026-03-26T06:19:32.622Z',
      type: 'event_msg',
      payload: {
        type: 'task_complete',
        turn_id: '019d28cc-1e0a-7b51-b0ff-920c85f2316a',
        last_agent_message: 'Hi! 😸 How can I help?',
      },
    },
  ];

  return `${lines.map(line => JSON.stringify(line)).join('\n')}\n`;
}

export function prepareRealResumeFixture(codexHome: string) {
  const sessionPath = path.join(codexHome, fixtureRelativePath);
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(path.join(codexHome, 'config.toml'), 'personality = "pragmatic"\n', 'utf8');
  fs.writeFileSync(sessionPath, createFixtureJsonl(), 'utf8');
}
