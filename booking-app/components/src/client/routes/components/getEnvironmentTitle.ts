export default function getEnvironmentTitle(branch?: string): string {
  const normalizedBranch = branch?.trim();
  if (!normalizedBranch || normalizedBranch.toLowerCase() === "production") {
    return "";
  }

  const branchTitle =
    normalizedBranch.charAt(0).toUpperCase() + normalizedBranch.slice(1);
  return `[${branchTitle}]`;
}
