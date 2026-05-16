import * as path from 'path';

export const PROTECTED_FILES = [
  '.env.production',
  '.env.local',
  '.ssh/id_rsa',
  '.aws/credentials',
];

export function isInsideCwd(filePath: string): boolean {
  const absolutePath = path.resolve(filePath);
  const cwd = process.cwd();
  return absolutePath.startsWith(cwd);
}

export function isProtectedFile(filePath: string): boolean {
  const relativePath = path.relative(process.cwd(), filePath);
  return PROTECTED_FILES.some(p => relativePath.includes(p));
}

export function resolveProjectPath(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}
