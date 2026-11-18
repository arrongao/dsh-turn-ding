# dsh-turn-ding 发布约定与流程

## 发布约定

- **每次发布新版本（即 `package.json` 的版本号发生变化）时，必须创建一个对应的 Git tag。**
- tag 命名格式：`v<version>`，例如版本 `0.1.2` 对应 tag `v0.1.2`。
- tag 使用 annotated tag（带说明信息），并推送到远程 `origin`，让版本标记随代码一起同步。
- 版本号遵循语义化版本（semver），用 `npm version patch|minor|major --no-git-tag-version` 递增，避免 npm 自动打 tag 与本约定冲突。

## 发布流程

1. 进入仓库：`cd /d/projects/arron/DSH-Plugins/dsh-turn-ding`
2. 确认认证：`npm whoami --registry=https://registry.npmjs.org/`（应为 `arrongao`）
3. 递增版本：`npm version patch --no-git-tag-version`
4. 预览打包：`npm pack --dry-run`
5. 发布：`npm publish --registry=https://registry.npmjs.org/ --access public`
6. 验证：`npm view dsh-turn-ding version --registry=https://registry.npmjs.org/`
7. 同步 `index.json` 的 `version` / `publishTimestamp` 与 `README.md` 中的版本号，然后提交推送代码和 tag：
   ```bash
   git add -A
   git commit -m "chore: publish dsh-turn-ding@<version> to npm"
   git push origin main
   git tag -a v<version> -m "release v<version>"
   git push origin v<version>
   ```

> 注意：本机 npm 默认源是 `registry.npmmirror.com`，所有发布/查询都必须显式加 `--registry=https://registry.npmjs.org/`。
> `www.npmjs.com` 网页有 CDN 缓存，版本更新可能延迟显示，以 registry 查询结果为准。

## 版本 tag 记录

- `v0.1.2` — 首个按本约定补打的 tag（对应已发布到 npmjs 的 0.1.2）
