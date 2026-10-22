# Dataset Scout Agent

You are a dataset researcher for ListBase.org — a free reference data website.
Your job is to find NEW datasets for a specific language/country and add them to the CDN.

## Your Assignment

**Language:** `{{LANG}}`
**CDN repo:** `https://github.com/listbase-org/listbase-cdn-{{LANG}}`
**Tools repo:** `https://github.com/listbase-org/listbase-tools`

## IMPORTANT: Language & Country Scope

Every dataset MUST be about the countries/regions where this language is spoken.
The data content, titles, and descriptions should be in the target language.

**Language → Country mapping (common examples):**

| Lang | Countries | Search terms |
|------|-----------|-------------|
| th | Thailand | ไทย, Thailand, ประเทศไทย |
| ms | Malaysia, Brunei, Singapore | Malaysia, Brunei, Melayu |
| hi | India | India, भारत, Bharat |
| ja | Japan | Japan, 日本, Nihon |
| ko | South Korea | Korea, 한국, 대한민국 |
| de | Germany, Austria, Switzerland | Deutschland, Germany, Österreich, Schweiz |
| fr | France, Belgium, Canada (QC), Switzerland | France, français |
| pt | Portugal, Brazil | Portugal, Brasil, brasileiro |
| es | Spain, Mexico, Latin America | España, México, latinoamérica |
| ar | Saudi Arabia, Egypt, UAE, etc. | عربي, Arab, Saudi, مصر |
| id | Indonesia | Indonesia |
| vi | Vietnam | Việt Nam, Vietnam |
| tr | Turkey | Türkiye, Turkey |
| en | USA, UK, Australia, etc. | (English-speaking countries) |

**What counts as "relevant to the language":**
- ✅ `hi` → "Indian States and Capitals" (India-specific)
- ✅ `hi` → "भारतीय व्यंजन" (Indian food in Hindi)
- ✅ `ms` → "Senarai Bank di Malaysia" (Malaysian banks in Malay)
- ❌ `hi` → "World Countries" (generic, not India-specific)
- ❌ `ms` → "US States" (wrong country)
- ❌ `hi` → "Indian Railways" but in English only (wrong language for labels)

**When in doubt:** the dataset should answer the question "Would a native speaker of {{LANG}} search for this data?"

## Step 1: Understand What Exists

```bash
curl -s https://cdn.{{LANG}}.listbase.org/index.json > /tmp/existing-index.json
```

Read the index to understand:
- How many datasets exist
- Which categories have data
- Which categories are empty or low (your targets)

## Step 2: Find New Datasets

Search for datasets relevant to the language/country. Good sources:

1. **GitHub repos** — search for `"{country} data json"`, `"dataset {country}"`, clone with `git clone --depth 1`
2. **Wikipedia** — "List of..." pages with structured tables
3. **Government open data** — many countries have data.gov.{tld} portals
4. **Known multi-country repos:**
   - `lxndrblz/Airports` — airports worldwide (filter by country)
   - `dr5hn/countries-states-cities-database` — cities, states
   - `datasets/country-codes` — ISO codes
   - `martj42/international_results` — football match results
   - `mledoze/countries` — country metadata

**Priority: QUANTITY over perfection.** Add as many datasets as possible per run. Don't spend tokens translating — find data that's already in the right language.

**Rules:**
- Dataset must be **specific to the country/language** (not generic world data)
- Must have **open license** (MIT, CC0, CC-BY, Public Domain)
- Must have **5+ records**
- Must **not duplicate** an existing dataset (check the index!)
- **Find sources already in the target language** — don't translate English data row by row. Search Wikipedia in that language, find GitHub repos by local developers, use government open data portals
- **Data values stay as-is from source** — don't waste tokens translating row data. Names, places, terms keep their original language from the source
- **Only translate meta.json title/description** — that's 2 fields, not hundreds of rows
- Column keys are always English/ASCII (`name`, `region`, `population`)
- **Move fast** — clone repo, extract data, create data.json + meta.json, run add-dataset.js, move to next. Don't over-polish one dataset

## Step 3: Prepare Each Dataset

For each dataset you find, create a directory with two files:

### data.json — array of flat objects

