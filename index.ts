import { Probot } from "probot";
import { parse, query } from "kdljs";
import micromatch from "micromatch";
import path from "path";
import fs from "fs";
import semver from "semver";

interface PackageVersions {
  [path: string]: {
    version: string;
    changesets: Changesets;
  };
}

interface Changesets {
  added?: string[];
  changed?: string[];
  deprecated?: string[];
  removed?: string[];
  fixed?: string[];
  security?: string[];
}

interface ChangesetNode {
  name: "major" | "minor" | "patch";
  values: string[];
  properties: {
    type: "added" | "changed" | "deprecated" | "removed" | "fixed" | "security";
    package?: string;
  };
}

export default (app: Probot) => {
  // create PR if nanpa changesets exist
  app.on("push", async (context) => {
    const repo = context.repo();
    const glob = "**/.nanpa/*.kdl";
    const botLogin = context.payload.repository.owner.login;

    try {
      const baseBranch = (
        await context.octokit.repos.get({
          owner: repo.owner,
          repo: repo.repo,
        })
      ).data.default_branch;

      // list files
      const tree = await context.octokit.git.getTree({
        owner: repo.owner,
        repo: repo.repo,
        tree_sha: baseBranch,
        recursive: "true",
      });

      // get directories with .nanpa/*.kdl
      const filePaths = tree.data.tree
        .map((file) => file.path)
        .filter((x) => typeof x == "string");
      const packages = [
        ...new Set(
          micromatch(filePaths, glob).map((filePath) => {
            const parts = filePath.split("/");
            return parts.slice(0, parts.indexOf(".nanpa") + 1).join("/");
          }),
        ),
      ];

      // only get packages that aren't superpackages
      const srcPackages = packages.filter((pkg) => {
        const packagePath = path.join(pkg, ".nanpa");
        let files: string[] = [];
        try {
          files = fs.readdirSync(packagePath);
        } catch (error) {
          return false;
        }

        const matchedFiles = micromatch(files, "*.kdl");
        return matchedFiles.some((file) => {
          const filePath = path.join(packagePath, file);
          try {
            const content = parse(fs.readFileSync(filePath, "utf8")).output!;
            if ((query(content, "prop(package)") as string[]).length > 0) {
              return false;
            }
          } catch (error) {
            return false;
          }
        });
      });
      const superPackages = packages.filter((pkg) => !(pkg in srcPackages));

      const updates = srcPackages.reduce((acc: PackageVersions, pkg) => {
        let bump = 1;
        const changesets: Changesets = {};
        let version = "";
        try {
          const content = fs.readFileSync(path.join(pkg, ".nanparc"));
          version = /\bversion *(.*) *.*/.exec(content.toString())![0];
        } catch {
          return acc;
        }

        // get changesets from inside package
        const packagePath = path.join(pkg, ".nanpa");
        let files: string[] = [];
        try {
          files = fs.readdirSync(packagePath);
        } catch {
          return acc;
        }

        const matchedFiles = micromatch(files, "*.kdl");
        matchedFiles.forEach((file) => {
          const filePath = path.join(packagePath, file);
          try {
            const content = parse(fs.readFileSync(filePath, "utf8")).output!;
            for (const node of query(content, "top()") as ChangesetNode[]) {
              switch (node.name) {
                case "major":
                  bump = 3;
                  break;
                case "minor":
                  if (bump == 1) bump = 2;
                  break;
              }

              switch (node.properties.type) {
                case "added":
                  if (!changesets.added) changesets.added = [];
                  changesets.added.push(node.values[0]);
                  break;
                case "changed":
                  if (!changesets.changed) changesets.changed = [];
                  changesets.changed.push(node.values[0]);
                  break;
                case "deprecated":
                  if (!changesets.deprecated) changesets.deprecated = [];
                  changesets.deprecated.push(node.values[0]);
                  break;
                case "removed":
                  if (!changesets.removed) changesets.removed = [];
                  changesets.removed.push(node.values[0]);
                  break;
                case "fixed":
                  if (!changesets.fixed) changesets.fixed = [];
                  changesets.fixed.push(node.values[0]);
                  break;
                case "security":
                  if (!changesets.security) changesets.security = [];
                  changesets.security.push(node.values[0]);
                  break;
              }
            }
          } catch {
            return acc;
          }
        });

        // get changesets from superpackages
        superPackages.forEach((spkg) => {
          const packagePath = path.join(spkg, ".nanpa");
          let files: string[] = [];
          try {
            files = fs.readdirSync(packagePath);
          } catch {
            return acc;
          }

          const matchedFiles = micromatch(files, "*.kdl");
          matchedFiles.forEach((file) => {
            const filePath = path.join(packagePath, file);
            try {
              const content = parse(fs.readFileSync(filePath, "utf8")).output!;
              for (const node of query(content, "top()") as ChangesetNode[]) {
                if (
                  !node.properties.package ||
                  path.join(spkg, node.properties.package) !== pkg
                ) {
                  continue;
                }
                switch (node.name) {
                  case "major":
                    bump = 3;
                    break;
                  case "minor":
                    if (bump == 1) bump = 2;
                    break;
                }

                switch (node.properties.type) {
                  case "added":
                    if (!changesets.added) changesets.added = [];
                    changesets.added.push(node.values[0]);
                    break;
                  case "changed":
                    if (!changesets.changed) changesets.changed = [];
                    changesets.changed.push(node.values[0]);
                    break;
                  case "deprecated":
                    if (!changesets.deprecated) changesets.deprecated = [];
                    changesets.deprecated.push(node.values[0]);
                    break;
                  case "removed":
                    if (!changesets.removed) changesets.removed = [];
                    changesets.removed.push(node.values[0]);
                    break;
                  case "fixed":
                    if (!changesets.fixed) changesets.fixed = [];
                    changesets.fixed.push(node.values[0]);
                    break;
                  case "security":
                    if (!changesets.security) changesets.security = [];
                    changesets.security.push(node.values[0]);
                    break;
                }
              }
            } catch {
              return acc;
            }
          });
        });

        // bump version
        switch (bump) {
          case 1:
            version = semver.inc(version, "patch")!;
            break;
          case 2:
            version = semver.inc(version, "minor")!;
            break;
          case 3:
            version = semver.inc(version, "major")!;
            break;
        }

        if (
          !changesets.added &&
          !changesets.changed &&
          !changesets.deprecated &&
          !changesets.fixed &&
          !changesets.removed &&
          !changesets.security
        ) {
          return acc;
        }

        acc[pkg] = {
          version,
          changesets,
        };
        return acc;
      }, {});

      const title = `bump: ${Object.keys(updates).join(", ")}`;

      let body =
        "ilo has detected nanpa changesets files in this repository.\n" +
        `Choose which packages you wish to update from the checkboxes below, and merge this pull request to start a CI build on \`${baseBranch}\`.\n` +
        "For more information, refer to the [nanpa](https://github.com/nbsp/nanpa) and [ilo](https://github.com/nbsp/ilo) repositories.";

      Object.entries(updates).forEach((update) => {
        const [name, { version, changesets }] = update;
        body += `## \`${name}\`: ${version}\n\n`;

        if (changesets.added) {
          body += "### Added\n\n";
          changesets.added.forEach((changeset) => (body += `- ${changeset}\n`));
        }
        if (changesets.changed) {
          body += "### Changed\n\n";
          changesets.changed.forEach(
            (changeset) => (body += `- ${changeset}\n`),
          );
        }
        if (changesets.deprecated) {
          body += "### Deprecated\n\n";
          changesets.deprecated.forEach(
            (changeset) => (body += `- ${changeset}\n`),
          );
        }
        if (changesets.fixed) {
          body += "### Fixed\n\n";
          changesets.fixed.forEach((changeset) => (body += `- ${changeset}\n`));
        }
        if (changesets.removed) {
          body += "### Removed\n\n";
          changesets.removed.forEach(
            (changeset) => (body += `- ${changeset}\n`),
          );
        }
        if (changesets.security) {
          body += "### Security\n\n";
          changesets.security.forEach(
            (changeset) => (body += `- ${changeset}\n`),
          );
        }
      });

      body += "# Packages to update\n";
      for (const pkg of srcPackages) {
        body += `- [x] \`${pkg}\``;
      }

      if (packages.length > 0) {
        const openPRs = await context.octokit.pulls.list({
          owner: repo.owner,
          repo: repo.repo,
          state: "open",
        });
        const alreadyOpen = openPRs.data.find(
          (pr) => pr.user?.login === botLogin,
        );

        if (alreadyOpen) {
          await context.octokit.pulls.update({
            owner: repo.owner,
            repo: repo.repo,
            pull_number: alreadyOpen.number,
            title,
            body,
          });
        } else {
          const branch = "nanpa/bump";

          await context.octokit.git.createRef({
            owner: repo.owner,
            repo: repo.repo,
            ref: `refs/heads/${branch}`,
            sha: context.payload.after,
          });

          await context.octokit.pulls.create({
            owner: repo.owner,
            repo: repo.repo,
            head: branch,
            base: baseBranch,
            title,
            body,
          });
        }
      }
    } catch (error) {
      context.log.error(`Error processing files: ${error}`);
    }
  });

  app.on("pull_request.closed", async (context) => {
    const pullRequest = context.payload.pull_request;
    if (pullRequest.merged) {
      try {
        // Fetch the workflow id from the repository secrets
        const workflow_id = process.env.NANPA_WORKFLOW;
        if (!workflow_id) {
          context.log.error("NANPA_WORKFLOW secret is not set");
          return;
        }

        // get packages to update
        const packages = Array.from(
          /- \[x\] (.*)\n/.exec(pullRequest.body!)?.entries() || [],
        ).map((x) => x[1]);
        const inputs = {
          packages,
        };

        await context.octokit.actions.createWorkflowDispatch({
          owner: context.payload.repository.owner.login,
          repo: context.payload.repository.name,
          workflow_id,
          ref: context.payload.repository.default_branch,
          inputs,
        });
      } catch (error) {
        context.log.error(`Error dispatching workflow: ${error}`);
      }
    }
  });
};
