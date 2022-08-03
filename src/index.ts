import * as core from "@actions/core";
import fs from "fs-extra";
import * as gitUtils from "./gitUtils";
import { runPublish } from "./run";
import readChangesetState from "./readChangesetState";

(async () => {
  let githubToken = process.env.GITHUB_TOKEN;
  let npmToken = process.env.NPM_TOKEN;

  if (!githubToken) {
    core.setFailed("Please add the GITHUB_TOKEN to the changesets action");
    return;
  }

  if (!npmToken) {
    core.setFailed("Please add the NPM_TOKEN to the changesets action");
    return;
  }

  const inputCwd = core.getInput("cwd");
  if (inputCwd) {
    console.log("changing directory to the one given as the input");
    process.chdir(inputCwd);
  }

  let setupGitUser = core.getBooleanInput("setupGitUser");

  if (setupGitUser) {
    console.log("setting git user");
    await gitUtils.setupUser();
  }

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

  let userNpmrcPath = `${process.env.HOME}/.npmrc`;

  if (fs.existsSync(userNpmrcPath)) {
    console.log("Found existing user .npmrc file");
    const userNpmrcContent = await fs.readFile(userNpmrcPath, "utf8");
    const authLine = userNpmrcContent.split("\n").find((line) => {
      // check based on https://github.com/npm/cli/blob/8f8f71e4dd5ee66b3b17888faad5a7bf6c657eed/test/lib/adduser.js#L103-L105
      return /^\s*\/\/registry\.npmjs\.org\/:[_-]authToken=/i.test(line);
    });
    if (authLine) {
      console.log(
        "Found existing auth token for the npm registry in the user .npmrc file"
      );
    } else {
      console.log(
        "Didn't find existing auth token for the npm registry in the user .npmrc file, creating one"
      );
      fs.appendFileSync(
        userNpmrcPath,
        `\n//registry.npmjs.org/:_authToken=${npmToken}\n`
      );
    }
  } else {
    console.log("No user .npmrc file found, creating one");
    fs.writeFileSync(
      userNpmrcPath,
      `//registry.npmjs.org/:_authToken=${npmToken}\n`
    );
  }

  console.log(
    "No changesets found, attempting to publish any unpublished packages to npm"
  );

  const result = await runPublish({
    tagName,
    githubToken,
    cwd: inputCwd,
  });

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
