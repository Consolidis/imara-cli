import { ToolDefinition, ToolArguments, AgentProxy } from '../agent.types';
import { Result, ok, err } from '../../types/result';
import { ImaraError, fromUnknown, ErrorCategory } from '../../types/errors';
import { TrackManager } from '../../context/conductor/track-manager';
import { toolCache } from '../../cache/tool-cache';
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
import { SmartReadTool } from './smart-read.tool';
import { WorkspaceIndexTool } from './workspace-index.tool';
import { BatchReplaceTool } from './batch-replace.tool';
import { DiffPreviewTool } from './diff-preview.tool';
import { ProjectSummaryTool } from './project-summary.tool';
import { GitCommitTool } from './git-commit.tool';

// Outils "purs" (lecture seule) dont les résultats sont mis en cache (TTL 30s)
const CACHED_TOOLS = new Set([
  'read_file', 'read_file_range', 'inspect_file', 'code_map',
  'git_diff', 'list_directory'
]);

export const TOOLS_DEFINITIONS: ToolDefinition[] = [
  ReadFileTool.definition, WriteFileTool.definition, AppendFileTool.definition,
  ListDirectoryTool.definition, RunCommandTool.definition, SearchFilesTool.definition,
  ReadMultipleFilesTool.definition, WebSearchTool.definition, ReplaceInFileTool.definition,
  ReadFileRangeTool.definition, InspectFileTool.definition, CodeMapTool.definition,
  GitDiffTool.definition, ClearContextTool.definition, ConductorCreateTrackTool.definition,
  ConductorUpdatePlanTool.definition, ConductorArchiveTrackTool.definition,
  ConductorValidatePlanTool.definition, SmartReadTool.definition,
  WorkspaceIndexTool.definition, BatchReplaceTool.definition,
  DiffPreviewTool.definition, ProjectSummaryTool.definition,
  GitCommitTool.definition
];

export class ToolExecutor {
  static async execute(name: string, args: ToolArguments, agent?: AgentProxy): Promise<Result<string, ImaraError>> {
    const guard = this.guardConductor(name, args);
    if (!guard.ok) return guard;

    // Vérification du cache pour les outils read-only
    if (CACHED_TOOLS.has(name)) {
      const cacheKey = toolCache.makeKey(name, args);
      const cached = toolCache.get(cacheKey);
      if (cached !== null) {
        return ok(cached);
      }
    }

    try {
      let result: string;
      switch (name) {
        case 'read_file':
          result = await ReadFileTool.run(args as { path: string });
          break;
        case 'write_file':
          result = await WriteFileTool.run(args as { path: string; content: string });
          toolCache.invalidatePath((args as { path: string }).path);
          break;
        case 'append_file':
          result = await AppendFileTool.run(args as { path: string; content: string });
          toolCache.invalidatePath((args as { path: string }).path);
          break;
        case 'list_directory':
          result = await ListDirectoryTool.run(args as { path?: string; recursive?: boolean });
          break;
        case 'run_command':
          result = await RunCommandTool.run(args as { command: string; cwd?: string });
          toolCache.clear(); // On ne sait pas ce que run_command modifie, purge totale
          break;
        case 'search_files':
          result = await SearchFilesTool.run(args as { pattern: string; filePattern?: string });
          break;
        case 'read_multiple_files':
          result = await ReadMultipleFilesTool.run(args as { paths: string[] });
          break;
        case 'web_search':
          result = await WebSearchTool.run(args as { query: string });
          break;
        case 'replace_in_file':
          result = await ReplaceInFileTool.run(args as { path: string; old_text: string; new_text: string });
          toolCache.invalidatePath((args as { path: string }).path);
          break;
        case 'read_file_range':
          result = await ReadFileRangeTool.run(args as { path: string; start_line?: number; end_line: number });
          break;
        case 'inspect_file':
          result = await InspectFileTool.run(args as { path: string; query?: string });
          break;
        case 'code_map':
          result = await CodeMapTool.run(args as { path: string });
          break;
        case 'git_diff':
          result = await GitDiffTool.run(args as { path?: string });
          break;
        case 'clear_context':
          result = await ClearContextTool.run(args as { reason?: string }, agent);
          toolCache.clear();
          break;
        case 'conductor_create_track':
          result = await ConductorCreateTrackTool.run(args as { title: string });
          break;
        case 'conductor_update_plan':
          result = await ConductorUpdatePlanTool.run(args as { taskName: string; status: 'todo' | 'in_progress' | 'done' });
          break;
        case 'conductor_archive_track':
          result = await ConductorArchiveTrackTool.run(args as { reason?: string });
          break;
        case 'conductor_validate_plan':
          result = await ConductorValidatePlanTool.run(args as { confirmation: boolean });
          break;
        case 'smart_read':
          result = await SmartReadTool.run(args as { path: string; mode?: 'outline' | 'summary' });
          break;
        case 'workspace_index':
          result = await WorkspaceIndexTool.run(args as { query: string; symbolOnly?: boolean });
          break;
        case 'batch_replace':
          result = await BatchReplaceTool.run(args as { path: string; replacements: Array<{ old_text: string; new_text: string }>; allowMultiple?: boolean });
          toolCache.invalidatePath((args as { path: string }).path);
          break;
        case 'diff_preview':
          result = await DiffPreviewTool.run(args as { path: string; proposed_content: string });
          break;
        case 'project_summary':
          result = await ProjectSummaryTool.run(args as { forceRefresh?: boolean });
          break;
        case 'git_commit':
          result = await GitCommitTool.run(args as { message: string; files?: string[]; all?: boolean });
          break;
        default:
          return err(new ImaraError(ErrorCategory.UNKNOWN, 'TOOL_UNKNOWN', `Tool inconnu: ${name}`));
      }

      // Mise en cache du résultat pour les outils read-only
      if (CACHED_TOOLS.has(name)) {
        const cacheKey = toolCache.makeKey(name, args);
        toolCache.set(cacheKey, result);
      }

      return ok(result);
    } catch (reason) {
      return err(fromUnknown(reason));
    }
  }

  private static guardConductor(name: string, args?: ToolArguments): Result<void, ImaraError> {
    const dangerous = new Set(['write_file', 'append_file', 'replace_in_file', 'run_command', 'batch_replace']);
    const exempted = new Set(['git_commit']);
    if (exempted.has(name)) return ok(undefined);
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