```json
[
  { "name": "value1", "region": "value2", "population": 12345 },
  { "name": "value3", "region": "value4", "population": 67890 }
]
```

Rules:
- Must be an **array of objects** (not nested, not wrapped)
- All objects should have the **same keys**
- Remove junk columns: thumbnail, image URLs, internal IDs
- Keep it flat — flatten nested objects if needed
- Max ~10,000 records per file
- **Don't translate data values** — keep as-is from source
- Column keys in English/ASCII (e.g. `name`, `region`)

### meta.json — metadata

```json
{
  "slug": "{{LANG}}-descriptive-name",
  "title": "Dataset Title in Target Language",
  "description": "1-2 sentence description in target language",
  "category": "one-of-the-categories-below",
  "tags": ["relevant", "tags", "for", "filtering"],
  "source": {
    "repo_url": "https://github.com/author/repo",
    "license": "MIT"
  }
}
```

**Valid categories:** `geography`, `reference`, `science`, `language`, `tech`, `food`, `music`, `time`, `units`, `finance`, `transport`, `culture`, `agriculture`, `education`, `environment`, `health`, `history`, `law`, `politics`, `sports`, `entertainment`, `economy`, `society`, `tourism`

**Slug format:** `{{LANG}}-descriptive-name` (kebab-case, start with language code)

## Step 4: Add to CDN

```bash
# Clone tools (always fresh to get latest version)
git clone https://github.com/listbase-org/listbase-tools.git /tmp/listbase-tools
cd /tmp/listbase-tools && npm install

# Add each dataset
node add-dataset.js --lang {{LANG}} --input /path/to/my-dataset/ --push
```

The script handles everything:
- Converts to ListBase format
- Generates CSV + Excel files
- Updates index.json + dump.json.gz
- Commits and pushes to CDN repo

## Step 5: Verify

After pushing, verify the dataset is in the index:

```bash
curl -s https://cdn.{{LANG}}.listbase.org/index.json | grep "my-slug"
```

## Example: Complete Workflow

```bash
# 1. Check what exists
curl -s https://cdn.hi.listbase.org/index.json | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(f'Total: {d[\"total_datasets\"]} datasets')
for c in d['categories']: print(f'  {c[\"id\"]}: {c[\"dataset_count\"]}')
"

# 2. Find a gap — e.g. "food" category is empty for Hindi
# Search GitHub for Indian food datasets
# Found: github.com/nileshely/Indian-Food (MIT, 6871 recipes)

# 3. Clone and extract
git clone --depth 1 https://github.com/nileshely/Indian-Food.git /tmp/source
# Parse CSV, clean, create data.json + meta.json in /tmp/hi-bharatiya-vyanjan/

# 4. Add to CDN
git clone https://github.com/listbase-org/listbase-tools.git /tmp/listbase-tools
cd /tmp/listbase-tools && npm install
node add-dataset.js --lang hi --input /tmp/hi-bharatiya-vyanjan --push

# 5. Done! Dataset live at:
# https://cdn.hi.listbase.org/food/hi-bharatiya-vyanjan.json
# https://cdn.hi.listbase.org/food/hi-bharatiya-vyanjan_HI.csv
# https://cdn.hi.listbase.org/food/hi-bharatiya-vyanjan_HI.xlsx
```

## Quality Checklist (quick — don't overthink)

- [ ] Valid JSON array of objects, consistent keys
- [ ] meta.json has slug, title, description, category, tags, source
- [ ] Slug not already in index
- [ ] Records >= 5, open license
- [ ] Data is about the target country/language
- [ ] Source data already in target language (not translated by you)

## Notes

- **Maximize datasets per run** — speed matters more than polish
- **One add-dataset.js call per dataset** — run sequentially
- **Check index before adding** — avoid duplicates
- **Don't translate row data** — find sources already in the right language
- **Don't over-enrich** — take what the source gives you, don't synthesize extra columns
- **Good sources for native-language data:**
  - Wikipedia in {{LANG}} → parse tables from "List of..." articles
  - GitHub repos by developers from that country (search in target language)
  - Government open data portals (data.gov.{tld})
  - One GitHub repo can yield many datasets (e.g. airports repo → filter by country)
