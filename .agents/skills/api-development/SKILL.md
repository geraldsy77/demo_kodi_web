---
name: api-development
description: Implement maintainable TypeScript API endpoints using route-controller-service-repository separation, validated input, stable errors, and automated tests.
---

# API Development

## Layering
`route -> controller -> service -> repository -> database`

## Workflow
1. Confirm endpoint contract from the ticket/docs.
2. Add input validation.
3. Implement service behavior.
4. Implement repository query if data access is needed.
5. Map DB rows to stable DTOs.
6. Return consistent errors.
7. Add tests.
8. Run lint/test/build.

## API rules
- Never return raw DB connection/SQL errors to clients.
- Validate IDs, pagination, search lengths, and enum-like inputs.
- Use reasonable default/max page sizes.
- Keep HTTP concerns out of repositories.
- Keep SQL out of controllers.
- Avoid unnecessary global state.

## Error format
```json
{
  "error": {
    "code": "CODE",
    "message": "Readable message"
  }
}
```
