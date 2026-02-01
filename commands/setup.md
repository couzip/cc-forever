---
description: Initial setup for CC-Forever plugin
allowed-tools: Bash(*), Write, Read, AskUserQuestion
---

# CC-Forever Setup

Configure the CC-Forever plugin for first use.

## Steps

### 1. Select Config Scope

Ask the user where to store config and data:

**Where should CC-Forever store its configuration and data?**

1. **Project-level (Recommended for project-specific memory)**
   - Config: `./.forever/config.yml`
   - Data: `./.forever/`
   - Memory is specific to this project

2. **User-level (Recommended for global memory)**
   - Config: `~/.forever/config.yml`
   - Data: `~/.forever/`
   - Memory is shared across all projects

### 2. Select Embedding Model

Ask the user to choose a model:

**Select your preferred model:**

1. **English (Recommended)** - `sentence-transformers/all-MiniLM-L6-v2`
   - Size: ~80MB
   - Lightweight and fast (txtai default)

2. **English (Q&A Optimized)** - `sentence-transformers/multi-qa-MiniLM-L6-dot-v1`
   - Size: ~80MB
   - Optimized for question-answer search

3. **Japanese** - `cl-nagoya/ruri-v3-30m`
   - Size: ~150MB
   - Optimized for Japanese

4. **Japanese (High Accuracy)** - `cl-nagoya/ruri-v3-130m`
   - Size: ~530MB
   - Higher accuracy, larger size

### 3. Auto-Index Setting

Ask if the user wants to enable auto-indexing on session end:

- **OFF (Default)**: Manual indexing with `/cc-forever:index`
- **ON**: Automatically save last Q&A when session ends

### 4. Generate Config File

Based on scope selection:

**Project-level:** Create `./.forever/config.yml`
**User-level:** Create `~/.forever/config.yml`

Config content:

```yaml
embeddings:
  path: {selected_model}
  content: true

data_dir: {./.forever or ~/.forever}
auto_index: false
```

### 5. Create Directory

```bash
mkdir -p {selected_directory}
```

### 6. Confirmation

Display completion message:

```
Setup complete!

Scope: {Project-level or User-level}
Config file: {config_path}
Data directory: {data_dir}
Model: {selected_model}
Auto-index: {ON/OFF}

Usage:
- /cc-forever:index     - Save recent Q&A pairs
- /cc-forever:compact   - Summarize and save entire session
- /cc-forever:query <question> - Search past conversations
```
