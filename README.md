# ListBase Tools

CLI tools for managing [ListBase](https://listbase.org) CDN repos.

## Setup

```bash
git clone https://github.com/listbase-org/listbase-tools.git
cd listbase-tools
npm install
```

## add-dataset

Add a new dataset to a CDN repo. Handles everything: format conversion, CSV/Excel generation, index/dump updates, and git commit.

### Input

Prepare a directory with two files:

```
my-dataset/
├── data.json    ← array of objects
└── meta.json    ← metadata
```

**data.json** — array of flat objects:
```json
[
  { "name": "Nasi Lemak", "region": "National", "type": "Rice" },
  { "name": "Roti Canai", "region": "National", "type": "Bread" }
]
```

**meta.json** — dataset metadata:
```json
{
  "slug": "ms-makanan-tradisional",
  "title": "Makanan Tradisional Malaysia",
  "description": "Senarai makanan tradisional Malaysia",
  "tags": ["food", "malaysia", "makanan"],
  "source": {
    "repo_url": "https://github.com/example/repo",
    "license": "CC-BY-4.0"
  }
}
```

### Usage

```bash
# Add to local CDN repo
node add-dataset.js --lang ms --input ./my-dataset/ --repo ../listbase-cdn-ms

# Auto-clone CDN repo + add + push
node add-dataset.js --lang ms --input ./my-dataset/ --push

# Auto-clone + add + create PR (with auto-merge)
node add-dataset.js --lang ms --input ./my-dataset/ --pr
```

### What it does

1. Clones `listbase-cdn-{lang}` (or uses `--repo`)
2. Validates data.json + meta.json
3. Infers category from tags (or uses meta.category)
4. Generates `{slug}.json` (ListBase format)
5. Generates `{slug}_{LANG}.csv` + `{slug}_{LANG}.xlsx`
6. Updates `index.json` + `dump.json.gz`
7. Commits (+ push or PR)

### For AI Agents

```markdown
## To add a new dataset:

1. git clone https://github.com/listbase-org/listbase-tools.git /tmp/listbase-tools
2. cd /tmp/listbase-tools && npm install
3. Prepare data.json + meta.json in a directory
4. node add-dataset.js --lang {lang} --input {dir} --pr
```

## Project Structure

```
listbase-tools/
├── add-dataset.js          ← Main CLI entry point
├── lib/
│   ├── convert.js          ← Category inference, column detection, data flattening
│   ├── generate-files.js   ← CSV + Excel generation
│   └── index-utils.js      ← index.json + dump.json.gz management
├── package.json
└── README.md
```

## License

MIT
