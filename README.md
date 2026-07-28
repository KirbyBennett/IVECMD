# ITCMD

An interactive CMD with trajectories mapped as lines. Toggleable lists are presented for radial mode pulsators, and further analysis tools are available once a line has been clicked on.

---

## Table of Contents

- [Quickstart](#quickstart)
- [How to Use](#how-to-use)
  - [Overview Plot](#overview-plot)
  - [Detail View](#detail-view)
  - [Zooming](#zooming)
  - [Filters](#filters)
  - [Inspecting a Star](#inspecting-a-star)
  - [Light Curves](#light-curves)
  - [Phase Folding](#phase-folding)
  - [Searching](#searching)
  - [Selecting](#selecting)
  - [Saving Data](#saving-data)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
- [What Am I Looking At?](#what-am-i-looking-at)
- [For Astronomers](#for-astronomers)
- [Serving This File](#serving-this-file)

---

## Quickstart

1. Unpack the `.zip` file to gain access to the data lists.
2. Open a terminal and run:
   ```bash
   python3 -m http.server 8000
   ```
3. Open a browser and navigate to:
   ```
   http://localhost:8000/index.html
   ```
4. The diagram opens with the Y-axis already inverted (the conventional CMD
   orientation).

---

## How to Use

### Overview Plot

A fixed map of every star that passes the active filters. The green rectangle marks the region shown in the Detail View and follows it as you pan and zoom the Detail View — it can even slide off the edge of the overview. Use **Center Detail View** in the Actions card to bring it back to the middle.

### Detail View

Shows the stars within the selected region. Drag to pan, scroll to zoom around the cursor, and use the slider to adjust line thickness.

### Zooming

- Use **`+`** and **`−`** keys to zoom the Detail View in and out; **`0`** resets the zoom.
- To stretch one axis independently (in the Detail View or the CMD), scroll while hovering over that axis — or hold **Shift** for x-only / **Alt** for y-only zoom inside the plot.
- The Detail View and the epoch CMD have floating **X −/+** and **Y −/+** buttons in their top-right corners that zoom each axis on its own without needing the scroll wheel.
- Dragging the CMD's axis strips pans that axis alone.

### Filters

Restrict the view to bluing (ρ > 0) or reddening (ρ < 0) systems, and tighten the significance (p-value) or correlation strength (|ρ|) thresholds. A parallax-quality cut and a distance range are also available — the min and max distance share a single dual-thumb slider whose thumbs can't pass each other (an inline message appears if they touch). Both panels and the export honor the active filters. **Reset Filters** returns every control to the position it had when the app loaded.

### Highlight Lists

Toggle a built-in catalog (Cepheids, RR Lyrae, δ Scuti, …) to highlight its members on both plots, or use **only** to restrict the view to it. Under **Custom IDs**, use **Load ID list…** or **Paste IDs…** to supply your own list of Gaia DR3 source IDs — a bare list (one per line or comma/space separated) or a whole table with a header and extra columns like RA/DEC, which are ignored. Matching sources are highlighted in **white**.

### Inspecting a Star

Click any line in the Detail View. The app queries VizieR live for that star's Gaia DR3 epoch photometry and builds its color–magnitude diagram, with sigma clipping and a slope fit. If VizieR's TAP service is down (it has occasional outages), the app automatically falls back to the ESA Gaia archive for the same data — the CMD status bar notes `data: ESA Gaia archive` when this happens. Scroll on the CMD to zoom past clipped outliers, drag to pan, and double-click (or **Reset Zoom**) to restore the full view.

### Light Curves

The **Light Curves** button in the CMD dialog shows the raw multi-epoch photometry — G, BP, and RP magnitudes versus time plus the BP−RP color curve — after the quality cuts. Every panel is interactive: drag to pan, scroll to zoom about the cursor (**Shift** x-only, **Alt** y-only), and double-click to reset that panel. The same applies to each periodogram and folded panel in the Phase Folding dialog.

### Phase Folding

Inside the CMD dialog, the **Phase Folding** button:

- Computes generalized Lomb–Scargle periodograms for G, BP, and RP.
- Folds each light curve at its own best period.
- Multiplies the three periodograms together and folds the BP−RP color curve at the combined best period.

**Period ×2 / ÷2** re-folds everything at harmonics of the peaks — useful when the periodogram locks onto half the true period, as it often does for eclipsing binaries.

The standard grid searches down to 1-hour periods. Tick **high-res freq grid** to extend the search to 5-minute periods with a much denser frequency grid *(slower — only needed for short-period pulsators)*.

### Searching

Paste a Gaia DR3 source ID into the **Search** card (or press **`/`**) to center and highlight that star.

### Selecting

- **Click** — selects one star.
- **Ctrl/Cmd + Click** — adds or removes stars from a multi-selection.

### Saving Data

Enter a filename and use the **Export** card to download the visible, selected, or filtered sources as CSV, or either panel as a PNG.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F` | Fit all data in the Detail View |
| `0` | Reset to the default window |
| `+` / `−` | Zoom the Detail View in / out |
| `/` | Focus the search box |
| `H` | Toggle this help |
| `S` | Export the current selection |
| `Esc` | Clear selection / close dialogs |
| `Ctrl/Cmd + Z` | Undo view |
| `Ctrl/Cmd + Shift + Z` | Redo view |

---

## What Am I Looking At?

Each line segment represents one star observed many times by ESA's Gaia space telescope.

- The **horizontal axis** is the star's color (G_BP − G_RP, blue → red).
- The **vertical axis** is its absolute brightness (G_MAG).

A star that varies traces a small path in this diagram — the segment shows the **direction and size** of that variation.

- 🔵 **Blue lines** — stars that get bluer as they brighten.
- 🔴 **Red lines** — stars that get redder as they brighten.
- **Bolder, more opaque lines** have a more statistically significant correlation (smaller Spearman p-value).

---

## For Astronomers

> **Source list:** Gaia DR3 epoch photometry ([VizieR I/355/epphot](https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=I/355/epphot)), filtered to ρ ≠ 0 and ≥ 6 epochs.

Clicking a source runs the following pipeline:

1. Flux → magnitude error propagation
2. Distance modulus from DR3 parallax
3. Iterative 4σ flux clip
4. SNR > 1 cut on G / BP / RP
5. Std-ratio slope-stability clip (10% threshold)
6. Unweighted linear fit to the kept epochs

---

## Serving This File

For the dataset to auto-load and VizieR queries to work smoothly, serve this folder over HTTP:

```bash
python3 -m http.server 8000
```

Then open:

```
http://localhost:8000/index.html
```

> **Note:** If opened directly from disk, you can drag & drop or browse for the data table instead.
