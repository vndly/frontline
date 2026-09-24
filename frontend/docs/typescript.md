# TypeScript Rules

## Style

- Do not use semicolons
- Do not use object shorthand: write `{code: code}`, not `{code}` (enforced by `object-shorthand: ['error', 'never']`)
- Require curly braces for all control flow statements, even single-line blocks (enforced by `curly: ['error', 'all']`)
- One class per file
- Unused parameters: use `_`, `__`, `___`, etc. (enforced by `@typescript-eslint/no-unused-vars`)

## Naming

- Files: `snake_case`
- Classes, interfaces, type aliases: `PascalCase`
- Functions: `camelCase`
- Variables: full descriptive names, avoid abbreviations
  - Allowed: `i`, `j` (loop counters)
  - Avoid: `p` (player), `s` (state), `c` (code), `el` (element), `btn` (button), `msg` (message), etc.

## Types

- `strict` and `noUncheckedIndexedAccess` are on and stay on. Do not add `any` to silence an error — this project has no test suite, so the type checker and the type-aware lint rules are the only automated safety net.
- Indexing a `Record` or array yields `T | undefined`. Handle the miss (`?? fallback`) rather than asserting it away with `!`.
- Use `import type` for type-only imports (enforced by `@typescript-eslint/consistent-type-imports` and required by `verbatimModuleSyntax`).

## Imports

Always use the `@` path alias (mapped to `src/`). No relative paths (`./`, `../`). No file extensions.

## Getters

Prefer getters over methods for parameterless functions that only read instance state and return a computed value (no side effects).

## Comment Conventions

**Class Level** — JSDoc block describing purpose:

```typescript
/**
 * Brief description of class purpose.
 * Additional context about its role in the architecture.
 */
class ClassName {
```

**Function Level** — JSDoc with parameters and return description (no types; TypeScript already declares them):

```typescript
/**
 * Brief description of what the method does.
 * @param paramName - Description
 * @returns Description
 */
methodName(paramName: string): number {
```

**Field Level** — Inline end-of-line comment on first declaration (no semicolons):

```typescript
this.code = code // Active 4-character room code
this.turnCount = 1 // 1-based turn counter
```

**Code Block Level** — Plain comments for complex logic:

```typescript
// Check expected turn count before advancing to prevent stale writes
```
