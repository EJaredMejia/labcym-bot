# Coding Guidelines & Preferences

## Code Structure & Quality
- **Always use early returns (guard clauses)** instead of deeply nested `if` statements or checking for "happy paths".
- Check for errors, missing values, or invalid conditions first and return early.
- Keep the main execution flow linear and at the lowest nesting level possible.
