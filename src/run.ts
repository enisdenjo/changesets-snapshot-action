import {
  execWithOutput,
  extractPublishedPackages,
  requireChangesetsCliPkgJson,
} from "./utils";
import resolveFrom from "resolve-from";

type PublishOptions = {
  tagName: string;
  cwd?: string;
};

type PublishedPackage = { name: string; version: string };

type PublishResult =
  | {
      published: true;
      publishedPackages: PublishedPackage[];
    }
  | {
      published: false;
    };

export async function runPublish({
  tagName,
  cwd = process.cwd(),
}: PublishOptions): Promise<PublishResult> {
  requireChangesetsCliPkgJson(cwd);

  let changesetVersionOutput = await execWithOutput(
    "node",
    [
      resolveFrom(cwd, "@changesets/cli/bin.js"),
      "version",
      "--snapshot",
      tagName,
    ],
    {
      cwd,
    }
  );

  console.log(
    changesetVersionOutput.code,
    changesetVersionOutput.stderr,
    changesetVersionOutput.stdout
  );

  if (changesetVersionOutput.code !== 0) {
    console.log(
      changesetVersionOutput.code,
      changesetVersionOutput.stderr,
      changesetVersionOutput.stdout
    );
    throw new Error(
      "Changeset command exited with non-zero code. Please check the output and fix the issue."
    );
  }

  let changesetPublishOutput = await execWithOutput(
    "node",
    [
      resolveFrom(cwd, "@changesets/cli/bin.js"),
      "publish",
      "--no-git-tag",
      "--snapshot",
      tagName,
    ],
    {
      cwd,
    }
  );

  console.log(
    changesetPublishOutput.code,
    changesetPublishOutput.stderr,
    changesetPublishOutput.stdout
  );

  if (changesetPublishOutput.code !== 0) {
    console.log(
      changesetPublishOutput.code,
      changesetPublishOutput.stderr,
      changesetPublishOutput.stdout
    );
    throw new Error(
      "Changeset command exited with non-zero code. Please check the output and fix the issue."
    );
  }

  let releasedPackages: PublishedPackage[] = [];

  for (let line of changesetPublishOutput.stdout.split("\n")) {
    let match = extractPublishedPackages(line);

    if (match === null) {
      continue;
    }

    releasedPackages.push(match);
  }

  const publishedAsString = releasedPackages
    .map((t) => `${t.name}@${t.version}`)
    .join("\n");

  const released = releasedPackages.length > 0;

  if (released) {
    console.info(
      `Published the following pakages (total of ${releasedPackages.length}): ${publishedAsString}`
    );
  } else {
    console.info(`No packages were published...`);
  }

  if (releasedPackages.length) {
    return {
      published: true,
      publishedPackages: releasedPackages,
    };
  }

  return { published: false };
}
