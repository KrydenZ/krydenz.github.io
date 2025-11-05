# Repository Branching Notes

This repository historically tracked its work on the `master` branch, but it has
since been consolidated onto the `work` branch. The tips below capture the
current state so future maintenance is clear.

## Current branches
- `work`: primary development branch that contains the latest site updates.

No other branches currently exist in the local clone or on remotes.

## What happens if `work` is deleted?
Removing the `work` branch would orphan the commits that are only reachable from
it. Unless there is another reference (such as a tag) pointing at the same
commit, the history would eventually be pruned by Git garbage collection. Any
collaborator trying to fetch or build the site would lose access to the content
stored exclusively on `work`.

## Creating a new branch for changes
To create a new branch while keeping `work` intact:

```bash
git branch feature/your-topic
```

This records a new branch pointer at the current commit without switching the
working tree. If you also want to begin working on that branch immediately,
check it out:

```bash
git checkout feature/your-topic
```

After implementing changes, push the branch and open a pull request targeting
`work` so the updates can be reviewed before merging.
