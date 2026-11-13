# Mode dodo — d11–d30 (incremental)

## Pipeline

Rerun whenever new ChatGPT images or Suno MP3s land:

```bash
/workspace/dodo-art2/integrate.sh           # images + songs + align
/workspace/dodo-art2/integrate.sh --no-align
```

Sources:

- Images: `/workspace/dodo-art2/<id>/{cover,1..6}.png`
- Songs: `/workspace/dodo-songs2/<slug>-v{1,2}.mp3` (112 kb/s after encode)
- Lyrics: `/workspace/dodo-suno.json` entries 11…30
- Align: `scripts/align-dodo.py` + `/workspace/align-venv` (`--separate`)

Rules:

- Illustrations appear in `BUNDLED_DODO_IMAGES` as soon as the JPGs exist.
- A story becomes musical (`MUSICAL_STORIES`) only when cover.webp + both MP3s + both timing JSON exist.
- Incomplete stories keep the procedural NightScene fallback.

## Sizes

- Cover WebP and scene JPG: 1344×756 (same as d01–d10).
- MP3: 112 kb/s libmp3lame.
