import { exec } from "@actions/exec";
import resolveFrom from "resolve-from";

export async function execWithOutput(
  command: string,
  args?: string[],
  options?: { ignoreReturnCode?: boolean; cwd?: string }
) {
  let myOutput = "";
  let myError = "";

  return {
    code: await exec(command, args, {
      listeners: {
        stdout: (data: Buffer) => {
          myOutput += data.toString();
        },
        stderr: (data: Buffer) => {
          myError += data.toString();
        },
      },

      ...options,
    }),
    stdout: myOutput,
    stderr: myError,
  };
}

export function extractPublishedPackages(
  line: string
): { name: string; version: string } | null {
  let newTagRegex = /New tag:\s+(@[^/]+\/[^@]+|[^/]+)@([^\s]+)/;
  let match = line.match(newTagRegex);

  if (match === null) {
    let npmOutRegex = /\+?\s+(@[^/]+\/[^@]+|[^/]+)@([^\s]+)/;
    match = line.match(npmOutRegex);
  }

  if (match) {
    const [, name, version] = match;
    return { name, version };
  }

  return null;
}

export const requireChangesetsCliPkgJson = (cwd: string) => {
  try {
    return require(resolveFrom(cwd, "@changesets/cli/package.json"));
  } catch (err) {
    if (err && (err as any).code === "MODULE_NOT_FOUND") {
      throw new Error(
        `Have you forgotten to install \`@changesets/cli\` in "${cwd}"?`
      );
    }
    throw err;
  }
};
