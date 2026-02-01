---
description: Initial setup for CC-Forever plugin
allowed-tools: Bash(*), Write, Read, AskUserQuestion
---

# CC-Forever Setup

Configure the CC-Forever plugin for first use.

## Steps

### 1. Select Embedding Model

Ask the user to choose a model:

**Select your preferred model:**

1. **English (Recommended)** - `sentence-transformers/all-MiniLM-L6-v2`
   - Size: ~80MB
   - Lightweight and fast (txtai default)

2. **Japanese** - `cl-nagoya/ruri-v3-30m`
   - Size: ~150MB
   - Optimized for Japanese

3. **Japanese (High Accuracy)** - `cl-nagoya/ruri-v3-130m`
   - Size: ~530MB
   - Higher accuracy, larger size

### 2. Data Directory

Default: `~/.forever`

Ask if the user wants to change this.

### 3. Auto-Index Setting

Ask if the user wants to enable auto-indexing on session end:

- **OFF (Default)**: Manual indexing with `/cc-forever:index`
- **ON**: Automatically save conversations when session ends

### 4. Generate Config File

Create `~/.forever/config.yml` based on selections:

```yaml
embeddings:
  path: {selected_model}
  content: true

data_dir: ~/.forever
auto_index: false
min_pairs: 1
```

### 5. Create Directory

```bash
mkdir -p ~/.forever
```

### 6. Confirmation

Display completion message:

```
Setup complete!

Config file: ~/.forever/config.yml
Data directory: ~/.forever
Model: {selected_model}
Auto-index: {ON/OFF}

Usage:
- /cc-forever:index [N]  - Save recent N Q&A pairs (default: 1)
- /cc-forever:compact    - Summarize and save entire session
- /cc-forever:query <question> - Search past conversations
```
