# Brother P-touch Label Export

This first pass does not control Brother P-touch printers directly from the browser.
Instead, the app exports clean label data that can be imported into Brother P-touch
Editor or consumed later by a desktop bridge.

The label utility in `lib/labels/p-touch.ts` generates CSV-ready payloads for:

- inventory item labels
- receiving labels
- shipping and manifest labels

Each payload includes part number, item ID, description, quantity, location/bin,
reference, date, and a barcode/QR payload string. P-touch Editor can import the
CSV and map those columns onto a saved label template.
