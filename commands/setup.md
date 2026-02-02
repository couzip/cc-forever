---
description: Initial setup for CC-Forever plugin
allowed-tools: Bash(*), Write, Read, AskUserQuestion, mcp__cc-forever-mcp__get_stats
---

# CC-Forever Setup

## Steps

### 1. Detect Installation Scope

Run this command to detect scope:

```bash
if grep -q "cc-forever" .claude/settings.local.json 2>/dev/null; then
  echo "SCOPE=local"
  echo "CONFIG_DIR=./.forever"
elif grep -q "cc-forever" .claude/settings.json 2>/dev/null; then
  echo "SCOPE=project"
  echo "CONFIG_DIR=./.forever"
else
  echo "SCOPE=user"
  echo "CONFIG_DIR=$HOME/.forever"
fi
```

Use the CONFIG_DIR from the output. **This is mandatory - do not skip or assume user scope.**

### 2. Check Existing Config

Check if config file already exists:

```bash
if [ -f "{config_dir}/config.yml" ]; then
  echo "EXISTS={config_dir}"
fi
```

Replace `{config_dir}` with the actual CONFIG_DIR from step 1.

If EXISTS is set, show this message and **stop** (do NOT proceed to model selection):

```
Already configured.

To change the embedding model, the index must be reset.
Delete the following folder and run /cc-forever:setup again:

{config_dir}

macOS/Linux: rm -rf {config_dir}
Windows:     rmdir /s /q {config_dir}
```

Replace `{config_dir}` with the **full absolute path** detected in step 1 (e.g., `/Users/john/.forever` on macOS/Linux, `C:\Users\john\.forever` on Windows).

**Important:** Do NOT proceed with model selection if config exists. End the setup here.

### 3. Select Embedding Model

Ask user:

**Select embedding model:**

1. **English (Recommended)** - `Xenova/all-MiniLM-L6-v2` (~90MB)
2. **Multilingual** - `Xenova/multilingual-e5-small` (~470MB)
3. **Japanese (Light)** - `sirasagi62/ruri-v3-30m-ONNX` (~120MB)
4. **Japanese (High Accuracy)** - `sirasagi62/ruri-v3-310m-ONNX` (~1.2GB)
5. **Custom** - Enter HuggingFace model ID

If Custom, ask for model ID.
Models: https://huggingface.co/models?library=transformers.js&pipeline_tag=feature-extraction

### 4. Auto-Index Option

Ask user:

**Enable auto-indexing?**

When enabled, conversations are automatically indexed when Claude's response completes.

1. **No (Recommended)** - Use `/cc-forever:index` to manually save conversations
2. **Yes** - Automatically index every response (may increase latency slightly)

Default: No (OFF)

### 5. Create Config

Create directory and config file at detected location:

```bash
mkdir -p {config_dir}
```

Write `{config_dir}/config.yml`:

```yaml
embeddings:
  path: {selected_model}
auto_index: {true_or_false}
```

Set `auto_index: true` only if user selected Yes in step 4. Otherwise set `auto_index: false` or omit it.

### 6. Download Model

Call `mcp__cc-forever-mcp__get_stats` to initialize the server and download the embedding model.

Tell user: "Downloading embedding model... This may take a moment on first run."

### 7. Confirmation

After successful model download, show:

```
Setup complete!

Scope: {detected_scope}
Config: {config_path}
Model: {selected_model}
Auto-index: {enabled/disabled}

Usage:
- /cc-forever:index - Save Q&A pairs
- /cc-forever:query <question> - Search past conversations
```
