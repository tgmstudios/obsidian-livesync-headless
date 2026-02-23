# Contributing to Obsidian LiveSync Headless

Thank you for your interest in contributing! 🎉

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/YOUR_USERNAME/obsidian-livesync-headless/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, Node version, config)
   - Relevant logs (redact credentials!)

### Suggesting Features

1. Check [Discussions](https://github.com/YOUR_USERNAME/obsidian-livesync-headless/discussions) for similar ideas
2. Open a new discussion or issue describing:
   - The use case
   - How it would work
   - Why it's valuable

### Code Contributions

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly (especially sync compatibility)
5. Commit with clear messages: `git commit -m 'Add amazing feature'`
6. Push to your fork: `git push origin feature/amazing-feature`
7. Open a Pull Request

## Development Setup

```bash
git clone https://github.com/YOUR_USERNAME/obsidian-livesync-headless.git
cd obsidian-livesync-headless
npm install
npm run setup  # Configure for testing
npm start      # Run once
npm run daemon # Run in daemon mode
```

## Testing

Before submitting a PR:

1. Test with E2EE enabled and disabled
2. Test upload and download sync
3. Test with different vault sizes
4. Verify no credentials are logged
5. Check compatibility with official LiveSync plugin

## Code Style

- Use ESM modules (`import`/`export`)
- Async/await over promises
- Descriptive variable names
- Comments for complex logic
- Error handling for all async operations

## Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Reference issues/PRs when relevant
- Keep first line under 72 characters

## License

By contributing, you agree your contributions will be licensed under the MIT License.

## Questions?

Open a [Discussion](https://github.com/YOUR_USERNAME/obsidian-livesync-headless/discussions) or reach out!
