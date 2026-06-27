# ITCMD

An interactive CMD with trajectories mapped as lines. Toggleable lists are presented for radial mode pulsators, and further analysis tools are available once a line has been clicked on.

---

## Table of Contents

- [Quickstart](#quickstart)
  - [Downloading the App](#downloading-the-app)
  - [Github repo access](#pulling-github-repo)
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

### Downloading the App
Downloading the .dmg version of the app is simpler in my opinion because it will run on your machine. The setup also doesn't require you to download any data files from Zenodo as when you run the .dmg it will download the file for you. **NOTE:** Currently this is unsupported but it will come in further updates once the data is published.

1. Navigate to the "Releases" tab on the right side of the screen.
2. Find the release that you want to download and click the "ITCMD-<version-#>-arm64.dmg" to download the app.
3. Open the .dmg file on you computer. Normally, this will end up in the downloads folder.
4. Drag the app icon over to the applications folder.
5. Open a terminal and run this command to allow the app to run on your machine.
  ```
  xattr -dr com.apple.quarantine /Applications/ITCMD.app
  ```
6. Enjoy exploring the Gaia CMD!
   **NOTE:** This step is necessary to run this code. When your Mac downloads this app, it puts it in  "quarantine". You must take it out of quarantine with this command (or any other that you choose) for the app to run.
6. Run the app on your machine!

### Pulling Github repo
This method allows you to edit the code on your own machine through a browser. This method works exactly the same and the .dmg however, it is less reccomended because there are more steps to get the code up and running.

1. Go to the Zenodo page and download the .
2. Open a terminal and run:
   ```bash
   python3 -m http.server 8000
   ```
3. Open a browser and navigate to:
   ```
   http://localhost:8000/index.html
   ```
4. Enjoy exploring the Gaia CMD! 

---

## How to Use

### Overview Plot

Displays every star in the dataset. Click or drag the green rectangle to change the detail view. Scroll on the overview to grow or shrink the rectangle.

### Detail View

Shows the stars within the selected region. Drag to pan, scroll to zoom around the cursor, and use the slider to adjust line thickness.

### Zooming

- Click on the overview to recenter.
- Use **`+`** and **`−`** keys to zoom the Detail View in and out; **`0`** resets the zoom.
- To stretch one axis independently (in the Detail View or the CMD), scroll while hovering over that axis — or hold **Shift** for x-only / **Alt** for y-only zoom inside the plot.
- In the epoch-CMD dialog, the **X −/+** and **Y −/+** buttons in the header zoom each axis on its own without needing the scroll wheel.
- Dragging the CMD's axis strips pans that axis alone.

### Filters

Restrict the view to bluing (ρ > 0) or reddening (ρ < 0) systems, and tighten the significance (p-value) or correlation strength (|ρ|) thresholds. Both panels and the export honor the active filters. **Reset Filters** returns every control to the position it had when the app loaded.

### Highlight Lists

Toggle a built-in catalog (Cepheids, RR Lyrae, δ Scuti, …) to highlight its members on both plots, or use **only** to restrict the view to it. Under **Custom IDs**, use **Load ID list…** or **Paste IDs…** to supply your own list of Gaia DR3 source IDs — a bare list (one per line or comma/space separated) or a whole table with a header and extra columns like RA/DEC, which are ignored. Matching sources are highlighted in **white**.

### Inspecting a Star

Click any line in the Detail View. The app queries VizieR live for that star's Gaia DR3 epoch photometry and builds its color–magnitude diagram, with sigma clipping and a slope fit. Scroll on the CMD to zoom past clipped outliers, drag to pan, and double-click (or **Reset Zoom**) to restore the full view.

### Light Curves

The **Light Curves** button in the CMD dialog shows the raw multi-epoch photometry — G, BP, and RP magnitudes versus time plus the BP−RP color curve — after the quality cuts.

### Phase Folding

Inside the CMD dialog, the **Phase Folding** button:

- Computes generalized Lomb–Scargle periodograms for G, BP, and RP.
- Folds each light curve at its own best period.
- Multiplies the three periodograms together and folds the BP−RP color curve at the combined best period.

**Period ×2 / ÷2** re-folds everything at harmonics of the peaks — useful when the periodogram locks onto half the true period, as it often does for eclipsing binaries.

The standard grid searches down to 1-hour periods. Tick **5-min high-res grid** to extend the search to 5-minute periods with a much denser frequency grid *(slower — only needed for short-period pulsators)*.

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
| `I` | Invert the Y axis |
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
