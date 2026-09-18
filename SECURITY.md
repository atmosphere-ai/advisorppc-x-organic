# Security

- Tokens live in env (`X_ACCESS_TOKEN`) or the `Authorization` header — never in git, HTML, or skill files.
- Post / reply / quote / repost / DM send / delete / hide require `confirm=true` after a named user ask.
- Media upload failure must not fall back to another asset.
- Do not log raw DM bodies to public places.
- Report vulnerabilities privately via the GitHub security advisory on this repository. Do not file public issues for token leaks.
