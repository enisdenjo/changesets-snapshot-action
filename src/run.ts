import * as github from "@actions/github";
import {
  execWithOutput,
  extractPublishedPackages,
  requireChangesetsCliPkgJson,
} from "./utils";
import resolveFrom from "resolve-from";

type PublishOptions = {
  tagName: string;
  githubToken: string;
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
  githubToken,
  cwd = process.cwd(),
}: PublishOptions): Promise<PublishResult> {
  let octokit = github.getOctokit(githubToken);
  requireChangesetsCliPkgJson(cwd);

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

  if (changesetPublishOutput.code !== 0) {
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
