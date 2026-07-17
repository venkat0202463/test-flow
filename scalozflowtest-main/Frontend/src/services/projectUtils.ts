export const getProjectPrefix = (projectName?: string): string => {
  if (!projectName) return 'FT';
  const clean = projectName.trim();
  if (!clean) return 'FT';

  // Split by spaces, hyphens, or underscores
  const words = clean.split(/[\s\-_]+/);
  if (words.length >= 2) {
    const prefix = words.map(w => w.charAt(0).toUpperCase()).join('');
    return prefix.slice(0, 3); // Max 3 characters
  }

  // Single word: take first 2 letters
  if (clean.length >= 2) {
    return clean.slice(0, 2).toUpperCase();
  }
  return clean.toUpperCase() || 'FT';
};

export const getTaskCode = (taskId: number | string, projectName?: string, projectSequence?: number | string): string => {
  const prefix = getProjectPrefix(projectName);
  const codeNum = projectSequence !== undefined && projectSequence !== null ? projectSequence : taskId;
  return `${prefix}-${codeNum}`;
};
