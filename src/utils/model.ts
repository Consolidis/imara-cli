export function isNativeModel(modelName?: string): boolean {
  if (!modelName) return true;
  const lower = modelName.toLowerCase();
  return ['zuri', 'standard', 'flash', 'imara-zuri', 'imara', 'imara-flash'].includes(lower);
}
