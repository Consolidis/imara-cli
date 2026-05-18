import { ToolDefinition, ToolArguments, AgentProxy } from '../agent.types';
import { Result, ok, err } from '../../types/result';
import { ImaraError, fromUnknown, ErrorCategory } from '../../types/errors';
import { TrackManager } from '../../context/conductor/track-manager';
import * as path from 'path';
import { ReadFileTool } from './read-file.tool';
import { WriteFileTool } from './write-file.tool';
import { AppendFileTool } from './append-file.tool';
import { ListDirectoryTool } from './list-directory.tool';
import { RunCommandTool } from './run-command.tool';
import { SearchFilesTool } from './search-files.tool';
import { ReadMultipleFilesTool } from './read-multiple-files.tool';
import { WebSearchTool } from './web-search.tool';
import { ReplaceInFileTool } from './replace-in-file.tool';
import { ReadFileRangeTool } from './read-file-range.tool';
import { InspectFileTool } from './inspect-file.tool';
import { CodeMapTool } from './code-map.tool';
import { GitDiffTool } from './git-diff.tool';
import { ClearContextTool } from './clear-context.tool';
import { ConductorCreateTrackTool } from './conductor-create-track.tool';
import { ConductorUpdatePlanTool } from './conductor-update-plan.tool';
import { ConductorArchiveTrackTool } from './conductor-archive-track.tool';
import { ConductorValidatePlanTool } from './conductor-validate-plan.tool';

export const TOOLS_DEFINITIONS: ToolDefinition[] = [
  ReadFileTool.definition, WriteFileTool.definition, AppendFileTool.definition,
  ListDirectoryTool.definition, RunCommandTool.definition, SearchFilesTool.definition,
  ReadMultipleFilesTool.definition, WebSearchTool.definition, ReplaceInFileTool.definition,
  ReadFileRangeTool.definition, InspectFileTool.definition, CodeMapTool.definition,
  GitDiffTool.definition, ClearContextTool.definition, ConductorCreateTrackTool.definition,
  ConductorUpdatePlanTool.definition, ConductorArchiveTrackTool.definition,
  ConductorValidatePlanTool.definition
];

export class ToolExecutor {
  static async execute(name: string, args: ToolArguments, agent?: AgentProxy): Promise<Result<string, ImaraError>> {
    const guard = this.guardConductor(name, args);
    if (!guard.ok) return guard;

    try {
      switch (name) {
        case 'read_file':
          return ok(await ReadFileTool.run(args as { path: string }));
        case 'write_file':
          return ok(await WriteFileTool.run(args as { path: string; content: string }));
        case 'append_file':
          return ok(await AppendFileTool.run(args as { path: string; content: string }));
        case 'list_directory':
          return ok(await ListDirectoryTool.run(args as { path?: string; recursive?: boolean }));
        case 'run_command':
          return ok(await RunCommandTool.run(args as { command: string; cwd?: string }));
        case 'search_files':
          return ok(await SearchFilesTool.run(args as { pattern: string; filePattern?: string }));
        case 'read_multiple_files':
          return ok(await ReadMultipleFilesTool.run(args as { paths: string[] }));
        case 'web_search':
          return ok(await WebSearchTool.run(args as { query: string }));
        case 'replace_in_file':
          return ok(await ReplaceInFileTool.run(args as { path: string; old_text: string; new_text: string }));
        case 'read_file_range':
          return ok(await ReadFileRangeTool.run(args as { path: string; start_line?: number; end_line: number }));
        case 'inspect_file':
          return ok(await InspectFileTool.run(args as { path: string; query?: string }));
        case 'code_map':
          return ok(await CodeMapTool.run(args as { path: string }));
        case 'git_diff':
          return ok(await GitDiffTool.run(args as { path?: string }));
        case 'clear_context':
          return ok(await ClearContextTool.run(args as { reason?: string }, agent));
        case 'conductor_create_track':
          return ok(await ConductorCreateTrackTool.run(args as { title: string }));
        case 'conductor_update_plan':
          return ok(await ConductorUpdatePlanTool.run(args as { taskName: string; status: 'todo' | 'in_progress' | 'done' }));
        case 'conductor_archive_track':
          return ok(await ConductorArchiveTrackTool.run(args as { reason?: string }));
        case 'conductor_validate_plan':
          return ok(await ConductorValidatePlanTool.run(args as { confirmation: boolean }));
        default:
          return err(new ImaraError(ErrorCategory.UNKNOWN, 'TOOL_UNKNOWN', `Tool inconnu: ${name}`));
      }
    } catch (reason) {
      return err(fromUnknown(reason));
    }
  }

  private static guardConductor(name: string, args?: ToolArguments): Result<void, ImaraError> {
    const dangerous = new Set(['write_file', 'append_file', 'replace_in_file', 'run_command']);
    const track = TrackManager.getActive();

    // Exemption : meta-fichiers Conductor (spec, plan, log du track actif)
    const targetPath = typeof args?.path === 'string' ? args.path : '';
    if (targetPath) {
      const absTarget = path.resolve(process.cwd(), targetPath);
      const absConductor = path.resolve(TrackManager.getConductorDir());
      if (absTarget.startsWith(absConductor)) {
        return ok(undefined);
      }
    }

    if (track && !track.validated && dangerous.has(name)) {
      return err(new ImaraError(ErrorCategory.CONDUCTOR, 'TRACK_NOT_VALIDATED', `BARRIÈRE CONDUCTOR : "${name}" bloqué — plan du track non validé.`));
    }
    return ok(undefined);
  }
}
