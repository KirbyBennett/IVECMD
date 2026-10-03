# IVECMD

Welcome to IVECMD! We are so excited to publish this software and allow the scientific community to get hands on with the app. We hope you enjoy the Interactive Variability-Encoded CMD as much as as we have! Clear skies and happy exploring!

---

## Table of Contents

- [Quickstart](#quickstart)
  - [Downloading the App (macOS)](#downloading-the-app-recommended)
  - [Downloading the App (Windows)](#downloading-the-app-windows)
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

### Downloading the App (Recommended)
*macOS — Windows users, see [the next section](#downloading-the-app-windows).*

Downloading the .dmg version of the app is less work in the long run. The setup also doesn't require you to download any data files from Zenodo — the first time you run the app it fetches them for you.

1. Navigate to the "Releases" tab on the right side of the screen.
2. Find the release that you want to download and click the "IVECMD-<version-#>-arm64.dmg" to download the app.
3. Open the .dmg file on you computer. Normally, this will end up in the downloads folder.
4. Drag the app icon over to the applications folder.
5. Open a terminal and run this command to allow the app to run on your machine.
  ```
  xattr -dr com.apple.quarantine /Applications/IVECMD.app
  ```
**NOTE:** This step is necessary to run this code. When your Mac downloads this app, it puts it in  "quarantine". You must take it out of quarantine with this command (or any other that you choose) for the app to run.

6. Run the app on your machine and enjoy exploring the Gaia CMD!

### Downloading the App (Windows)
The Windows installer needs the same one-time data download as the Mac app (see [First launch](#first-launch-both-platforms)), and it is not code-signed, so Windows will warn you the first time you run it. That is expected — here is how to get past it.

1. Navigate to the "Releases" tab on the right side of the screen.
2. Find the release that you want and, under **Assets**, click the Windows installer (`IVECMD Setup <version-#>.exe`) to download it. (GitHub may show the spaces as dots, e.g. `IVECMD.Setup.<version-#>.exe`.) The installer is for 64-bit Windows.
3. Your browser may say the file "isn't commonly downloaded" or "could be dangerous". In Edge or Chrome, open the downloads list, click the **⋯** next to the file and choose **Keep**, then **Keep anyway**.
4. Double-click the installer. If Windows shows **"Windows protected your PC"** (SmartScreen), click **More info**, then **Run anyway**.
5. Follow the setup wizard. You can change the install folder, and it creates Desktop and Start Menu shortcuts. It installs for your user only, so no administrator rights are needed.
6. Launch **IVECMD** from the Start Menu or Desktop and enjoy exploring the Gaia CMD!

**If the installer won't open at all** (nothing happens, or SmartScreen offers no **Run anyway** button), Windows has marked the download as coming from the internet — the same "quarantine" idea as on a Mac. Remove the mark with either of these:

- **File Explorer:** right-click the `.exe` → **Properties** → tick **Unblock** at the bottom of the General tab → **OK**.
- **PowerShell** (adjust the path to wherever the file is):
  ```powershell
  Unblock-File -Path "$env:USERPROFILE\Downloads\IVECMD Setup <version-#>.exe"
  ```

**If antivirus or Windows Security blocks or deletes the file**, it is reacting to the missing signature, not to anything in the app. Restore it from **Windows Security → Virus & threat protection → Protection history** (choose **Allow on device**), or add the Downloads folder as an exclusion while you install, then run the installer again. Only do this for an installer you downloaded from this repository's Releases page.

**Corporate or school computers** may block unsigned installers through policy; if **Run anyway** never appears and Unblock doesn't help, ask your IT department, or use the [GitHub repo method](#pulling-github-repo) below, which needs no installer.

### First launch (both platforms)

The first time the app opens it has no data yet, so it downloads `lists.zip`
(about 1.75 GB) from Zenodo, checks it against the record's MD5 and unpacks it
to roughly 4 GB. Expect a couple of minutes on a fast connection; a progress bar
shows the download, the check and the extraction. That only happens once — every
launch after that goes straight to the diagram.

- **Quitting mid-download is safe.** The next launch resumes from where it
  stopped rather than starting over, and dropped connections are retried
  automatically.
- **The archive is deleted after unpacking**, so only the ~4 GB of data tables
  stay on disk.
- **Already have `lists.zip`?** Put it in your **Downloads** folder before
  opening the app and it will use that instead of downloading anything. A copy
  you supplied is left in place.
- If anything goes wrong the app says why and offers **Try again**.

Data source: [10.5281/zenodo.20931723](https://doi.org/10.5281/zenodo.20931723).

### Pulling Github repo
This method allows you to edit the code on your own machine through a browser. This method works exactly the same and the .dmg however, there are more steps to get the code up and running.

1. Go to the [Zenodo record](https://doi.org/10.5281/zenodo.20931723),
   download `lists.zip` and unzip it next to `index.html`. (The browser version
   has no downloader of its own — that lives in the Electron app.)
2. Open a terminal and run:
   ```bash
   python3 -m http.server 8000
   ```
3. Open a browser and navigate to:
   ```
   http://localhost:8000/index.html
   ```
4. The diagram opens with the Y-axis already inverted (the conventional CMD
   orientation). Enjoy exploring the Gaia CMD!

---

## How to Use

### Overview Plot

A fixed map of every star that passes the active filters. The green rectangle marks the region shown in the Detail View — drag it around the overview to move the Detail View, and it also follows along as you pan and zoom the Detail View itself. It can even slide off the edge of the overview; use **Center Detail View** in the Actions card to bring it back to the middle.

### Detail View

Shows the stars within the selected region. Drag to pan, scroll to zoom around the cursor, and use the slider to adjust line thickness.

### Zooming

- Use **`+`** and **`−`** keys to zoom the Detail View in and out; **`0`** resets the zoom.
- To stretch one axis independently (in the Detail View or the CMD), scroll while hovering over that axis — or hold **Shift** for x-only / **Alt** for y-only zoom inside the plot.
- The Detail View and the epoch CMD have floating **X −/+** and **Y −/+** buttons in their top-right corners that zoom each axis on its own without needing the scroll wheel.
- Dragging the CMD's axis strips pans that axis alone.

### Filters

Restrict the view to bluing (ρ > 0) or reddening (ρ < 0) systems, and tighten the significance (p-value) or correlation strength (|ρ|) thresholds. The **Slope** slider keeps lines within a range of steepness |m|, the slope of each star's least-squares fit of G against BP−RP, from 0 (flat — only the color changes) to ∞ (vertical — only the brightness changes); its stops are spaced evenly in the line's angle, so the middle of the track is slope 1, and hovering a line in the Detail View shows its slope. A parallax-quality cut, a distance range and a galactic-latitude |b| range are also available. Each range is a single dual-thumb slider whose thumbs can't pass each other (an inline message appears if they touch). Both panels and the export honor the active filters. **Reset Filters** returns every control to the position it had when the app loaded.

### Highlight Lists

Toggle a built-in catalog (Cepheids, RR Lyrae, δ Scuti, …) to highlight its members on both plots, or use **only** to restrict the view to it. Under **Custom IDs**, use **Load ID list…** or **Paste IDs…** to supply your own list of Gaia DR3 source IDs — a bare list (one per line or comma/space separated) or a whole table with a header and extra columns like RA/DEC, which are ignored. Matching sources are highlighted in **white**.

### Inspecting a Star

Click any line in the Detail View. The app queries VizieR live for that star's Gaia DR3 epoch photometry and builds its color–magnitude diagram, with sigma clipping and a slope fit. If VizieR's TAP service is down (it has occasional outages), the app automatically falls back to the ESA Gaia archive for the same data — the CMD status bar notes `data: ESA Gaia archive` when this happens. Scroll on the CMD to zoom past clipped outliers, drag to pan, and double-click (or **Reset Zoom**) to restore the full view.

### Light Curves

The **Light Curves** button in the CMD dialog shows the raw multi-epoch photometry — G, BP, and RP magnitudes versus time plus the BP−RP color curve — after the quality cuts. Every panel is interactive: drag to pan, scroll to zoom about the cursor (**Shift** x-only, **Alt** y-only), and double-click to reset that panel. **Reset Views** in the dialog header returns every panel to its auto-fit view at once. The same applies to each periodogram and folded panel in the Phase Folding dialog.

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
- The **vertical axis** is its absolute brightness (M_G).

A star that varies traces a small path in this diagram — the segment is the **straight line that best fits** that path (its `B-R_Slope`, from the pipeline's least-squares fit), drawn across the range of color it covers.

- 🔵 **Blue lines** — stars that get bluer as they brighten.
- 🔴 **Red lines** — stars that get redder as they brighten.
- **Bolder, more opaque lines** have a more statistically significant correlation (smaller Spearman p-value). They are also drawn *on top*, so a significant source is never buried under the faint ones — and because the stacking depends only on each source's own significance, it stays put as you pan the Detail View or nudge a filter.

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

## AI Statement

Generative AI was used to generate the code for this project. The models used to generate the code were Claude Fable 5, Opus 5, and Opus 5.5. The code's function modeled directly from human coded Python algorithms and important analyses features (periodograms, sigma-clipping, etc.) was checked against these existing codes. 
