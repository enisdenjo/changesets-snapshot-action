import * as core from "@actions/core";
import fs from "fs-extra";
import { runPublish } from "./run";
import readChangesetState from "./readChangesetState";
import { configureNpmRc, setupGitUser } from "./utils";
import * as github from "@actions/github";

(async () => {
  let githubToken = process.env.GITHUB_TOKEN;
  let npmToken = process.env.NPM_TOKEN;

  if (!githubToken) {
    core.setFailed("Please add the GITHUB_TOKEN to the changesets action");
    return;
  }

  let octokit = github.getOctokit(githubToken);

  if (!npmToken) {
    core.setFailed("Please add the NPM_TOKEN to the changesets action");
    return;
  }

  const inputCwd = core.getInput("cwd");
  if (inputCwd) {
    console.log("changing directory to the one given as the input");
    process.chdir(inputCwd);
  }

  let shouldeSetupGitUser = core.getBooleanInput("setupGitUser");

  if (shouldeSetupGitUser) {
    console.log("setting git user");
    await setupGitUser();
  }

  await configureNpmRc(npmToken);

  console.log("setting GitHub credentials");
  await fs.writeFile(
    `${process.env.HOME}/.netrc`,
    `machine github.com\nlogin github-actions[bot]\npassword ${githubToken}`
  );

  let { changesets } = await readChangesetState();
  let hasChangesets = changesets.length !== 0;

  core.setOutput("published", "false");
  core.setOutput("publishedPackages", "[]");
  core.setOutput("hasChangesets", String(hasChangesets));

  if (!hasChangesets) {
    console.log("No changesets found");
    return;
  }

  let tagName = core.getInput("tag");

  if (!tagName) {
    core.setFailed(
      "Please configure the 'tag' name you wish to use for the release."
    );

    return;
  }

  console.log(
    "No changesets found, attempting to publish any unpublished packages to npm"
  );

  const result = await runPublish({
    tagName,
    cwd: inputCwd,
  });

  console.log("Publish result:", JSON.stringify(result));

  if (result.published) {
    core.setOutput("published", "true");
    core.setOutput(
      "publishedPackages",
      JSON.stringify(result.publishedPackages)
    );
  }
})().catch((err) => {
  console.error(err);
  core.setFailed(err.message);
});
