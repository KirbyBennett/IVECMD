# ITCMD
An interactive CMD with trajectories mapped as lines. Toggleable lists are presented for radial mode pulastors and further analysis tools are available once a line has been clicked on.

# Quickstart
Unpack the .zip file to gain access to the lists of items that we are pulling our data from. Start by opening a terminal and running the command "python3 -m http.server 8000". Then, open any internet web service and run the url "http://localhost:8000/index.html". This will boot up the Interactive CMD on your own machine. Remember to press "I" after it loads all of the lists so that it inverts the y-axis!

# How to Use
Overview Plot: Displays every star in the dataset. Click or drag the green rectangle to change the detail view. Scroll on the overview to grow/shrink the rectangle.
Detail View: Shows the stars within the selected region. Drag to pan, scroll to zoom around the cursor, and use the slider to adjust line thickness.
Zooming: Click on the overview to recenter. Use + and − keys to zoom the detail view in and out, and 0 to reset. To stretch one axis independently (in the Detail View or the CMD), scroll while hovering over that axis — or hold Shift for x-only / Alt for y-only zoom inside the plot. Dragging the CMD's axis strips pans that axis alone.
Filters: Restrict the view to bluing (ρ>0) or reddening (ρ<0) systems, and tighten the significance (p-value) or correlation strength (|ρ|) thresholds. Both panels and the export honor the active filters.
Inspecting a star: Click any line in the Detail View. The app queries VizieR live for that star's Gaia DR3 epoch photometry and builds its color–magnitude diagram, with sigma clipping and a slope fit. Scroll on the CMD to zoom past clipped outliers, drag to pan, and double-click (or Reset Zoom) to restore the full view.
Light curves: The Light Curves button in the CMD dialog shows the raw multi-epoch photometry — G, BP, and RP magnitudes versus time plus the BP−RP color curve — after the quality cuts.
Phase folding: Inside the CMD dialog, the Phase Folding button computes generalized Lomb–Scargle periodograms for G, BP, and RP, folds each light curve at its own best period, multiplies the three periodograms together, and folds the BP−RP color curve at the combined best period. Period ×2 / ÷2 re-fold everything at harmonics of the peaks — useful when the periodogram locks onto half the true period, as it often does for eclipsing binaries. The standard grid searches down to 1-hour periods; tick 5-min high-res grid to extend the search to 5-minute periods with a much denser frequency grid (slower — only needed for short-period pulsators).
Searching: Paste a Gaia DR3 source ID into the Search card (or press /) to center and highlight that star.
Selecting: Click selects one star; Ctrl/Cmd+Click adds or removes stars from a multi-selection.
Saving Data: Enter a filename and use the Export card to download the visible, selected, or filtered sources as CSV, or either panel as a PNG.
Keyboard shortcuts
F fit all data in the Detail View · 0 reset to the default window
+/− zoom the detail window · I invert the Y axis
/ focus the search box · H toggle this help
S export the current selection · Esc clear selection / close dialogs
Ctrl/Cmd+Z undo view · Ctrl/Cmd+Shift+Z redo view

What am I looking at?

Each line segment represents one star observed many times by ESA's Gaia space telescope. The horizontal axis is the star's color (GBP−GRP, blue→red), and the vertical axis is its absolute brightness (GMAG). A star that varies traces a small path in this diagram: the segment shows the direction and size of that path.

Blue lines are stars that get bluer as they brighten; red lines get redder as they brighten. Bolder, more opaque lines have a more statistically significant correlation (smaller Spearman p-value).

For astronomers
Source list: Gaia DR3 epoch photometry (VizieR I/355/epphot), filtered to ρ ≠ 0 and ≥ 6 epochs. Clicking a source runs: flux→mag error propagation, distance modulus from DR3 parallax, iterative 4σ flux clip, SNR > 1 cut on G/BP/RP, an std-ratio slope-stability clip (10% threshold), and an unweighted linear fit to the kept epochs.

Serving this file
For the dataset to auto-load and VizieR queries to work smoothly, serve this folder over HTTP, e.g. python3 -m http.server 8000 then open http://localhost:8000/index.html. If opened directly from disk, you can drag & drop or browse for the data table instead.
