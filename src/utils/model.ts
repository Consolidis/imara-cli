export function isNativeModel(modelName?: string): boolean {
  if (!modelName) return true;
  const lower = modelName.toLowerCase();
  return ['zuri', 'standard', 'flash', 'pro', 'imara-zuri', 'imara', 'imara-flash', 'imara-pro'].includes(lower);
}
