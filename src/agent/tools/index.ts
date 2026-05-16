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
import { CodeMapTool } from './code-map.tool';
import { GitDiffTool } from './git-diff.tool';
import { ClearContextTool } from './clear-context.tool';
import { ConductorCreateTrackTool } from './conductor-create-track.tool';
import { ConductorUpdatePlanTool } from './conductor-update-plan.tool';
import { ConductorArchiveTrackTool } from './conductor-archive-track.tool';
import { ConductorValidatePlanTool } from './conductor-validate-plan.tool';

export const TOOLS_DEFINITIONS = [
  ReadFileTool.definition,
  WriteFileTool.definition,
  AppendFileTool.definition,
  ListDirectoryTool.definition,
  RunCommandTool.definition,
  SearchFilesTool.definition,
  ReadMultipleFilesTool.definition,
  WebSearchTool.definition,
  ReplaceInFileTool.definition,
  ReadFileRangeTool.definition,
  CodeMapTool.definition,
  GitDiffTool.definition,
  ClearContextTool.definition,
  ConductorCreateTrackTool.definition,
  ConductorUpdatePlanTool.definition,
  ConductorArchiveTrackTool.definition,
  ConductorValidatePlanTool.definition
];

export class ToolExecutor {
  static async execute(name: string, args: any, agent?: any) {
    const dangerousTools = ['write_file', 'append_file', 'replace_in_file', 'run_command'];
    const track = require('../../context/conductor/track-manager').TrackManager.getActive();

    if (track && !track.validated && dangerousTools.includes(name)) {
      return `BARRIÈRE CONDUCTOR : Vous tentez d'utiliser "${name}" alors que le plan du track actif n'a pas été validé par l'utilisateur. Veuillez d'abord demander l'approbation formelle (Planning -> Validation).`;
    }

    switch (name) {
      case 'read_file':
        return await ReadFileTool.run(args);
      case 'write_file':
        return await WriteFileTool.run(args);
      case 'append_file':
        return await AppendFileTool.run(args);
      case 'list_directory':
        return await ListDirectoryTool.run(args);
      case 'run_command':
        return await RunCommandTool.run(args);
      case 'search_files':
        return await SearchFilesTool.run(args);
      case 'read_multiple_files':
        return await ReadMultipleFilesTool.run(args);
      case 'web_search':
        return await WebSearchTool.run(args);
      case 'replace_in_file':
        return await ReplaceInFileTool.run(args);
      case 'read_file_range':
        return await ReadFileRangeTool.run(args);
      case 'code_map':
        return await CodeMapTool.run(args);
      case 'git_diff':
        return await GitDiffTool.run(args);
      case 'clear_context':
        return await ClearContextTool.run(args, agent);
      case 'conductor_create_track':
        return await ConductorCreateTrackTool.run(args);
      case 'conductor_update_plan':
        return await ConductorUpdatePlanTool.run(args);
      case 'conductor_archive_track':
        return await ConductorArchiveTrackTool.run(args);
      case 'conductor_validate_plan':
        return await ConductorValidatePlanTool.run(args);
      default:
        throw new Error(`Tool inconnu: ${name}`);
    }
  }
}

